import "server-only";

import { createPrivateKey, createSign } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  analyticsFailure,
  analyticsSuccess,
  type AnalyticsSourceResult,
  type AnalyticsWarning,
} from "./result";

export const GOOGLE_ANALYTICS_READONLY_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
export const GOOGLE_SEARCH_CONSOLE_READONLY_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const GOOGLE_OAUTH_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const MAX_INLINE_CREDENTIAL_BYTES = 16 * 1024;

export type GoogleOAuthScope =
  | typeof GOOGLE_ANALYTICS_READONLY_SCOPE
  | typeof GOOGLE_SEARCH_CONSOLE_READONLY_SCOPE;

const GOOGLE_OAUTH_SCOPES = new Set<GoogleOAuthScope>([
  GOOGLE_ANALYTICS_READONLY_SCOPE,
  GOOGLE_SEARCH_CONSOLE_READONLY_SCOPE,
]);

export type GoogleServiceAccount = {
  clientEmail: string;
  privateKey: string;
  tokenUri: string;
};

export type GoogleAccessToken = {
  accessToken: string;
  expiresIn?: number;
};

type CredentialEnvironment = Record<string, string | undefined>;
type CredentialOptions = {
  env?: CredentialEnvironment;
  readFileImpl?: typeof readFile;
};

type ServiceAccountDocument = {
  type: "service_account";
  client_email: string;
  private_key: string;
  token_uri: string;
};

type CredentialSource = "inline" | "file";

export type GoogleAccessTokenOptions = CredentialOptions & {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
  scope?: GoogleOAuthScope;
};

function warning(code: string, message: string): AnalyticsWarning[] {
  return [{ code, message }];
}

function safeFailure<T = never>(
  state: "not_configured" | "auth_error" | "api_error" | "invalid_response" | "timeout",
  code: string
): AnalyticsSourceResult<T> {
  return analyticsFailure(state, { warnings: warning(code, `state=${state}; code=${code}`) });
}

function isServiceAccountDocument(value: unknown): value is ServiceAccountDocument {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const document = value as Record<string, unknown>;
  if (
    document.type !== "service_account" ||
    typeof document.client_email !== "string" ||
    document.client_email.trim() === "" ||
    typeof document.private_key !== "string" ||
    document.private_key.trim() === "" ||
    document.token_uri !== GOOGLE_OAUTH_TOKEN_ENDPOINT
  ) return false;
  return true;
}

function credentialFailureCode(source: CredentialSource, detail: string): string {
  return source === "inline" ? `credential_inline_${detail}` : `credential_${detail}`;
}

function parseGoogleServiceAccount(
  contents: string,
  source: CredentialSource
): AnalyticsSourceResult<GoogleServiceAccount> {
  if (source === "inline") {
    if (Buffer.byteLength(contents, "utf8") > MAX_INLINE_CREDENTIAL_BYTES) {
      return safeFailure("invalid_response", "credential_inline_too_large");
    }
    if (contents.trim() === "") {
      return safeFailure("invalid_response", "credential_inline_empty");
    }
  }

  let document: unknown;
  try {
    document = JSON.parse(contents);
  } catch {
    return safeFailure("invalid_response", credentialFailureCode(source, "invalid_json"));
  }
  if (!isServiceAccountDocument(document)) {
    return safeFailure("invalid_response", credentialFailureCode(source, "invalid_shape"));
  }

  const privateKey = document.private_key.replaceAll("\\n", "\n");
  try {
    const key = createPrivateKey(privateKey);
    if (key.type !== "private" || key.asymmetricKeyType !== "rsa") {
      return safeFailure("invalid_response", credentialFailureCode(source, "invalid_private_key"));
    }
  } catch {
    return safeFailure("invalid_response", credentialFailureCode(source, "invalid_private_key"));
  }

  return analyticsSuccess({
    clientEmail: document.client_email,
    privateKey,
    tokenUri: document.token_uri,
  });
}

