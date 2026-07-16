import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPhase4Summary,
  validatePhase4Dataset
} from "./lib/sakaisujihonmachi-phase4-data.mjs";

const repoRoot = join(fileURLToPath(new URL("..", import.meta.url)), "..");
const datasetPath = join(
  repoRoot,
  "docs",
  "data",
  "sakaisujihonmachi-phase4-30-shops-2026-07-15.json"
);
const previewPath = join(
  repoRoot,
  "docs",
  "data",
  "sakaisujihonmachi-phase4-supabase-draft-preview-2026-07-15.json"
);
const reportPath = join(
  repoRoot,
  "docs",
  "seo",
  "sakaisujihonmachi-phase4-data-report-2026-07-15.md"
);

const dataset = JSON.parse(readFileSync(datasetPath, "utf8"));
validatePhase4Dataset(dataset);
const verifiedAt = `${dataset.selection.selected_on}T00:00:00+09:00`;

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function escapeTable(value) {
  return String(value ?? "—").replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

function accessText(shop) {
  const parts = [];
  for (const access of shop.access_points) {
    const exit = access.exit ? ` ${access.exit}` : "";
    const walk = access.walk_minutes === null ? "" : ` 徒歩${access.walk_minutes}分`;
    parts.push(`${access.station}${exit}${walk}`);
  }
  return parts.length > 0 ? unique(parts).join(" / ") : null;
}

function primaryBookingUrl(shop) {
  const priority = new Map([["web", 0], ["line", 1], ["dm", 2], ["other", 3], ["phone", 4]]);
  return [...shop.contact.booking_methods]
    .filter((method) => method.url)
    .sort((left, right) => (priority.get(left.type) ?? 99) - (priority.get(right.type) ?? 99))[0]?.url ?? null;
}

function representativeCourse(shop) {
  if (shop.prices.status !== "verified") return null;
  return shop.prices.courses[shop.prices.representative_course_index] ?? null;
}

const previewShops = dataset.shops.map((shop) => {
  const eligibleForDraftImport = shop.sources.length > 0;
  const access = accessText(shop);
  const bookingUrl = primaryBookingUrl(shop);
  const shopPatch = {
    wp_post_id: shop.wp_post_id,
    ...(shop.official_name.status === "verified" ? { name: shop.official_name.value } : {}),
    ...(shop.official_url.status === "verified" ? { official_url: shop.official_url.value } : {}),
    ...(shop.contact.phone.status === "verified" ? { phone: shop.contact.phone.value } : {}),
    ...(shop.address.status === "verified" && shop.address.visibility === "public" ? { address_text: shop.address.value } : {}),
    ...(access ? { access_text: access } : {}),
    ...(bookingUrl ? { booking_url: bookingUrl } : {}),
    legacy_payload_patch: {
      phase4: {
        verified_on: shop.verified_on,
        address_visibility: shop.address.visibility,
        booking_methods: shop.contact.booking_methods,
        beginner_guidance: shop.beginner_guidance.status === "verified" ? shop.beginner_guidance.value : null,
        unverified_fields: shop.unverified_fields,
        source_urls: shop.sources.map((source) => source.url)
      }
    },
    publication_status: "draft",
    published_at: null
  };

  const prices = shop.prices.status === "verified"
    ? shop.prices.courses.map((course, index) => ({
      wp_post_id: shop.wp_post_id,
      course_name: course.name,
      duration_minutes: course.duration_minutes,
      amount_yen: course.amount_yen,
      currency: "JPY",
      notes: index === shop.prices.representative_course_index ? "Phase 4代表料金" : "Phase 4確認済み通常料金",
      is_public: false,
      verified_at: verifiedAt
    }))
    : [];

  const businessHours = shop.business_hours.status === "verified"
    ? [{
      wp_post_id: shop.wp_post_id,
      day_of_week: null,
      opens_at: shop.business_hours.value.is_24_hours ? null : shop.business_hours.value.opens_at,
      closes_at: shop.business_hours.value.is_24_hours ? null : shop.business_hours.value.closes_at,
      is_overnight: shop.business_hours.value.closes_next_day,
      notes: shop.business_hours.value.display,
      is_public: false,
      verified_at: verifiedAt
    }]
    : [];

  const sourcesByKey = new Map();
  for (const source of shop.sources) {
    const key = `official:${source.url}`;
    const current = sourcesByKey.get(key);
    if (current) {
      current.metadata.phase4_source_ids = unique([...current.metadata.phase4_source_ids, source.id]);
      current.metadata.original_kinds = unique([...current.metadata.original_kinds, source.kind]);
      current.metadata.fields = unique([...current.metadata.fields, ...source.fields]);
      current.metadata.titles = unique([...current.metadata.titles, source.title]);
      continue;
    }
    sourcesByKey.set(key, {
      source_url: source.url,
      source_kind: "official",
      title: source.title,
      fetched_at: null,
      verified_at: verifiedAt,
      metadata: {
        phase4_source_ids: [source.id],
        original_kinds: [source.kind],
        fields: [...source.fields],
        titles: [source.title],
        checked_on: source.checked_on
      }
    });
  }
  const sources = [...sourcesByKey.values()];

  const sourceLinks = shop.sources.flatMap((source) => source.fields.map((fieldName) => ({
    wp_post_id: shop.wp_post_id,
    source_url: source.url,
    source_kind: "official",
    field_name: fieldName,
    verification_status: "verified",
    is_public: false
  })));

  return {
    selection_position: shop.selection_position,
    wp_post_id: shop.wp_post_id,
    wordpress_comparison: {
      title: shop.wordpress_title,
      snapshot: shop.wordpress_snapshot
    },
    eligible_for_draft_import: eligibleForDraftImport,
    supabase_draft_candidate: eligibleForDraftImport ? {
      shop_patch: shopPatch,
      prices,
      business_hours: businessHours,
      sources,
      source_links: sourceLinks
    } : null,
    requires_human_check: eligibleForDraftImport,
    notes: shop.notes
  };
});

const preview = {
  schema_version: 1,
  generated_on: dataset.selection.selected_on,
  mode: "supabase-draft-preview",
  apply_status: "not-applied",
  public_data_source: "wordpress",
  target_data_store: "supabase",
  target_state: {
    shops_publication_status: "draft",
    rows_is_public: false,
    public_cutover: false
  },
  target_tables: [
    "app.shops",
    "app.shop_prices",
    "app.shop_business_hours",
    "app.sources",
    "app.shop_source_links"
  ],
  target: dataset.area,
  selection: dataset.selection,
  safeguards: [
    "WordPressは現行公開値との比較にだけ使い、更新先にしない",
    "未確認値はSupabase draft候補へ出さない",
    "app.shopsはdraft、関連行はis_public=falseを維持する",
    "本番WordPress、Supabase、外部サービスへ自動書き込みしない"
  ],
  summary: {
    shops_eligible: previewShops.filter((shop) => shop.eligible_for_draft_import).length,
    shop_prices: previewShops.reduce((count, shop) => count + (shop.supabase_draft_candidate?.prices.length ?? 0), 0),
    shop_business_hours: previewShops.reduce((count, shop) => count + (shop.supabase_draft_candidate?.business_hours.length ?? 0), 0),
    source_observations: dataset.shops.reduce((count, shop) => count + shop.sources.length, 0),
    sources: previewShops.reduce((count, shop) => count + (shop.supabase_draft_candidate?.sources.length ?? 0), 0),
    shop_source_links: previewShops.reduce((count, shop) => count + (shop.supabase_draft_candidate?.source_links.length ?? 0), 0)
  },
  shops: previewShops
};

const representativePrices = dataset.shops
  .map((shop) => ({ shop, course: representativeCourse(shop) }))
  .filter(({ course }) => course !== null);
const sortedAmounts = representativePrices.map(({ course }) => course.amount_yen).sort((a, b) => a - b);
const median = sortedAmounts.length === 0
  ? null
  : sortedAmounts.length % 2 === 1
    ? sortedAmounts[(sortedAmounts.length - 1) / 2]
    : (sortedAmounts[sortedAmounts.length / 2 - 1] + sortedAmounts[sortedAmounts.length / 2]) / 2;

const priceBands = [
  { label: "10,000円未満", count: sortedAmounts.filter((amount) => amount < 10000).length },
  { label: "10,000〜11,999円", count: sortedAmounts.filter((amount) => amount >= 10000 && amount < 12000).length },
  { label: "12,000〜14,999円", count: sortedAmounts.filter((amount) => amount >= 12000 && amount < 15000).length },
  { label: "15,000〜19,999円", count: sortedAmounts.filter((amount) => amount >= 15000 && amount < 20000).length },
  { label: "20,000円以上", count: sortedAmounts.filter((amount) => amount >= 20000).length }
];

const verifiedHours = dataset.shops.filter((shop) => shop.business_hours.status === "verified");
const confirmedLateNight = verifiedHours.filter((shop) => {
  const hours = shop.business_hours.value;
  return hours.is_24_hours || (hours.closes_next_day && hours.closes_at !== null);
});
const openEndedHours = verifiedHours.filter((shop) => shop.business_hours.value.closes_at === null);

const accessCounts = new Map();
for (const shop of dataset.shops) {
  for (const access of shop.access_points) {
    const label = `${access.station}${access.exit ? ` ${access.exit}` : "（出口未掲載）"}`;
    accessCounts.set(label, (accessCounts.get(label) ?? 0) + 1);
  }
}

const bookingCounts = new Map();
for (const shop of dataset.shops) {
  for (const method of shop.contact.booking_methods) {
    bookingCounts.set(method.type, (bookingCounts.get(method.type) ?? 0) + 1);
  }
}

const beginnerShops = dataset.shops.filter((shop) => shop.beginner_guidance.status === "verified");
const summary = buildPhase4Summary(dataset);
const sourceCount = dataset.shops.reduce((count, shop) => count + shop.sources.length, 0);
const draftCandidateCount = previewShops.filter((shop) => shop.eligible_for_draft_import).length;

const lines = [];
lines.push("# 堺筋本町 Phase 4 実データ調査レポート", "");
lines.push(`確認日: ${dataset.selection.selected_on}`, "");
lines.push("## 結論", "");
lines.push(`- WordPress既定順で固定した30店舗を調査し、一次情報${sourceCount}件を項目単位で記録した。`);
lines.push(`- 料金確認済みは${summary.prices_verified}/30、営業時間確認済みは${summary.hours_verified}/30、駅情報確認済みは${dataset.shops.filter((shop) => shop.access_points.length > 0).length}/30。`);
lines.push(`- Supabase非公開draft候補を持つ店舗は${draftCandidateCount}/30。料金${preview.summary.shop_prices}行、営業時間${preview.summary.shop_business_hours}行、公式URL単位の出典${preview.summary.sources}行（調査記録${preview.summary.source_observations}件）、項目別出典${preview.summary.shop_source_links}行を読み取り専用previewへ変換した。`);
lines.push("- WordPressは現行公開値との比較にだけ使用し、更新先にはしていない。公開データ元はWordPressのまま。");
lines.push("- 未確認値、推測値、利用者投稿の代替文章は追加していない。", "");

lines.push("## 確認済み件数", "");
lines.push("| 項目 | 確認済み |", "|---|---:|");
lines.push(`| 公式名 | ${summary.official_name_verified}/30 |`);
lines.push(`| 住所 | ${dataset.shops.filter((shop) => shop.address.status === "verified").length}/30 |`);
lines.push(`| 駅・出口・徒歩 | ${dataset.shops.filter((shop) => shop.access_points.length > 0).length}/30 |`);
lines.push(`| 営業時間 | ${summary.hours_verified}/30 |`);
lines.push(`| 料金 | ${summary.prices_verified}/30 |`);
lines.push(`| 電話 | ${dataset.shops.filter((shop) => shop.contact.phone.status === "verified").length}/30 |`);
lines.push(`| 予約方法 | ${dataset.shops.filter((shop) => shop.contact.booking_methods.length > 0).length}/30 |`);
lines.push(`| 初回向け公式案内 | ${beginnerShops.length}/30 |`, "");

lines.push("## 料金集計", "");
if (sortedAmounts.length > 0) {
  lines.push(`- 代表料金確認済み: ${sortedAmounts.length}/30`);
  lines.push(`- 最小: ${Math.min(...sortedAmounts).toLocaleString("ja-JP")}円`);
  lines.push(`- 中央値: ${median.toLocaleString("ja-JP")}円`);
  lines.push(`- 最大: ${Math.max(...sortedAmounts).toLocaleString("ja-JP")}円`, "");
}
lines.push("| 代表料金帯 | 店舗数 |", "|---|---:|");
for (const band of priceBands) lines.push(`| ${band.label} | ${band.count} |`);
lines.push("");

lines.push("## 営業時間と深夜対応", "");
lines.push(`- 営業時間確認済み: ${verifiedHours.length}/30`);
lines.push(`- 閉店時刻が翌日と明記された深夜対応: ${confirmedLateNight.length}/${verifiedHours.length}`);
lines.push(`- LAST表記で具体的な閉店時刻が未掲載: ${openEndedHours.length}/${verifiedHours.length}`);
lines.push("- LAST表記は深夜対応件数へ含めていない。", "");

lines.push("## 駅・出口", "");
lines.push("| 確認済みの駅・出口 | 店舗内の掲載数 |", "|---|---:|");
for (const [label, count] of [...accessCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))) {
  lines.push(`| ${escapeTable(label)} | ${count} |`);
}
lines.push("");

