export type AreaDepthFieldKey =
  | "officialUrl"
  | "location"
  | "station"
  | "access"
  | "telephone"
  | "price"
  | "businessHours"
  | "booking";

export type AreaDepthEditorial = {
  slug: "shinosaka" | "sakai";
  areaLabel: string;
  observedAt: string;
  observedDateLabel: string;
  expectedPublicShopCount: number;
  gscStatus: "EVIDENCE_AVAILABLE" | "DATA_REQUIRED";
  sourceClass: "OFFICIAL_FACT_AGGREGATE";
  featureFlags: typeof AREA_DEPTH_FEATURE_FLAGS;
  fieldCoverage: Array<{
    key: AreaDepthFieldKey;
    label: string;
    verifiedCount: number;
    missingCount: number;
    verificationRate: number;
  }>;
  price: {
    status: "PUBLIC_READY" | "LIMITED_SAMPLE";
    sampleSize: number;
    minimumYen: number;
    medianYen: number;
    maximumYen: number;
    bands: Array<{ label: string; count: number }>;
  };
  hours: {
    verifiedCount: number;
    parsableSampleSize: number;
    lateNightCount: number;
    afterMidnightCount: number;
    earliestOpening: string;
    latestClosing: string;
  };
  station: {
    sampleSize: number;
    buckets: Array<{ label: string; count: number }>;
  };
  therapists: {
    status: "PUBLIC_READY_WITH_SAMPLE_NOTE";
    profileCount: number;
    ageKnownCount: number;
    availableShopCount: number;
    ageBands: Array<{ label: string; count: number }>;
  };
  portals: {
    factClass: "EXTERNAL_PORTAL_FACT";
    presenceShopCount: number;
    multiPortalShopCount: number;
    maximumConfirmedPortalCount: number;
  };
};

type AreaDepthSource = Omit<AreaDepthEditorial, "fieldCoverage" | "featureFlags"> & {
  fieldCoverage: Array<{
    key: AreaDepthFieldKey;
    label: string;
    verifiedCount: number;
  }>;
};

export const AREA_DEPTH_FEATURE_FLAGS = Object.freeze({
  coverage: true,
  price: true,
  hours: true,
  station: true,
  portals: true,
  therapists: true,
  methodologyFaq: true,
});

const SHARED_PRICE_BANDS = [
  "9,999円以下",
  "10,000〜11,999円",
  "12,000〜13,999円",
  "14,000〜15,999円",
  "16,000円以上",
] as const;

