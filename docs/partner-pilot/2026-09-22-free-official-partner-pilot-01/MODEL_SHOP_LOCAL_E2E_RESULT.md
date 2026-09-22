# Model Shop local E2E result

対象: 明示的にsyntheticな `Partner Shop A/B` fixtureのみ。P1 Production workspace、token、review、個人データは使用・変更しない。

## Flow proved locally

`auth fixture → canonical own shop → Action-first Home → Guided Onboarding → Review Growth Center → QR / LINE / Website CTA / Widget` をA/B分離fixtureで検証する。

- Aはそれぞれの有効な `counter_qr`、`line_after_visit`、`shop_website` campaignからのみassetを受け取る。
- Bはmetrics未提供時にURL/QR/copy actionを受け取らない。
- manipulated Partner B workspace URLはmetrics取得前にloginへdenyされる。
- Widget snippetはAのpublic widget URLのみを用い、responsive iframeで、install guideは任意案内のみ。
- 390px / 320px / 1280pxでhorizontal overflowは許容しない。

## Existing Native Review chain reused

既存のlocal contractは、canonical campaign → review form → rating/tags/optional note → optional AI Assist → user confirmation → pending moderation → human approval → public adapter/readback → Widget reflection → campaign attribution を保持する。AI outageは既存のfallbackで投稿経路を妨げず、AIによるrating/tag変更・auto-publishはない。

## Failure coverage

wrong shop/workspace、inactive/missing/duplicate campaign、invalid token、cross-workspace asset、pending/rejected non-public、Widget ineligibility、PII/secret non-projectionをfocused contractsおよび既存review/widget regressionsで確認する。

Production values・個別P1 URL・個別QRはこのE2Eに含めない。
