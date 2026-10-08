"use client";
import { useState } from "react";
import { api } from "./PublicForm";
import { text, type Locale } from "@/lib/domain";
export default function Newsletter({ l, legacy = false }: { l: Locale; legacy?: boolean }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className={legacy ? "legacy-newsletter" : undefined}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const fd = new FormData(e.currentTarget);
        try {
          await api({
            op: "newsletter",
            email: fd.get("email"),
            consent: fd.get("consent") === "on",
          });
          setMessage(
            text(l, "Inscription enregistrée.", "Subscription recorded."),
          );
        } catch (e) {
          setMessage(e instanceof Error ? e.message : "Error");
        } finally {
          setBusy(false);
        }
      }}
    >
      {legacy ? <div className="newsletter-form">
        <label className="sr-only" htmlFor="footer-newsletter-email">{text(l, "Adresse e-mail", "Email address")}</label>
        <input id="footer-newsletter-email" type="email" name="email" placeholder={text(l, "Votre e-mail", "Your email")} required autoComplete="email" />
        <button type="submit" disabled={busy}>{text(l, "S’inscrire", "Subscribe")}</button>
      </div> : <label>
        {text(l, "Recevoir nos actualités", "Receive our updates")}
        <input type="email" name="email" placeholder="Email" required autoComplete="email" />
      </label>}
      <label className="check" style={{ marginTop: 12, fontSize: ".8rem" }}>
        <input type="checkbox" name="consent" required />
        <span>{text(l, "J’accepte de recevoir la newsletter.", "I agree to receive the newsletter.")}</span>
      </label>
      {!legacy && <button className="button light small" disabled={busy} style={{ marginTop: 12 }}>{text(l, "M’inscrire", "Subscribe")}</button>}
      {message && <p role="status">{message}</p>}
    </form>
  );
}
