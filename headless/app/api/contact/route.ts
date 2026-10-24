import nodemailer from "nodemailer";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/contact-rate-limit";
import { buildContactEmailText, validateContactPayload } from "@/lib/contact-validation";
import { resolveContactVercelFallback } from "@/lib/contact-vercel-fallback";

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

const workersDiagnosticHost = "escomi-workers-production.workers.dev";

function isWorkersDiagnosticRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin || request.nextUrl.hostname !== workersDiagnosticHost) return false;
  try {
    return new URL(origin).hostname === workersDiagnosticHost;
  } catch {
    return false;
  }
}

function contactFallbackProbeHeaders(): HeadersInit {
  return {
    "cache-control": "no-store",
    "x-robots-tag": "noindex, nofollow",
  };
}

function logContactFallbackProbe(response: Response): void {
  const location = response.headers.get("location");
  let locationHost: string | null = null;
  let locationPath: string | null = null;
  if (location) {
    try {
      const url = new URL(location);
      locationHost = url.host;
      locationPath = url.pathname;
    } catch {
      locationPath = "invalid";
    }
  }
  console.info("[contact-fallback-probe]", {
    status: response.status,
    locationHost,
    locationPath,
    contentType: response.headers.get("content-type")?.split(";", 1)[0] ?? null,
  });
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
      return NextResponse.json(
        { ok: false, message: "現在お問い合わせを受け付けできません。時間をおいて再度お試しください。" },
        { status: 503 },
      );
    }

    const body = await response.json().catch(() => null) as { ok?: unknown; message?: unknown } | null;
    if (!response.ok || body?.ok !== true) {
      const status = response.status >= 400 && response.status <= 599 ? response.status : 502;
      const message = typeof body?.message === "string"
        ? body.message
        : "送信に失敗しました。時間をおいて再度お試しください。";
      return NextResponse.json({ ok: false, message }, { status });
    }

    return NextResponse.json({
      ok: true,
      message: typeof body.message === "string" ? body.message : "送信が完了しました。",
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "現在お問い合わせを受け付けできません。時間をおいて再度お試しください。" },
      { status: 503 },
    );
  }
}

/**
 * Temporary, workers.dev-only non-sending connectivity probe. It returns no
 * upstream details; the sanitized observation is available only in Worker logs.
 */
export async function OPTIONS(request: NextRequest) {
  if (!isWorkersDiagnosticRequest(request)) return new NextResponse(null, { status: 404, headers: contactFallbackProbeHeaders() });
  const fallback = resolveContactVercelFallback(process.env);
  if (!fallback) {
    console.info("[contact-fallback-probe]", { state: "disabled" });
    return new NextResponse(null, { status: 204, headers: contactFallbackProbeHeaders() });
  }
  try {
    const response = await fetch(fallback.url, {
      method: "HEAD",
      headers: fallback.headers,
      redirect: "manual",
    });
    logContactFallbackProbe(response);
  } catch {
    console.info("[contact-fallback-probe]", { state: "fetch-error" });
  }
  return new NextResponse(null, { status: 204, headers: contactFallbackProbeHeaders() });
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

  if (isDryRun()) {
    console.info("[contact] DRY_RUN – email not sent", { subject, ip });
    return NextResponse.json({ ok: true, message: "送信が完了しました。（DRY_RUN）" });
  }

  if (!isSmtpConfigured()) {
    if (process.env.NODE_ENV === "production") {
      console.error("[contact] SMTP not configured in production");
      return NextResponse.json(
        {
          ok: false,
          message: "現在お問い合わせを受け付けできません。時間をおいて再度お試しください。"
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
    console.error("[contact] send failed", error);
    return NextResponse.json(
      {
        ok: false,
        message: "送信に失敗しました。時間をおいて再度お試しください。"
      },
      { status: 500 }
    );
  }
}
