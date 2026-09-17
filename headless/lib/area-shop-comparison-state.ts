export const AREA_SHOP_COMPARISON_LIMIT = 3;

export type AreaShopComparisonState = Readonly<{
  selectedIds: readonly number[];
  limitReached: boolean;
}>;

export type AreaShopComparisonAction =
  | Readonly<{ type: "toggle" | "remove"; shopId: number }>
  | Readonly<{ type: "clear" }>;

function validShopId(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

export function reduceAreaShopComparison(
  state: AreaShopComparisonState,
  action: AreaShopComparisonAction,
): AreaShopComparisonState {
  if (action.type === "clear") return { selectedIds: [], limitReached: false };
  if (!validShopId(action.shopId)) return { ...state, limitReached: false };

  const selectedIds = [...new Set(state.selectedIds.filter(validShopId))];
  const selected = selectedIds.includes(action.shopId);
  if (action.type === "remove" || selected) {
    return {
      selectedIds: selectedIds.filter((id) => id !== action.shopId),
      limitReached: false,
    };
  }
  if (selectedIds.length >= AREA_SHOP_COMPARISON_LIMIT) {
    return { selectedIds, limitReached: true };
  }
  return { selectedIds: [...selectedIds, action.shopId], limitReached: false };
}

export function canOpenAreaShopComparison(selectedIds: readonly number[]): boolean {
  return new Set(selectedIds.filter(validShopId)).size >= 2;
}
