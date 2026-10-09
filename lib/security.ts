import "server-only";
import { createHmac } from "node:crypto";
import { workerClient } from "./supabase";
export class RateLimitUnavailableError extends Error {}
export async function rateLimit(ip: string, operation: string) {
  if (!process.env.EMAIL_WORKER_SECRET)
    throw new RateLimitUnavailableError("Submission service unavailable");
  const key = createHmac("sha256", process.env.EMAIL_WORKER_SECRET)
    .update(`${operation}:${ip}`)
    .digest("hex");
  const { data, error } = await workerClient().rpc("check_rate_limit", {
    p_secret: process.env.EMAIL_WORKER_SECRET,
    p_key: key,
    p_limit: operation === "login" ? 10 : 5,
    p_seconds: 600,
  });
  if (error || typeof data !== "boolean")
    throw new RateLimitUnavailableError("Submission service unavailable");
  if (!data)
    throw new Error("Too many requests. Veuillez réessayer dans dix minutes.");
}
export const safeNext = (next: string | null) =>
  next?.startsWith("/") && !next.startsWith("//") && !next.includes("\\")
    ? next
    : "/dashboard";
