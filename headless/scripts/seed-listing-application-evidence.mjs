import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const base = process.env.LISTING_QA_BASE_URL ?? "http://127.0.0.1:3105";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLUKgAAAABJRU5ErkJggg==", "base64");
const prefix = `evidence-${Date.now()}`;
const submit = await fetch(`${base}/api/listing-applications/`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    idempotencyKey: randomUUID(), kind: "new_listing", shopName: `${prefix} 店舗`, area: "大阪市北区",
    websiteUrl: "https://example.test/listing-evidence", introduction: "ローカル実画面の確認用に編集される紹介文です。",
    contactName: "非公開確認担当", contactEmail: `${prefix}@example.test`, contactRole: "owner", editPreference: "operator",
    consentPrivacy: true, consentAccuracy: true, consentImageRights: true,
  }),
});
const application = await submit.json();
assert.equal(submit.status, 200, application.message);
assert.match(application.applicationId, /^[0-9a-f-]{36}$/i);
assert.match(application.uploadToken, /^[A-Za-z0-9_-]+$/);
const form = new FormData();
form.append("uploadToken", application.uploadToken);
form.append("banner", new Blob([png], { type: "image/png" }), "banner.png");
const upload = await fetch(`${base}/api/listing-applications/${application.applicationId}/asset/`, { method: "POST", body: form });
const uploadBody = await upload.json();
assert.equal(upload.status, 200, uploadBody.message);
const auth = `Basic ${Buffer.from("operator:fixture-password").toString("base64")}`;
const edit = await fetch(`${base}/api/dashboard/listing-applications/${application.applicationId}/`, {
  method: "PATCH", headers: { "Content-Type": "application/json", Authorization: auth },
  body: JSON.stringify({ expectedRevision: 2, shopName: `${prefix} 編集済み店舗`, area: "大阪市北区", websiteUrl: "https://example.test/listing-evidence-edited", introduction: "運営が承認前に編集した公開候補の紹介文です。", editPreference: "operator" }),
});
const editBody = await edit.json();
assert.equal(edit.status, 200, editBody.message);
console.log(JSON.stringify({ applicationId: application.applicationId, shopName: `${prefix} 編集済み店舗` }));
