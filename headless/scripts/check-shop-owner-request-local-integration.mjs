import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

const appBaseUrl = process.env.SHOP_OWNER_REQUEST_INTEGRATION_BASE_URL;
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;
const rateLimitSecret = process.env.SHOP_OWNER_REQUEST_RATE_LIMIT_SECRET;

assert.ok(appBaseUrl, "SHOP_OWNER_REQUEST_INTEGRATION_BASE_URL is required");
assert.ok(supabaseUrl, "SUPABASE_URL is required");
assert.ok(serviceKey, "SUPABASE_SERVICE_ROLE_KEY is required");
assert.ok(anonKey, "SUPABASE_ANON_KEY is required");
assert.ok(rateLimitSecret, "SHOP_OWNER_REQUEST_RATE_LIMIT_SECRET is required");

const encodedSlug =
  "c-rest%ef%bc%88%e3%82%b7%e3%83%bc%e3%83%ac%e3%82%b9%e3%83%88%ef%bc%89";
const shopId = 865;
const clientIp = "203.0.113.42";

function dataHeaders(key, profileHeader) {
  const headers = {
    apikey: key,
    "Content-Type": "application/json",
    [profileHeader]: "api",
  };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
  return headers;
}

function rateKey(scope) {
  return createHmac("sha256", rateLimitSecret)
    .update(scope)
    .digest("hex");
}

const apiRateKey = rateKey(`ip:${clientIp}|shop:${shopId}`);
const atomicRateKey = rateKey("local-integration-atomic-check");
const integrationSourceUrl = "https://mens-esthe-kuchikomi.com/storelisting/?shop_id=865";

try {
  const response = await fetch(`${appBaseUrl}/api/shop-owner-request/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-real-ip": clientIp,
    },
    body: JSON.stringify({
      shopId,
      shopSlug: encodedSlug,
      shopName: "browser-submitted-name-must-not-be-saved",
      targetUrl: `https://mens-esthe-kuchikomi.com/shops/${encodedSlug}/`,
      sourceUrl: integrationSourceUrl,
      requesterName: "local-integration",
      requesterRole: "owner",
      requesterEmail: "local-integration@example.invalid",
      requestedFields: ["price"],
      changeDetails: "local integration only",
      consentPrivacy: true,
      consentAccuracy: true,
      consentImageRights: true,
      website: "",
    }),
  });
  assert.equal(response.status, 200, "encoded WordPress slug must reach the local API");
  assert.equal((await response.json()).ok, true);

  const query = new URL(`${supabaseUrl}/rest/v1/shop_owner_requests`);
  query.searchParams.set("wp_shop_id", `eq.${shopId}`);
  query.searchParams.set("shop_slug", `eq.${encodedSlug}`);
  query.searchParams.set("select", "id,wp_shop_id,shop_slug,shop_name,target_url,status");
  const serviceRead = await fetch(query, {
    headers: dataHeaders(serviceKey, "Accept-Profile"),
    cache: "no-store",
  });
  assert.equal(serviceRead.ok, true);
  const rows = await serviceRead.json();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].wp_shop_id, shopId);
  assert.equal(rows[0].shop_slug, encodedSlug);
  assert.equal(rows[0].shop_name, "C-REST（シーレスト）");
  assert.equal(rows[0].target_url, `https://mens-esthe-kuchikomi.com/shops/${encodedSlug}/`);
  assert.equal(rows[0].status, "received");

  const anonymousRead = await fetch(query, {
    headers: dataHeaders(anonKey, "Accept-Profile"),
    cache: "no-store",
  });
  assert.equal(
    anonymousRead.ok,
    false,
    "the private owner queue must not be readable with the anonymous key",
  );

  const atomicClaims = [];
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const claim = await fetch(
      `${supabaseUrl}/rest/v1/rpc/claim_shop_owner_request_rate_limit`,
      {
        method: "POST",
        headers: {
          ...dataHeaders(serviceKey, "Content-Profile"),
          "Accept-Profile": "api",
        },
        body: JSON.stringify({ p_request_key: atomicRateKey }),
        cache: "no-store",
      },
    );
    assert.equal(claim.ok, true);
    atomicClaims.push(await claim.json());
  }
  assert.deepEqual(atomicClaims, [true, true, true, true, true, false]);

  console.log("shop owner request local integration passed");
} finally {
  const cleanupRows = new URL(`${supabaseUrl}/rest/v1/shop_owner_requests`);
  cleanupRows.searchParams.set("source_url", `eq.${integrationSourceUrl}`);
  await fetch(cleanupRows, {
    method: "DELETE",
    headers: dataHeaders(serviceKey, "Content-Profile"),
  });

  const cleanupRates = new URL(`${supabaseUrl}/rest/v1/shop_owner_request_rate_limits`);
  cleanupRates.searchParams.set("request_key", `in.(${apiRateKey},${atomicRateKey})`);
  await fetch(cleanupRates, {
    method: "DELETE",
    headers: dataHeaders(serviceKey, "Content-Profile"),
  });
}
