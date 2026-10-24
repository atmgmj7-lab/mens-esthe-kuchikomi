import nodemailer from "nodemailer";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/contact-rate-limit";
import { buildContactEmailText, validateContactPayload } from "@/lib/contact-validation";
import { resolveContactVercelFallback } from "@/lib/contact-vercel-fallback";

const GENERIC_CONTACT_UNAVAILABLE = "現在お問い合わせを受け付けできません。時間をおいて再度お試しください。";
const ALLOWED_ERROR_NAMES = new Set(["Error", "TypeError", "RangeError", "AbortError", "TimeoutError"]);
const ALLOWED_LOCATION_PATHS = new Map<string, ReadonlySet<string>>([
  ["escomi-headless-narikiyos-projects.vercel.app", new Set(["/api/contact/"])],
  ["vercel.com", new Set(["/", "/login", "/sso-api"])],
  ["www.vercel.com", new Set(["/", "/login", "/sso-api"])],
]);

function logContactFallback(event: string, fields: Readonly<Record<string, string | number>> = {}): void {
  // Do not add request data, binding values, headers, URLs, or error messages.
  console.error("[contact-fallback]", { event, ...fields });
}

function safeErrorName(error: unknown): string {
  return error instanceof Error && ALLOWED_ERROR_NAMES.has(error.name) ? error.name : "UnknownError";
}

function safeContentType(contentType: string): string {
  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType === "application/json" || mediaType === "text/html") return mediaType;
  return mediaType ? "other" : "missing";
}

function safeLocation(location: string | null, fallbackUrl: string): string {
  if (!location) return "missing";
  try {
    const url = new URL(location, fallbackUrl);
    const allowedPaths = ALLOWED_LOCATION_PATHS.get(url.hostname);
    return allowedPaths?.has(url.pathname) ? `${url.hostname}${url.pathname}` : "unapproved";
  } catch {
    return "invalid";
  }
}

function getClientIp(request: NextRequest): string {
  const cloudflare = request.headers.get("cf-connecting-ip")?.trim();
  if (cloudflare) return cloudflare;
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
}

function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.CONTACT_FROM_EMAIL &&
      process.env.CONTACT_TO_EMAIL
  );
}

function isDryRun(): boolean {
  return process.env.CONTACT_FORM_DRY_RUN === "true";
}

function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

async function forwardToExistingVercelContact(
  fallback: NonNullable<ReturnType<typeof resolveContactVercelFallback>>,
  payload: unknown,
  clientIp: string,
): Promise<NextResponse> {
  const headers = new Headers(fallback.headers);
  headers.set("x-forwarded-for", clientIp);

  try {
    const response = await fetch(fallback.url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      redirect: "error",
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("application/json")) {
      logContactFallback("contact_fallback_upstream_non_json", {
        upstreamStatus: response.status,
        contentType: safeContentType(contentType),
        location: safeLocation(response.headers.get("location"), fallback.url),
      });
      return NextResponse.json(
        { ok: false, message: GENERIC_CONTACT_UNAVAILABLE },
        { status: 503 },
      );
    }

    const body = await response.json().catch(() => null) as { ok?: unknown; message?: unknown } | null;
    if (!response.ok || body?.ok !== true) {
      const status = response.status >= 400 && response.status <= 599 ? response.status : 502;
      if (response.status === 503) {
        logContactFallback("contact_fallback_upstream_json_503", {
          upstreamStatus: response.status,
          contentType: safeContentType(contentType),
          location: safeLocation(response.headers.get("location"), fallback.url),
        });
      }
      const message = typeof body?.message === "string"
        ? body.message
        : "送信に失敗しました。時間をおいて再度お試しください。";
      return NextResponse.json({ ok: false, message }, { status });
    }

    return NextResponse.json({
      ok: true,
      message: typeof body.message === "string" ? body.message : "送信が完了しました。",
    });
  } catch (error) {
    logContactFallback("contact_fallback_fetch_exception", { errorName: safeErrorName(error) });
    return NextResponse.json(
      { ok: false, message: GENERIC_CONTACT_UNAVAILABLE },
      { status: 503 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, message: "不正なリクエストです。" }, { status: 403 });
  }

  const ip = getClientIp(request);
  const rate = checkRateLimit(ip);

  if (!rate.allowed) {
    return NextResponse.json(
      {
        ok: false,
        message: `送信回数が多すぎます。${rate.retryAfterSec}秒後に再度お試しください。`
      },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "リクエスト形式が正しくありません。" },
      { status: 400 }
    );
  }

  const validation = validateContactPayload(body);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, message: validation.error }, { status: 400 });
  }

  const subject = `【Eskomi】お問い合わせ: ${validation.data.type}（${validation.data.name}）`;
  const fallback = resolveContactVercelFallback(process.env);
  if (fallback) {
    return forwardToExistingVercelContact(fallback, validation.data, ip);
  }
  if (process.env.NODE_ENV === "production") {
    logContactFallback("contact_fallback_disabled");
  }

  if (isDryRun()) {
    console.info("[contact]", { event: "contact_dry_run" });
    return NextResponse.json({ ok: true, message: "送信が完了しました。（DRY_RUN）" });
  }

  if (!isSmtpConfigured()) {
    if (process.env.NODE_ENV === "production") {
      console.error("[contact]", { event: "contact_smtp_not_configured" });
      return NextResponse.json(
        {
          ok: false,
          message: GENERIC_CONTACT_UNAVAILABLE
        },
        { status: 503 }
      );
    }

    console.info("[contact] SMTP not configured (non-production) – skipping send", { subject, ip });
    return NextResponse.json({ ok: true, message: "送信が完了しました。（開発モード）" });
  }

  try {
    const submittedAt = new Date();
    const text = buildContactEmailText(validation.data, submittedAt);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.CONTACT_FROM_EMAIL,
      to: process.env.CONTACT_TO_EMAIL,
      replyTo: validation.data.email,
      subject,
      text
    });

    return NextResponse.json({ ok: true, message: "送信が完了しました。" });
  } catch (error) {
    console.error("[contact]", { event: "contact_smtp_send_failed", errorName: safeErrorName(error) });
    return NextResponse.json(
      {
        ok: false,
        message: "送信に失敗しました。時間をおいて再度お試しください。"
      },
      { status: 500 }
    );
  }
}
