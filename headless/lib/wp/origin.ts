const DEFAULT_WP_ORIGIN_HOST = "mens-esthe-kuchikomi.com";

export const WP_ORIGIN_IP = "85.131.213.108";
export const wpOriginBaseUrl = `http://${WP_ORIGIN_IP}`;
export const wpOriginHost = process.env.WP_ORIGIN_HOST || DEFAULT_WP_ORIGIN_HOST;

export function usesWpOriginIp(apiBase: string): boolean {
  return apiBase.includes(WP_ORIGIN_IP);
}
