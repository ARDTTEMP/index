"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  REGIONS,
  memberRoles,
  roleLabels,
  text,
  type Locale,
} from "@/lib/domain";
export async function api(body: Record<string, unknown>) {
  const r = await fetch("/api/platform", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Request failed");
  return data;
}
export default function PublicForm({
  kind,
  locale: l,
}: {
  kind: "login" | "register" | "contact" | "donate" | "forgot" | "reset";
  locale: Locale;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState(10000);
  const [success, setSuccess] = useState(false);
  const t = (fr: string, en: string) => text(l, fr, en);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (kind === "register" && step === 1) {
      setStep(2);
      return;
    }
    setBusy(true);
    setError("");
    const fd = new FormData(form);
    let b: Record<string, unknown> = Object.fromEntries(fd);
    b = { ...b, op: kind, locale: l };
    if (kind === "register") b.terms = fd.get("terms") === "on";
    if (kind === "donate") {
      b.amount = amount;
      b.is_monthly = fd.get("is_monthly") === "on";
    }
    try {
      const data = await api(b);
      if (kind === "login") {
        const next = params.get("next");
        router.push(
          next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard",
        );
        router.refresh();
      } else if (kind === "register") {
        setSuccess(true);
        setMessage(
          t(
            "Votre demande est reçue. Vérifiez votre boîte email pour confirmer votre adresse, puis connectez-vous. Votre compte reste en attente de validation par un administrateur.",
            "Your application has been received. Check your inbox to confirm your email, then sign in. Your account remains pending administrator approval.",
          ),
        );
      } else if (kind === "contact") {
        form.reset();
        setMessage(
          t(
            "Votre message est enregistré et sera transmis à notre équipe.",
            "Your message has been recorded and will be forwarded to our team.",
          ),
        );
      } else if (kind === "donate") {
        setSuccess(true);
        setMessage(
          data.message +
            " " +
            t("Référence : ", "Reference: ") +
            data.reference,
        );
      } else if (kind === "reset") {
        setMessage(t("Mot de passe modifié.", "Password updated."));
        router.push("/dashboard");
      } else
        setMessage(
          t(
            "Si un compte existe, vous recevrez un lien de réinitialisation.",
            "If an account exists, you will receive a reset link.",
          ),
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {message && (
        <div className="notice" role="status">
          {message}
          {success && kind === "register" && (
            <p>
              <Link className="link" href="/login">
                {t("Se connecter", "Sign in")}
              </Link>
            </p>
          )}
        </div>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {!success && (
        <form className="form" onSubmit={submit}>
          {kind === "register" && (
            <div className="step-indicator">
              <span className={step === 1 ? "active" : ""}>
                1. {t("Votre profil", "Your profile")}
              </span>
              <span className={step === 2 ? "active" : ""}>
                2. {t("Votre engagement", "Your commitment")}
              </span>
            </div>
          )}
          {(kind === "login" || kind === "forgot") && (
            <label>
              Email
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                maxLength={254}
              />
            </label>
          )}
          {kind === "login" && (
            <label>
              {t("Mot de passe", "Password")}
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                maxLength={128}
              />
            </label>
          )}
          {kind === "register" && (
            <>
              <div style={{ display: step === 1 ? "grid" : "none", gap: 20 }}>
                <label>
                  {t("Nom complet", "Full name")}
                  <input
                    name="full_name"
                    required
                    autoComplete="name"
                    minLength={2}
                    maxLength={200}
                  />
                </label>
                <label>
                  Email
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                  />
                </label>
                <div className="form-grid">
                  <label>
                    {t("Téléphone", "Phone")}
                    <input
                      name="phone"
                      type="tel"
                      required
                      autoComplete="tel"
                      minLength={6}
                      maxLength={30}
                    />
                  </label>
                  <label>
                    {t("Ville", "City")}
                    <input
                      name="city"
                      required
                      autoComplete="address-level2"
                      minLength={2}
                    />
                  </label>
                </div>
                <label>
                  {t("Région", "Region")}
                  <select name="region" required defaultValue="">
                    <option value="" disabled>
                      {t("Choisir une région", "Choose a region")}
                    </option>
                    {REGIONS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div style={{ display: step === 2 ? "grid" : "none", gap: 20 }}>
                <label>
                  {t("Rôle demandé", "Requested role")}
                  <select
                    name="requested_role"
                    required
                    defaultValue="membre"
                  >
                    {memberRoles.map((r) => (
                      <option key={r} value={r}>
                        {roleLabels[l][r]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("Votre motivation", "Your motivation")}
                  <textarea
                    name="motivation"
                    required={step === 2}
                    minLength={10}
                    maxLength={5000}
                  />
                </label>
                <div className="form-grid">
                  <label>
                    {t(
                      "Mot de passe — 12 caractères minimum",
                      "Password — at least 12 characters",
                    )}
                    <input
                      name="password"
                      type="password"
                      required={step === 2}
                      minLength={12}
                      maxLength={128}
                      autoComplete="new-password"
                    />
                  </label>
                  <label>
                    {t("Confirmer le mot de passe", "Confirm password")}
                    <input
                      name="confirmation"
                      type="password"
                      required={step === 2}
                      minLength={12}
                      autoComplete="new-password"
                    />
                  </label>
                </div>
                <label className="check">
                  <input type="checkbox" name="terms" required={step === 2} />
                  <span>
                    {t(
                      "J’accepte les statuts et le règlement intérieur d’ARDTTEMP et le traitement de mes données pour mon adhésion.",
                      "I accept ARDTTEMP’s statutes and internal rules and the processing of my data for membership.",
                    )}{" "}
                    <Link className="link" href="/terms" target="_blank">
                      {t("Consulter les modalités", "Read the terms")}
                    </Link>
                  </span>
                </label>
                <p className="form-note">
                  {t(
                    "Après inscription : confirmation email, examen par l’équipe, puis matricule et 50 points à l’approbation. Le bénévolat ne nécessite pas de cotisation.",
                    "After registration: email confirmation, team review, then a membership ID and 50 points upon approval. Volunteering does not require a fee.",
                  )}
                </p>
              </div>
            </>
          )}
          {kind === "contact" && (
            <>
              <div className="form-grid">
                <label>
                  {t("Votre nom", "Your name")}
                  <input
                    name="name"
                    required
                    autoComplete="name"
                    minLength={2}
                  />
                </label>
                <label>
                  Email
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                  />
                </label>
              </div>
              <label>
                {t("Sujet", "Subject")}
                <input name="subject" required minLength={2} maxLength={200} />
              </label>
              <label>
                Message
                <textarea
                  name="message"
                  required
                  minLength={10}
                  maxLength={5000}
                />
              </label>
              <label className="hidden-field" aria-hidden="true">
                Website
                <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
              <p className="form-note">
                {t(
                  "Vos coordonnées servent uniquement à répondre à votre message.",
                  "Your contact details are used only to respond to your message.",
                )}
              </p>
            </>
          )}
          {kind === "donate" && (
            <>
              <div className="amounts">
                {[5000, 10000, 25000, 50000, 100000, 250000].map((x) => (
                  <button
                    key={x}
                    type="button"
                    className={amount === x ? "active" : ""}
                    onClick={() => setAmount(x)}
                  >
                    {x.toLocaleString(l)} FCFA
                  </button>
                ))}
              </div>
              <label>
                {t("Montant libre (FCFA)", "Custom amount (XAF)")}
                <input
                  name="amount"
                  type="number"
                  min={100}
                  max={100000000}
                  required
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                />
              </label>
              <label className="check">
                <input name="is_monthly" type="checkbox" />
                <span>
                  {t(
                    "Je souhaite donner chaque mois — l’équipe me contactera pour organiser les versements.",
                    "I would like to donate monthly — the team will contact me to arrange payments.",
                  )}
                </span>
              </label>
              <div className="form-grid">
                <label>
                  {t("Nom du donateur", "Donor name")}
                  <input
                    name="donor_name"
                    required
                    autoComplete="name"
                    minLength={2}
                  />
                </label>
                <label>
                  Email
                  <input name="donor_email" type="email" autoComplete="email" />
                </label>
              </div>
              <label>
                {t("Téléphone", "Phone")}
                <input
                  name="donor_phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  minLength={6}
                />
              </label>
              <label>
                {t("Moyen de paiement souhaité", "Preferred payment method")}
                <select name="payment_method">
                  <option value="mobile_money">
                    Mobile Money (MTN / Orange)
                  </option>
                  <option value="bank_transfer">
                    {t("Virement bancaire", "Bank transfer")}
                  </option>
                  <option value="cash">
                    {t("Espèces au siège", "Cash at our office")}
                  </option>
                </select>
              </label>
              <label>
                {t("Votre message (facultatif)", "Your message (optional)")}
                <textarea name="message" maxLength={2000} />
              </label>
              <p className="form-note">
                {t(
                  "Le paiement en ligne est en cours de configuration. Votre intention de don sera enregistrée en attente ; notre équipe vous indiquera comment régler.",
                  "Online payment is being configured. Your pledge will be recorded as pending; our team will provide payment instructions.",
                )}
              </p>
            </>
          )}
          {kind === "reset" && (
            <>
              <label>
                {t("Nouveau mot de passe", "New password")}
                <input
                  name="password"
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                />
              </label>
              <label>
                {t("Confirmation", "Confirm password")}
                <input
                  name="confirmation"
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                />
              </label>
            </>
          )}
          <div className="actions" style={{ marginTop: 0 }}>
            {kind === "register" && step === 2 && (
              <button
                type="button"
                className="button outline"
                onClick={() => setStep(1)}
              >
                {t("Retour", "Back")}
              </button>
            )}
            <button className="button" disabled={busy}>
              {busy
                ? t("En cours…", "Please wait…")
                : kind === "login"
                  ? t("Se connecter", "Sign in")
                  : kind === "register"
                    ? step === 1
                      ? t("Continuer", "Continue")
                      : t("Envoyer ma demande", "Submit application")
                    : kind === "donate"
                      ? t("Enregistrer mon don", "Record my donation")
                      : kind === "forgot"
                        ? t("Recevoir le lien", "Send reset link")
                        : kind === "reset"
                          ? t("Modifier le mot de passe", "Update password")
                          : t("Envoyer le message", "Send message")}
            </button>
          </div>
          {kind === "login" && (
            <>
              <Link className="link" href="/forgot-password">
                {t("Mot de passe oublié ?", "Forgot password?")}
              </Link>
              <p>
                {t("Pas encore de compte ?", "No account yet?")}{" "}
                <Link className="link" href="/register">
                  {t("S’inscrire", "Register")}
                </Link>
              </p>
            </>
          )}
        </form>
      )}
    </>
  );
}
