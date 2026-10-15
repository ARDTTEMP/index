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
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return (
    <span className={"member-avatar" + (small ? " chat-avatar" : "")}>
      {url && url !== failedUrl && /^(https:|blob:)/.test(url) ? (
        <img
          src={url}
          alt=""
          width={small ? 40 : 80}
          height={small ? 40 : 80}
          decoding="async"
          loading={small ? "lazy" : "eager"}
          onError={() => setFailedUrl(url || null)}
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
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
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
            setSaved(false);
            try {
              const optimized = await optimizeImage(file, 256, 0.72);
              await uploadPersonal(optimized, "profile-photos");
              setFile(null);
              form.reset();
              await refresh();
              setSaved(true);
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
              accept="image/*"
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
        {saved && (
          <p className="notice" role="status">
            {t(
              "Photo enregistrée. Elle apparaît aussi dans vos discussions de groupe.",
              "Photo saved. It also appears in your group discussions.",
            )}
          </p>
        )}
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
  const [notchEnabled, setNotchEnabled] = useState(false);
  useEffect(() => {
    fetch("/api/payments/notchpay")
      .then((r) => r.json())
      .then((d) => setNotchEnabled(d.enabled))
      .catch(() => {});
  }, []);
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
              "Fixez le montant et la période. Les cotisations sont réglées avec Notch Pay. Le bénévolat reste sans cotisation.",
              "Set the amount and period. Membership fees are paid with Notch Pay. Volunteers remain exempt.",
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
              {notchEnabled &&
                !data.payments.some(
                  (payment) =>
                    payment.period === settings.period &&
                    payment.status === "paid",
                ) && (
                  <button
                    className="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      try {
                        const result = await api({ op: "pay_dues_notchpay" });
                        window.location.assign(result.checkout_url);
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Error");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {t(
                      "Payer ma cotisation — Notch Pay",
                      "Pay my membership fee — Notch Pay",
                    )}
                  </button>
                )}
              <p className="form-note">
                {t(
                  "La cotisation est confirmée automatiquement après vérification du paiement auprès de Notch Pay et donne droit à 200 points, une seule fois par période.",
                  "Your fee is confirmed automatically after verification with Notch Pay and awards 200 points once per period.",
                )}
              </p>
              {!notchEnabled && (
                <p role="status">
                  {t(
                    "Le paiement Notch Pay est momentanément indisponible.",
                    "Notch Pay is temporarily unavailable.",
                  )}
                </p>
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
