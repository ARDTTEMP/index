import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
export async function proxy(request: NextRequest) {
  const shopHost=request.nextUrl.hostname === "shop.ardttemp.org";
  if(shopHost){
    const path=request.nextUrl.pathname;
    if(path==="/shop"||path==="/shop/")return NextResponse.redirect(new URL("/"+request.nextUrl.search,request.url));
    if(path==="/"){
      const destination=request.nextUrl.clone();destination.pathname="/shop";
      const rewritten=NextResponse.rewrite(destination);
      const lang=request.nextUrl.searchParams.get("lang");if(lang==="fr"||lang==="en")rewritten.cookies.set("ardttemp-locale",lang,{sameSite:"lax",path:"/",maxAge:31536000});
      rewritten.headers.set("Cache-Control","private, no-store");return rewritten;
    }
    // Keep authentication and payments on the established site and session.
    if(!path.startsWith("/_next/")&&path!=="/api/locale"&&path!=="/shop/conditions"&&path!=="/shop/conditions/"&&!/\.(?:png|jpg|jpeg|webp|svg|ico|woff2?|css|js)$/.test(path))return NextResponse.redirect(new URL(path+request.nextUrl.search,"https://www.ardttemp.org"));
  }
  let response = NextResponse.next({ request });
  const language = request.nextUrl.searchParams.get("lang");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (url && key) {
    const db = createServerClient(url, key, {
      cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(items) {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          items.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });
    const { data } = await db.auth.getUser();
    if (data.user && ["/login", "/register"].includes(request.nextUrl.pathname)) {
      const { data: profile } = await db.from("profiles").select("id").eq("id", data.user.id).maybeSingle();
      // A missing/unavailable profile must not create a login-dashboard redirect loop.
      if (profile) {
      const next = request.nextUrl.searchParams.get("next");
      const destination = next?.startsWith("/") && !next.startsWith("//") && !next.includes("\\")
        && !["/login", "/register"].includes(next.split("?")[0]) ? next : "/dashboard";
      const r = NextResponse.redirect(new URL(destination, request.url));
      response.cookies.getAll().forEach((c) => r.cookies.set(c));
      return r;
      }
    }
    if (request.nextUrl.pathname.startsWith("/dashboard")) {
      if (!data.user) {
        const u = new URL("/login", request.url);
        u.searchParams.set("next", request.nextUrl.pathname);
        const r = NextResponse.redirect(u);
        response.cookies.getAll().forEach((c) => r.cookies.set(c));
        return r;
      }
      const { data: p } = await db
        .from("profiles")
        .select("role,status")
        .eq("id", data.user.id)
        .single();
      if (
        request.nextUrl.pathname.startsWith("/dashboard/admin") &&
        (!p ||
          p.status !== "approved" ||
          !["admin", "super_admin"].includes(p.role))
      ) {
        const r = NextResponse.redirect(new URL("/dashboard", request.url));
        response.cookies.getAll().forEach((c) => r.cookies.set(c));
        return r;
      }
    }
  }
  if (language === "fr" || language === "en")
    response.cookies.set("ardttemp-locale", language, {
      sameSite: "lax",
      path: "/",
      maxAge: 31536000,
    });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png).*)"],
};
