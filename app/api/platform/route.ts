import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { supabase, workerClient, locale } from "@/lib/supabase";
import { REGIONS, isAdmin, memberRoles, type Profile } from "@/lib/domain";
import { rateLimit, RateLimitUnavailableError } from "@/lib/security";
import { drainEmails } from "@/lib/emails";
import { fallbackInstructions } from "@/lib/payments";
import { errorMessage } from "@/lib/errors";
// Short-lived, caller-scoped cache. Authorization/RLS are checked on every request.
const avatarLinks = new Map<string, { url: string; expires: number }>();
async function signAvatars(
  db: Awaited<ReturnType<typeof supabase>>,
  caller: string,
  paths: string[],
) {
  const now = Date.now();
  for (const [key, item] of avatarLinks)
    if (item.expires <= now) avatarLinks.delete(key);
  const missing = paths.filter((path) => !avatarLinks.has(`${caller}:${path}`));
  if (missing.length) {
    const { data, error } = await db.storage
      .from("profile-photos")
      .createSignedUrls(missing, 900);
    check(error);
    for (const item of data || []) {
      if (item.path && item.signedUrl) {
        if (avatarLinks.size >= 500)
          avatarLinks.delete(avatarLinks.keys().next().value!);
        avatarLinks.set(`${caller}:${item.path}`, {
          url: item.signedUrl,
          expires: now + 600000,
        });
      }
    }
  }
  return new Map(
    paths.map((path) => [
      path,
      avatarLinks.get(`${caller}:${path}`)?.url || null,
    ]),
  );
}
const uuid = z.string().uuid();
const short = z.string().trim().min(2).max(200);
const phone = z.string().trim().min(6).max(30);
const region = z.enum(REGIONS);
class ForbiddenError extends Error {}
class ConflictError extends Error {}
class ConfigurationError extends Error {}
const adminInvite = z.object({
  full_name: short,
  email: z.email().max(254),
  phone,
  city: short,
  region,
  locale: z.enum(["fr", "en"]).default("fr"),
});
const reg = z
  .object({
    full_name: short,
    email: z.email().max(254),
    phone,
    city: short,
    region,
    requested_role: z.enum(memberRoles),
    motivation: z.string().trim().min(10).max(5000),
    password: z.string().min(12).max(128),
    confirmation: z.string(),
    terms: z.literal(true),
    locale: z.enum(["fr", "en"]),
  })
  .refine((d) => d.password === d.confirmation, {
    path: ["confirmation"],
    message: "Passwords must match",
  });
