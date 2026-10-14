"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
export default function PaymentReturn() {
  const params = useSearchParams();
  const payment = params.get("payment");
  const [result, setResult] = useState<{
    status: string;
    kind: string;
    sandbox: boolean;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [english, setEnglish] = useState(false);
  const t = (fr: string, en: string) => (english ? en : fr);
  async function verify() {
    setBusy(true);
    setError("");
    try {
      if (!payment || !/^[0-9a-f-]{36}$/i.test(payment))
        throw new Error(t("Référence invalide.", "Invalid reference."));
      const response = await fetch("/api/payments/notchpay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void verify();
  }, [payment]);
  const complete = result?.status === "complete";
  return (
    <main className="container section" style={{ maxWidth: 720 }}>
      <section className="card">
        <button
          type="button"
          className="button secondary"
          onClick={() => setEnglish(!english)}
        >
          {english ? "Français" : "English"}
        </button>
        <h1>{t("Votre paiement ARDTTEMP", "Your ARDTTEMP payment")}</h1>
        <div role="status" aria-live="polite">
          {busy ? (
            <p>
              {t(
                "Vérification auprès de Notch Pay…",
                "Verifying with Notch Pay…",
              )}
            </p>
          ) : complete ? (
            <p>
              {result.sandbox
                ? t(
                    "Test réussi. Aucun versement réel ni point attribué.",
                    "Test successful. No real payment or points awarded.",
                  )
                : t(
                    result.kind === "shop" ? "Paiement confirmé. Votre commande est en préparation." : "Paiement confirmé. Merci pour votre contribution.",
                    result.kind === "shop" ? "Payment confirmed. Your order is being prepared." : "Payment confirmed. Thank you for your contribution.",
                  )}
            </p>
          ) : result ? (
            <p>
              {t(
                "Votre paiement n’est pas confirmé. Aucun point n’a été attribué.",
                "Your payment is not confirmed. No points have been awarded.",
              )}
            </p>
          ) : null}
        </div>
        {error && <p role="alert">{error}</p>}
        {!complete && (
          <button
            className="button"
            disabled={busy}
            onClick={() => void verify()}
          >
            {t("Vérifier à nouveau", "Check again")}
          </button>
        )}
        <p>
          <Link href={result?.kind === "shop" ? "/shop" : result?.kind === "dues" ? "/dashboard/dues" : "/donate"}>
            {t("Continuer sur ARDTTEMP", "Continue on ARDTTEMP")}
          </Link>
        </p>
      </section>
    </main>
  );
}