lines.push("## 予約方法", "");
lines.push("| 種類 | 確認済み件数 |", "|---|---:|");
for (const type of ["phone", "web", "line", "dm", "other"]) {
  lines.push(`| ${type} | ${bookingCounts.get(type) ?? 0} |`);
}
lines.push("");

lines.push("## 初回向け公式案内", "");
if (beginnerShops.length === 0) {
  lines.push("確認できた店舗なし。", "");
} else {
  for (const shop of beginnerShops) {
    lines.push(`- ${shop.wordpress_title}（WP ${shop.wp_post_id}）: ${shop.beginner_guidance.value}`);
  }
  lines.push("");
}

lines.push("## 30店舗の確認結果", "");
lines.push("| 順 | WP ID | WordPress名 | 公式名 | 代表料金 | 営業時間 | 駅・出口 | 予約 | 未確認項目 |", "|---:|---:|---|---|---|---|---|---|---|");
for (const shop of dataset.shops) {
  const representative = representativeCourse(shop);
  const access = shop.access_points
    .map((point) => `${point.station}${point.exit ? ` ${point.exit}` : ""}${point.walk_minutes === null ? "" : ` 徒歩${point.walk_minutes}分`}`)
    .join(" / ");
  lines.push(`| ${shop.selection_position} | ${shop.wp_post_id} | ${escapeTable(shop.wordpress_title)} | ${escapeTable(shop.official_name.status === "verified" ? shop.official_name.value : "未確認")} | ${representative ? `${representative.duration_minutes}分 ${representative.amount_yen.toLocaleString("ja-JP")}円` : "未確認"} | ${escapeTable(shop.business_hours.status === "verified" ? shop.business_hours.value.display : "未確認")} | ${escapeTable(access || "未確認")} | ${shop.contact.booking_methods.length > 0 ? escapeTable(shop.contact.booking_methods.map((method) => method.label).join(" / ")) : "未確認"} | ${escapeTable(shop.unverified_fields.join("、") || "なし")} |`);
}
lines.push("");

