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
const DEFAULT_TIMEOUT_MS = 10_000;

function resolveTimeoutMs() {
  const candidate = Number(process.env.WP_ORIGIN_TIMEOUT_MS);
  return Number.isSafeInteger(candidate) && candidate > 0 ? candidate : DEFAULT_TIMEOUT_MS;
}

function readResponseBody(response) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    response.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new Error("critical WordPress preflight response exceeded 1 MB"));
        return;
      }
      chunks.push(chunk);
    });
    response.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    response.on("error", reject);
  });
}

export function requestCriticalArea(slug, options = {}) {
  const requestImpl = options.requestImpl || https.request;
  const timeoutMs = options.timeoutMs || resolveTimeoutMs();
  const transport = options.transport || {
    hostname: WP_ORIGIN_IP,
    tlsServername: wpOriginTlsServername,
    httpHost: wpOriginHost
  };
  const path = `/wp-json/wp/v2/area?slug=${encodeURIComponent(slug)}&hide_empty=false`;

  return new Promise((resolve, reject) => {
    const request = requestImpl(
      {
        hostname: transport.hostname,
        port: 443,
        servername: transport.tlsServername,
        rejectUnauthorized: true,
        method: "GET",
        path,
        headers: {
          Accept: "application/json",
          Host: transport.httpHost
        }
      },
      async (response) => {
        try {
          resolve({ status: response.statusCode || 500, body: await readResponseBody(response) });
        } catch (error) {
          reject(error);
        }
      }
    );

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`WordPress origin request timed out for critical Area ${slug}`));
    });
    request.on("error", reject);
    request.end();
  });
}

function validateAreaTerm(slug, response) {
  if (response.status !== 200) {
    throw new Error(`critical WordPress Area ${slug} returned HTTP ${response.status}`);
  }

  let payload;
  try {
    payload = JSON.parse(response.body);
  } catch {
    throw new Error(`critical WordPress Area ${slug} returned invalid JSON`);
  }

  if (!Array.isArray(payload) || payload.length !== 1) {
    throw new Error(`critical WordPress Area ${slug} must return exactly one term`);
  }

  const term = payload[0];
  if (!term || term.slug !== slug || !Number.isSafeInteger(term.id) || term.id <= 0) {
    throw new Error(`critical WordPress Area ${slug} returned an unexpected term`);
  }

  return { slug, id: term.id };
}

export async function runCriticalAreaPreflight(options = {}) {
  const requestArea = options.requestArea || requestCriticalArea;
  const verified = [];
  for (const slug of CRITICAL_AREA_SLUGS) {
    verified.push(validateAreaTerm(slug, await requestArea(slug)));
  }
  return verified;
}

async function main() {
  const verified = await runCriticalAreaPreflight();
  for (const term of verified) {
    console.log(`critical WordPress Area ${term.slug}: PASS (term id ${term.id})`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
