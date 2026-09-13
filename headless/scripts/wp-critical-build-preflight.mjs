#!/usr/bin/env node

import https from "node:https";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  WP_ORIGIN_IP,
  wpOriginHost,
  wpOriginTlsServername
} from "../lib/wp/origin-config.mjs";

export const CRITICAL_AREA_SLUGS = ["shinosaka", "sakai"];
const DEFAULT_TIMEOUT_MS = 15_000;
const MIN_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;
const TRANSIENT_CODES = new Set(["ETIMEDOUT", "ECONNRESET", "ENETUNREACH", "EHOSTUNREACH", "EAI_AGAIN", "ECONNREFUSED"]);
const PERMANENT_CODES = new Set([
  "CERT_HAS_EXPIRED", "DEPTH_ZERO_SELF_SIGNED_CERT", "ERR_TLS_CERT_ALTNAME_INVALID",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "ENOTFOUND", "WP_HTTP_STATUS", "WP_INVALID_JSON",
  "WP_INVALID_TERM", "WP_RESPONSE_TOO_LARGE",
]);

export function resolvePreflightTimeoutMs(value) {
  const candidate = Number(value);
  return Number.isSafeInteger(candidate) && candidate > 0
    ? Math.max(MIN_TIMEOUT_MS, Math.min(DEFAULT_TIMEOUT_MS, candidate))
    : DEFAULT_TIMEOUT_MS;
}

function failure(code, message) {
  return Object.assign(new Error(message), { code });
}

function safeErrorCode(error) {
  return TRANSIENT_CODES.has(error?.code) || PERMANENT_CODES.has(error?.code) ? error.code : "UNCLASSIFIED";
}

function readResponseBody(response) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let oversized = false;
    response.on("data", (chunk) => {
      if (oversized) return;
      size += chunk.length;
      if (size > 1_000_000) {
        oversized = true;
        reject(failure("WP_RESPONSE_TOO_LARGE", "critical WordPress preflight response exceeded 1 MB"));
        return;
      }
      chunks.push(chunk);
    });
    response.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    response.on("aborted", () => reject(failure("ECONNRESET", "critical WordPress response aborted")));
    response.on("error", reject);
  });
}

export function requestCriticalArea(slug, options = {}) {
  const requestImpl = options.requestImpl || https.request;
  const timeoutMs = resolvePreflightTimeoutMs(options.timeoutMs ?? process.env.WP_ORIGIN_TIMEOUT_MS);
  const transport = options.transport || {
    hostname: WP_ORIGIN_IP,
    tlsServername: wpOriginTlsServername,
    httpHost: wpOriginHost
  };
  const path = `/wp-json/wp/v2/area?slug=${encodeURIComponent(slug)}&hide_empty=false`;

  return new Promise((resolve, reject) => {
    let settled = false;
    let deadline;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      if (error) reject(error);
      else resolve(value);
    };
    const request = requestImpl(
      {
        hostname: transport.hostname,
        port: 443,
        servername: transport.tlsServername,
        rejectUnauthorized: true,
        method: "GET",
        path,
        headers: { Accept: "application/json", Host: transport.httpHost }
      },
      async (response) => {
        // A known HTTP failure is permanent, even if its response body later stalls.
        if (response.statusCode !== 200) {
          finish(failure("WP_HTTP_STATUS", `critical WordPress Area ${slug} returned HTTP ${response.statusCode || 500}`));
          response.destroy();
          request.destroy();
          return;
        }
        try {
          finish(null, { status: 200, body: await readResponseBody(response) });
        } catch (error) {
          finish(error);
          request.destroy();
        }
      }
    );
    const timeout = () => {
      if (settled) return;
      const error = failure("ETIMEDOUT", `WordPress origin request timed out for critical Area ${slug}`);
      finish(error);
      request.destroy(error);
    };
    // Socket inactivity alone does not bound DNS/TCP/TLS setup or a trickling body.
    deadline = setTimeout(timeout, timeoutMs);
    request.setTimeout(timeoutMs, timeout);
    request.on("error", (error) => finish(error));
    request.end();
  });
}

function validateAreaTerm(slug, response) {
  if (response.status !== 200) {
    throw failure("WP_HTTP_STATUS", `critical WordPress Area ${slug} returned HTTP ${response.status}`);
  }

  let payload;
  try {
    payload = JSON.parse(response.body);
  } catch {
    throw failure("WP_INVALID_JSON", `critical WordPress Area ${slug} returned invalid JSON`);
  }

  if (!Array.isArray(payload) || payload.length !== 1) {
    throw failure("WP_INVALID_TERM", `critical WordPress Area ${slug} must return exactly one term`);
  }

  const term = payload[0];
  if (!term || term.slug !== slug || !Number.isSafeInteger(term.id) || term.id <= 0) {
    throw failure("WP_INVALID_TERM", `critical WordPress Area ${slug} returned an unexpected term`);
  }

  return { slug, id: term.id };
}

export async function runCriticalAreaPreflight(options = {}) {
  const timeoutMs = resolvePreflightTimeoutMs(process.env.WP_ORIGIN_TIMEOUT_MS);
  const requestArea = options.requestArea || ((slug) => requestCriticalArea(slug, { timeoutMs }));
  const sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const onAttempt = options.onAttempt || (() => {});
  const verified = [];
  for (const slug of CRITICAL_AREA_SLUGS) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const started = performance.now();
      const evidence = { slug, transport: "fixed-ip", attempt, maxAttempts: MAX_ATTEMPTS, timeoutSeconds: timeoutMs / 1000 };
      try {
        const term = validateAreaTerm(slug, await requestArea(slug));
        onAttempt({ ...evidence, elapsedMs: Math.round(performance.now() - started), outcome: "PASS" });
        verified.push(term);
        break;
      } catch (error) {
        const errorCode = safeErrorCode(error);
        onAttempt({ ...evidence, elapsedMs: Math.round(performance.now() - started), outcome: "FAIL", errorCode });
        if (!TRANSIENT_CODES.has(errorCode) || attempt === MAX_ATTEMPTS) throw error;
        await sleep(500 * attempt);
      }
    }
  }
  return verified;
}

async function main() {
  console.log(JSON.stringify({
    event: "critical-wp-preflight-config",
    timeoutConfigured: process.env.WP_ORIGIN_TIMEOUT_MS !== undefined,
    timeoutSeconds: resolvePreflightTimeoutMs(process.env.WP_ORIGIN_TIMEOUT_MS) / 1000,
    maxAttempts: MAX_ATTEMPTS,
  }));
  const verified = await runCriticalAreaPreflight({ onAttempt: (event) => console.log(JSON.stringify(event)) });
  for (const term of verified) {
    console.log(`critical WordPress Area ${term.slug}: PASS (term id ${term.id})`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(`critical WordPress preflight failed (${safeErrorCode(error)}); see attempt evidence`);
    process.exitCode = 1;
  });
}
