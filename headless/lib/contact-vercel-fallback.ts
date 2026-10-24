const approvedOrigin = "https://escomi-headless-narikiyos-projects.vercel.app";

type ContactFallbackEnvironment = Readonly<Record<string, string | undefined>>;

export type ContactVercelFallback = Readonly<{
  url: string;
  headers: Headers;
}>;

/**
 * Returns the sole permitted Vercel contact endpoint when it has explicitly
 * been configured with the existing deployment-protection bypass secret.
 *
 * The public hostname is intentionally not accepted: once it is served by the
 * Worker, forwarding to it would recursively invoke this Worker instead of
 * the retained Vercel mail handler.
 */
export function resolveContactVercelFallback(
  environment: ContactFallbackEnvironment,
): ContactVercelFallback | null {
  const configuredOrigin = environment.CONTACT_VERCEL_FALLBACK_ORIGIN?.trim();
  const bypass = environment.CONTACT_VERCEL_PROTECTION_BYPASS?.trim();
  if (!configuredOrigin || !bypass) return null;

  let origin: URL;
  try {
    origin = new URL(configuredOrigin);
  } catch {
    return null;
  }

  if (
    origin.origin !== approvedOrigin ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    origin.username ||
    origin.password
  ) {
    return null;
  }

  return {
    url: `${approvedOrigin}/api/contact/`,
    headers: new Headers({
      "content-type": "application/json",
      origin: approvedOrigin,
      "x-vercel-protection-bypass": bypass,
    }),
  };
}