async function actor(db: Awaited<ReturnType<typeof supabase>>) {
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) throw new Error("Authentication required");
  const { data: p, error: e } = await db
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single();
  if (e || !p) throw new Error("Profile unavailable");
  return p as Profile;
}
function assertAdmin(p: Profile) {
  if (p.status !== "approved" || !isAdmin(p.role))
    throw new ForbiddenError("Forbidden");
}
function check(e: { message: string } | null) {
  if (e) throw new Error(e.message);
}
export async function GET(req: NextRequest) {
  try {
    const db = await supabase();
    const p = await actor(db);
    const view = req.nextUrl.searchParams.get("view") || "overview";
    let data: unknown = {};
    const query = async (
      table: string,
      filter?: [string, string],
      order = "created_at",
    ) => {
      let q = db
        .from(table)
        .select("*")
        .order(order, { ascending: false })
        .limit(200);
      if (filter) q = q.eq(...filter);
      const { data, error } = await q;
      check(error);
      return data;
    };
    if (view.startsWith("admin/")) assertAdmin(p);
    switch (view) {
      case "overview":
        data = {
          history: await query("points_history", ["user_id", p.id]),
          rewards: await query("rewards", ["user_id", p.id]),
        };
        break;
      case "profile":
        data = p;
        break;
      case "reports":
        data = await query("reports", ["user_id", p.id]);
        break;
      case "groups":
        data = await query("groups");
        break;
      case "rewards":
        if (p.role === "super_admin")
          throw new ForbiddenError("Super Admin does not receive rewards");
        data = await query("rewards", ["user_id", p.id]);
        break;
      case "messages": {
        if (p.status !== "approved")
          throw new Error("Approved account required");
        const id = uuid.parse(req.nextUrl.searchParams.get("group"));
        const { data: g, error: ge } = await db
          .from("groups")
          .select("*")
          .eq("id", id)
          .single();
        check(ge);
        const { data: m, error } = await db
          .from("group_messages")
          .select("*,profiles(full_name,avatar_url)")
          .eq("group_id", id)
          .order("created_at", { ascending: false })
          .limit(100);
        check(error);
        const messages = (m || []).reverse();
        const paths = [
          ...new Set(
            messages
              .map((message) => message.profiles?.avatar_url)
              .filter(
                (path): path is string =>
                  typeof path === "string" &&
                  /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/.test(path),
              ),
          ),
        ];
        const urls = await signAvatars(db, p.id, paths);
        data = {
          group: g,
          messages: messages.map((message) => ({
            ...message,
            profiles: message.profiles
              ? {
                  ...message.profiles,
                  avatar_url: urls.get(message.profiles.avatar_url) || null,
                }
              : null,
          })),
        };
        break;
      }
      case "admin/overview": {
        const tables = [
          "membership_requests",
          "reports",
          "profiles",
          "donations",
        ];
        const out = await Promise.all(
          tables.map(async (table) => {
            let counter = db
              .from(table === "membership_requests" ? "profiles" : table)
              .select("id", { head: true, count: "exact" })
              .eq("status", table === "profiles" ? "approved" : "pending");
            if (table === "membership_requests")
              counter = counter.in("role", [
                "membre",
                "benevole",
                "volontaire",
              ]);
            const { count, error } = await counter;
            check(error);
            return count;
          }),
        );
        data = Object.fromEntries(tables.map((t, i) => [t, out[i]]));
        break;
      }
      case "admin/requests": {
        const requests = (await query("membership_requests")) || [];
        const pending = (await query("profiles", ["status", "pending"])) || [];
        const legacy = (await query("members")) || [];
        const known = new Set(requests.map((row) => row.user_id));
        data = [
          ...requests,
          ...pending
            .filter((row) => !known.has(row.id) && !isAdmin(row.role))
            .map((row) => ({
              id: row.id,
              user_id: row.id,
              legacy: true,
              full_name: row.full_name,
              email: row.email,
              status: "pending",
              requested_role:
                legacy.find((member) => member.user_id === row.id)
                  ?.membership_type === "benevole"
                  ? "benevole"
                  : row.role,
              city: row.city,
              region: row.region,
              phone: row.phone,
              created_at: row.created_at,
              motivation: "",
              admin_comment: null,
            })),
        ];
        break;
      }
      case "admin/reports":
        data = await query("reports");
        break;
      case "admin/members":
        data = await query("profiles");
        break;
      case "admin/news": {
        const page = Math.max(
          1,
          Math.min(1000000, Number(req.nextUrl.searchParams.get("page")) || 1),
        );
        const {
          data: articles,
          error,
          count,
        } = await db
          .from("news")
          .select("*", { count: "exact" })
          .order("created_at", { ascending: false })
          .order("id")
          .range((page - 1) * 20, page * 20 - 1);
        check(error);
        data = { articles, page, total: count || 0 };
        break;
      }
      case "admin/media": {
        const rows = (await query("gallery_media")) as Array<{
          object_path: string;
          poster_path: string | null;
        }>;
        data = rows.map((row) => ({
          ...row,
          url: db.storage.from("gallery-media").getPublicUrl(row.object_path)
            .data.publicUrl,
          poster_url: row.poster_path
            ? db.storage.from("gallery-media").getPublicUrl(row.poster_path)
                .data.publicUrl
            : null,
        }));
        break;
      }
      case "admin/donations":
        data = await query("donations");
        break;
      case "admin/groups":
        data = {
          groups: await query("groups"),
          members: await query("profiles", ["status", "approved"]),
        };
        break;
      case "dues":
      case "admin/dues": {
        const { data: settings, error: settingError } = await db
          .from("dues_settings")
          .select("*")
          .single();
        check(settingError);
        let paymentsQuery = db
          .from("membership_payments")
          .select(
            "*,profiles!membership_payments_user_id_fkey(full_name,matricule)",
          )
          .order("created_at", { ascending: false });
        if (view === "dues") paymentsQuery = paymentsQuery.eq("user_id", p.id);
        const { data: payments, error: paymentError } = await paymentsQuery;
        check(paymentError);
        data = { settings, payments: payments || [] };
        break;
      }
      case "admin/rewards":
        data = await query("rewards");
        break;
      default:
        throw new Error("Unknown view");
    }
    let profilePhoto: string | null = null;
    if (
      p.avatar_url &&
      /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/.test(p.avatar_url)
    ) {
      profilePhoto =
        (await signAvatars(db, p.id, [p.avatar_url])).get(p.avatar_url) || null;
    }
    return NextResponse.json(
      { profile: { ...p, avatar_url: profilePhoto }, data },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: errorMessage(e, await locale()) },
      { status: 403 },
    );
  }
}
export async function POST(req: NextRequest) {
  try {
    if (
      !req.headers.get("origin") ||
      new URL(req.headers.get("origin")!).host !== req.headers.get("host")
    )
      return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("multipart/form-data")) return await upload(req);
    const b = await req.json();
    const op = z.string().parse(b.op);
    const db = await supabase();
    const l = await locale();
    let result: unknown = { ok: true };
    if (
      [
        "login",
        "register",
        "contact",
        "donate",
        "forgot",
        "newsletter",
      ].includes(op)
    )
      await rateLimit(
        req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown",
        op,
      );
    const rpc = async (name: string, args: Record<string, unknown>) => {
      const { data, error } = await db.rpc(name, args);
      check(error);
      return data;
    };
    if (op === "login") {
      const d = z
        .object({ email: z.email(), password: z.string().min(1).max(128) })
        .parse(b);
      const { error } = await db.auth.signInWithPassword(d);
      check(error);
      result = { ok: true };
    } else if (op === "register") {
      const d = reg.parse(b);
      const { data, error } = await db.auth.signUp({
        email: d.email,
        password: d.password,
        options: {
          emailRedirectTo:
            (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin) +
            "/auth/callback",
          data: {
            full_name: d.full_name,
            first_name: d.full_name.split(" ")[0],
            last_name: d.full_name.split(" ").slice(1).join(" ") || "ARDTTEMP",
            phone: d.phone,
            city: d.city,
            region: d.region,
            requested_role: d.requested_role,
            motivation: d.motivation,
            locale: d.locale,
            terms_accepted: true,
            preferred_language: d.locale,
          },
        },
      });
      check(error);
      result = { ok: true, session: !!data.session };
    } else if (op === "logout") {
      const { error } = await db.auth.signOut();
      check(error);
    } else if (op === "forgot") {
      const { email } = z.object({ email: z.email() }).parse(b);
      const { error } = await db.auth.resetPasswordForEmail(email, {
        redirectTo:
          (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin) +
          "/auth/callback?next=/reset-password",
      });
      check(error);
    } else if (op === "reset") {
      const d = z
        .object({
          password: z.string().min(12).max(128),
          confirmation: z.string(),
        })
        .refine((x) => x.password === x.confirmation)
        .parse(b);
      const { data } = await db.auth.getUser();
      if (!data.user) throw new Error("Authentication required");
      const { error } = await db.auth.updateUser({ password: d.password });
      check(error);
    } else if (op === "newsletter") {
      const d = z
        .object({ email: z.email(), consent: z.literal(true) })
        .parse(b);
      const { error } = await workerClient().rpc("subscribe_newsletter", {
        p_secret: process.env.EMAIL_WORKER_SECRET,
        p_email: d.email,
        p_locale: l,
      });
      check(error);
    } else if (op === "contact") {
      const d = z
        .object({
          name: short,
          email: z.email(),
          subject: short,
          message: z.string().trim().min(10).max(5000),
          website: z.string().max(0).optional(),
        })
        .parse(b);
      const { error } = await workerClient().rpc("submit_contact", {
        p_secret: process.env.EMAIL_WORKER_SECRET,
        p_name: d.name,
        p_email: d.email,
        p_subject: d.subject,
        p_message: d.message,
        p_locale: l,
      });
      check(error);
    } else if (op === "donate") {
      const d = z
        .object({
          donor_name: short,
          donor_email: z.union([z.email(), z.literal("")]),
          donor_phone: phone,
          amount: z.coerce.number().int().min(100).max(100000000),
          message: z.string().max(2000),
          is_monthly: z.boolean(),
          payment_method: z.enum([
            "smobilpay",
            "mobile_money",
            "bank_transfer",
            "cash",
          ]),
        })
        .parse(b);
      const { data: u } = await db.auth.getUser();
      const { data, error } = await workerClient().rpc("submit_donation", {
        p_secret: process.env.EMAIL_WORKER_SECRET,
        p_data: {
          ...d,
          locale: l,
          payment_method:
            d.payment_method === "smobilpay"
              ? "mobile_money"
              : d.payment_method,
        },
        p_user: u.user?.id || null,
      });
      check(error);
      result = { ok: true, reference: data, message: fallbackInstructions[l] };
    } else if (op === "create_admin") {
      const p = await actor(db);
      if (p.status !== "approved" || p.role !== "super_admin")
        throw new ForbiddenError("Super Admin required");
      const d = adminInvite.parse(b);
      const { data: invitation, error: inviteError } =
        await db.functions.invoke("ardttemp-admin-invite", {
          body: { ...d, origin: req.nextUrl.origin },
        });
      if (inviteError) {
        const context =
          "context" in inviteError ? inviteError.context : undefined;
        const status = context instanceof Response ? context.status : 503;
        if (status === 401 || status === 403)
          throw new ForbiddenError("Super Admin required");
        if (status === 409) throw new ConflictError("Account already exists");
        throw new ConfigurationError("Supabase invitation unavailable");
      }
      if (!invitation?.ok)
        throw new ConfigurationError("Invitation could not be saved");
      result = {
        ok: true,
        email: d.email.toLowerCase(),
        message: "Admin invitation queued",
      };
    } else {
      const p = await actor(db);
      const adminOps = [
        "approve_membership",
        "approve_existing_member",
        "reject_existing_member",
        "review_dues",
        "configure_dues",
        "reject_membership",
        "validate_report",
        "reject_report",
        "manage_member",
        "delete_account",
        "save_news",
        "create_news_upload",
        "delete_news",
        "create_group",
        "add_member",
        "review_reward",
        "complete_donation",
        "create_media_upload",
        "publish_media",
        "delete_media",
      ];
      if (adminOps.includes(op)) assertAdmin(p);
      if (op === "create_news_upload") {
        const path = `${p.id}/${crypto.randomUUID()}.webp`;
        const { data, error } = await db.storage
          .from("news-photos")
          .createSignedUploadUrl(path, { upsert: false });
        check(error);
        if (!data?.token) throw new Error("Could not create upload token");
        result = { path, token: data.token };
      } else if (op === "create_media_upload") {
        const d = z
          .object({
            content_type: z.enum(["image/webp", "video/webm", "video/mp4"]),
          })
          .parse(b);
        const ext =
          d.content_type === "image/webp" ? "webp" : d.content_type.slice(6);
        const path = `${p.id}/${crypto.randomUUID()}.${ext}`;
        const { data, error } = await db.storage
          .from("gallery-media")
          .createSignedUploadUrl(path, { upsert: false });
        check(error);
        if (!data?.token) throw new Error("Could not create upload token");
        result = { path, token: data.token };
      } else if (op === "publish_media") {
        const d = z
          .object({
            media_type: z.enum(["image", "video"]),
            title_fr: short,
            title_en: short,
            description_fr: z.string().max(2000).default(""),
            description_en: z.string().max(2000).default(""),
            object_path: z.string().max(500),
            poster_path: z.string().max(500).nullable().optional(),
          })
          .parse(b);
        const prefix = `${p.id}/`;
        const expectedExtension = d.media_type === "image" ? ".webp" : null;
        if (
          !d.object_path.startsWith(prefix) ||
          d.object_path.includes("..") ||
          (expectedExtension && !d.object_path.endsWith(expectedExtension)) ||
          (d.media_type === "video" && !/\.(webm|mp4)$/.test(d.object_path)) ||
          (d.media_type === "image" && d.poster_path) ||
          (d.poster_path &&
            (!d.poster_path.startsWith(prefix) ||
              !d.poster_path.endsWith(".webp") ||
              d.poster_path.includes("..")))
        )
          throw new ForbiddenError("Invalid media storage path");
        const exists = async (path: string) => {
          const folder = path.slice(0, path.lastIndexOf("/"));
          const filename = path.slice(path.lastIndexOf("/") + 1);
          const { data, error } = await db.storage
            .from("gallery-media")
            .list(folder, { search: filename, limit: 100 });
          check(error);
          return data?.some((file) => file.name === filename) || false;
        };
        if (!(await exists(d.object_path)))
          throw new Error("Uploaded media not found");
        if (d.poster_path && !(await exists(d.poster_path)))
          throw new Error("Uploaded video poster not found");
        const { error } = await db.from("gallery_media").insert({
          ...d,
          poster_path: d.poster_path || null,
          created_by: p.id,
          published: true,
        });
        check(error);
      } else if (op === "delete_media") {
        const id = uuid.parse(b.id);
        const { data: item, error: readError } = await db
          .from("gallery_media")
          .select("object_path,poster_path")
          .eq("id", id)
          .single();
        check(readError);
        if (!item) throw new Error("Media not found");
        const paths = [item.object_path, item.poster_path].filter(
          (path): path is string => !!path,
        );
        const { error: storageError } = await db.storage
          .from("gallery-media")
          .remove(paths);
        check(storageError);
        const { error } = await db.from("gallery_media").delete().eq("id", id);
        check(error);
      }
      if (op === "manage_member") {
        const requestedRole = z
          .enum(["super_admin", "admin", "membre", "benevole", "volontaire"])
          .parse(b.role);
        if (requestedRole === "super_admin")
          throw new ForbiddenError("Super Admin assignment is restricted");
        if (p.role !== "super_admin" && requestedRole === "admin")
          throw new ForbiddenError("Super Admin required");
        const targetId = uuid.parse(b.id);
        if (targetId === p.id)
          throw new ForbiddenError("Cannot change your own privileges");
        const { data: target, error } = await db
          .from("profiles")
          .select("role")
          .eq("id", targetId)
          .single();
        check(error);
        if (!target) throw new Error("Target account unavailable");
        if (
          p.role !== "super_admin" &&
          (target.role === "admin" || target.role === "super_admin")
        )
          throw new ForbiddenError("Super Admin required");
      }
      switch (op) {
        case "create_dues":
          result = { id: await rpc("create_dues_payment", {}) };
          break;
        case "submit_dues":
          await rpc("submit_dues_payment", {
            p_id: uuid.parse(b.id),
            p_method: z
              .enum(["mobile_money", "bank_transfer", "cash", "online"])
              .parse(b.method),
            p_reference: z.string().trim().min(3).max(200).parse(b.reference),
            p_receipt_path:
              z.string().max(500).nullable().optional().parse(b.receipt_path) ||
              null,
          });
          break;
        case "review_dues":
          await rpc("review_dues_payment", {
            p_id: uuid.parse(b.id),
            p_approved: z.boolean().parse(b.approved),
            p_comment:
              z.string().max(2000).nullable().optional().parse(b.comment) ||
              null,
          });
          break;
        case "configure_dues": {
          if (p.role !== "super_admin")
            throw new ForbiddenError("Super Admin required");
          const settings = z
            .object({
              amount: z.coerce.number().int().min(100).max(100000000),
              period: z.string().trim().min(1).max(64),
              instructions_fr: z.string().trim().min(10).max(5000),
              instructions_en: z
                .union([z.string().trim().min(10).max(5000), z.literal("")])
                .default(""),
              checkout_url: z.union([
                z.url().refine((value) => new URL(value).protocol === "https:"),
                z.literal(""),
              ]),
            })
            .parse(b);
          const { error } = await db
            .from("dues_settings")
            .update({
              ...settings,
              instructions_en:
                settings.instructions_en || settings.instructions_fr,
              checkout_url: settings.checkout_url || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", true)
            .select("id")
            .single();
          check(error);
          break;
        }
        case "profile": {
          const d = z
            .object({
              full_name: short,
              phone,
              city: short,
              region,
              bio: z.string().max(2000),
              locale: z.enum(["fr", "en"]),
            })
            .parse(b);
          const { error } = await db.from("profiles").update(d).eq("id", p.id);
          check(error);
          break;
        }
        case "report": {
          if (
            p.status !== "approved" ||
            !["membre", "benevole", "volontaire"].includes(p.role)
          )
            throw new Error("Approved membership required");
          const d = z
            .object({
              title: short,
              description: z.string().trim().min(10).max(10000),
              activity_date: z.iso.date(),
              location: short,
              photo_urls: z.array(z.string().max(500)).max(6),
            })
            .parse(b);
          if (d.activity_date > new Date().toISOString().slice(0, 10))
            throw new Error("Future dates are not allowed");
          const { error } = await db
            .from("reports")
            .insert({ ...d, user_id: p.id });
          check(error);
          break;
        }
        case "message": {
          if (p.status !== "approved")
            throw new Error("Approved membership required");
          const d = z
            .object({
              group_id: uuid,
              content: z.string().trim().min(1).max(5000),
              attachment_url: z.string().max(500).nullable(),
            })
            .parse(b);
          const { error } = await db
            .from("group_messages")
            .insert({ ...d, user_id: p.id });
          check(error);
          break;
        }
        case "signed_url": {
          const d = z
            .object({
              bucket: z.enum([
                "activity-photos",
                "group-files",
                "dues-receipts",
              ]),
              path: z.string().max(500),
            })
            .parse(b);
          const { data, error } = await db.storage
            .from(d.bucket)
            .createSignedUrl(d.path, 300);
          check(error);
          result = { url: data?.signedUrl };
          break;
        }
        case "approve_existing_member":
          await rpc("approve_existing_member", { p_user_id: uuid.parse(b.id) });
          break;
        case "reject_existing_member":
          await rpc("reject_existing_member", {
            p_user_id: uuid.parse(b.id),
            p_comment: z.string().trim().min(3).max(2000).parse(b.comment),
          });
          break;
        case "approve_membership": {
          const requestId = uuid.parse(b.id);
          await rpc("approve_membership", {
            p_request_id: requestId,
            p_reviewer_id: p.id,
          });
          const { data: membership, error: membershipError } = await db
            .from("membership_requests")
            .select("user_id,status")
            .eq("id", requestId)
            .single();
          check(membershipError);
          const { data: approved, error: approvedError } = await db
            .from("profiles")
            .select("status,matricule,points")
            .eq("id", membership!.user_id)
            .single();
          check(approvedError);
          if (
            membership?.status !== "approved" ||
            approved?.status !== "approved" ||
            !approved.matricule
          )
            throw new Error("Membership approval did not complete");
          result = { ok: true, member: approved };
          break;
        }
        case "reject_membership":
          await rpc("reject_membership", {
            p_request_id: uuid.parse(b.id),
            p_reviewer_id: p.id,
            p_comment: z.string().trim().min(3).max(2000).parse(b.comment),
          });
          break;
        case "validate_report":
          await rpc("validate_report", {
            p_report_id: uuid.parse(b.id),
            p_reviewer_id: p.id,
            p_points: z
              .union([
                z.literal(5),
                z.literal(10),
                z.literal(15),
                z.literal(20),
              ])
              .parse(b.points),
            p_comment: z
              .string()
              .max(2000)
              .parse(b.comment || ""),
          });
          break;
        case "reject_report":
          await rpc("reject_report", {
            p_report_id: uuid.parse(b.id),
            p_reviewer_id: p.id,
            p_comment: z.string().trim().min(3).max(2000).parse(b.comment),
          });
          break;
        case "manage_member":
          await rpc("manage_member", {
            p_user_id: uuid.parse(b.id),
            p_role: z
              .enum([
                "super_admin",
                "admin",
                "membre",
                "benevole",
                "volontaire",
              ])
              .parse(b.role),
            p_status: z
              .enum(["pending", "approved", "rejected", "suspended"])
              .parse(b.status),
          });
          break;
        case "delete_account":
          if (p.role !== "super_admin")
            throw new ForbiddenError("Super Admin required");
          await rpc("delete_account", { p_user_id: uuid.parse(b.id) });
          break;
        case "save_news": {
          const d = z
            .object({
              title_fr: short,
              title_en: z.union([short, z.literal("")]).default(""),
              content_fr: z.string().min(10).max(50000),
              content_en: z
                .union([z.string().trim().min(10).max(50000), z.literal("")])
                .default(""),
              published: z.boolean(),
              cover_path: z.string().max(500).optional(),
            })
            .parse(b);
          const { cover_path, ...fields } = d;
          const values: Record<string, unknown> = {
            ...fields,
            title_en: fields.title_en || fields.title_fr,
            content_en: fields.content_en || fields.content_fr,
          };
          if (cover_path !== undefined) {
            if (!new RegExp(`^${p.id}/[0-9a-f-]{36}\\.webp$`).test(cover_path))
              throw new ForbiddenError("Invalid cover photo path");
            const [folder, filename] = cover_path.split("/");
            const { data: files, error: storageError } = await db.storage
              .from("news-photos")
              .list(folder, { search: filename });
            check(storageError);
            if (!files?.some((file) => file.name === filename))
              throw new Error("Cover photo not uploaded");
            values.cover_image = db.storage
              .from("news-photos")
              .getPublicUrl(cover_path).data.publicUrl;
          }
          const { data: saved, error } = b.id
            ? await db
                .from("news")
                .update(values)
                .eq("id", uuid.parse(b.id))
                .select("id")
                .single()
            : await db
                .from("news")
                .insert({ ...values, author_id: p.id })
                .select("id")
                .single();
          check(error);
          result = {
            id: saved!.id,
            article_url: fields.published ? `/news/${saved!.id}` : null,
          };
          break;
        }
        case "delete_news": {
          const { error } = await db
            .from("news")
            .delete()
            .eq("id", uuid.parse(b.id));
          check(error);
          break;
        }
        case "create_group": {
          const d = z
            .object({
              name: short,
              description: z.string().max(2000),
              role: z.enum(["all", "membre", "benevole", "volontaire"]),
              city: z.string().max(100),
              region: z.union([region, z.literal("")]),
              invite: z.boolean(),
            })
            .parse(b);
          result = {
            invite_url: await rpc("create_group_from_filters", {
              p_name: d.name,
              p_description: d.description,
              p_role: d.role,
              p_city: d.city,
              p_region: d.region,
              p_invite: d.invite,
            }),
          };
          break;
        }
        case "add_member":
          await rpc("add_group_member", {
            p_group: uuid.parse(b.group_id),
            p_user: uuid.parse(b.user_id),
          });
          break;
        case "join_group":
          result = {
            group_id: await rpc("join_group", {
              p_token: z
                .string()
                .regex(/^[a-f0-9]{32}$/)
                .parse(b.token),
            }),
          };
          break;
        case "request_reward":
          result = {
            id: await rpc("request_reward", {
              p_type: z
                .enum(["formation", "voyage_ambassadeur", "promotion"])
                .parse(b.reward_type),
            }),
          };
          break;
        case "review_reward":
          await rpc("review_reward", {
            p_id: uuid.parse(b.id),
            p_status: z
              .enum(["approved", "fulfilled", "rejected"])
              .parse(b.status),
            p_notes: z
              .string()
              .max(2000)
              .parse(b.notes || ""),
          });
          break;
        case "complete_donation":
          await rpc("complete_donation", { p_id: uuid.parse(b.id) });
          break;
        case "create_news_upload":
        case "create_media_upload":
        case "publish_media":
        case "delete_media":
          break;
        default:
          throw new Error("Unknown operation");
      }
    }
    after(async () => {
      try {
        await drainEmails();
      } catch {
        /* Durable outbox retained for retry. */
      }
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = errorMessage(e, await locale());
    const status =
      e instanceof ForbiddenError
        ? 403
        : e instanceof ConflictError
          ? 409
          : e instanceof ConfigurationError ||
              e instanceof RateLimitUnavailableError
            ? 503
            : e instanceof Error && e.message.startsWith("Too many requests")
              ? 429
              : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
async function upload(req: NextRequest) {
  const db = await supabase();
  const p = await actor(db);
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new Error("File required");
  const bucket = z
    .enum([
      "activity-photos",
      "group-files",
      "profile-photos",
      "dues-receipts",
      "news-photos",
      "gallery-media",
    ])
    .parse(form.get("bucket"));
  const publicPhoto = ["news-photos", "gallery-media"].includes(bucket);
  if (publicPhoto && (p.status !== "approved" || !isAdmin(p.role)))
    throw new ForbiddenError("Forbidden");
  const personalUpload =
    bucket === "profile-photos" || bucket === "dues-receipts";
  if (
    personalUpload
      ? !["pending", "approved"].includes(p.status)
      : p.status !== "approved"
  )
    throw new ForbiddenError("Account not eligible for upload");
  if (
    file.size === 0 ||
    file.size >
      (bucket === "profile-photos"
        ? 1
        : publicPhoto
          ? 4
          : bucket === "group-files"
            ? 10
            : 5) *
        1024 *
        1024
  )
    throw new Error("File too large or empty");
  const bytes = Buffer.from(await file.arrayBuffer());
  const image = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
  if (
    file.size > (bucket === "activity-photos" ? 5 : 10) * 1024 * 1024 ||
    !(
      image ||
      (["group-files", "dues-receipts"].includes(bucket) &&
        file.type === "application/pdf") ||
      (bucket === "group-files" && file.type === "text/plain")
    )
  )
    throw new Error("Unsupported file or file too large");
  if (
    (bucket === "profile-photos" || publicPhoto) &&
    file.type !== "image/webp"
  )
    throw new Error("Profile photo must be WebP");
  // Validate common magic bytes instead of trusting a supplied MIME type.
  if (
    (file.type === "image/jpeg" && !(bytes[0] === 255 && bytes[1] === 216)) ||
    (file.type === "image/png" &&
      !bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (file.type === "image/webp" &&
      !(
        bytes.toString("ascii", 0, 4) === "RIFF" &&
        bytes.toString("ascii", 8, 12) === "WEBP"
      )) ||
    (file.type === "application/pdf" &&
      bytes.toString("ascii", 0, 5) !== "%PDF-")
  )
    throw new Error("Invalid file contents");
  const ext = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
    "text/plain": "txt",
  }[file.type]!;
  const path =
    bucket !== "group-files"
      ? `${p.id}/${crypto.randomUUID()}.${ext}`
      : `groups/${uuid.parse(form.get("group_id"))}/${p.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await db.storage.from(bucket).upload(path, bytes, {
    contentType: file.type,
    upsert: false,
    cacheControl: "31536000",
  });
  check(error);
  if (bucket === "profile-photos") {
    const { error: profileError } = await db
      .from("profiles")
      .update({ avatar_url: path })
      .eq("id", p.id)
      .select("id")
      .single();
    check(profileError);
  }
  return NextResponse.json({ path });
}
