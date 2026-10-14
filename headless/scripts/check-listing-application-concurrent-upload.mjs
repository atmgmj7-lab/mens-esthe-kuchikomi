import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const base = process.env.LISTING_QA_BASE_URL ?? "http://localhost:3105";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLUKgAAAABJRU5ErkJggg==", "base64");
const response = await fetch(`${base}/api/listing-applications/`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ idempotencyKey: randomUUID(), kind: "new_listing", shopName: "同時送信確認店舗", area: "大阪市", websiteUrl: "https://example.test/concurrent", contactName: "非公開", contactEmail: `concurrent-${Date.now()}@example.test`, contactRole: "owner", editPreference: "operator", consentPrivacy: true, consentAccuracy: true, consentImageRights: true }),
});
const application = await response.json();
assert.equal(response.status, 200, application.message);
const upload = () => {
  const form = new FormData(); form.append("uploadToken", application.uploadToken); form.append("banner", new Blob([png], { type: "image/png" }), "banner.png");
  return fetch(`${base}/api/listing-applications/${application.applicationId}/asset/`, { method: "POST", body: form });
};
const results = await Promise.all([upload(), upload()]);
const statuses = results.map((result) => result.status).sort((a, b) => a - b);
assert.deepEqual(statuses, [200, 403], "exactly one simultaneous use of an upload capability may succeed");
console.log("listing application concurrent upload: PASS");
