import nodemailer from "nodemailer";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/contact-rate-limit";
import { buildContactEmailText, validateContactPayload } from "@/lib/contact-validation";

function getClientIp(request: NextRequest): string {
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

export async function POST(request: NextRequest) {
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

  const submittedAt = new Date();
  const text = buildContactEmailText(validation.data, submittedAt);
  const subject = `【Escomi】お問い合わせ: ${validation.data.type}（${validation.data.name}）`;

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
