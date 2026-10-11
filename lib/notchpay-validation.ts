import { createHmac, timingSafeEqual } from "node:crypto";
export function verifyNotchSignature(
  body: string,
  signature: string | null,
  hash: string,
) {
  if (!hash || !signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", hash).update(body).digest();
  return timingSafeEqual(Buffer.from(signature, "hex"), expected);
}
export function checkoutUrl(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid checkout URL");
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "pay.notchpay.co" ||
    url.port ||
    url.username ||
    url.password
  )
    throw new Error("Invalid checkout URL");
  return url.href;
}
export function validateNotchPayment(
  transaction: unknown,
  expected: { provider_reference: string; amount: number; sandbox: boolean },
): string {
  const t = transaction as Record<string, unknown> | null;
  if (
    !t ||
    t.reference !== expected.provider_reference ||
    Number(t.amount) !== expected.amount ||
    t.currency !== "XAF" ||
    t.sandbox !== expected.sandbox ||
    typeof t.status !== "string"
  )
    throw new Error("Payment verification mismatch");
  return t.status;
}
