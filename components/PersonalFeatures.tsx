"use client";
import { useEffect, useState } from "react";
import { api } from "./PublicForm";
import { optimizeImage } from "./MediaManager";
import { text, type Locale, type Profile } from "@/lib/domain";
type Act = (body: Record<string, unknown>) => Promise<any>;
export async function uploadPersonal(file: File, bucket: string) {
  const form = new FormData();
  form.set("file", file);
  form.set("bucket", bucket);
  const response = await fetch("/api/platform", { method: "POST", body: form });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result.path as string;
}
export function Avatar({
  name,
  url,
  small = false,
}: {
  name: string;
  url?: string | null;
  small?: boolean;
}) {
  return (
    <span className={"member-avatar" + (small ? " chat-avatar" : "")}>
      {url && /^(https:|blob:)/.test(url) ? (
        <img
          src={url}
          alt=""
          width={small ? 40 : 80}
          height={small ? 40 : 80}
          decoding="async"
          loading="lazy"
        />
      ) : (
        name
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((word) => word[0])
          .join("")
          .toUpperCase()
      )}
    </span>
  );
}
export function AvatarUploader({
  profile,
  l,
  refresh,
}: {
  profile: Profile;
  l: Locale;
  refresh: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const t = (fr: string, en: string) => text(l, fr, en);
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <section className="card avatar-editor">
      <div className="avatar-preview">
        <Avatar name={profile.full_name} url={preview || profile.avatar_url} />
      </div>
      <div>
        <h2>{t("Votre photo de profil", "Your profile photo")}</h2>
        <p>
          {t(
            "Elle vous représentera dans les discussions de groupe. Elle est redimensionnée et compressée avant l’envoi.",
            "It will represent you in group discussions. It is resized and compressed before upload.",
          )}
        </p>
        <form
          className="form"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            if (!file) return;
            setBusy(true);
            setError("");
            try {
              const optimized = await optimizeImage(file, 256, 0.72);
              await uploadPersonal(optimized, "profile-photos");
              setFile(null);
              form.reset();
              await refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Error");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            {t("Choisir une photo", "Choose a photo")}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
          </label>
          <button className="button" disabled={busy || !file}>
            {busy
              ? t("Envoi…", "Uploading…")
              : t("Enregistrer ma photo", "Save my photo")}
          </button>
        </form>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
type Settings = {
  amount: number | null;
  period: string;
  instructions_fr: string;
  instructions_en: string;
  checkout_url: string | null;
};
type Payment = {
  id: string;
  user_id: string;
  period: string;
  amount: number;
  status: string;
  reference: string | null;
  receipt_path: string | null;
  admin_comment: string | null;
  created_at: string;
  paid_at: string | null;
  profiles?: { full_name: string; matricule: string | null };
};
export function DuesPanel({
  data,
  profile,
  admin,
  l,
  act,
}: {
  data: { settings: Settings; payments: Payment[] };
  profile: Profile;
  admin: boolean;
  l: Locale;
  act: Act;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const t = (fr: string, en: string) => text(l, fr, en);
  const settings = data.settings;
  const exempt = !["membre", "volontaire"].includes(profile.role);
  const labels: Record<string, string> = {
    pending: t("À régler", "To pay"),
    submitted: t("En vérification", "Under review"),
    paid: t("Payée", "Paid"),
    rejected: t("Justificatif refusé", "Proof rejected"),
  };
  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      return await act(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="dues-space">
      {admin && profile.role === "super_admin" && (
        <section className="card">
          <h2>{t("Barème de cotisation", "Membership fee settings")}</h2>
          <p>
            {t(
              "Fixez le montant, la période et les coordonnées de paiement. Le bénévolat reste sans cotisation.",
              "Set the fee, period and payment details. Volunteering remains free of membership fees.",
            )}
          </p>
          <form
            className="form"
            onSubmit={async (event) => {
              event.preventDefault();
              const fd = new FormData(event.currentTarget);
              await run({ op: "configure_dues", ...Object.fromEntries(fd) });
            }}
          >
            <div className="form-grid">
              <label>
                {t("Montant en FCFA", "Amount in XAF")}
                <input
                  type="number"
                  name="amount"
                  min={100}
                  max={100000000}
                  step={1}
                  required
                  defaultValue={settings.amount || ""}
                />
              </label>
              <label>
                {t("Période de cotisation", "Membership period")}
                <input
                  name="period"
                  required
                  maxLength={64}
                  defaultValue={settings.period}
                />
              </label>
            </div>
            <label>
              {t(
                "Instructions et bénéficiaire — français",
                "Instructions and payee — French",
              )}
              <textarea
                name="instructions_fr"
                required
                minLength={10}
                maxLength={5000}
                defaultValue={settings.instructions_fr}
              />
            </label>
            <label>
              {t(
                "Instructions et bénéficiaire — anglais (facultatif)",
                "Instructions and payee — English (optional)",
              )}
              <small>
                {t(
                  "Sans version anglaise, les instructions françaises seront affichées.",
                  "Without an English version, French instructions will be displayed.",
                )}
              </small>
              <textarea
                name="instructions_en"
                minLength={10}
                maxLength={5000}
                defaultValue={settings.instructions_en}
              />
            </label>
            <label>
              {t(
                "Lien de paiement sécurisé (facultatif)",
                "Secure checkout link (optional)",
              )}
              <input
                name="checkout_url"
                type="url"
                placeholder="https://"
                defaultValue={settings.checkout_url || ""}
              />
            </label>
            <button className="button" disabled={busy}>
              {t("Enregistrer le barème", "Save fee settings")}
            </button>
          </form>
        </section>
      )}
      {!admin && (
        <section className="card dues-summary">
          <p className="eyebrow">{t("MA COTISATION", "MY MEMBERSHIP FEE")}</p>
          <h2>
            {exempt
              ? t("Aucune cotisation requise", "No membership fee required")
              : settings.amount
                ? `${settings.amount.toLocaleString(l)} FCFA`
                : t("Barème en attente", "Fee settings pending")}
          </h2>
          <p>
            {exempt
              ? t(
                  "Votre catégorie n’est pas soumise à cette cotisation.",
                  "Your membership category is exempt from this fee.",
                )
              : t("Période : ", "Period: ") + settings.period}
          </p>
          {!exempt && settings.amount && (
            <>
              <p className="payment-instructions">
                {l === "fr"
                  ? settings.instructions_fr
                  : settings.instructions_en}
              </p>
              {settings.checkout_url && (
                <a
                  className="button"
                  href={settings.checkout_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("Payer en ligne ↗", "Pay online ↗")}
                </a>
              )}
              <p className="form-note">
                {t(
                  "Après votre versement, transmettez sa référence ou son justificatif ci-dessous. La cotisation sera confirmée après vérification par l’association et donnera droit à 200 points, une seule fois par période.",
                  "After paying, submit its reference or receipt below. The association will confirm your fee after verification and award 200 points once per period.",
                )}
              </p>
              {!data.payments.some(
                (payment) => payment.period === settings.period,
              ) && (
                <button
                  className="button"
                  disabled={busy || settings.instructions_fr.trim().length < 10}
                  onClick={() => void run({ op: "create_dues" })}
                >
                  {t("Préparer ma cotisation", "Prepare my membership payment")}
                </button>
              )}
            </>
          )}
          {!exempt && !settings.amount && (
            <p>
              {t(
                "L’association doit d’abord publier le montant et les coordonnées de paiement.",
                "The association must first publish the fee and payment details.",
              )}
            </p>
          )}
        </section>
      )}
      <section>
        <h2>
          {admin
            ? t("Cotisations à suivre", "Membership payments")
            : t("Mon historique de cotisation", "My payment history")}
        </h2>
        {!data.payments.length && (
          <p className="empty">
            {t(
              "Aucune cotisation enregistrée.",
              "No membership payments recorded.",
            )}
          </p>
        )}
        {data.payments.map((payment) => (
          <article className="card dues-payment" key={payment.id}>
            <div className="section-head">
              <div>
                <h3>
                  {payment.amount.toLocaleString(l)} FCFA · {payment.period}
                </h3>
                {admin && (
                  <p>
                    {payment.profiles?.full_name} ·{" "}
                    {payment.profiles?.matricule}
                  </p>
                )}
              </div>
              <span className={"badge " + payment.status}>
                {labels[payment.status] || payment.status}
              </span>
            </div>
            <p>
              {t("Référence interne : ", "Internal reference: ")}
              {payment.id}
            </p>
            {payment.reference && (
              <p>
                {t("Référence de versement : ", "Payment reference: ")}
                {payment.reference}
              </p>
            )}
            {payment.paid_at && (
              <p>
                {t("Confirmée le ", "Confirmed on ")}
                {new Date(payment.paid_at).toLocaleString(l, {
                  timeZone: "Africa/Douala",
                })}
              </p>
            )}
            {payment.admin_comment && (
              <p className="notice">{payment.admin_comment}</p>
            )}
            {payment.receipt_path && (
              <button
                className="file-link"
                onClick={async () => {
                  const tab = window.open("about:blank", "_blank");
                  if (tab) tab.opener = null;
                  try {
                    const result = await api({
                      op: "signed_url",
                      bucket: "dues-receipts",
                      path: payment.receipt_path,
                    });
                    if (tab) tab.location.href = result.url;
                  } catch (e) {
                    tab?.close();
                    setError(e instanceof Error ? e.message : "Error");
                  }
                }}
              >
                {t("Voir le justificatif", "View receipt")}
              </button>
            )}
            {!admin && ["pending", "rejected"].includes(payment.status) && (
              <form
                className="form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const fd = new FormData(form);
                  setBusy(true);
                  setError("");
                  try {
                    let receipt_path = null;
                    const source = fd.get("receipt");
                    if (source instanceof File && source.size) {
                      const prepared = source.type.startsWith("image/")
                        ? await optimizeImage(source)
                        : source;
                      receipt_path = await uploadPersonal(
                        prepared,
                        "dues-receipts",
                      );
                    }
                    await act({
                      op: "submit_dues",
                      id: payment.id,
                      method: fd.get("method"),
                      reference: fd.get("reference"),
                      receipt_path,
                    });
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Error");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <div className="form-grid">
                  <label>
                    {t("Mode de paiement", "Payment method")}
                    <select name="method">
                      <option value="mobile_money">Mobile Money</option>
                      <option value="bank_transfer">
                        {t("Virement", "Bank transfer")}
                      </option>
                      <option value="cash">
                        {t("Espèces au siège", "Cash at office")}
                      </option>
                      {settings.checkout_url && (
                        <option value="online">
                          {t("Paiement en ligne", "Online payment")}
                        </option>
                      )}
                    </select>
                  </label>
                  <label>
                    {t(
                      "Référence ou numéro de reçu",
                      "Transaction or receipt reference",
                    )}
                    <input
                      name="reference"
                      required
                      minLength={3}
                      maxLength={200}
                    />
                  </label>
                </div>
                <label>
                  {t(
                    "Justificatif (photo ou PDF, facultatif)",
                    "Receipt (photo or PDF, optional)",
                  )}
                  <input
                    name="receipt"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                  />
                </label>
                <button className="button" disabled={busy}>
                  {t("Soumettre pour vérification", "Submit for verification")}
                </button>
              </form>
            )}
            {admin && payment.status === "submitted" && (
              <form
                className="review-form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const fd = new FormData(event.currentTarget);
                  await run({
                    op: "review_dues",
                    id: payment.id,
                    approved: fd.get("decision") === "approve",
                    comment: fd.get("comment"),
                  });
                }}
              >
                <select name="decision" aria-label={t("Décision", "Decision")}>
                  <option value="approve">
                    {t("Confirmer le paiement", "Confirm payment")}
                  </option>
                  <option value="reject">
                    {t("Refuser le justificatif", "Reject receipt")}
                  </option>
                </select>
                <input
                  name="comment"
                  placeholder={t(
                    "Commentaire obligatoire en cas de refus",
                    "Comment required when declining",
                  )}
                  maxLength={2000}
                />
                <button className="button" disabled={busy}>
                  {t("Valider", "Save decision")}
                </button>
              </form>
            )}
          </article>
        ))}
      </section>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
    </div>
  );
}
