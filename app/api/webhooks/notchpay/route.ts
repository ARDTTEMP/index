import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { verifyNotchSignature } from "@/lib/notchpay-validation";
import { notchConfigured, verifyNotchPayment } from "@/lib/notchpay";
import { drainEmails } from "@/lib/emails";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  if (!notchConfigured())
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  const body = await req.text();
  if (body.length > 65536)
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  if (
    !verifyNotchSignature(
      body,
      req.headers.get("x-notch-signature"),
      process.env.NOTCHPAY_WEBHOOK_HASH!,
    )
  )
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  let event;
  try {
    event = z
      .object({
        event: z.string(),
        data: z.object({
          reference: z.string().regex(/^trx[._][A-Za-z0-9_-]+$/),
        }),
      })
      .parse(JSON.parse(body));
  } catch {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }
  if (!event.event.startsWith("payment."))
    return NextResponse.json({ ok: true });
  try {
    // The event is only a signal. Re-read the transaction from Notch Pay.
    await verifyNotchPayment({ reference: event.data.reference });
    after(() => drainEmails());
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Retry later" }, { status: 503 });
  }
}
