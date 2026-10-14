import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";

const TOKEN_BYTES = 32;

export type ListingApplicationUploadCapability = Readonly<{
  token: string;
  tokenHash: string;
  objectId: string;
  expiresAt: string;
}>;

export function createListingApplicationUploadCapability(now = Date.now()): ListingApplicationUploadCapability {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return {
    token,
    tokenHash: hashListingApplicationUploadToken(token),
    objectId: randomUUID(),
    expiresAt: new Date(now + 10 * 60 * 1000).toISOString(),
  };
}

export function hashListingApplicationUploadToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isListingApplicationUploadToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{40,100}$/.test(value);
}
