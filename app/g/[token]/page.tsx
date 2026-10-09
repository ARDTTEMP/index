import { redirect } from "next/navigation";
import { supabase, locale } from "@/lib/supabase";
import { text } from "@/lib/domain";
import GroupInvite from "@/components/GroupInvite";
export default async function Invitation({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login?next=" + encodeURIComponent("/g/" + token));
  return (
    <div className="auth-shell">
      <h1>
        {text(await locale(), "Invitation à un groupe", "Group invitation")}
      </h1>
      <GroupInvite token={token} locale={await locale()} />
    </div>
  );
}
