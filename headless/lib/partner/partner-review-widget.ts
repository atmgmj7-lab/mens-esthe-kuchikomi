const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHOP_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type PublicPartnerWidgetSource = Readonly<{
  shopId: number;
  shopSlug: string;
  shopName: string;
  canonicalUrl: string;
  reviewUrl: string;
  widgetUrl: string;
  reviewCount: number;
  averageRating: number | null;
}>;

export type PublicPartnerWidget =
  | Readonly<{
      status: "available";
      badge: "Eskomi Official Partner";
      shopName: string;
      reviewSummary: Readonly<{ kind: "count_only"; count: number }>
        | Readonly<{ kind: "average_and_count"; average: number; count: number }>;
      reviewUrl: string;
      iframeSnippet: string;
    }>
  | Readonly<{ status: "unavailable" }>;

function isSafeUrl(value: string, path: string): boolean {
  try {
    const url = new URL(value);
    return url.origin === "https://mens-esthe-kuchikomi.com" && url.pathname === path
      && !url.search && !url.hash && !url.username && !url.password;
  } catch {
    return false;
  }
}

function validSource(source: PublicPartnerWidgetSource): boolean {
  const reviewToken = source.reviewUrl.match(/^https:\/\/mens-esthe-kuchikomi\.com\/r\/([0-9a-f-]+)\/$/i)?.[1] ?? "";
  const widgetToken = source.widgetUrl.match(/^https:\/\/mens-esthe-kuchikomi\.com\/partner\/widget\/([0-9a-f-]+)\/$/i)?.[1] ?? "";
  return Number.isSafeInteger(source.shopId) && source.shopId > 0
    && SHOP_SLUG_RE.test(source.shopSlug)
    && source.shopName.trim().length > 0 && source.shopName.length <= 120 && !/[<>&"]/u.test(source.shopName)
    && isSafeUrl(source.canonicalUrl, `/shops/${source.shopSlug}/`)
    && UUID_RE.test(reviewToken) && UUID_RE.test(widgetToken) && reviewToken.toLowerCase() === widgetToken.toLowerCase()
    && isSafeUrl(source.reviewUrl, `/r/${reviewToken.toLowerCase()}/`)
    && isSafeUrl(source.widgetUrl, `/partner/widget/${widgetToken.toLowerCase()}/`)
    && Number.isSafeInteger(source.reviewCount) && source.reviewCount >= 0
    && (source.averageRating === null || (Number.isFinite(source.averageRating) && source.averageRating >= 1 && source.averageRating <= 5));
}

export function buildPartnerWidgetIframeSnippet(input: Readonly<{ shopName: string; widgetUrl: string }>): string | null {
  const token = input.widgetUrl.match(/^https:\/\/mens-esthe-kuchikomi\.com\/partner\/widget\/([0-9a-f-]+)\/$/i)?.[1] ?? "";
  if (!UUID_RE.test(token)
    || !isSafeUrl(input.widgetUrl, `/partner/widget/${token.toLowerCase()}/`)
    || input.shopName.trim().length === 0 || input.shopName.length > 120 || /[<>&"]/u.test(input.shopName)) return null;
  return `<iframe src="${input.widgetUrl}" title="${input.shopName}のEskomi口コミ" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" style="width:100%;max-width:100%;border:0;min-height:180px;"></iframe>`;
}

export function resolvePublicPartnerWidget(source: PublicPartnerWidgetSource): PublicPartnerWidget {
  if (!validSource(source)) return { status: "unavailable" };
  const iframeSnippet = buildPartnerWidgetIframeSnippet(source);
  if (!iframeSnippet) return { status: "unavailable" };
  const reviewSummary = source.reviewCount >= 3 && source.averageRating !== null
    ? { kind: "average_and_count" as const, average: source.averageRating, count: source.reviewCount }
    : { kind: "count_only" as const, count: source.reviewCount };
  return {
    status: "available",
    badge: "Eskomi Official Partner",
    shopName: source.shopName,
    reviewSummary,
    reviewUrl: source.reviewUrl,
    iframeSnippet,
  };
}
