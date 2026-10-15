import assert from "node:assert/strict";

const base = process.env.LISTING_QA_BASE_URL ?? "http://127.0.0.1:3105";
const applicationId = process.env.LISTING_QA_APPLICATION_ID;
assert.match(applicationId ?? "", /^[0-9a-f-]{36}$/i, "LISTING_QA_APPLICATION_ID is required");
const authorization = `Basic ${Buffer.from("operator:fixture-password").toString("base64")}`;
const response = await fetch(`${base}/api/dashboard/listing-applications/${applicationId}/`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: authorization },
  body: JSON.stringify({ expectedRevision: 3, decision: "approved", note: "ローカル画面証跡の承認確認" }),
});
const body = await response.json();
assert.equal(response.status, 200, body.message);
console.log(`approved ${applicationId}`);
