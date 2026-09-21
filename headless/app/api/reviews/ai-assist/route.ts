import { createHash } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { createGeminiReviewProvider, estimateAiReviewTokens, prefilterAiReviewInput, recordAiReviewTelemetry, resolveAiReviewModel } from "@/lib/reviews/ai-review-assist";
import { REVIEW_TAGS } from "@/lib/reviews/low-friction-review";
import { REVIEW_SUBMISSION_CSRF_VALUE, resolveTrustedReviewClientIp, utf8ByteLength } from "@/lib/reviews/submission-security";

const MAX_BODY_BYTES = 8_192;
const WINDOW_MS = 10 * 60 * 1_000;
const MAX_REQUESTS = 5;
const attempts = new Map<string, number[]>();

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
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

function claim(ip: string): boolean {
  const key = createHash("sha256").update(ip).digest("hex");
  const now = Date.now();
  const current = (attempts.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  if (current.length >= MAX_REQUESTS) return false;
  current.push(now);
  attempts.set(key, current);
  return true;
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
  if (!sameOrigin(request)) return json({ ok: false, message: "送信元を確認できません。" }, 403);
  if (request.headers.get("x-eskomi-csrf") !== REVIEW_SUBMISSION_CSRF_VALUE) {
    return json({ ok: false, message: "送信元を確認できません。" }, 403);
  }
  const ip = resolveTrustedReviewClientIp(request.headers);
  if (!ip || !claim(ip)) return json({ ok: false, message: "現在AI補助を利用できません。" }, 429);
  const raw = await request.text().catch(() => "");
  if (!raw || utf8ByteLength(raw) > MAX_BODY_BYTES) return json({ ok: false, message: "送信内容が大きすぎます。" }, 413);
  let input: ReturnType<typeof parse>;
  try { input = parse(JSON.parse(raw)); } catch { input = null; }
  if (!input) return json({ ok: false, message: "入力内容を確認してください。" }, 400);

  const prefilter = prefilterAiReviewInput(input);
  if (prefilter.status === "reject") return json({ ok: false, message: "入力内容を確認してください。" }, 400);
  if (prefilter.status === "human_review") {
    return json({ ok: true, decision: "HUMAN_REVIEW", message: "運営審査で内容を確認します。" }, 200);
  }
  const provider = createGeminiReviewProvider(process.env);
  if (!provider) return json({ ok: false, message: "AI補助は現在利用できません。" }, 503);
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  const output = await provider.generate({ ...input, note: prefilter.note }, controller.signal).catch(() => null).finally(() => clearTimeout(timeout));
  if (!output) {
    recordAiReviewTelemetry({ model: resolveAiReviewModel(process.env), inputTokens: 0, outputTokens: 0, decision: "UNAVAILABLE", latencyMs: Date.now() - startedAt, mode: "standard" });
    return json({ ok: false, message: "AI補助は現在利用できません。" }, 503);
  }
  const tokens = estimateAiReviewTokens(input, output);
  recordAiReviewTelemetry({ model: resolveAiReviewModel(process.env), inputTokens: tokens.input, outputTokens: tokens.output, decision: output.decision, latencyMs: Date.now() - startedAt, mode: "standard" });
  return json({ ok: true, decision: output.decision, ...(output.draft ? { draft: output.draft } : {}) }, 200);
}
