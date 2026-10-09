import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
export function publicKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
export async function supabase() {
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    publicKey(),
    {
      cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      },
      cookies: {
        getAll: () => jar.getAll(),
        setAll(items) {
          try {
            items.forEach(({ name, value, options }) =>
              jar.set(name, value, options),
            );
          } catch {
            /* Server component reads; proxy owns refreshing. */
          }
        },
      },
    },
  );
}
export function workerClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, publicKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export function authAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Supabase Auth Admin is not configured");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function locale() {
  return (await cookies()).get("ardttemp-locale")?.value === "en"
    ? ("en" as const)
    : ("fr" as const);
}