const AREA_DEPTH_SOURCES: Record<AreaDepthEditorial["slug"], AreaDepthSource> = {
  shinosaka: {
    slug: "shinosaka",
    areaLabel: "新大阪",
    observedAt: "2026-08-29T02:27:02.532Z",
    observedDateLabel: "2026年8月29日",
    expectedPublicShopCount: 58,
    gscStatus: "EVIDENCE_AVAILABLE",
    sourceClass: "OFFICIAL_FACT_AGGREGATE",
    fieldCoverage: [
      { key: "officialUrl", label: "公式URL", verifiedCount: 30 },
      { key: "location", label: "住所・location", verifiedCount: 14 },
      { key: "station", label: "最寄駅", verifiedCount: 15 },
      { key: "access", label: "アクセス", verifiedCount: 13 },
      { key: "telephone", label: "電話番号", verifiedCount: 27 },
      { key: "price", label: "料金", verifiedCount: 18 },
      { key: "businessHours", label: "営業時間", verifiedCount: 26 },
      { key: "booking", label: "予約導線", verifiedCount: 17 },
    ],
    price: {
      status: "PUBLIC_READY",
      sampleSize: 18,
      minimumYen: 9000,
      medianYen: 15000,
      maximumYen: 17000,
      bands: SHARED_PRICE_BANDS.map((label, index) => ({ label, count: [1, 1, 4, 6, 6][index] })),
    },
    hours: {
      verifiedCount: 26,
      parsableSampleSize: 21,
      lateNightCount: 21,
      afterMidnightCount: 21,
      earliestOpening: "9:30",
      latestClosing: "翌6:00",
    },
    station: {
      sampleSize: 15,
      buckets: [
        { label: "新大阪", count: 13 },
        { label: "西中島南方", count: 1 },
        { label: "南方", count: 0 },
        { label: "東三国", count: 1 },
        { label: "その他近隣", count: 0 },
      ],
    },
    therapists: {
      status: "PUBLIC_READY_WITH_SAMPLE_NOTE",
      profileCount: 192,
      ageKnownCount: 167,
      availableShopCount: 9,
      ageBands: [
        { label: "20代", count: 78 },
        { label: "30代", count: 54 },
        { label: "40代", count: 27 },
        { label: "50代以上", count: 3 },
        { label: "その他既知年齢", count: 5 },
      ],
    },
    portals: {
      factClass: "EXTERNAL_PORTAL_FACT",
      presenceShopCount: 39,
      multiPortalShopCount: 22,
      maximumConfirmedPortalCount: 4,
    },
  },
  sakai: {
    slug: "sakai",
    areaLabel: "堺東",
    observedAt: "2026-08-29T02:27:39.383Z",
    observedDateLabel: "2026年8月29日",
    expectedPublicShopCount: 25,
    gscStatus: "DATA_REQUIRED",
    sourceClass: "OFFICIAL_FACT_AGGREGATE",
    fieldCoverage: [
      { key: "officialUrl", label: "公式URL", verifiedCount: 11 },
      { key: "location", label: "住所・location", verifiedCount: 5 },
      { key: "station", label: "最寄駅", verifiedCount: 6 },
      { key: "access", label: "アクセス", verifiedCount: 5 },
      { key: "telephone", label: "電話番号", verifiedCount: 12 },
      { key: "price", label: "料金", verifiedCount: 5 },
      { key: "businessHours", label: "営業時間", verifiedCount: 12 },
      { key: "booking", label: "予約導線", verifiedCount: 10 },
    ],
    price: {
      status: "LIMITED_SAMPLE",
      sampleSize: 5,
      minimumYen: 10000,
      medianYen: 11000,
      maximumYen: 16000,
      bands: SHARED_PRICE_BANDS.map((label, index) => ({ label, count: [0, 3, 1, 0, 1][index] })),
    },
    hours: {
      verifiedCount: 12,
      parsableSampleSize: 12,
      lateNightCount: 12,
      afterMidnightCount: 12,
      earliestOpening: "10:00",
      latestClosing: "翌6:00",
    },
    station: {
      sampleSize: 6,
      buckets: [
        { label: "堺東", count: 6 },
        { label: "その他近隣", count: 0 },
      ],
    },
    therapists: {
      status: "PUBLIC_READY_WITH_SAMPLE_NOTE",
      profileCount: 63,
      ageKnownCount: 63,
      availableShopCount: 3,
      ageBands: [
        { label: "20代", count: 18 },
        { label: "30代", count: 34 },
        { label: "40代", count: 11 },
        { label: "50代以上", count: 0 },
        { label: "その他既知年齢", count: 0 },
      ],
    },
    portals: {
      factClass: "EXTERNAL_PORTAL_FACT",
      presenceShopCount: 18,
      multiPortalShopCount: 6,
      maximumConfirmedPortalCount: 4,
    },
  },
};

function verificationRate(verifiedCount: number, publicShopCount: number) {
  return Math.round((verifiedCount / publicShopCount) * 1000) / 10;
}

export function resolveAreaDepthEditorial(
  slug: string,
  livePublicShopCount: number,
): AreaDepthEditorial | null {
  if (slug !== "shinosaka" && slug !== "sakai") return null;
  const source = AREA_DEPTH_SOURCES[slug];
  if (livePublicShopCount !== source.expectedPublicShopCount) return null;

  return {
    ...source,
    featureFlags: AREA_DEPTH_FEATURE_FLAGS,
    fieldCoverage: source.fieldCoverage.map((field) => ({
      ...field,
      missingCount: source.expectedPublicShopCount - field.verifiedCount,
      verificationRate: verificationRate(field.verifiedCount, source.expectedPublicShopCount),
    })),
  };
}

export function buildAreaDepthMethodologyFaq(editorial: AreaDepthEditorial) {
  return {
    question: `${editorial.areaLabel}の掲載情報はどのように確認していますか？`,
    answer: `${editorial.observedDateLabel}時点の公開${editorial.expectedPublicShopCount}店舗を母数に、公式サイトなど店舗自身が公開する一次情報で確認できた項目だけを集計しています。未確認項目を推測や0件で補わず、料金・営業時間・駅情報は確認済み標本数を併記しています。`,
  };
}