lines.push("## 一次情報一覧", "");
for (const shop of dataset.shops) {
  lines.push(`### ${shop.selection_position}. ${shop.wordpress_title}（WP ${shop.wp_post_id}）`, "");
  if (shop.sources.length === 0) {
    lines.push("- 採用できる一次情報なし", "");
  } else {
    for (const source of shop.sources) {
      lines.push(`- [${source.title}](${source.url}) — 確認日 ${source.checked_on}`);
    }
    lines.push("");
  }
  for (const note of shop.notes) lines.push(`- 注記: ${note}`);
  if (shop.notes.length > 0) lines.push("");
}

lines.push("## 反映前の停止状態", "");
lines.push("- WordPress更新: 対象外・未実施");
lines.push("- ローカルSupabase非公開draft投入: 2回実行・検証済み");
lines.push("- 本番Supabase非公開draft投入: 未実施");
lines.push("- Supabase公開切替: 未実施");
lines.push("- push: 未実施");
lines.push("- deploy・本番公開: 未実施");
lines.push("- 次の工程: ローカル検証済みSQLを人間確認し、別承認後に本番Supabaseの非公開テーブルへ投入する。公開参照先の切替はさらに別承認とする。", "");

mkdirSync(dirname(previewPath), { recursive: true });
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(previewPath, `${JSON.stringify(preview, null, 2)}\n`);
writeFileSync(reportPath, `${lines.join("\n")}\n`);

console.log(`Rendered ${preview.shops.length} Supabase draft preview rows and Phase 4 report`);
