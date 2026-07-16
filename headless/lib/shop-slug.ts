const MAX_PUBLIC_SHOP_SLUG_LENGTH = 200;
const PUBLIC_SHOP_SLUG_TOKENS = /^(?:[a-z0-9-]|%[0-9a-f]{2})+$/;
const UNSAFE_DECODED_SLUG = /[\u0000-\u001f\u007f/\\?#%]|\s/u;

function lowercasePercentEscapes(value: string): string {
  return value.replace(/%[0-9A-F]{2}/g, (escape) => escape.toLowerCase());
}

export function normalizePublicShopSlug(value: string): string {
  if (
    !value ||
    value.length > MAX_PUBLIC_SHOP_SLUG_LENGTH ||
    !PUBLIC_SHOP_SLUG_TOKENS.test(value)
  ) {
    return "";
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return "";
  }

  if (
    !decoded ||
    decoded.normalize("NFC") !== decoded ||
    UNSAFE_DECODED_SLUG.test(decoded)
  ) {
    return "";
  }

  const canonical = lowercasePercentEscapes(encodeURIComponent(decoded));
  return canonical === value ? value : "";
}
