import type { StrictRankingAvailability } from "@/lib/ux-production-data-boundary";

export function ScopedRankingModule({ availability }: {
  availability: StrictRankingAvailability;
}) {
  if (availability.status === "unavailable") return null;
  return null;
}
