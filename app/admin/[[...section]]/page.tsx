import { redirect } from "next/navigation";
export default async function AdminAlias({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section = [] } = await params;
  redirect(
    "/dashboard/admin" + (section.length ? "/" + section.join("/") : ""),
  );
}