export async function loadGoogleServiceAccount(
  options: CredentialOptions = {}
): Promise<AnalyticsSourceResult<GoogleServiceAccount>> {
  const env = options.env ?? process.env;
  const inlineCredential = env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (inlineCredential !== undefined) {
    return parseGoogleServiceAccount(inlineCredential, "inline");
  }

  const credentialPath = env.GOOGLE_APPLICATION_CREDENTIALS;
  if (typeof credentialPath !== "string" || credentialPath.trim() === "") {
    return safeFailure("not_configured", "credential_not_configured");
  }

  let contents: string;
  try {
    contents = await (options.readFileImpl ?? readFile)(credentialPath, "utf8");
  } catch {
    return safeFailure("api_error", "credential_unreadable");
  }

  return parseGoogleServiceAccount(contents, "file");
}

function base64Url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function createSignedJwt(serviceAccount: GoogleServiceAccount, now: Date, scope: GoogleOAuthScope): string {
  const iat = Math.floor(now.getTime() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({
    iss: serviceAccount.clientEmail,
    scope,
    aud: serviceAccount.tokenUri,
    iat,
    exp: iat + 3600,
  }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  signer.end();
  return `${header}.${claims}.${signer.sign(serviceAccount.privateKey).toString("base64url")}`;
}

function tokenFailureForStatus(status: number): AnalyticsSourceResult<GoogleAccessToken> {
  if (status === 401 || status === 403) return safeFailure("auth_error", `oauth_http_${status}`);
  return safeFailure("api_error", `oauth_http_${status}`);
}

function isAbortError(error: unknown): boolean {
  return (error instanceof DOMException && error.name === "AbortError") ||
    (typeof error === "object" && error !== null && (error as { name?: unknown }).name === "AbortError");
}

export async function getGoogleAccessToken(
  options: GoogleAccessTokenOptions = {}
): Promise<AnalyticsSourceResult<GoogleAccessToken>> {
  const scope = options.scope ?? GOOGLE_ANALYTICS_READONLY_SCOPE;
  if (!GOOGLE_OAUTH_SCOPES.has(scope)) return safeFailure("invalid_response", "oauth_invalid_scope");
  const serviceAccount = await loadGoogleServiceAccount(options);
  if (serviceAccount.data === null) {
    return analyticsFailure(serviceAccount.state, {
      collectedAt: serviceAccount.collectedAt,
      warnings: serviceAccount.warnings,
    });
  }

  const now = (options.now ?? (() => new Date()))();
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    return safeFailure("invalid_response", "oauth_invalid_clock");
  }
  const timeoutMs = options.timeoutMs ?? 10_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return safeFailure("invalid_response", "oauth_invalid_timeout");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await (options.fetchImpl ?? fetch)(serviceAccount.data.tokenUri, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: createSignedJwt(serviceAccount.data, now, scope),
      }).toString(),
      signal: controller.signal,
    });
    if (!response.ok) return tokenFailureForStatus(response.status);

    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) return safeFailure("timeout", "oauth_timeout");
      if (error instanceof SyntaxError) return safeFailure("invalid_response", "oauth_invalid_json");
      return safeFailure("api_error", "oauth_body_read_failed");
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return safeFailure("invalid_response", "oauth_invalid_token_response");
    }
    const tokenBody = body as Record<string, unknown>;
    const accessToken = tokenBody.access_token;
    if (typeof accessToken !== "string" || accessToken.trim() === "") {
      return safeFailure("invalid_response", "oauth_invalid_token_response");
    }

    const expiresIn = tokenBody.expires_in;
    if (expiresIn !== undefined && (
      typeof expiresIn !== "number" || !Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > 86_400
    )) return safeFailure("invalid_response", "oauth_invalid_expiry");
    return analyticsSuccess({
      accessToken,
      ...(expiresIn === undefined ? {} : { expiresIn }),
    });
  } catch (error) {
    if (controller.signal.aborted || isAbortError(error)) {
      return safeFailure("timeout", "oauth_timeout");
    }
    return safeFailure("api_error", "oauth_request_failed");
  } finally {
    clearTimeout(timeout);
  }
}
