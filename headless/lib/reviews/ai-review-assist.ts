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
    || (row.draft !== undefined && (typeof row.draft !== "string" || row.draft.length > 1000))) return null;
  const draft = typeof row.draft === "string" ? row.draft.trim() : "";
  return draft.length === 0
    ? { decision: row.decision as AiReviewDecision }
    : { decision: row.decision as AiReviewDecision, draft };
}

const SHOP_REPLY_RE = /(?:ご来店|お待ち(?:して|しており)|安心いたしました|ありがとうございます|心より)/u;
const SENTIMENT_PHRASES = ["安心", "おすすめ", "最高", "満足", "素晴ら", "よかっ", "嬉し", "残念", "最悪", "不満", "ひど"] as const;
const CONTENT_CHAR_RE = /[\p{Script=Han}\p{Script=Katakana}\p{Number}A-Za-z]/u;

export function isAiReviewDraftContractSafe(note: string, draft: string): boolean {
  if (SHOP_REPLY_RE.test(draft)) return false;
  if ([...draft].some((character) => CONTENT_CHAR_RE.test(character) && !note.includes(character))) return false;
  return SENTIMENT_PHRASES.every((phrase) => !draft.includes(phrase) || note.includes(phrase));
}

function modelName(environment: Readonly<Record<string, string | undefined>>): string {
  const configured = environment.GEMINI_REVIEW_MODEL?.trim();
  return configured && /^[a-z0-9._-]{1,120}$/i.test(configured) ? configured : "gemini-3.1-flash-lite";
}

const telemetry: AiReviewTelemetry[] = [];
const AI_REVIEW_PRICING_USD_PER_MILLION = {
  standard: { input: 0.25, output: 1.5 },
  batch: { input: 0.125, output: 0.75 },
} as const;

export function recordAiReviewTelemetry(event: AiReviewTelemetry): void {
  telemetry.push(event);
  if (telemetry.length > 100) telemetry.splice(0, telemetry.length - 100);
}

export function estimateAiReviewCostUsd(inputTokens: number, outputTokens: number, mode: AiReviewTelemetry["mode"] = "standard"): number {
  const pricing = AI_REVIEW_PRICING_USD_PER_MILLION[mode];
  return Number(((inputTokens * pricing.input / 1_000_000) + (outputTokens * pricing.output / 1_000_000)).toFixed(8));
}

export function resolveAiReviewModel(environment: Readonly<Record<string, string | undefined>>): string {
  return modelName(environment);
}

type GeminiModelMetadata = Readonly<{ name?: unknown; supportedGenerationMethods?: unknown }>;

function isStableTextGenerationModel(modelMetadata: GeminiModelMetadata): modelMetadata is Readonly<{ name: string; supportedGenerationMethods: readonly string[] }> {
  if (typeof modelMetadata.name !== "string" || !Array.isArray(modelMetadata.supportedGenerationMethods)
    || !modelMetadata.supportedGenerationMethods.includes("generateContent")) return false;
  const model = modelMetadata.name.replace(/^models\//, "");
  return /^gemini-[a-z0-9.-]{1,120}$/i.test(model)
    && !/(?:preview|experimental|exp|latest|live|tts|image|embedding|robotics|banana)/i.test(model)
    && !/^gemini-2\.0-/i.test(model);
}

export async function listAvailableGeminiTextModels(
  environment: Readonly<Record<string, string | undefined>>,
  fetchImpl: typeof fetch = fetch,
): Promise<readonly string[] | null> {
  const apiKey = environment.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  try {
    const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`, {
      method: "GET",
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = await response.json() as { models?: GeminiModelMetadata[] };
    if (!Array.isArray(payload.models)) return null;
    return payload.models
      .filter(isStableTextGenerationModel)
      .map((model) => model.name.replace(/^models\//, ""));
  } catch {
    return null;
  }
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
      let response: Response;
      try {
        response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal,
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: JSON.stringify({
              task: "Edit a customer's Japanese review in the reviewer's first-person voice. Return JSON only. Do not change rating or tags. Do not invent, remove, or reverse facts or sentiment. Never write a business reply, greeting, thanks, invitation, or recommendation. If a safe minimal edit is uncertain, choose HUMAN_REVIEW and omit draft.",
              ratingTotal: input.ratingTotal,
              tags: input.tags,
              note: input.note,
              response: { decision: "SAFE|REWRITE_SAFE|HUMAN_REVIEW|REJECT", draft: "optional Japanese text up to 1000 chars" },
            }) }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: {
              type: "object",
              properties: {
                decision: { type: "string", enum: [...AI_REVIEW_DECISIONS] },
                draft: { type: "string", maxLength: 1000 },
              },
              required: ["decision"],
            },
            maxOutputTokens: 200,
          },
          }),
        });
      } catch (error) {
        const reason = error instanceof Error && error.name === "AbortError" ? "aborted" : "network";
        console.info(JSON.stringify({ event: "review_ai_provider_transport_failure", model, reason }));
        return null;
      }
      if (!response.ok) {
        console.info(JSON.stringify({ event: "review_ai_provider_response", model, status: response.status }));
        return null;
      }
      let payload: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: unknown }> };
      try {
        payload = await response.json() as typeof payload;
      } catch {
        console.info(JSON.stringify({ event: "review_ai_provider_response_parse_failure", model }));
        return null;
      }
      const candidate = payload.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text;
      if (typeof text !== "string") {
        const finishReason = typeof candidate?.finishReason === "string" ? candidate.finishReason : "missing";
        console.info(JSON.stringify({ event: "review_ai_provider_response_shape", model, candidateCount: payload.candidates?.length ?? 0, finishReason }));
        return null;
      }
      try {
        const output = parseAiReviewOutput(JSON.parse(text));
        if (!output) console.info(JSON.stringify({ event: "review_ai_provider_structured_output_invalid", model }));
        if (output?.draft && !isAiReviewDraftContractSafe(input.note, output.draft)) {
          console.info(JSON.stringify({ event: "review_ai_provider_draft_contract_guard", model }));
          return { decision: "HUMAN_REVIEW" };
        }
        return output;
      } catch {
        console.info(JSON.stringify({ event: "review_ai_provider_response_json_invalid", model }));
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
