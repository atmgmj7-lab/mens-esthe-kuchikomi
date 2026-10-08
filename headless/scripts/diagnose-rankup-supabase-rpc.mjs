#!/usr/bin/env node

const EXPECTED_PROJECT_REF = "goeagrxjsjcbbatpotbu";
const WP_SHOP_ID = 768;
const REQUIRE_READY = process.argv.includes("--require-ready") || process.env.SHOP_MANAGEMENT_SOURCE === "supabase";

function configured(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function resolveSecret() {
  return configured(process.env.SUPABASE_SECRET_KEY)
    ?? configured(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function result(value, exitCode = 0) {
  console.log(JSON.stringify(value));
  process.exitCode = exitCode;
}

function availability(value) {
  return value ? "PRESENT" : "MISSING";
}

const rawUrl = configured(process.env.SUPABASE_URL);
const secret = resolveSecret();
let endpoint;
try {
  endpoint = rawUrl ? new URL(rawUrl) : null;
} catch {
  endpoint = null;
}

const endpointProjectMatches = endpoint?.hostname.split(".")[0] === EXPECTED_PROJECT_REF;
if (!endpoint || !secret || !endpointProjectMatches) {
  result({
    status: "NOT_READY",
    endpoint: availability(endpoint),
    endpoint_project: endpoint ? (endpointProjectMatches ? "EXPECTED" : "OTHER") : "UNAVAILABLE",
    server_secret: availability(secret),
  }, REQUIRE_READY ? 1 : 0);
} else {
  const legacyJwt = /^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(secret);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${endpoint.origin}/rest/v1/rpc/get_partner_shop_fact_snapshot`, {
      method: "POST",
      headers: {
        apikey: secret,
        ...(legacyJwt ? { Authorization: `Bearer ${secret}` } : {}),
        "Content-Type": "application/json",
        "Content-Profile": "api",
        "Accept-Profile": "api",
      },
      body: JSON.stringify({ p_wp_shop_id: WP_SHOP_ID }),
      signal: controller.signal,
      cache: "no-store",
    });
    const body = await response.json().catch(() => null);
    const snapshot = Array.isArray(body) && body.length === 1 ? body[0] : null;
    const validSnapshot = snapshot
      && snapshot.wp_shop_id === WP_SHOP_ID
      && typeof snapshot.shop_slug === "string" && snapshot.shop_slug.length > 0
      && Number.isSafeInteger(snapshot.revision) && snapshot.revision > 0
      && typeof snapshot.updated_at === "string"
      && typeof snapshot.facts === "object" && snapshot.facts !== null;
    const status = response.ok && validSnapshot ? "PASS" : "RPC_UNAVAILABLE";
    result({
      status,
      endpoint: "PRESENT",
      endpoint_project: "EXPECTED",
      server_secret: "PRESENT",
      http_status: response.status,
      snapshot_shape_valid: Boolean(validSnapshot),
    }, REQUIRE_READY && status !== "PASS" ? 1 : 0);
  } catch (error) {
    result({
      status: "NETWORK_ERROR",
      endpoint: "PRESENT",
      endpoint_project: "EXPECTED",
      server_secret: "PRESENT",
      error_code: error?.name === "AbortError" ? "TIMEOUT" : "REQUEST_FAILED",
    }, REQUIRE_READY ? 1 : 0);
  } finally {
    clearTimeout(timer);
  }
}
