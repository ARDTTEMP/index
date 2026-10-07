import { NextRequest, NextResponse } from "next/server";
import { drainEmails } from "@/lib/emails";
import { timingSafeEqual } from "node:crypto";
export async function GET(req: NextRequest) {
  const expected = "Bearer " + process.env.CRON_SECRET;
  const received = req.headers.get("authorization") || "";
  if (
    !process.env.CRON_SECRET ||
    received.length !== expected.length ||
    !timingSafeEqual(Buffer.from(received), Buffer.from(expected))
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await drainEmails());
}
