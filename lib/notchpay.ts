import "server-only";
import { workerClient } from "./supabase";
import { checkoutUrl, validateNotchPayment } from "./notchpay-validation";
type Checkout = {
  id: string;
  kind: "dues" | "donation" | "shop";
  amount: number;
  sandbox: boolean;
  provider_reference: string | null;
  checkout_url: string | null;
  status: string;
  new?: boolean;
  name?: string;
  email?: string;
  phone?: string;
};
export function notchConfigured() {
  return !!(
    process.env.NOTCHPAY_PUBLIC_KEY &&
    process.env.NOTCHPAY_WEBHOOK_HASH &&
    ["test", "live"].includes(process.env.NOTCHPAY_MODE || "")
  );
}
export function notchSandbox() {
  return process.env.NOTCHPAY_MODE === "test";
}
function configuration() {
  if (!notchConfigured())
    throw new Error(
      "Notch Pay n’est pas encore activé. / Notch Pay is not enabled yet.",
    );
  if (
    process.env.NOTCHPAY_MODE === "live" &&
    process.env.VERCEL_ENV &&
    process.env.VERCEL_ENV !== "production"
  )
    throw new Error("Live payments are disabled outside production");
  const key = process.env.NOTCHPAY_PUBLIC_KEY!;
  if (notchSandbox() !== key.includes("test"))
    throw new Error("Notch Pay environment mismatch");
  return key;
}
async function request(path: string, body?: Record<string, unknown>) {
  const response = await fetch(`https://api.notchpay.co/payments${path}`, {
    method: body ? "POST" : "GET",
    redirect: "error",
    cache: "no-store",
    headers: {
      Authorization: configuration(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(
      "Notch Pay est temporairement indisponible. / Notch Pay is temporarily unavailable.",
    );
  return await response.json();
}
export async function notchLedger(
  operation: string,
  data: Record<string, unknown>,
) {
  const result = await workerClient().rpc("notchpay_payment", {
    p_secret: process.env.EMAIL_WORKER_SECRET,
    p_operation: operation,
    p_data: data,
  });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
export async function shopNotchLedger(operation: string, data: Record<string, unknown>) {
  const result = await workerClient().rpc("shop_notchpay", {p_secret: process.env.EMAIL_WORKER_SECRET, p_operation: operation, p_data: data});
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
export async function startNotchPayment(
  kind: "dues" | "donation" | "shop",
  target: string,
  userId?: string,
) {
  configuration();
  const ledger = kind === "shop" ? shopNotchLedger : notchLedger;
  const a: Checkout = await ledger("prepare", {
    kind,
    target,
    user_id: userId,
    sandbox: notchSandbox(),
  });
  if (a.checkout_url)
    return { checkout_url: checkoutUrl(a.checkout_url), payment_id: a.id };
  // Do not repeat an ambiguous POST: it may already have created a payable checkout.
  if (!a.new)
    throw new Error(
      "Initialisation en cours de vérification. Contactez l’association avant de recommencer. / Payment initialization is being checked. Contact the association before retrying.",
    );
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://www.ardttemp.org";
  const origin = new URL(base);
  if (
    origin.protocol !== "https:" ||
    !["www.ardttemp.org", "ardttemp.org"].includes(origin.hostname)
  )
    throw new Error("Invalid payment callback origin");
  const response = await request("", {
    amount: a.amount,
    currency: "XAF",
    locked_currency: "XAF",
    title: kind === "shop" ? "Commande Shop ARDTTEMP" : kind === "dues" ? "Cotisation ARDTTEMP" : "Soutenir ARDTTEMP",
    theming: { color: "#166534" },
    customer: { name: a.name, email: a.email || undefined, phone: a.phone },
    description: kind === "shop" ? "Commande Shop — livraison incluse" : kind === "dues" ? "Cotisation ARDTTEMP" : "Don ARDTTEMP",
    reference: `ARDTTEMP-${a.id}`,
    callback: `${origin.origin}/payment/return?payment=${a.id}`,
  });
  const ref = response.transaction?.reference;
  if (typeof ref !== "string" || !/^trx[._][A-Za-z0-9_-]+$/.test(ref))
    throw new Error("Invalid Notch Pay reference");
  const url = checkoutUrl(response.authorization_url);
  await ledger("attach", { id: a.id, reference: ref, url });
  return { checkout_url: url, payment_id: a.id };
}
export async function verifyNotchPayment(
  lookup: { id: string } | { reference: string },
) {
  const original: Checkout | null = await notchLedger("lookup", lookup);
  const a: Checkout | null = original || await shopNotchLedger("lookup", lookup);
  const ledger = original ? notchLedger : shopNotchLedger;
  if (!a) return null;
  if (!a.provider_reference)
    return { status: "creating", kind: a.kind, sandbox: a.sandbox };
  const response = await request(
    `/${encodeURIComponent(a.provider_reference)}`,
  );
  const status = validateNotchPayment(response.transaction, {
    provider_reference: a.provider_reference,
    amount: a.amount,
    sandbox: a.sandbox,
  });
  return await ledger("settle", {
    id: a.id,
    reference: a.provider_reference,
    amount: a.amount,
    currency: "XAF",
    sandbox: a.sandbox,
    status,
  });
}
