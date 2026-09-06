const DEFAULT_WP_ORIGIN_HOST = "mens-esthe-kuchikomi.com";
const DEFAULT_WP_ORIGIN_TLS_SERVERNAME = "sv16727.xserver.jp";

function resolveHostname(value, fallback) {
  const candidate = value?.trim().toLowerCase();
  if (!candidate) return fallback;

  try {
    const parsed = new URL(`https://${candidate}`);
    if (
      parsed.hostname !== candidate ||
      parsed.port ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      return fallback;
    }
    return candidate;
  } catch {
    return fallback;
  }
}

export const WP_ORIGIN_IP = "85.131.213.108";
export const wpOriginBaseUrl = `https://${WP_ORIGIN_IP}`;
export const wpOriginHost = resolveHostname(process.env.WP_ORIGIN_HOST, DEFAULT_WP_ORIGIN_HOST);
export const wpOriginTlsServername = resolveHostname(
  process.env.WP_ORIGIN_TLS_SERVERNAME,
  DEFAULT_WP_ORIGIN_TLS_SERVERNAME
);

export function usesWpOriginIp(apiBase) {
  return apiBase.includes(WP_ORIGIN_IP);
}
