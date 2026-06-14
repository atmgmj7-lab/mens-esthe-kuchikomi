import { wpApiBase } from "@/lib/wp/client";
import { requestWpOrigin } from "@/lib/wp/origin-request";
import { usesWpOriginIp } from "@/lib/wp/origin";
import type { ReviewSubmitPayload } from "@/lib/review-validation";

export type ReviewWordPressPayload = ReviewSubmitPayload & {
  shopId: number;
  shopTitle: string;
};

type SubmitResult = { ok: true; id?: number } | { ok: false; error: string };

function isDryRun(): boolean {
  return process.env.REVIEW_SUBMIT_DRY_RUN === "true";
}

function isWpConfigured(): boolean {
  return Boolean(process.env.WP_REVIEW_SUBMIT_USER && process.env.WP_REVIEW_SUBMIT_APP_PASSWORD);
}

async function postReviewToWordPress(
  payload: ReviewWordPressPayload,
  authHeader: string
): Promise<Response> {
  const path = "/wp/v2/reviews";
  const url = `${wpApiBase}${path}`;
  const body = JSON.stringify({
    title: `${payload.shopTitle}への口コミ（${payload.nickname}）`,
    status: "pending",
    content: payload.reviewBody,
    meta: {
      review_shop_id: payload.shopId,
      review_shop_slug: payload.shopSlug,
      reviewer_name: payload.nickname,
      used_period: payload.usedPeriod,
      rating_total: payload.ratingTotal,
      rating_price: payload.ratingPrice ?? 0,
      rating_service: payload.ratingService ?? 0,
      rating_cleanliness: payload.ratingCleanliness ?? 0,
      revisit_intent: payload.revisitIntent ?? "",
      approval_status: "pending"
    }
  });

  const init: RequestInit = {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json"
    },
    body
  };

  if (usesWpOriginIp(wpApiBase)) {
    const parsed = new URL(url);
    return requestWpOrigin(`${parsed.pathname}${parsed.search}`, init);
  }

  return fetch(url, init);
}

export async function submitReviewToWordPress(payload: ReviewWordPressPayload): Promise<SubmitResult> {
  if (isDryRun()) {
    console.info("[review-submit] DRY_RUN – WordPress post skipped", {
      shopSlug: payload.shopSlug
    });
    return { ok: true };
  }

  if (!isWpConfigured()) {
    if (process.env.NODE_ENV === "production") {
      console.error("[review-submit] WordPress credentials not configured in production");
      return {
        ok: false,
        error: "現在口コミを受け付けできません。時間をおいて再度お試しください。"
      };
    }

    console.info("[review-submit] WP credentials not configured (non-production) – skipping post", {
      shopSlug: payload.shopSlug
    });
    return { ok: true };
  }

  const user = process.env.WP_REVIEW_SUBMIT_USER as string;
  const appPassword = process.env.WP_REVIEW_SUBMIT_APP_PASSWORD as string;
  const authHeader = `Basic ${Buffer.from(`${user}:${appPassword}`).toString("base64")}`;

  try {
    const response = await postReviewToWordPress(payload, authHeader);
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("[review-submit] WordPress API failed", response.status, text.slice(0, 300));
      return {
        ok: false,
        error: "送信に失敗しました。時間をおいて再度お試しください。"
      };
    }

    const created = (await response.json()) as { id?: number };
    return { ok: true, id: created.id };
  } catch (error) {
    console.error("[review-submit] request failed", error);
    return {
      ok: false,
      error: "送信に失敗しました。時間をおいて再度お試しください。"
    };
  }
}
