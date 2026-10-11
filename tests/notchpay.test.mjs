import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  verifyNotchSignature,
  validateNotchPayment,
  checkoutUrl,
} from "../lib/notchpay-validation.ts";
test("Notch Pay rejects forged or altered webhook bodies", () => {
  const body = '{"event":"payment.complete"}';
  const signature = createHmac("sha256", "test-hash")
    .update(body)
    .digest("hex");
  assert.equal(verifyNotchSignature(body, signature, "test-hash"), true);
  for (const sig of [null, "", "bad", "a".repeat(64)])
    assert.equal(verifyNotchSignature(body, sig, "test-hash"), false);
  assert.equal(verifyNotchSignature(body + " ", signature, "test-hash"), false);
});
test("A confirmation must match the stored reference, amount, currency and environment", () => {
  const expected = {
    provider_reference: "trx.test",
    amount: 5000,
    sandbox: false,
  };
  const valid = {
    reference: "trx.test",
    amount: 5000,
    currency: "XAF",
    status: "complete",
    sandbox: false,
  };
  assert.equal(validateNotchPayment(valid, expected), "complete");
  assert.equal(
    validateNotchPayment({ ...valid, status: "processing" }, expected),
    "processing",
  );
  for (const patch of [
    { reference: "trx.other" },
    { amount: 100 },
    { currency: "USD" },
    { sandbox: true },
    { sandbox: undefined },
  ])
    assert.throws(() => validateNotchPayment({ ...valid, ...patch }, expected));
});
test("Checkout navigation only accepts the documented Notch Pay host", () => {
  assert.equal(
    checkoutUrl("https://pay.notchpay.co/pay_test"),
    "https://pay.notchpay.co/pay_test",
  );
  for (const url of [
    "https://evil.test",
    "https://pay.notchpay.co.evil.test",
    "javascript:alert(1)",
    "https://user:pass@pay.notchpay.co/",
  ])
    assert.throws(() => checkoutUrl(url));
});
