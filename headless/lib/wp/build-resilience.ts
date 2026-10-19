import { isManagedShopSourceUnavailableError } from "@/lib/shop-management-source";

function isFailClosedPrimaryContentError(error: unknown): boolean {
  return error instanceof Error && error.name === "ContentMigrationIncompleteError";
}

export function logWpBuildFallback(label: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[wp-build] ${label} failed; using fallback. ${message}`);
}

export async function getStaticParamsOrFallback<T, P>(
  label: string,
  load: () => Promise<T[]>,
  map: (item: T) => P,
  fallback: P[],
): Promise<P[]> {
  try {
    const items = await load();
    const params = items.map(map);
    return params.length > 0 ? params : fallback;
  } catch (error) {
    if (isFailClosedPrimaryContentError(error)) throw error;
    logWpBuildFallback(label, error);
    return fallback;
  }
}

export async function withWpBuildFallback<T>(
  label: string,
  load: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (isManagedShopSourceUnavailableError(error) || isFailClosedPrimaryContentError(error)) throw error;
    logWpBuildFallback(label, error);
    return fallback;
  }
}
