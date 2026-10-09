import { redirect, notFound } from "next/navigation";
import { locale, supabase } from "@/lib/supabase";
import { isAdmin, type Profile } from "@/lib/domain";
import Workspace from "@/components/Workspace";
export default async function Dashboard({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section = [] } = await params;
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data: p } = await db
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!p) redirect("/login");
  const view = section.join("/") || "overview";
  if (view.startsWith("admin") && (!isAdmin(p.role) || p.status !== "approved"))
    redirect("/dashboard");
  if (
    ![
      "overview",
      "profile",
      "dues",
      "reports",
      "reports/new",
      "groups",
      "rewards",
      "admin",
      "admin/requests",
      "admin/reports",
      "admin/members",
      "admin/news",
      "admin/media",
      "admin/donations",
      "admin/dues",
      "admin/groups",
      "admin/rewards",
    ].includes(view) &&
    !/^groups\/[0-9a-f-]{36}$/.test(view)
  )
    notFound();
  return (
    <Workspace
      initialProfile={p as Profile}
      view={view === "admin" ? "admin/overview" : view}
      locale={await locale()}
    />
  );
}
