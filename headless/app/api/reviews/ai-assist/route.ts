import { createHash, createHmac, randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { createGeminiReviewProvider, estimateAiReviewCostUsd, estimateAiReviewTokens, listAvailableGeminiTextModels, prefilterAiReviewInput, recordAiReviewTelemetry, resolveAiReviewModel, type AiReviewTelemetry } from "@/lib/reviews/ai-review-assist";
import { REVIEW_TAGS } from "@/lib/reviews/low-friction-review";
import { REVIEW_SUBMISSION_CSRF_VALUE, getReviewRateLimitWindow, resolveTrustedReviewClientIp, utf8ByteLength } from "@/lib/reviews/submission-security";
import { reviewNativeRepository } from "@/lib/supabase/review-native";

const MAX_BODY_BYTES = 8_192;
const MAX_REQUESTS = 5;

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
}

function logAiUnavailable(stage: "provider_config" | "client_ip" | "server_secret" | "rate_limit" | "provider_response", reason?: string): void {
  console.info(JSON.stringify({ event: "review_ai_unavailable", stage, ...(reason ? { reason } : {}), model: resolveAiReviewModel(process.env) }));
}

async function readBoundedBody(request: NextRequest): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(next.value);
    }
  } catch {
    return "";
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

function sameOrigin(request: NextRequest): boolean {
  if (request.headers.get("sec-fetch-site") !== "same-origin") return false;
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    const url = new URL(origin);
    return !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash
      && url.host.toLowerCase() === host.toLowerCase()
      && (url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

async function claimAiAssistRateLimit(ip: string, serverSecret: string): Promise<
  Readonly<{ status: "allowed" | "limited" }>
  | Readonly<{ status: "unavailable"; reason: string }>
> {
  const window = getReviewRateLimitWindow();
  const result = await reviewNativeRepository.claimRateLimit({
    idempotencyKeyHash: createHash("sha256").update(`ai-review-assist-v1|${randomUUID()}`).digest("hex"),
    abuseKeyHash: createHmac("sha256", serverSecret).update(`ai-review-assist-v1|ip:${ip}`).digest("hex"),
    windowStartedAt: window.startedAt,
    windowExpiresAt: window.expiresAt,
    limit: MAX_REQUESTS,
  });
  if (result.status === "error") {
    const reason = result.error.httpStatus
      ? `${result.error.code}_http_${result.error.httpStatus}`
      : result.error.code;
    return { status: "unavailable", reason };
  }
  if (result.status === "no_data") return { status: "unavailable", reason: "no_data" };
  return { status: result.data.allowed ? "allowed" : "limited" };
}

async function persistAiReviewTelemetry(event: AiReviewTelemetry, serverSecret: string): Promise<void> {
  const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  if (!baseUrl) return;
  await fetch(`${baseUrl}/rest/v1/rpc/record_ai_review_assist_telemetry`, {
    method: "POST",
    headers: { apikey: serverSecret, "Content-Type": "application/json", "Content-Profile": "api", "Accept-Profile": "api" },
    body: JSON.stringify({
      p_occurred_at: event.occurredAt, p_model: event.model, p_input_tokens: event.inputTokens,
      p_output_tokens: event.outputTokens, p_estimated_cost_usd: event.estimatedCostUsd,
      p_decision: event.decision, p_latency_ms: event.latencyMs, p_mode: event.mode,
    }),
    cache: "no-store",
  }).catch(() => undefined);
}

function parse(value: unknown): { ratingTotal: number; tags: string[]; note: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some((key) => !["ratingTotal", "tags", "note"].includes(key))
    || !Number.isInteger(row.ratingTotal) || (row.ratingTotal as number) < 1 || (row.ratingTotal as number) > 5
    || !Array.isArray(row.tags) || row.tags.length > 6 || !row.tags.every((tag) => typeof tag === "string" && REVIEW_TAGS.includes(tag as typeof REVIEW_TAGS[number]))
    || new Set(row.tags).size !== row.tags.length || typeof row.note !== "string" || row.note.length > 1000) return null;
  return { ratingTotal: row.ratingTotal as number, tags: row.tags as string[], note: row.note };
}

export async function POST(request: NextRequest) {
  if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
    return json({ ok: false, message: "JSON形式で送信してください。" }, 415);
  }
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const declaredLength = Number(contentLength);
    if (!Number.isSafeInteger(declaredLength) || declaredLength < 0 || declaredLength > MAX_BODY_BYTES) {
      return json({ ok: false, message: "送信内容が大きすぎます。" }, 413);
    }
  }
  if (!sameOrigin(request)) return json({ ok: false, message: "送信元を確認できません。" }, 403);
  if (request.headers.get("x-eskomi-csrf") !== REVIEW_SUBMISSION_CSRF_VALUE) {
    return json({ ok: false, message: "送信元を確認できません。" }, 403);
  }
  const raw = await readBoundedBody(request);
  if (!raw || utf8ByteLength(raw) > MAX_BODY_BYTES) return json({ ok: false, message: "送信内容が大きすぎます。" }, 413);
  let input: ReturnType<typeof parse>;
  try { input = parse(JSON.parse(raw)); } catch { input = null; }
  if (!input) return json({ ok: false, message: "入力内容を確認してください。" }, 400);

  const prefilter = prefilterAiReviewInput(input);
  if (prefilter.status === "reject") return json({ ok: false, message: "入力内容を確認してください。" }, 400);
  if (prefilter.status === "human_review") {
    return json({ ok: true, decision: "HUMAN_REVIEW", draft: prefilter.note, message: "連絡先等を伏せて、運営審査で内容を確認します。" }, 200);
  }
  const provider = createGeminiReviewProvider(process.env);
  if (!provider) {
    logAiUnavailable("provider_config");
    return json({ ok: false, message: "AI補助は現在利用できません。" }, 503);
  }
  const ip = resolveTrustedReviewClientIp(request.headers);
  const serverSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!ip || !serverSecret) {
    logAiUnavailable(!ip ? "client_ip" : "server_secret");
    return json({ ok: false, message: "AI補助は現在利用できません。" }, 503);
  }
  const rateLimit = await claimAiAssistRateLimit(ip, serverSecret);
  if (rateLimit.status === "unavailable") {
    logAiUnavailable("rate_limit", rateLimit.reason);
    return json({ ok: false, message: "AI補助は現在利用できません。" }, 503);
  }
  if (rateLimit.status === "limited") return json({ ok: false, message: "AI補助は現在利用できません。" }, 429);
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  const output = await provider.generate({ ...input, note: prefilter.note }, controller.signal).catch(() => null).finally(() => clearTimeout(timeout));
  if (!output) {
    const availableModels = await listAvailableGeminiTextModels(process.env);
    console.info(JSON.stringify({ event: "review_ai_model_availability", status: availableModels ? "ok" : "unavailable", models: availableModels ?? [] }));
    logAiUnavailable("provider_response");
    const event = { occurredAt: new Date().toISOString(), model: resolveAiReviewModel(process.env), inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0, decision: "UNAVAILABLE" as const, latencyMs: Date.now() - startedAt, mode: "standard" as const };
    recordAiReviewTelemetry(event);
    await persistAiReviewTelemetry(event, serverSecret);
    return json({ ok: false, message: "AI補助は現在利用できません。" }, 503);
  }
  const tokens = estimateAiReviewTokens(input, output);
  const event = { occurredAt: new Date().toISOString(), model: resolveAiReviewModel(process.env), inputTokens: tokens.input, outputTokens: tokens.output, estimatedCostUsd: estimateAiReviewCostUsd(tokens.input, tokens.output), decision: output.decision, latencyMs: Date.now() - startedAt, mode: "standard" as const };
  recordAiReviewTelemetry(event);
  await persistAiReviewTelemetry(event, serverSecret);
  return json({ ok: true, decision: output.decision, ...(output.draft ? { draft: output.draft } : {}) }, 200);
}
