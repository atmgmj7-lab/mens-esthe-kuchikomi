import { cacheLife, cacheTag } from "next/cache";
import {
  normalizeAreaShopRankingMap,
  type AreaShopRankingMap
} from "@/lib/area-shop-ranking";
import { logWpBuildFallback } from "@/lib/wp/build-resilience";
import { wpFetch } from "@/lib/wp/client";

type AreaShopRankingsResponse = {
  rankings?: unknown;
};

export async function getAreaShopRankings(): Promise<AreaShopRankingMap> {
  "use cache";
  cacheLife("minutes");
  cacheTag("wp", "area-shop-rankings");

  try {
    const response = await wpFetch<AreaShopRankingsResponse>("/escomi/v1/area-shop-rankings");
    return normalizeAreaShopRankingMap(response.rankings);
  } catch (error) {
    logWpBuildFallback("area shop rankings", error);
    return {};
  }
}
