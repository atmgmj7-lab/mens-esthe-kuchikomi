import "server-only";

export const AI_REVIEW_DECISIONS = ["SAFE", "REWRITE_SAFE", "HUMAN_REVIEW", "REJECT"] as const;
export type AiReviewDecision = (typeof AI_REVIEW_DECISIONS)[number];

export type AiReviewInput = Readonly<{ ratingTotal: number; tags: readonly string[]; note: string }>;
export type AiReviewOutput = Readonly<{ decision: AiReviewDecision; draft?: string }>;
export type AiPrefilterResult = Readonly<{ status: "safe" | "human_review" | "reject"; note: string }>;
export type AiReviewBatchItem = Readonly<{ ratingTotal: number; tags: readonly string[]; note: string }>;
export type AiReviewProvider = Readonly<{
  generate(input: AiReviewInput, signal: AbortSignal): Promise<AiReviewOutput | null>;
  prepareManualBatch(inputs: readonly AiReviewBatchItem[]): readonly AiReviewBatchItem[];
}>;
export type AiReviewTelemetry = Readonly<{ occurredAt: string; model: string; inputTokens: number; outputTokens: number; estimatedCostUsd: number; decision: AiReviewDecision | "UNAVAILABLE"; latencyMs: number; mode: "standard" | "batch" }>;

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
const PHONE_RE = /(?<!\d)(?:0\d{1,4}[- ]?\d{1,4}[- ]?\d{3,4})(?!\d)/gu;
const URL_RE = /(?:https?:\/\/|www\.)[^\s]+/giu;
const CONTACT_HANDLE_RE = /(?:line|ライン)\s*(?:id)?\s*[:：]\s*[a-z0-9._-]{3,}/giu;
const CONTROL_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const HUMAN_REVIEW_RE = /(?:殺す|脅す|住所|本名|犯罪|逮捕|病気|診断|治療)/u;
const SPAM_RE = /(.)\1{9,}/u;

export function prefilterAiReviewInput(input: AiReviewInput): AiPrefilterResult {
  if (CONTROL_RE.test(input.note) || SPAM_RE.test(input.note)) return { status: "reject", note: "" };
  const redacted = input.note
    .replace(EMAIL_RE, "[連絡先を削除]")
    .replace(PHONE_RE, "[連絡先を削除]")
    .replace(URL_RE, "[URLを削除]")
    .replace(CONTACT_HANDLE_RE, "[連絡先を削除]");
  return HUMAN_REVIEW_RE.test(redacted) || redacted !== input.note
    ? { status: "human_review", note: redacted }
    : { status: "safe", note: redacted };
}

export function parseAiReviewOutput(value: unknown): AiReviewOutput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const keys = Object.keys(row).sort();
  if (!keys.every((key) => key === "decision" || key === "draft")
    || typeof row.decision !== "string" || !AI_REVIEW_DECISIONS.includes(row.decision as AiReviewDecision)
    || (row.draft !== undefined && (typeof row.draft !== "string" || row.draft.trim().length === 0 || row.draft.length > 1000))) return null;
  return row.draft === undefined
    ? { decision: row.decision as AiReviewDecision }
    : { decision: row.decision as AiReviewDecision, draft: row.draft.trim() };
}

function modelName(environment: Readonly<Record<string, string | undefined>>): string {
  const configured = environment.GEMINI_REVIEW_MODEL?.trim();
  return configured && /^[a-z0-9._-]{1,120}$/i.test(configured) ? configured : "gemini-3.1-flash-lite";
}

const telemetry: AiReviewTelemetry[] = [];

export function recordAiReviewTelemetry(event: AiReviewTelemetry): void {
  telemetry.push(event);
  if (telemetry.length > 100) telemetry.splice(0, telemetry.length - 100);
}

export function estimateAiReviewCostUsd(inputTokens: number, outputTokens: number): number {
  return Number(((inputTokens * 0.0000001) + (outputTokens * 0.0000004)).toFixed(8));
}

export function resolveAiReviewModel(environment: Readonly<Record<string, string | undefined>>): string {
  return modelName(environment);
}

export function createGeminiReviewProvider(
  environment: Readonly<Record<string, string | undefined>>,
  fetchImpl: typeof fetch = fetch,
): AiReviewProvider | null {
  const apiKey = environment.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  const model = modelName(environment);
  return {
    async generate(input, signal) {
      const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: JSON.stringify({
            task: "Return JSON only. Do not change rating or tags. Do not invent facts or reverse sentiment.",
            ratingTotal: input.ratingTotal,
            tags: input.tags,
            note: input.note,
            response: { decision: "SAFE|REWRITE_SAFE|HUMAN_REVIEW|REJECT", draft: "optional Japanese text up to 1000 chars" },
          }) }] }],
          generationConfig: { responseMimeType: "application/json", maxOutputTokens: 200 },
        }),
      });
      if (!response.ok) return null;
      const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text !== "string") return null;
      try {
        return parseAiReviewOutput(JSON.parse(text));
      } catch {
        return null;
      }
    },
    prepareManualBatch(inputs) {
      return inputs.map((input) => ({ ...input, tags: [...input.tags], note: input.note }));
    },
  };
}

export function estimateAiReviewTokens(input: AiReviewInput, output: AiReviewOutput | null): Readonly<{ input: number; output: number }> {
  return {
    input: Math.min(800, Math.ceil((input.note.length + input.tags.join(",").length + 24) / 4)),
    output: Math.min(200, Math.ceil((output?.draft?.length ?? 0) / 4)),
  };
}
