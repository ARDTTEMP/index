import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest) {
  if (
    !req.headers.get("origin") ||
    new URL(req.headers.get("origin")!).host !== req.headers.get("host")
  )
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { locale } = await req.json();
  if (!["fr", "en"].includes(locale))
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set("ardttemp-locale", locale, {
    path: "/",
    sameSite: "lax",
    maxAge: 31536000,
  });
  return res;
}
