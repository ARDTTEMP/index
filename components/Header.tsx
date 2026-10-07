"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { type Locale, text } from "@/lib/domain";
export default function Header({ locale: l }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const path = usePathname();
  const t = (fr: string, en: string) => text(l, fr, en);
  const nav = [
    ["/", t("Accueil", "Home")],
    ["/about", t("L’association", "About us")],
    ["/activities", t("Nos actions", "Our work")],
    ["/news", t("Actualités", "News")],
    ["/contact", "Contact"],
  ];
  async function language(locale: Locale) {
    setBusy(true);
    await fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    });
    const u = new URL(window.location.href);
    u.searchParams.delete("lang");
    window.history.replaceState(null, "", u);
    window.location.assign(u.toString());
  }
  return (
    <>
      <a className="skip" href="#main">
        {t("Aller au contenu", "Skip to content")}
      </a>
      <div className="topbar">
        <Link href="/dashboard">{t("Espace membre", "Member area")}</Link>
        <a href="tel:+237655508511">+237 655 50 85 11</a>
      </div>
      <header className="header">
        <Link href="/" className="brand">
          <Image src="/logo.png" alt="ARDTTEMP" width={52} height={52} />
          <span>
            <strong>ARDTTEMP</strong>
            <small>
              {t(
                "Transformons notre environnement ensemble.",
                "Let’s transform our environment together.",
              )}
            </small>
          </span>
        </Link>
        <button
          className="menu"
          onClick={() => setOpen(!open)}
          aria-label={t("Menu de navigation", "Navigation menu")}
          aria-expanded={open}
        >
          {open ? <X /> : <Menu />}
        </button>
        <nav
          className={open ? "navigation open" : "navigation"}
          aria-label={t("Navigation principale", "Main navigation")}
        >
          {nav.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={path === href ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {label}
            </Link>
          ))}
          <Link
            href="/gallery"
            aria-current={path === "/gallery" ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            {t("ARDTTEMP en image", "ARDTTEMP in pictures")}
          </Link>
        </nav>
        <div className="header-actions">
          <Link className="member-access" href="/login">{t("Se connecter", "Sign in")}</Link>
          <div className="language" aria-label={t("Langue", "Language")}>
            {(["fr", "en"] as Locale[]).map((x) => (
              <button
                key={x}
                disabled={busy}
                aria-pressed={l === x}
                onClick={() => language(x)}
              >
                {x.toUpperCase()}
              </button>
            ))}
          </div>
          <Link className="button small" href="/donate">
            {t("Faire un don", "Donate")}
          </Link>
        </div>
      </header>
    </>
  );
}
