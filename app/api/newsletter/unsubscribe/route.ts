import { NextRequest, NextResponse } from "next/server";
import { workerClient } from "@/lib/supabase";

const validToken = (value: string | null): value is string =>
  !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const page = (message: string, form = "") =>
  new NextResponse(
    `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Newsletter ARDTTEMP</title><body style="font:16px Arial,sans-serif;max-width:640px;margin:10vh auto;padding:24px;color:#17251c"><h1>ARDTTEMP</h1><p>${message}</p>${form}</body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!validToken(token))
    return new NextResponse("Lien invalide ou expiré.", { status: 400 });

  return page(
    "Confirmez votre désinscription de la newsletter ARDTTEMP.",
    `<form method="post"><input type="hidden" name="token" value="${token}"><button style="padding:12px 18px;background:#166534;color:white;border:0;border-radius:4px">Me désinscrire</button></form>`,
  );
}

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const token = form?.get("token");
  if (typeof token !== "string" || !validToken(token))
    return new NextResponse("Lien invalide ou expiré.", { status: 400 });

  const secret = process.env.EMAIL_WORKER_SECRET;
  if (!secret)
    return new NextResponse("Désinscription temporairement indisponible.", { status: 503 });

  const { error } = await workerClient().rpc("unsubscribe_newsletter", {
    p_secret: secret,
    p_token: token,
  });
  if (error)
    return new NextResponse("Désinscription temporairement indisponible.", { status: 503 });

  return page("Votre désinscription est confirmée.");
}
