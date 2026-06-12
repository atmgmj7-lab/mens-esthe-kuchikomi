import { stripHtml } from "@/lib/wp/client";
import type { AreaView, ShopView } from "@/lib/wp/types";

const STATION_KEYWORDS = [
  "近鉄日本橋駅",
  "日本橋駅",
  "谷町九丁目駅",
  "なんば駅",
  "難波駅",
  "梅田駅",
  "京橋駅",
  "天王寺駅"
] as const;

const LATE_NIGHT_MARKERS = ["翌", "24:", "23:", "0:", "1:", "2:", "3:", "4:", "5:"] as const;

export type AreaSeoRepresentativeShop = {
  title: string;
  href: string;
};

export type AreaSeoCardBlock = {
  title: string;
  lines: string[];
};

export type AreaSeoModel = {
  areaName: string;
  parentName: string | null;
  shopCount: number;
  visibleShopCount: number;
  representativeShops: AreaSeoRepresentativeShop[];
  stationKeywords: string[];
  lateNightCount: number;
  dispatchCount: number;
  hasAreaSpecificCopy: boolean;
  isParentArea: boolean;
  leadParagraphs: string[];
  accessCard: AreaSeoCardBlock;
  hoursCard: AreaSeoCardBlock;
  compareCard: AreaSeoCardBlock;
};

function shopAddress(shop: ShopView): string {
  return stripHtml(shop.acf.shop_address);
}

function shopHours(shop: ShopView): string {
  return stripHtml(shop.acf.shop_hours);
}

function shopHaystack(shop: ShopView): string {
  return [shop.title, shopAddress(shop), shopHours(shop), stripHtml(shop.acf.shop_catch), shop.excerpt]
    .filter(Boolean)
    .join(" ");
}

function isLateNightShop(shop: ShopView): boolean {
  const hours = shopHours(shop);
  if (!hours) return false;
  return LATE_NIGHT_MARKERS.some((marker) => hours.includes(marker));
}

function isDispatchShop(shop: ShopView): boolean {
  return shopHaystack(shop).includes("出張");
}

export function extractStationKeywords(shops: ShopView[], max = 4): string[] {
  const found: string[] = [];

  for (const shop of shops) {
    const address = shopAddress(shop);
    if (!address) continue;

    for (const station of STATION_KEYWORDS) {
      if (address.includes(station) && !found.includes(station)) {
        found.push(station);
      }
    }

    if (found.length >= max) break;
  }

  return found.slice(0, max);
}

function buildLeadParagraphs(model: {
  areaName: string;
  parentName: string | null;
  shopCount: number;
  visibleShopCount: number;
  stationKeywords: string[];
  lateNightCount: number;
  dispatchCount: number;
  hasAreaSpecificCopy: boolean;
  isParentArea: boolean;
}): string[] {
  const {
    areaName,
    parentName,
    shopCount,
    visibleShopCount,
    stationKeywords,
    lateNightCount,
    dispatchCount,
    hasAreaSpecificCopy,
    isParentArea
  } = model;

  if (visibleShopCount === 0) {
    return [
      `${areaName}エリアのメンズエステ店舗情報を掲載予定です。エリア別の店舗一覧、営業時間、料金、口コミ、予約導線をこのページで比較できるよう整備しています。`,
      parentName
        ? `${parentName}全体の店舗一覧からも探せます。掲載が始まり次第、このページでも確認できます。`
        : "関西エリアの店舗情報は随時更新しています。掲載開始後に改めてご確認ください。"
    ];
  }

  const paragraphs: string[] = [];

  if (hasAreaSpecificCopy) {
    const stationText =
      stationKeywords.length > 0
        ? `${stationKeywords.slice(0, 3).join("・")}周辺`
        : "大阪メトロ・近鉄日本橋駅周辺";
    paragraphs.push(
      `${areaName}でメンズエステを探す場合、${stationText}からアクセスしやすい店舗が中心です。掲載${shopCount}件のうち、一覧では${visibleShopCount}件を確認できます。`
    );
    paragraphs.push(
      "なんば・谷町九丁目方面へ足を延ばせる立地の店舗もあり、仕事帰りや買い物ついでに立ち寄りやすいエリアです。各店舗ページで営業時間・料金・口コミを見比べてください。"
    );
    if (lateNightCount > 0 || dispatchCount > 0) {
      const parts: string[] = [];
      if (lateNightCount > 0) {
        parts.push(`深夜帯の営業時間が確認できる店舗が${lateNightCount}件`);
      }
      if (dispatchCount > 0) {
        parts.push(`出張対応の記載がある店舗が${dispatchCount}件`);
      }
      paragraphs.push(`${parts.join("、")}あります。条件に合う店舗を絞り込む際の目安にしてください。`);
    }
    return paragraphs.slice(0, 3);
  }

  if (isParentArea) {
    paragraphs.push(
      `${areaName}エリアのメンズエステ店舗を${shopCount}件掲載しています。詳細エリアごとの一覧から、駅近・営業時間・料金・口コミを比較しながら探せます。`
    );
    paragraphs.push(
      "各店舗ページでは住所、営業時間、料金目安、予約・出勤情報への導線を確認できます。気になる店舗を複数見比べてから問い合わせや予約に進んでください。"
    );
    return paragraphs;
  }

  const stationLead =
    stationKeywords.length > 0
      ? `${stationKeywords.slice(0, 2).join("・")}周辺を中心に`
      : `${areaName}エリア内で`;

  paragraphs.push(
    `${areaName}でメンズエステを探す際は、${stationLead}掲載${shopCount}件の店舗情報を起点に比較するのがおすすめです。`
  );

  paragraphs.push(
    "各店舗ページで営業時間、料金、口コミ、予約・出勤情報を確認できます。条件が近い店舗をいくつか見比べてから問い合わせや予約に進んでください。"
  );

  if (lateNightCount > 0 || dispatchCount > 0) {
    const hints: string[] = [];
    if (lateNightCount > 0) hints.push(`深夜帯の営業記載がある店舗が${lateNightCount}件`);
    if (dispatchCount > 0) hints.push(`出張対応の記載がある店舗が${dispatchCount}件`);
    paragraphs.push(`${hints.join("、")}あります。`);
  }

  return paragraphs.slice(0, 3);
}

