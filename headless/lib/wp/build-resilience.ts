export function logWpBuildFallback(label: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[wp-build] ${label} failed; using fallback. ${message}`);
}

export async function getStaticParamsOrFallback<T, P>(
  label: string,
  load: () => Promise<T[]>,
  map: (item: T) => P,
  fallback: P[]
): Promise<P[]> {
  try {
    const items = await load();
    const params = items.map(map);
    return params.length > 0 ? params : fallback;
  } catch (error) {
    logWpBuildFallback(label, error);
    return fallback;
  }
}

export async function withWpBuildFallback<T>(
  label: string,
  load: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await load();
  } catch (error) {
    logWpBuildFallback(label, error);
    return fallback;
  }
}
