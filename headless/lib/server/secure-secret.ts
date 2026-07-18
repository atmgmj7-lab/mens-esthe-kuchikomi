import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

export function secretsMatch(expected: string, actual: string): boolean {
  const left = createHash("sha256").update(expected).digest();
  const right = createHash("sha256").update(actual).digest();
  return timingSafeEqual(left, right);
}
