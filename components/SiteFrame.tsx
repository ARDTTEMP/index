"use client";
import type { ReactNode } from "react";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { text, type Locale } from "@/lib/domain";

const authPaths = new Set(["/login", "/register", "/forgot-password", "/reset-password"]);
export default function SiteFrame({ children, header, footer }: {
  children: ReactNode; header: ReactNode; footer: ReactNode;
}) {
  const path = usePathname().replace(/\/$/, "") || "/";
  if (authPaths.has(path)) return <main id="main" className="auth-screen">{children}</main>;
  return <>{header}<main id="main">{children}</main>{footer}</>;
}

export function AuthTools({ locale: l }: { locale: Locale }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function language(locale: Locale) {
    setBusy(true); setFailed(false);
    try {
      const result = await fetch("/api/locale", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      if (!result.ok) throw new Error("Language unavailable");
      router.refresh();
    } catch { setFailed(true); }
    finally { setBusy(false); }
  }
  return <>
    <div className="auth-tools">
      <Link href="/" className="auth-brand" aria-label={text(l,"ARDTTEMP — Accueil","ARDTTEMP — Home")}>
        <Image src="/logo.png" alt="" width={42} height={42} />
        <span>ARDTTEMP</span>
      </Link>
      <div className="language" aria-label={text(l,"Langue","Language")}>
        {(["fr","en"] as const).map(lang => <button type="button" key={lang} disabled={busy}
          aria-pressed={lang === l} onClick={() => language(lang)}>{lang.toUpperCase()}</button>)}
      </div>
    </div>
    {failed && <p role="alert" className="form-note">{text(l,"La langue n’a pas pu être modifiée. Réessayez.","Unable to change language. Please try again.")}</p>}
  </>;
}

export function AuthHome({ locale: l }: { locale: Locale }) {
  return <Link className="auth-home" href="/"><ArrowLeft size={16} aria-hidden="true" />{text(l,"Retour au site","Back to website")}</Link>;
}
