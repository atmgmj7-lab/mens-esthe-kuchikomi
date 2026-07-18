/**
 * Encode a single URL path segment for upstream (node:https) requests.
 * Decodes first when already percent-encoded to avoid double-encoding.
 */
export function encodePathSegmentForOrigin(segment: string): string {
  if (!segment) return segment;
  try {
    return encodeURIComponent(decodeURIComponent(segment));
  } catch {
    return encodeURIComponent(segment);
  }
}

/**
 * Encode pathname segments for WP origin requests. Query string is preserved.
 */
export function encodeOriginPath(pathWithSearch: string): string {
  const qIndex = pathWithSearch.indexOf("?");
  const pathname = qIndex >= 0 ? pathWithSearch.slice(0, qIndex) : pathWithSearch;
  const search = qIndex >= 0 ? pathWithSearch.slice(qIndex) : "";

  const encodedPathname = pathname
    .split("/")
    .map(encodePathSegmentForOrigin)
    .join("/");

  return encodedPathname + search;
}

/**
 * Encode /wp-content/ paths for browser img/src (encodeURI, slashes stay unencoded).
 */
export function encodeBrowserWpContentPath(path: string): string {
  if (!path.startsWith("/wp-content/")) return path;
  try {
    return encodeURI(decodeURI(path));
  } catch {
    return encodeURI(path);
  }
}
