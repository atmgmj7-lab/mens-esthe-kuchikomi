const PARTNER_RETURN_PATHS = new Set([
  "/partner/",
  "/partner/growth/",
  "/partner/operations/",
  "/partner/therapists/",
]);

const PARTNER_RETURN_HASHES: Readonly<Record<string, ReadonlySet<string>>> = {
  "/partner/": new Set(["", "#partner-access-report"]),
  "/partner/growth/": new Set(["", "#growth-line-heading", "#growth-widget-heading"]),
  "/partner/operations/": new Set([""]),
  "/partner/therapists/": new Set(["", "#partner-therapists-heading"]),
};

/** Accept only exact, same-origin Partner destinations needed by published links. */
export function partnerLoginReturnTo(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 200) return "/partner/";
  try {
    const url = new URL(value, "https://eskomi.invalid");
    if (url.origin !== "https://eskomi.invalid" || url.search || !PARTNER_RETURN_PATHS.has(url.pathname)) return "/partner/";
    return PARTNER_RETURN_HASHES[url.pathname]?.has(url.hash) ? `${url.pathname}${url.hash}` : "/partner/";
  } catch {
    return "/partner/";
  }
}

export function partnerLoginUrl(returnTo: string): string {
  return `/partner/login/?returnTo=${encodeURIComponent(partnerLoginReturnTo(returnTo))}`;
}
