import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import {
  notchConfigured,
  notchSandbox,
  verifyNotchPayment,
} from "@/lib/notchpay";
import { rateLimit } from "@/lib/security";
import { drainEmails } from "@/lib/emails";
export async function GET() {
  return NextResponse.json(
    { enabled: notchConfigured(), sandbox: notchSandbox() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get("origin");
    if (!origin || new URL(origin).host !== req.headers.get("host"))
      return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
    if (!notchConfigured())
      return NextResponse.json(
        { error: "Notch Pay n’est pas encore activé." },
        { status: 503 },
      );
    await rateLimit(
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown",
      "verify_notchpay",
    );
    const { payment } = z
      .object({ payment: z.string().uuid() })
      .parse(await req.json());
    const result = await verifyNotchPayment({ id: payment });
    if (!result)
      return NextResponse.json(
        { error: "Payment unavailable" },
        { status: 404 },
      );
    after(() => drainEmails());
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Vérification temporairement indisponible. Réessayez dans quelques minutes. / Verification temporarily unavailable. Try again in a few minutes.",
      },
      { status: 503 },
    );
  }
}
