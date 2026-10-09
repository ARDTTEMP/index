import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { z } from "npm:zod@4.6.5";

const regions = ["Adamaoua", "Centre", "Est", "Extrême-Nord", "Littoral", "Nord", "Nord-Ouest", "Ouest", "Sud", "Sud-Ouest"] as const;
const input = z.object({
  full_name: z.string().trim().min(2).max(200),
  email: z.email().max(254),
  phone: z.string().trim().min(6).max(30),
  city: z.string().trim().min(2).max(200),
  region: z.enum(regions),
  locale: z.enum(["fr", "en"]).default("fr"),
  origin: z.string().regex(/^https:\/\/(www\.ardttemp\.org|ardttemp\.org|ardttemp-[a-z0-9-]+-ardttemp-1081\.vercel\.app)$/),
});
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return reply(401, { error: "Authentication required" });
  const url = Deno.env.get("SUPABASE_URL")!;
  const actor = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: identity, error: authError } = await actor.auth.getUser(authorization.slice(7));
  if (authError || !identity.user) return reply(401, { error: "Authentication required" });
  const { data: profile, error: profileError } = await actor.from("profiles")
    .select("role,status").eq("id", identity.user.id).single();
  if (profileError || profile?.role !== "super_admin" || profile.status !== "approved")
    return reply(403, { error: "Super Admin required" });
  let fields: z.infer<typeof input>;
  try { fields = input.parse(await req.json()); }
  catch { return reply(400, { error: "Invalid invitation details" }); }
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = fields.email.toLowerCase();
  if (["projets@ardttemp.org", "cyrille.kamto@ardttemp.org"].includes(email))
    return reply(403, { error: "Reserved Super Admin identity" });
  // Never generate a login link for an existing account.
  const { data: existing, error: lookupError } = await admin.from("profiles")
    .select("id").eq("email", email).maybeSingle();
  if (lookupError) return reply(503, { error: "Invitation unavailable" });
  if (existing) return reply(409, { error: "Account already exists" });
  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite", email,
    options: { data: { full_name: fields.full_name, phone: fields.phone,
      city: fields.city, region: fields.region, locale: fields.locale } },
  });
  if (error || !data.user || !data.properties?.hashed_token)
    return reply(409, { error: "Unable to create invitation" });
  const { error: saveError } = await actor.rpc("create_admin_with_invitation", {
    p_user_id: data.user.id, p_token_hash: data.properties.hashed_token,
    p_origin: fields.origin, p_locale: fields.locale,
  });
  if (saveError) {
    // Failed SQL leaves the account pending; never delete an identity on a retry/race.
    return reply(saveError.code === "42501" ? 403 : 503, { error: "Invitation could not be saved" });
  }
  return reply(200, { ok: true, email, message: "Admin invitation queued" });
});