function buildAccessCard(
  areaName: string,
  stationKeywords: string[],
  isParentArea: boolean
): AreaSeoCardBlock {
  if (isParentArea) {
    return {
      title: "アクセス",
      lines: [
        `${areaName}エリアは複数の詳細エリアに分かれています。`,
        "詳細エリアページで、駅名や住所をもとにアクセスしやすい店舗を確認できます。"
      ]
    };
  }

  if (stationKeywords.length > 0) {
    return {
      title: "アクセス",
      lines: [
        `掲載店舗の住所から、${stationKeywords.join("・")}が目安となります。`,
        "最寄り駅や徒歩時間は各店舗ページの基本情報で確認してください。"
      ]
    };
  }

  return {
    title: "アクセス",
    lines: [
      `${areaName}エリア内の店舗住所を一覧で確認できます。`,
      "最寄り駅やアクセス方法は各店舗ページの基本情報を参照してください。"
    ]
  };
}

function buildHoursCard(lateNightCount: number, dispatchCount: number, visibleShopCount: number): AreaSeoCardBlock {
  if (visibleShopCount === 0) {
    return {
      title: "営業時間",
      lines: ["掲載店舗の営業時間・深夜対応・出張対応は、店舗情報の更新後に確認できます。"]
    };
  }

  const lines: string[] = ["各店舗ページで営業時間や定休日を確認できます。"];

  if (lateNightCount > 0) {
    lines.push(`一覧内で深夜帯の営業記載がある店舗は${lateNightCount}件です。`);
  } else {
    lines.push("仕事帰りなど時間帯の希望がある場合は、営業時間を先に確認してください。");
  }

  if (dispatchCount > 0) {
    lines.push(`出張対応の記載がある店舗は${dispatchCount}件です。`);
  }

  return { title: "営業時間", lines: lines.slice(0, 3) };
}

function buildCompareCard(areaName: string, shopCount: number): AreaSeoCardBlock {
  return {
    title: "比較ポイント",
    lines: [
      `${areaName}の店舗${shopCount}件を、料金・営業時間・口コミ・予約導線の観点で見比べられます。`,
      "気になる店舗は詳細ページを開き、条件が近い候補を2〜3件並べて比較するのがおすすめです。"
    ]
  };
}

export function buildAreaSeoModel(
  area: AreaView,
  shops: ShopView[],
  parentArea?: AreaView | null
): AreaSeoModel {
  const stationKeywords = extractStationKeywords(shops);
  const lateNightCount = shops.filter(isLateNightShop).length;
  const dispatchCount = shops.filter(isDispatchShop).length;
  const hasAreaSpecificCopy = area.slug === "nihonbashi";
  const isParentArea = area.parent === 0;
  const shopCount = area.count > 0 ? area.count : shops.length;
  const visibleShopCount = shops.length;

  const representativeShops: AreaSeoRepresentativeShop[] = shops.slice(0, 5).map((shop) => ({
    title: shop.title,
    href: `/shops/${shop.slug}/`
  }));

  const base = {
    areaName: area.name,
    parentName: parentArea?.name ?? null,
    shopCount,
    visibleShopCount,
    stationKeywords,
    lateNightCount,
    dispatchCount,
    hasAreaSpecificCopy,
    isParentArea
  };

  return {
    ...base,
    representativeShops,
    leadParagraphs: buildLeadParagraphs(base),
    accessCard: buildAccessCard(area.name, stationKeywords, isParentArea),
    hoursCard: buildHoursCard(lateNightCount, dispatchCount, visibleShopCount),
    compareCard: buildCompareCard(area.name, shopCount)
  };
}
