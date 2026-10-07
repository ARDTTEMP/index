import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { safeNext } from "@/lib/security";
import type { EmailOtpType } from "@supabase/supabase-js";
export async function GET(req: NextRequest) {
  const db = await supabase();
  const q = req.nextUrl.searchParams;
  const code = q.get("code");
  const hash = q.get("token_hash");
  const type = q.get("type");
  let error;
  if (code) ({ error } = await db.auth.exchangeCodeForSession(code));
  else if (
    hash &&
    ["signup", "recovery", "invite", "email"].includes(type || "")
  )
    ({ error } = await db.auth.verifyOtp({
      token_hash: hash,
      type: type as EmailOtpType,
    }));
  else error = true;
  return NextResponse.redirect(
    new URL(
      error ? "/login?error=confirmation" : safeNext(q.get("next")),
      req.nextUrl.origin,
    ),
  );
}
