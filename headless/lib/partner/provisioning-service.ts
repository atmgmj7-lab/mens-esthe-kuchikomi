import "server-only";

import { normalizePublicShopSlug } from "@/lib/shop-slug";

export const PARTNER_WORKSPACE_STATES = [
  "normal_listing",
  "shop_confirmed",
  "free_official_partner",
  "active_partner",
] as const;

export type PartnerWorkspaceState = (typeof PARTNER_WORKSPACE_STATES)[number];

export type CanonicalPartnerShop = {
  id: number;
  slug: string;
  title: string;
};

export type PartnerWorkspace = {
  id: string;
  state: PartnerWorkspaceState;
  initialized: boolean;
};

export type PartnerWorkspaceRepository = {
  provision: (input: {
    shopId: number;
    shopSlug: string;
    shopName: string;
    canonicalUrl: string;
    source: "operator" | "self_registration";
  }) => Promise<PartnerWorkspace | null>;
};

export function nextPartnerAction(state: PartnerWorkspaceState): string {
  switch (state) {
    case "normal_listing": return "店舗の公式申請を受け付け、canonical照合を完了します。";
    case "shop_confirmed": return "運営が申請内容を確認し、無料公式パートナーへの移行を判断します。";
    case "free_official_partner": return "承認済みの手入力ワークフローを開始できます。公開反映は別承認です。";
    case "active_partner": return "承認済みの拡張機能を個別の公開承認フローで利用できます。";
  }
}

export async function provisionPartnerWorkspace(
  shop: CanonicalPartnerShop,
  source: "operator" | "self_registration",
  repository: PartnerWorkspaceRepository,
): Promise<PartnerWorkspace | null> {
  const shopSlug = normalizePublicShopSlug(shop.slug);
  const shopName = shop.title.trim();
  if (!Number.isSafeInteger(shop.id) || shop.id <= 0 || !shopSlug || !shopName || shopName.length > 120) {
    return null;
  }

  return repository.provision({
    shopId: shop.id,
    shopSlug,
    shopName,
    canonicalUrl: `https://mens-esthe-kuchikomi.com/shops/${shopSlug}/`,
    source,
  });
}
