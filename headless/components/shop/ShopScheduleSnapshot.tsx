import { sanitizeTodayAnalysisText } from "@/lib/area-shop-utils";
import { safeText } from "@/lib/wp/client";
import { shopField } from "@/lib/shop-contact";
import type { ShopView } from "@/lib/wp/types";

const SCHEDULE_DATE_KEYS = [
  "shop_schedule_updated_at",
  "shop_updated_at",
  "schedule_updated_at",
  "attendance_updated_at"
] as const;

function resolveScheduleFetchedAt(shop: ShopView): string | null {
  for (const key of SCHEDULE_DATE_KEYS) {
    const raw = safeText(shop.acf[key]) || shopField(shop, key);
    if (raw) return raw;
  }
  return null;
}

function formatScheduleDateLabel(raw: string): string {
  const normalized = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(normalized)) {
    const [y, m, d] = normalized.slice(0, 10).split("-");
    return `${y}年${Number(m)}月${Number(d)}日`;
  }
  if (/^\d{4}年/.test(normalized)) return normalized;
  return normalized;
}

export function ShopScheduleSnapshot({ shop }: { shop: ShopView }) {
  const todayAnalysis = shopField(shop, "shop_today_analysis");
  const sanitizedAnalysis = sanitizeTodayAnalysisText(todayAnalysis);
  const fetchedAt = resolveScheduleFetchedAt(shop);
  const hasKnownDate = Boolean(fetchedAt);

  return (
    <section className="shop-info-section hl-section hl-attendance-placeholder">
      <h2 className="mod-customColor es-sec-title">
        <span className="es-sec-title__ja">直近の出勤・空き状況</span>
      </h2>
      <div className="hl-today-box">
        <p className="hl-today-label">RECENT AVAILABILITY</p>
        <p className="hl-today-disclaimer">
          最新の出勤状況は公式サイトでご確認ください。
        </p>
        <p className="hl-today-note">直近取得した出勤情報</p>
        <p className="hl-today-meta">
          最終取得日: {hasKnownDate ? formatScheduleDateLabel(fetchedAt!) : "未確認"}
        </p>
        {sanitizedAnalysis ? (
          <p className="hl-today-analysis">{sanitizedAnalysis}</p>
        ) : (
          <p className="hl-today-note">
            出勤情報は準備中です。詳細は店舗へ直接お問い合わせください。
          </p>
        )}
      </div>
    </section>
  );
}
