import "server-only";

import { secretsMatch } from "@/lib/server/secure-secret";

const LEGACY_DASHBOARD_PREFIX = "/wp-content/themes/swell_child/dashboard";

type AuthEnvironment = Readonly<Record<string, string | undefined>>;

type AuthCredentials = {
  user: string;
  password: string;
};

export type ContentAdminAuthResult =
  | { ok: true; reason: "authorized" }
  | {
      ok: false;
      reason: "missing-configuration" | "missing-credentials" | "invalid-credentials";
    };

export type DashboardAuthorization =
  | { ok: true; status: 200; reason: "authorized" }
  | {
      ok: false;
      status: 401 | 503;
      reason: "missing-configuration" | "missing-credentials" | "invalid-credentials";
    };

export function isDashboardProtectedPath(pathname: string): boolean {
  return (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/api/dashboard" ||
    pathname.startsWith("/api/dashboard/") ||
    pathname === LEGACY_DASHBOARD_PREFIX ||
    pathname.startsWith(`${LEGACY_DASHBOARD_PREFIX}/`)
  );
}

function completePair(user: unknown, password: unknown): AuthCredentials | null {
  if (typeof user !== "string" || typeof password !== "string" || !user || !password) {
    return null;
  }
  return { user, password };
}

function hasDefinedValue(environment: AuthEnvironment, key: keyof AuthEnvironment): boolean {
  return environment[key] !== undefined;
}

function resolveConfiguredCredentials(environment: AuthEnvironment): AuthCredentials | null {
  const hasDirectConfiguration =
    hasDefinedValue(environment, "user") || hasDefinedValue(environment, "password");
  if (hasDirectConfiguration) {
    return completePair(environment.user, environment.password);
  }

  const hasOfficialConfiguration =
    hasDefinedValue(environment, "DASHBOARD_BASIC_AUTH_USER") ||
    hasDefinedValue(environment, "DASHBOARD_BASIC_AUTH_PASSWORD");
  if (hasOfficialConfiguration) {
    return completePair(
      environment.DASHBOARD_BASIC_AUTH_USER,
      environment.DASHBOARD_BASIC_AUTH_PASSWORD,
    );
  }

  const hasLegacyConfiguration =
    hasDefinedValue(environment, "BASIC_AUTH_USER") ||
    hasDefinedValue(environment, "BASIC_AUTH_PASSWORD");
  if (hasLegacyConfiguration) {
    return completePair(environment.BASIC_AUTH_USER, environment.BASIC_AUTH_PASSWORD);
  }

  return null;
}

function decodeBasicCredentials(authorization: string): AuthCredentials | null {
  const match = authorization.match(/^Basic\s+([A-Za-z0-9+/]+={0,2})$/i);
  if (!match || match[1].length % 4 !== 0) {
    return null;
  }

  let decoded: string;
  try {
    decoded = Buffer.from(match[1], "base64").toString("utf8");
  } catch {
    return null;
  }

  const delimiterIndex = decoded.indexOf(":");
  if (delimiterIndex < 0) {
    return null;
  }

  return {
    user: decoded.slice(0, delimiterIndex),
    password: decoded.slice(delimiterIndex + 1),
  };
}

export function resolveContentAdminAuth(
  authorization: string | null,
  environment: AuthEnvironment,
): ContentAdminAuthResult {
  const configured = resolveConfiguredCredentials(environment);
  if (!configured) {
    return { ok: false, reason: "missing-configuration" };
  }

  if (!authorization) {
    return { ok: false, reason: "missing-credentials" };
  }

  const provided = decodeBasicCredentials(authorization);
  if (!provided) {
    return { ok: false, reason: "invalid-credentials" };
  }

  const userMatches = secretsMatch(configured.user, provided.user);
  const passwordMatches = secretsMatch(configured.password, provided.password);
  if (!userMatches || !passwordMatches) {
    return { ok: false, reason: "invalid-credentials" };
  }

  return { ok: true, reason: "authorized" };
}

export function authorizeDashboardRequest(
  authorization: string | null,
  environment: AuthEnvironment,
): DashboardAuthorization {
  const result = resolveContentAdminAuth(authorization, environment);
  if (result.ok) {
    return { ...result, status: 200 };
  }

  return {
    ...result,
    status: result.reason === "missing-configuration" ? 503 : 401,
  };
}
