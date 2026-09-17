export type ComparisonFactEvidence = Readonly<{
  sourceUrl?: string;
  observedAt?: string;
  reviewedAt?: string;
  publishedValueHash?: string;
  href?: string;
  rel?: string;
}>;

export type AreaShopComparisonFact =
  | Readonly<{ status: "confirmed"; value: string } & ComparisonFactEvidence>
  | Readonly<{ status: "unknown" | "unavailable"; value: "未確認"; reason: string }>;

export function confirmedComparisonFact(
  value: string,
  evidence: ComparisonFactEvidence = {},
): AreaShopComparisonFact {
  return Object.freeze({ status: "confirmed", value, ...evidence });
}

export function unknownComparisonFact(reason: string): AreaShopComparisonFact {
  return Object.freeze({ status: "unknown", value: "未確認", reason });
}

export function unavailableComparisonFact(reason: string): AreaShopComparisonFact {
  return Object.freeze({ status: "unavailable", value: "未確認", reason });
}

export function visibleComparisonFieldKeys<
  const TBase extends readonly string[],
  const TDeferred extends readonly string[],
>(
  items: readonly object[],
  baseKeys: TBase,
  deferredKeys: TDeferred,
): Array<TBase[number] | TDeferred[number]> {
  return [
    ...baseKeys,
    ...deferredKeys.filter((key) => items.some((item) => {
      const fact = (item as Record<string, unknown>)[key] as AreaShopComparisonFact | undefined;
      return fact?.status === "confirmed";
    })),
  ];
}
