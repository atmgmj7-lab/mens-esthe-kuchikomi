# Eskomi Dashboard and Shop Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存の分析ダッシュボードを共通管理shellへ発展させ、既存RESTの安全化、承認済み口コミdashboard、6項目の確認状況、明示的なEskomi順位、1カラム・二層menuの店舗詳細を、WordPress公開正本のまま完成させる。

**Architecture:** `/dashboard/`を分析概要として維持し、共通`DashboardShell`へ詳細分析と将来の管理routeを登録する。公開店舗情報はWordPress `shop`・`reviews`をserver adapterで共通view modelへ変換し、HeadlessはSSR HTMLだけを描画する。新しい管理書込はPhase 0の安全化が通るまで接続せず、Supabase staging・AI取込・セラピストは後続の独立計画で実装する。

**Tech Stack:** WordPress + SWELL child theme PHP、Next.js 16 App Router、React 19、TypeScript 5、CSS Modules、Node contract tests、Playwright headless QA。

## Global Constraints

- 公開データ元はWordPressを維持し、Supabase非公開stagingを公開UIへ接続しない。
- 推測値、架空口コミ、固定件数、固定確認日、外部評価の平均を追加しない。
- Google評価を実装しない。
- graph libraryと新しいnpm dependencyを追加しない。ringはSSR inline SVG、棒はCSSで描画する。
- 口コミはWordPress `reviews`の公開済みかつ`approval_status=approved`だけを使い、有効な総合評価が3件未満ではgraphとAggregateRatingを出さない。
- 店舗情報確認状況は料金、営業時間、アクセス、予約先、公式サイト、画像の6項目とし、値hashとfield別provenanceが一致する項目だけを数える。
- 既存の`shop_updated_at`はページ更新日であり、個別fieldの確認日の代用にしない。
- 既存の分析KPI、CTA計測属性、公開URL、canonical、パンくず、LocalBusinessを壊さない。
- 追跡済み固定WordPress Application Passwordと、同じ値を再利用している可能性がある資格情報は本番反映前に失効・再発行する。新しい値はrepository、log、計画書、進行記録へ保存しない。
- `/dashboard/`は分析概要、`/dashboard/analytics/`は詳細分析とし、管理routeを同じshellへ段階追加する。
- 管理画面は認証未設定で503、認証失敗で401、権限不足で403にする。Next.js Proxyだけを認可根拠にしない。
- browserの`Authorization`をWordPressへ転送しない。許可した日次更新POSTだけ、Headlessがserver-only Application Passwordを付与する。
- PC 1440/1280/1024/768px、スマホ500/390/375/320px、760/761・900/901・1024/1025px境界で横はみ出し0にする。
- taskごとに実装担当と別担当レビューを行い、全task後に独立横断レビューを行う。
- 各taskで作るcontract scriptを`headless/package.json`へ個別`test:*` commandとして登録し、通常の`npm test` chainにも追加する。
- push、deploy、本番WordPress操作はユーザーの別の明示許可まで行わない。

---

### Task 1: Phase 0 WordPress REST安全化

**Files:**
- Create: `headless/scripts/check-wp-phase0-security-contract.mjs`
- Create: `ai-update-security.php`
- Create: `tests/php/check-ai-update-route-security.php`
- Modify: `headless/package.json`
- Modify: `functions.php`
- Modify: `ai-update-log.php`
- Modify: `ai-site-monitor/price_migrator.py`
- Modify: `.github/workflows/deploy.yml`
- Create: `pm/SECURITY-ROTATION-CHECKLIST-2026-07-18.md`

**Interfaces:**
- Consumes: WordPress `shop` post type、既存`escomi/v1/update`、既存Headless revalidate hook。
- Produces: `escomi_is_valid_daily_request_id()`、`escomi_can_update_daily_shop_data(WP_REST_Request): bool|WP_Error`、`escomi_validate_daily_shop_update(WP_REST_Request): array|WP_Error`、日次allowlist更新route。

- [x] **Step 1: 危険な既存契約を検出する失敗testを書く**

`check-wp-phase0-security-contract.mjs`はrepository rootの`functions.php`と`ai-update-log.php`を読み、次を`assert`する。

```js
assert.doesNotMatch(functionsSource, /opcache_reset\s*\(/);
assert.doesNotMatch(functionsSource, /@?unlink\s*\(/);
assert.doesNotMatch(functionsSource, /register_rest_route\s*\(\s*['"]escomi\/v1['"]\s*,\s*['"]\/debug['"]/);
assert.doesNotMatch(functionsSource, /Missing API key[\s\S]{0,900}return null/);
assert.match(aiSource, /ESKOMI_DAILY_UPDATE_META_KEYS/);
assert.match(aiSource, /current_user_can\(\s*['"]edit_post['"]\s*,\s*\$shop_id\s*\)/);
assert.match(aiSource, /escomi_update_daily_shop_data/);
assert.match(aiSource, /request_id/);
assert.doesNotMatch(aiSource, /['"]basic_price['"]\s*=>\s*\$params/);
assert.doesNotMatch(aiSource, /['"]official_url['"]\s*=>\s*\$params/);
assert.doesNotMatch(priceMigratorSource, /os\.environ\[["']WP_(?:USER|APP_PASSWORD)["']\]\s*=/);
assert.doesNotMatch(deployWorkflowSource, /escomi\/v1\/debug|opcache_reset/);
```

- [x] **Step 2: REDを確認する**

Run: `cd headless && node scripts/check-wp-phase0-security-contract.mjs`

Expected: `opcache_reset`または`unlink`の禁止契約でFAIL。

- [x] **Step 3: 匿名debugとREST保護解除を削除する**

`functions.php`の「Missing API key」対策block全体を削除し、CloudSecure互換をtheme codeで上書きしない。`escomi/v1/debug`、`opcache_reset()`、MU plugin `unlink`を残さない。

- [x] **Step 4: legacy日次更新routeを明示allowlistへ縮小する**

`ai-update-log.php`に次の定数とpermission contractを追加する。

```php
const ESKOMI_DAILY_UPDATE_META_KEYS = array(
    'shop_today_analysis',
    'shop_availability',
    'shop_today_therapists',
);

function escomi_can_update_daily_shop_data( $request ) {
    $shop_id = absint( $request->get_param( 'shop_post_id' ) );
    if ( $shop_id <= 0 || 'shop' !== get_post_type( $shop_id ) ) {
        return new WP_Error( 'invalid_shop', '対象店舗を確認できません', array( 'status' => 400 ) );
    }
    if ( ! current_user_can( 'escomi_update_daily_shop_data' )
        || ! current_user_can( 'edit_post', $shop_id ) ) {
        return new WP_Error( 'rest_forbidden', '更新権限がありません', array( 'status' => 403 ) );
    }
    return true;
}
```

`handle_ai_shop_update_final()`は次を満たす最小実装へ変更する。

```php
$request_id = sanitize_text_field( (string) $request->get_param( 'request_id' ) );
if ( ! escomi_is_valid_daily_request_id( $request_id ) ) {
    return new WP_Error( 'invalid_request_id', 'request_idが不正です', array( 'status' => 400 ) );
}
$meta = $request->get_param( 'meta' );
if ( ! is_array( $meta ) ) {
    return new WP_Error( 'invalid_meta', 'metaが不正です', array( 'status' => 400 ) );
}
$unknown = array_diff( array_keys( $meta ), ESKOMI_DAILY_UPDATE_META_KEYS );
if ( $unknown ) {
    return new WP_Error( 'unsupported_field', '更新対象外の項目があります', array( 'status' => 400 ) );
}
```

`shop_today_analysis`は2,000文字、`shop_availability`は200文字までとする。`shop_today_therapists`は最大100件、許可keyは`name`・`time`・`status`・`tags`だけとし、`name`・`time`は100文字、`status`は200文字、`tags`は最大10件・各50文字までsanitizeする。未知key、入れ子object、上限超過は黙って切り捨てず400で拒否する。`shop_last_ai_check`とlogは実際に変更された場合だけ更新する。

`ai-update-security.php`へWordPress stateを読まないpure validatorを置き、`request_id`は`/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`に一致するcanonical UUIDv4だけを許可する。`tests/php/check-ai-update-route-security.php`は有効UUIDv4に加え、36個のハイフン、version 1 UUID、variant不正、文字数違いをproduction validatorへ通し、無効fixtureが全てfalseになることを実行確認する。

店舗metaへ直近24時間・最大100件の`{ id, appliedAt }`を保存し、期限切れを削除する。同じIDの再送は現在値を再更新せず`duplicate: true`で返す。直前1件だけの保存にせず、retry順序が入れ替わっても過去24時間の重複を検出する。

- [x] **Step 5: ai_update_logを非公開管理CPTへ変更する**

```php
register_post_type( 'ai_update_log', array(
    'label'              => 'AI更新ログ',
    'public'             => false,
    'publicly_queryable' => false,
    'show_ui'            => true,
    'show_in_rest'       => false,
    'supports'           => array( 'title', 'editor', 'custom-fields' ),
    'menu_icon'          => 'dashicons-media-text',
) );
```

- [x] **Step 6: 固定認証情報と匿名debug依存を除去する**

`ai-site-monitor/price_migrator.py`の固定`WP_USER`・`WP_APP_PASSWORD`代入を削除し、環境変数未設定時は値を表示せず停止する。`.github/workflows/deploy.yml`から匿名`/escomi/v1/debug`によるOPcache操作を削除し、日次routeの確認は認証なしPOSTが401または403を返すことだけをhealth条件にする。`functions.php`に重複している`escomi/v1/update`登録は1箇所へ統合する。

専用権限`escomi_update_daily_shop_data`は全管理者へ自動付与しない。後続の本番手順で専用WordPressユーザー1名へだけ付与する。

`pm/SECURITY-ROTATION-CHECKLIST-2026-07-18.md`へ、値を書かずに「旧Application Password失効」「GitHubの旧`WP_USER`・`WP_APP_PASSWORD` secret削除」「専用user作成」「新Application Password発行」「Vercel設定」「GitHubの`DAILY_UPDATE_PROXY_SECRET`設定」「1店舗試験」の確認欄、実施者、確認時刻、証跡URL欄を作る。ローカル実装中は`required`のままにし、全項目の外部確認が終わるまでpush/deploy準備完了と判定しない。

- [x] **Step 7: GREENとPHP構文を確認する**

Run: `cd headless && node scripts/check-wp-phase0-security-contract.mjs && php ../tests/php/check-ai-update-route-security.php && php -l ../functions.php && php -l ../ai-update-log.php && php -l ../ai-update-security.php`

Expected: contract PASS、3つのPHPで`No syntax errors detected`。

- [x] **Step 8: named pathだけcommitする**

```bash
git add functions.php ai-update-log.php ai-update-security.php tests/php/check-ai-update-route-security.php ai-site-monitor/price_migrator.py .github/workflows/deploy.yml pm/SECURITY-ROTATION-CHECKLIST-2026-07-18.md headless/package.json headless/scripts/check-wp-phase0-security-contract.mjs
git commit -m "fix: secure legacy WordPress update routes"
```

---

### Task 2: 日次更新専用の安全なHeadless bridge

**Files:**
- Create: `headless/lib/server/secure-secret.ts`
- Create: `headless/lib/wp/daily-update-proxy.ts`
- Create: `headless/scripts/check-daily-update-proxy-contract.mjs`
- Create: `ai-site-monitor/tests/test_daily_update_payload.py`
- Modify: `headless/app/wp-json/[[...path]]/route.ts`
- Modify: `headless/.env.example`
- Modify: `ai-site-monitor/ai_auto_updater.py`
- Modify: `ai-site-monitor/ai_monthly_updater.py`
- Modify: `ai-site-monitor/hourly_schedule_updater.py`
- Modify: `ai-site-monitor/price_migrator.py`
- Modify: `ai-site-monitor/crawler_base.py`
- Modify: `ai-site-monitor/README.md`
- Modify: `SHOP-prompt.md`
- Modify: `DEPLOY-AI-UPDATE.md`
- Modify: `tools/ai_crawl_engine.py`
- Modify: `tools/AI-CRAWL-README.md`
- Modify: `.github/workflows/daily_shop_update.yml`
- Modify: `.github/workflows/monthly_shop_summary.yml`
- Modify: `headless/package.json`

**Interfaces:**
- Consumes: `DAILY_UPDATE_PROXY_SECRET`、`WP_DAILY_UPDATE_USER`、`WP_DAILY_UPDATE_APP_PASSWORD`。
- Produces: exact path日次POST bridge、`buildDailyUpdateRequest()`、`secretsMatch()`、専用秘密鍵だけを持つGitHub caller。

- [ ] **Step 1: exact path・秘密鍵・payloadの失敗testを書く**

Node contractとPython unittestで次を固定する。

```js
assert.match(proxySource, /targetPath\s*!==\s*["']escomi\/v1\/update["']/);
assert.match(proxySource, /DAILY_UPDATE_PROXY_SECRET/);
assert.match(proxySource, /WP_DAILY_UPDATE_USER/);
assert.match(proxySource, /WP_DAILY_UPDATE_APP_PASSWORD/);
assert.doesNotMatch(proxySource, /request\.headers\.get\(["']authorization["']\)/i);
assert.match(proxySource, /status:\s*503/);
assert.match(proxySource, /status:\s*401/);
assert.match(monthlyWorkflow, /workflow_dispatch/);
assert.doesNotMatch(monthlyWorkflow, /schedule:/);
```

Python testは`request_id`がUUID、age fieldがない、headerが`x-escomi-daily-update-secret`だけ、Basic認証を付けないことを検証する。Node testは1byteずつ流れる256KB本文が成功し、256KB+1byteはreaderが残りを全読込せず413を返すこと、unknown pathではbodyを読まないことを実行検証する。

- [ ] **Step 2: REDを確認する**

Run: `cd headless && node scripts/check-daily-update-proxy-contract.mjs && cd ../ai-site-monitor && python -m unittest tests.test_daily_update_payload`

Expected: 受信Authorization転送またはrequest_id不在でFAIL。

- [ ] **Step 3: timing-safe secretとserver-only認証headerを実装する**

```ts
export function secretsMatch(expected: string, actual: string): boolean {
  const left = createHash("sha256").update(expected).digest();
  const right = createHash("sha256").update(actual).digest();
  return timingSafeEqual(left, right);
}
```

`buildDailyUpdateUpstreamHeaders()`は受信headerを複製せず、`Content-Type: application/json`とserver環境変数から作ったWordPress Basic headerだけを返す。秘密値をlog・responseへ含めない。

- [ ] **Step 4: POSTを日次routeだけへ縮小する**

GET/HEADは従来の公開proxyとして認証headerなしで維持する。POSTは`targetPath === "escomi/v1/update"`、JSON、256KB以下だけを許可する。`readBoundedJsonBody(request.body, 262144)`は`ReadableStreamDefaultReader`をchunkごとに読み、累積が上限を1byteでも超えた時点で`reader.cancel()`して413を返す。`Content-Length`だけを信用せず、先に`arrayBuffer()`で全本文を確保しない。

3環境変数のどれかが未設定なら503、専用headerなし・不一致は401、対象外pathは405、上限超過は413、JSON不正は400とする。受信Authorizationは常に破棄する。

- [ ] **Step 5: 日次・毎時callerを専用秘密鍵へ移行する**

`ai_auto_updater.py`と`hourly_schedule_updater.py`は各requestで`str(uuid.uuid4())`をpayloadへ入れ、`DAILY_UPDATE_PROXY_SECRET`を`x-escomi-daily-update-secret`へ付ける。POSTで`WP_USER`・`WP_APP_PASSWORD`を使わず、年齢fieldをpayloadから削除する。店舗一覧の公開GETは認証なしへ変更し、公開responseに必要項目がない時は更新対象から外して理由だけを記録する。

`.github/workflows/daily_shop_update.yml`は`DAILY_UPDATE_PROXY_SECRET`だけをcallerへ渡し、旧WordPress認証secretを渡さない。preflightは秘密鍵なし401、秘密鍵あり・空payload400を正常なroute存在確認とする。

- [ ] **Step 6: 月次・移行・汎用crawlerの直接書込を停止する**

`.github/workflows/monthly_shop_summary.yml`の`schedule`を削除し、`workflow_dispatch`も「Supabase staging計画完了まで書込を実行せず説明を出して終了」へ変更する。`ai_monthly_updater.py`、`price_migrator.py`、`tools/ai_crawl_engine.py`から日次routeへ料金・紹介・公式URL・年齢を送る経路を削除または明示的に停止する。公式サイト自動収集の入力項目は設計上残すが、このplanでは公開書込しない。

`SHOP-prompt.md`、`DEPLOY-AI-UPDATE.md`、`tools/AI-CRAWL-README.md`から`WP_USER/WP_APP_PASSWORD`をcallerへ渡して公開URLへ直接POSTする手順を削除する。日次3項目は専用bridge、料金・紹介・公式URL・年齢は非公開staging完成まで実行禁止と明記する。過去記録として残す必要がある箇所は冒頭へ`DEPRECATED / 実行禁止`を付け、コピー可能な旧curl・command・secret名を残さない。contract scriptは3文書に旧直接POST手順がないことを検査する。

- [ ] **Step 7: GREENを確認する**

Run: `cd headless && node scripts/check-daily-update-proxy-contract.mjs && npm run typecheck && npm run lint && cd ../ai-site-monitor && python -m unittest tests.test_daily_update_payload`

Expected: contract、typecheck、lint PASS。

- [ ] **Step 8: commitする**

```bash
git add headless/app/wp-json/\[\[...path\]\]/route.ts headless/lib/server/secure-secret.ts headless/lib/wp/daily-update-proxy.ts headless/scripts/check-daily-update-proxy-contract.mjs headless/.env.example headless/package.json ai-site-monitor/ai_auto_updater.py ai-site-monitor/ai_monthly_updater.py ai-site-monitor/hourly_schedule_updater.py ai-site-monitor/price_migrator.py ai-site-monitor/crawler_base.py ai-site-monitor/README.md ai-site-monitor/tests/test_daily_update_payload.py SHOP-prompt.md DEPLOY-AI-UPDATE.md tools/ai_crawl_engine.py tools/AI-CRAWL-README.md .github/workflows/daily_shop_update.yml .github/workflows/monthly_shop_summary.yml
git commit -m "fix: isolate automated daily shop updates"
```

---

### Task 3: Dashboard認証とcache再検証のfail-closed化

**Files:**
- Create: `headless/lib/dashboard/content-admin-auth.ts`
- Create: `headless/scripts/check-headless-admin-security-contract.mjs`
- Create: `headless/proxy.ts`
- Delete: `headless/middleware.ts`
- Modify: `headless/app/api/revalidate/route.ts`
- Modify: `functions.php`
- Modify: `headless/.env.example`
- Modify: `pm/RUNBOOK.md`
- Modify: `pm/HEADLESS-CUTOVER-CHECKLIST.md`
- Modify: `headless/package.json`

**Interfaces:**
- Consumes: `DASHBOARD_BASIC_AUTH_USER`、`DASHBOARD_BASIC_AUTH_PASSWORD`、`REVALIDATE_SECRET`。
- Produces: `isDashboardProtectedPath()`、`resolveContentAdminAuth()`、`authorizeDashboardRequest()`、Next.js 16 `proxy()`、POST/header限定revalidate。

- [ ] **Step 1: fail-closed contractの失敗testを書く**

```js
assert.match(proxySource, /export function proxy/);
assert.match(proxySource, /status:\s*503/);
assert.match(authSource, /missing-configuration/);
assert.match(proxySource, /\/api\/dashboard/);
assert.doesNotMatch(revalidateSource, /export async function GET/);
assert.match(revalidateSource, /secretsMatch/);
assert.match(revalidateSource, /status:\s*503/);
assert.match(functionsSource, /revalidate secret not configured; request skipped/);
```

同じscriptでTypeScriptをtranspileしてpure関数を実行し、次を固定する。

```ts
assert.equal(isDashboardProtectedPath("/dashboard"), true);
assert.equal(isDashboardProtectedPath("/dashboard/content/shops"), true);
assert.equal(isDashboardProtectedPath("/api/dashboard/content/shops"), true);
assert.equal(isDashboardProtectedPath("/wp-content/themes/swell_child/dashboard/api/report"), true);
assert.equal(isDashboardProtectedPath("/api/revalidate"), false);
assert.equal(resolveContentAdminAuth(null, {}).reason, "missing-configuration");
assert.equal(resolveContentAdminAuth(null, { user: "qa", password: "secret" }).reason, "missing-credentials");
assert.equal(resolveContentAdminAuth("Basic d3Jvbmc6d3Jvbmc=", { user: "qa", password: "secret" }).reason, "invalid-credentials");
assert.equal(resolveContentAdminAuth("Basic cWE6c2VjcmV0", { user: "qa", password: "secret" }).ok, true);
assert.equal(authorizeDashboardRequest(null, {}).status, 503);
assert.equal(authorizeDashboardRequest("Basic d3Jvbmc6d3Jvbmc=", { user: "qa", password: "secret" }).status, 401);
assert.equal(authorizeDashboardRequest("Basic cWE6c2VjcmV0", { user: "qa", password: "secret" }).status, 200);
```

- [ ] **Step 2: REDを確認する**

Run: `cd headless && node scripts/check-headless-admin-security-contract.mjs`

Expected: middlewareの認証未設定pass-throughまたはGET revalidateでFAIL。

- [ ] **Step 3: pure auth resolverとNext.js 16 proxyを実装する**

`isDashboardProtectedPath(pathname)`は通常dashboard、将来の`/api/dashboard/*`、legacy dashboard配下の画面・APIを同じ保護対象にする。matcher文字列が存在するだけで合格にせず、このpredicateと`authorizeDashboardRequest()`を`proxy()`が必ず呼ぶ。

`resolveContentAdminAuth(authorization, env)`は`missing-configuration`、`missing-credentials`、`invalid-credentials`を区別する。正式な`DASHBOARD_BASIC_AUTH_USER/PASSWORD`が両方ある場合だけ使い、旧`BASIC_AUTH_USER/PASSWORD`は両方揃う場合だけ互換利用する。新旧の片方ずつを混ぜず、片方だけの設定は503にする。認証値比較はTask 2の`secretsMatch()`を使う。

`headless/middleware.ts`を`headless/proxy.ts`へ移し、export名を`proxy`へ変更する。認証未設定は503、認証不正は401とし、matcherへ`/dashboard/:path*`、`/api/dashboard/:path*`、legacy dashboard routeを含める。401/503は`Cache-Control: no-store`と`X-Robots-Tag: noindex, nofollow`を返す。Proxyは入口判定であり、後続の管理APIもresolverをroute内で直接呼ぶ。

- [ ] **Step 4: revalidateをPOST・header secret限定にする**

`REVALIDATE_SECRET`未設定は503、`x-revalidate-secret`なし・不一致は401、query secretは無視する。GET exportは削除する。WordPress側`escomi_headless_send_revalidate()`もsecretが空ならrequestを送らず、debug時だけ`revalidate secret not configured; request skipped`を記録する。

`headless/.env.example`は正式なdashboard環境変数へ更新する。`pm/RUNBOOK.md`の「未設定なら認証なし」を削除し、fail-closed、旧envのpair-only互換、日次bridge、secret非表示の確認手順へ更新する。`pm/HEADLESS-CUTOVER-CHECKLIST.md`からGET/query revalidate例を削除し、POST/header方式だけを残す。

- [ ] **Step 5: GREENを確認する**

Run: `cd headless && node scripts/check-headless-admin-security-contract.mjs && npm run typecheck && npm run lint && npm run build`

Expected: contract、typecheck、lint、build PASS。

- [ ] **Step 6: commitする**

```bash
git add functions.php headless/proxy.ts headless/middleware.ts headless/app/api/revalidate/route.ts headless/lib/dashboard/content-admin-auth.ts headless/scripts/check-headless-admin-security-contract.mjs headless/.env.example pm/RUNBOOK.md pm/HEADLESS-CUTOVER-CHECKLIST.md headless/package.json
git commit -m "fix: fail closed dashboard administration routes"
```

---

### Task 4: 分析ダッシュボード共通shell

**Files:**
- Create: `headless/components/dashboard/DashboardShell.tsx`
- Create: `headless/components/dashboard/DashboardNav.tsx`
- Create: `headless/components/dashboard/DashboardShell.module.css`
- Create: `headless/lib/dashboard/navigation.ts`
- Create: `headless/lib/dashboard/data-result.ts`
- Create: `headless/scripts/check-dashboard-shell-contract.mjs`
- Modify: `headless/app/dashboard/layout.tsx`
- Modify: `headless/app/dashboard/page.tsx`
- Modify: `headless/app/dashboard/analytics/page.tsx`
- Modify: `headless/components/AnalyticsDashboard.tsx`
- Modify: `headless/components/GoogleAnalytics.tsx`
- Modify: `headless/components/WPQuickLinks.tsx`
- Modify: `headless/lib/ga.ts`
- Modify: `headless/lib/searchConsole.ts`
- Modify: `headless/app/globals.css`
- Modify: `headless/scripts/check-q06-seo-metadata.mjs`
- Modify: `headless/scripts/check-visible-eskomi-brand.mjs`
- Modify: `headless/package.json`

**Interfaces:**
- Consumes: existing `AnalyticsDashboard` and dashboard routes。
- Produces: `DASHBOARD_NAV_GROUPS`、`DashboardShell({children})`、全dashboard route共通navigation。

- [ ] **Step 1: 共通shellの失敗testを書く**

```js
assert.match(layoutSource, /<DashboardShell>\s*\{children\}\s*<\/DashboardShell>/s);
assert.match(navigationSource, /href:\s*["']\/dashboard\/["']/);
assert.match(navigationSource, /href:\s*["']\/dashboard\/analytics\/["']/);
assert.doesNotMatch(dashboardPageSource, /className=["']dashboard-shell["']/);
assert.doesNotMatch(analyticsPageSource, /className=["']dashboard-shell["']/);
assert.doesNotMatch(gaSource, /mockDaily|MOCK_PAGES|MOCK_CREATIVES|MOCK_CTA/);
assert.doesNotMatch(searchConsoleSource, /MOCK_SEARCH_/);
assert.match(dataResultSource, /status:\s*["']live["']/);
assert.match(dataResultSource, /status:\s*["']unavailable["']/);
assert.doesNotMatch(quickLinksSource, /localhost:3333/);
assert.doesNotMatch(analyticsDashboardSource, /<button[^>]*>\s*\{prompt\}/s);
assert.match(googleAnalyticsSource, /pathname\.startsWith\(["']\/dashboard["']\)/);
assert.match(shellCss, /grid-template-columns:\s*minmax\(220px,\s*260px\)\s+minmax\(0,\s*1fr\)/);
assert.match(shellCss, /@media\s*\(max-width:\s*900px\)/);
```

- [ ] **Step 2: REDを確認する**

Run: `cd headless && node scripts/check-dashboard-shell-contract.mjs`

Expected: `DashboardShell`不在でFAIL。

- [ ] **Step 3: route registryを実装する**

```ts
export type DashboardNavItem = {
  href: string;
  label: string;
  description: string;
};

export const DASHBOARD_NAV_GROUPS = [
  {
    label: "分析",
    items: [
      { href: "/dashboard/", label: "概要", description: "GA4・Search Console・SEO状況" },
      { href: "/dashboard/analytics/", label: "詳細分析", description: "期間別・ページ別の深掘り" },
    ],
  },
] satisfies Array<{ label: string; items: DashboardNavItem[] }>;
```

未実装の管理routeはこのtaskでmenuへ出さない。

- [ ] **Step 4: 共通shellをlayoutへ移す**

`DashboardShell`はPCで左navigation + main、900px以下で上部drawer + 1カラムとする。headerに「Eskomi Growth Command」「エスコミ管理ダッシュボード」、footerを1回だけ表示し、各pageから重複shellを削除する。DOM順はnavigation→mainとし、skip link、現在地`aria-current=page`、44px以上の操作を持つ。

- [ ] **Step 5: 初期分析取得を変えない**

`/dashboard/`は`<AnalyticsDashboard />`、`/dashboard/analytics/`は`<AnalyticsDashboard showWeekly showQuickLinks={false} />`を維持する。管理一覧API requestや固定badgeを追加しない。`WPQuickLinks`のlocalhost専用linkと、処理のないAI Workbench buttonは削除する。実装済みのGA4、Search Console、WordPress管理linkだけを操作要素として残す。

- [ ] **Step 6: mock fallbackを削除し、未連携を明示する**

`ga.ts`の`mockDaily`、`mockTotals`、`MOCK_PAGES`、`MOCK_CREATIVES`、`MOCK_CTA`と、`searchConsole.ts`の`MOCK_SEARCH_*`を削除する。全取得関数は次のdiscriminated unionを返す。

```ts
export type DashboardDataResult<T> =
  | { status: "live"; data: T; source: "ga4" | "search-console" | "analytics-supabase" | "legacy-proxy"; fetchedAt: string }
  | { status: "unavailable"; data: null; source: "ga4" | "search-console" | "analytics-supabase" | "legacy-proxy"; reason: "not-configured" | "request-failed" | "invalid-response" };
```

HTTP 200で空配列・0集計を受けた場合は`{ status: "live", data: [] }`または実0値とし、未設定・例外・不正responseは必ず`data: null`の`unavailable`にする。fallback引数や空配列の参照同一性で接続状態を推定しない。検査scriptは「成功0件」「未設定」「request失敗」のfixtureをproduction result helperへ渡して3状態を実行確認する。

`AnalyticsDashboard`はGA4、Search Console、分析用Supabaseを別sourceとして状態保持し、各panelへデータ元と最終取得成否を表示する。GA合計がliveでもページ別取得に失敗した場合はページrankingを未取得状態にし、別sourceの固定配列を実データとして表示しない。現在のbrowser用`dashboard-supabase.ts`は分析読取だけに限定し、後続の非公開管理stagingへ再利用しない。`GoogleAnalytics`はpathnameが`/dashboard`から始まる場合、pageview、click listener、Scriptを全て無効にする。

- [ ] **Step 7: GREENとbuildを確認する**

Run: `cd headless && node scripts/check-dashboard-shell-contract.mjs && npm run test:q06-seo-metadata && npm run test:visible-eskomi-brand && npm run typecheck && npm run lint && npm run build`

Expected: contract、typecheck、lint、build PASS。

- [ ] **Step 8: commitする**

```bash
git add headless/app/dashboard headless/app/globals.css headless/components/AnalyticsDashboard.tsx headless/components/GoogleAnalytics.tsx headless/components/WPQuickLinks.tsx headless/components/dashboard headless/lib/dashboard/navigation.ts headless/lib/dashboard/data-result.ts headless/lib/ga.ts headless/lib/searchConsole.ts headless/scripts/check-dashboard-shell-contract.mjs headless/scripts/check-q06-seo-metadata.mjs headless/scripts/check-visible-eskomi-brand.mjs headless/package.json
git commit -m "feat: unify dashboard analytics shell"
```

---

### Task 5: WordPress承認済み口コミの公開contract

**Files:**
- Create: `reviews-public-rest.php`
- Create: `headless/lib/wp/reviews.ts`
- Create: `headless/scripts/check-public-review-contract.mjs`
- Modify: `functions.php`
- Modify: `reviews-cpt.php`
- Modify: `headless/lib/wp/types.ts`
- Modify: `headless/app/shops/[slug]/page.tsx`
- Create: `headless/app/shops/[slug]/reviews/page.tsx`
- Modify: `headless/components/ShopDetail.tsx`
- Modify: `headless/scripts/check-final-design-preservation.mjs`
- Modify: `headless/package.json`

**Interfaces:**
- Consumes: WordPress `reviews` CPT fields。
- Produces: `GET /wp-json/escomi/v1/shops/{id}/reviews`、`ApprovedShopReviewPage`、`getApprovedShopReviews(shopId, page, perPage)`、`/shops/{slug}/reviews/`。

- [ ] **Step 1: 口コミ正本の失敗testを書く**

```js
assert.match(restSource, /post_type['"]?\s*=>\s*['"]reviews['"]/);
assert.match(restSource, /post_status['"]?\s*=>\s*['"]publish['"]/);
assert.match(restSource, /approval_status/);
assert.match(restSource, /review_shop_id/);
assert.doesNotMatch(restSource, /reviewer_email|moderation_note/);
assert.match(nextSource, /cacheTag\([\s\S]*`reviews:\$\{shopId\}`/);
assert.match(nextSource, /status:\s*["']available["']/);
assert.match(nextSource, /status:\s*["']unavailable["']/);
assert.doesNotMatch(shopDetailSource, /extractShopUserReviewItems/);
assert.match(functionsSource, /save_post_reviews/);
```

- [ ] **Step 2: REDを確認する**

Run: `cd headless && node scripts/check-public-review-contract.mjs`

Expected: 専用REST不在でFAIL。

- [ ] **Step 3: WordPress read-only RESTを実装する**

routeはpathの`shop_id`が公開`shop`であることを確認し、`reviews`から`post_status=publish`、`approval_status=approved`、`review_shop_id=shop_id`だけを新しい順で取得する。公開responseの`items`は次だけとする。

```php
array(
    'id'                 => (int) $review->ID,
    'body'               => wp_strip_all_tags( $review->post_content ),
    'submittedAt'        => get_post_time( DATE_ATOM, true, $review ),
    'ratingTotal'        => (int) get_post_meta( $review->ID, 'rating_total', true ),
    'ratingPrice'        => (int) get_post_meta( $review->ID, 'rating_price', true ),
    'ratingService'      => (int) get_post_meta( $review->ID, 'rating_service', true ),
    'ratingCleanliness'  => (int) get_post_meta( $review->ID, 'rating_cleanliness', true ),
)
```

ratingは1〜5以外を`null`にする。`per_page`は1〜20、`page`は正整数とする。同じ承認済みquery全件から4評価別に`average`と`responseCount`、有効な投稿日から`oldestSubmittedAt`と`latestSubmittedAt`を集計し、responseを`{ items, total, totalPages, page, metrics, dateRange }`にする。平均は有効な1〜5だけを分母にして小数1桁へ丸める。reviewer email、名前、審査状態、管理メモ、IPを返さない。slugはrelation正本に使わず、不一致をresponseの管理用debugへ出さない。

- [ ] **Step 4: Next server adapterを実装する**

```ts
export type ApprovedShopReview = {
  id: number;
  body: string;
  submittedAt: string | null;
  ratings: {
    total: number | null;
    price: number | null;
    service: number | null;
    cleanliness: number | null;
  };
};

export type ApprovedShopReviewPage = {
  reviews: ApprovedShopReview[];
  total: number;
  totalPages: number;
  page: number;
  metrics: Record<
    "total" | "price" | "service" | "cleanliness",
    { average: number | null; responseCount: number }
  >;
  dateRange: { oldestSubmittedAt: string | null; latestSubmittedAt: string | null };
};

export type ApprovedShopReviewResult =
  | { status: "available"; page: ApprovedShopReviewPage }
  | { status: "unavailable"; reason: "request-failed" | "invalid-response" };
```

`getApprovedShopReviews()`は`use cache`、`cacheLife("minutes")`、`cacheTag("wp", `reviews:${shopId}`)`を使う。WordPressが正常に0件を返した場合だけ`status: "available"`・total 0とする。network失敗、非2xx、不正responseは`status: "unavailable"`とし、0件へ変換しない。schemaとgraphは`available`時の同じ`metrics`だけを使い、表示と構造化データの分母を分けない。

- [ ] **Step 5: 店舗pageへ同時取得を接続する**

shop取得後、`getAreas()`とreviews最大3件だけを`Promise.all`で開始する。parent areaは取得済みarea collectionから解決し、同じarea RESTを重複取得しない。`ShopDetail`へreview resultを明示propとして渡し、ACFの`user_reviews`・`reviews`を店舗詳細の公開口コミとして使わない。

`/shops/[slug]/reviews/page.tsx`は同じ店舗IDで20件ずつ取得し、canonical `/shops/{slug}/reviews/`、パンくず、前後page linkを持つ。`available`かつ0件では空状態と口コミ投稿導線を表示し、`unavailable`では「口コミ情報を現在取得できません」を表示して0件とは書かない。架空の例文を出さない。

`reviews`の保存・削除・審査状態変更時は`save_post_reviews`等から既存の`wp`再検証をqueueし、店舗詳細と口コミ一覧のcacheを同時に失効させる。

- [ ] **Step 6: GREENを確認する**

Run: `cd headless && node scripts/check-public-review-contract.mjs && npm run test:final-design-preservation && npm run typecheck && npm run lint`

Expected: contract、typecheck、lint PASS。

- [ ] **Step 7: commitする**

```bash
git add reviews-public-rest.php reviews-cpt.php functions.php headless/lib/wp/reviews.ts headless/lib/wp/types.ts headless/app/shops/\[slug\]/page.tsx headless/app/shops/\[slug\]/reviews/page.tsx headless/components/ShopDetail.tsx headless/scripts/check-public-review-contract.mjs headless/scripts/check-final-design-preservation.mjs headless/package.json
git commit -m "feat: expose approved shop reviews safely"
```

---

### Task 6: 口コミdashboardとschemaの共通集計

**Files:**
- Create: `headless/lib/shop-review-view-model.ts`
- Create: `headless/components/shop-detail/ShopReviewDashboard.tsx`
- Create: `headless/scripts/check-shop-review-dashboard-contract.mjs`
- Modify: `headless/lib/seo.ts`
- Modify: `headless/components/shop-detail/ShopDetailSections.tsx`
- Modify: `headless/components/shop-detail/ShopDetail.module.css`
- Modify: `headless/components/ShopDetail.tsx`
- Modify: `headless/scripts/check-review-rating.mjs`
- Modify: `headless/scripts/check-schema-output-conditions.mjs`
- Modify: `headless/scripts/check-shop-detail-density-contract.mjs`
- Modify: `headless/scripts/check-final-design-preservation.mjs`
- Modify: `headless/package.json`

**Interfaces:**
- Consumes: `ApprovedShopReviewResult`。
- Produces: `ShopReviewViewModel`、`buildShopReviewViewModel()`、graph・最新3件・AggregateRating共通値。

- [ ] **Step 1: 2件/3件境界の失敗testを書く**

検査scriptは既存`check-shop-detail-view-model.mjs`と同じくTypeScript compilerでproduction view modelをCommonJSへ変換し、`vm`で実関数を実行する。source文字列だけを検査せず、承認済み0・2・3件、個別評価2・3件、不正平均・不正回答数のfixtureをproduction関数へ渡す。既存`review-rating` fixtureにもschema境界を追加する。

```ts
export type ShopReviewMetric = {
  key: "total" | "price" | "service" | "cleanliness";
  label: string;
  value: number;
  count: number;
};

export type ShopReviewViewModel =
  | { status: "unavailable"; reason: "request-failed" | "invalid-response" }
  | {
      status: "available";
      totalApproved: number;
      showGraph: boolean;
      aggregateRating: number | null;
      aggregateRatingCount: number;
      metrics: ShopReviewMetric[];
      latest: ApprovedShopReview[];
      dateRange: { oldestSubmittedAt: string | null; latestSubmittedAt: string | null };
    };
```

`unavailable`は0件empty stateへ変換せず、graph・schema・件数を出さない。`available`で総合評価の有効回答が2件なら`showGraph=false`・schemaなし、3件なら総合平均と有効回答3件以上の棒だけを返すことを固定する。公開口コミ総数と評価回答数を混同せず、0・範囲外・nullを分母へ入れない。

- [ ] **Step 2: REDを確認する**

Run: `cd headless && node scripts/check-shop-review-dashboard-contract.mjs && npm run test:review-rating`

Expected: view modelまたは3件境界契約でFAIL。

- [ ] **Step 3: server-only集計を実装する**

WordPress responseの各metricを範囲検証し、小数1桁へ丸める。総合回答3件未満では`showGraph=false`。個別metricは有効回答3件未満なら配列へ入れない。`latest`は投稿日降順最大3件。responseの平均・回答数が不正ならそのmetricを表示せずschemaにも渡さない。

- [ ] **Step 4: SSR graphを実装する**

`ShopReviewDashboard`は`showGraph=true`時だけ、小型inline SVG ringとCSS横棒を表示する。棒は0起点、`width = value / 5 * 100%`、数値・回答件数・`aria-label`を文字でも併記する。Client Component、animation、tooltipを使わない。2件以下では口コミ本文と「評価グラフは承認済み評価3件以上で表示します」を出す。日付が両方有効なら対象期間、最新だけなら最新投稿日を表示し、日付なしは推測しない。口コミ本文blockは最大960pxとする。

- [ ] **Step 5: schemaを同じview modelへ接続する**

`shopLocalBusinessJsonLd(shop, reviewModel?: ShopReviewViewModel)`へ後方互換のoptional引数としてsignatureを拡張し、`reviewModel?.status === "available"`かつ`reviewModel.showGraph`かつ`aggregateRating != null`の時だけ次を出す。既存の1引数callerと`unavailable`は口コミschemaなしで従来どおり動かす。

```ts
data.aggregateRating = {
  "@type": "AggregateRating",
  ratingValue: reviewModel.aggregateRating,
  reviewCount: reviewModel.aggregateRatingCount,
  bestRating: 5,
  worstRating: 1,
};
```

- [ ] **Step 6: GREENを確認する**

Run: `cd headless && node scripts/check-shop-review-dashboard-contract.mjs && npm run test:review-rating && npm run test:schema-output && npm run test:shop-detail-density && npm run test:final-design-preservation && npm run typecheck && npm run lint`

Expected: 全てPASS。

- [ ] **Step 7: commitする**

```bash
git add headless/lib/shop-review-view-model.ts headless/lib/seo.ts headless/components/ShopDetail.tsx headless/components/shop-detail/ShopDetailSections.tsx headless/components/shop-detail/ShopReviewDashboard.tsx headless/components/shop-detail/ShopDetail.module.css headless/scripts/check-shop-review-dashboard-contract.mjs headless/scripts/check-review-rating.mjs headless/scripts/check-schema-output-conditions.mjs headless/scripts/check-shop-detail-density-contract.mjs headless/scripts/check-final-design-preservation.mjs headless/package.json
git commit -m "feat: add approved review dashboard"
```

---

### Task 7: field別provenance・Eskomi順位・1カラム二層menu

**Files:**
- Create: `shop-public-meta.php`
- Create: `headless/lib/shop-information-coverage.ts`
- Create: `headless/lib/shop-detail-modules.ts`
- Create: `headless/components/shop-detail/ShopInformationCoverage.tsx`
- Create: `headless/components/shop-detail/ShopRankingSnapshot.tsx`
- Create: `headless/components/shop-detail/ShopDetailModuleList.tsx`
- Create: `headless/components/shop-detail/ShopOverviewSection.tsx`
- Create: `headless/components/shop-detail/ShopPricesSection.tsx`
- Create: `headless/components/shop-detail/ShopFeaturesSection.tsx`
- Create: `headless/components/shop-detail/ShopAccessSection.tsx`
- Create: `headless/components/shop-detail/ShopBasicInformationSection.tsx`
- Create: `headless/scripts/prepare-shop-public-meta-seed.mjs`
- Create: `headless/scripts/check-shop-public-meta-seed.mjs`
- Create: `headless/scripts/check-shop-dashboard-foundation-contract.mjs`
- Create: `docs/data/shop-public-meta-seed-preview-2026-07-18.json`
- Create: `docs/data/excluded-shop-draft-preview-2026-07-18.json`
- Read: `docs/data/sakaisujihonmachi-phase4-30-shops-2026-07-15.json`
- Read: `docs/data/sakaisujihonmachi-phase4-evidence-2026-07-15.json`
- Modify: `functions.php`
- Modify: `headless/lib/wp/types.ts`
- Modify: `headless/lib/shop-detail-view-model.ts`
- Modify: `headless/components/ShopDetail.tsx`
- Modify: `headless/components/shop-detail/ShopSectionNav.tsx`
- Modify: `headless/components/shop-detail/ShopDetailSections.tsx`
- Modify: `headless/components/shop-detail/ShopDetail.module.css`
- Modify: `headless/scripts/check-shop-detail-view-model.mjs`
- Modify: `headless/scripts/check-shop-detail-density-contract.mjs`
- Modify: `headless/scripts/check-shop-detail-responsive-contract.mjs`
- Modify: `headless/scripts/check-final-design-preservation.mjs`
- Modify: `headless/scripts/check-internal-link-map.mjs`
- Modify: `headless/package.json`

**Interfaces:**
- Consumes: WordPress `shop_fact_provenance`、`shop_area_ranking_snapshot`、現在のShopView値。
- Produces: `ShopInformationCoverage`、`ShopRankingSnapshot`、`SHOP_DETAIL_MODULES`、二層`ShopSectionLink.layer`、非公開初期投入preview。

- [ ] **Step 1: provenanceと二層menuの失敗testを書く**

```ts
export type ShopFactProvenance = {
  field: "price" | "hours" | "access" | "booking" | "official" | "image";
  sourceUrl: string;
  sourceType: "official-site" | "shop-provided" | "admin-verified";
  observedAt: string;
  reviewedAt: string;
  reviewStatus: "reviewed" | "pending" | "rejected";
  publishedValueHash: string;
};

export type ShopInformationCoverage = {
  verifiedCount: number;
  totalCount: 6;
  latestReviewedAt: string | null;
  items: Array<{ key: "price" | "hours" | "access" | "booking" | "official" | "image"; label: string; verified: boolean }>;
};
```

検査scriptはTypeScript compilerと`vm`でproductionのcoverage・hash関数を実行する。料金値hashだけ一致するfixtureで1/6、料金値変更後0/6、provenanceなしでmodule非表示を固定する。順位は`areaSlug`、`rank`、`totalEligibleShops`、`basis`、`observedAt`、`isPr`が全て有効な時だけ表示する。

- [ ] **Step 2: REDを確認する**

Run: `cd headless && node scripts/check-shop-dashboard-foundation-contract.mjs`

Expected: meta contract・coverage module・二層link不在でFAIL。

- [ ] **Step 3: WordPress metaをread contractとして登録する**

`shop-public-meta.php`で`shop_fact_provenance`と`shop_area_ranking_snapshot`をobject配列としてsanitizeする。provenanceは6つの許可`field`だけを受け付け、1店舗・1fieldにつき最新1recordへ正規化し、重複field、未知field、欠落fieldを拒否する。公開RESTはread-only、更新は`edit_post`と専用管理権限を要求する。現行値へ推測のprovenanceを自動生成しない。

- [ ] **Step 4: canonical hashとcoverageを実装する**

`canonicalizeShopFactValue(field, model)`を唯一のhash入力関数にする。文字列はNFKC、CRLF→LF、各行trim、連続空白1個へ正規化する。`price`は公開中courseの`durationMinutes`と`priceYen`を昇順配列、`hours`は表示文字列、`access`はstationとaddressの配列、`booking`はofficial以外のactionを`kind`→`href`順、`official`は正規化URL、`image`はfallbackを除く画像URLを表示順の配列としてJSON化する。object key順を固定したUTF-8文字列をNode `createHash("sha256")`へ渡す。fixtureで同じ入力が常に同じhashになること、予約ボタン追加・画像順変更でhashが変わることを固定する。WordPressは管理側から渡されたhashをsanitizeして保存するだけとし、現行値から推測生成しない。

`reviewStatus=reviewed`、有効な`reviewedAt`、現在値hash一致を全て満たす項目だけverifiedにする。`latestReviewedAt`はverified itemから算出し、6件の分母には入れない。

- [ ] **Step 5: 1カラム表示順と二層anchorを実装する**

店舗詳細は永続sidebarを持たない最大1200pxの1本文カラムにする。profile内部だけはPCで画像と要点を横並びにできるが、同じarticle flow内に置き、1024px以下では画像→要点→CTAの1列へ戻す。表示順はprofile・CTA→二層menu→口コミdashboard/最新3件→確認状況/順位→紹介→料金→こだわり→アクセス→基本情報→内部link→責任者導線とする。

固定unionと`ShopDetailSections`への条件分岐追加をやめ、server-only module registryを唯一の表示順・menu正本にする。

```ts
export type ShopDetailModuleContext = {
  model: ShopDetailViewModel;
  review: ShopReviewViewModel;
  coverage: ShopInformationCoverage | null;
  ranking: ShopRankingSnapshot | null;
  hasNearby: boolean;
};

export type ShopDetailModuleDefinition = {
  id: string;
  label: string;
  layer: "primary" | "secondary";
  order: number;
  renderer: "reviews" | "information" | "overview" | "prices" | "features" | "access" | "basic" | "nearby";
  sourceKeys: ReadonlyArray<"shop" | "reviews" | "fact-provenance" | "ranking-snapshot" | "area">;
  isVisible: (context: ShopDetailModuleContext) => boolean;
};

export const SHOP_DETAIL_MODULES = [
  { id: "reviews", label: "口コミ", layer: "primary", order: 10, renderer: "reviews", sourceKeys: ["reviews"], isVisible: () => true },
  { id: "shop-information", label: "店舗情報", layer: "primary", order: 20, renderer: "information", sourceKeys: ["shop", "fact-provenance", "ranking-snapshot"], isVisible: (context) => context.model.infoRows.length > 0 || context.coverage !== null || context.ranking !== null },
  { id: "prices", label: "料金", layer: "primary", order: 30, renderer: "prices", sourceKeys: ["shop"], isVisible: (context) => context.model.prices.length > 0 },
] as const satisfies readonly ShopDetailModuleDefinition[];

export type ShopDetailModuleId = (typeof SHOP_DETAIL_MODULES)[number]["id"];

export type ShopSectionLink = {
  id: ShopDetailModuleId;
  label: string;
  layer: "primary" | "secondary";
};
```

実際のregistryにはこのmilestoneで描画可能な`reviews`、`shop-information`、`prices`、`map-access`、`features`、`basic-information`、`nearby`だけを登録する。`ShopDetailModuleList`はrenderer mapから小さいsection componentを選び、同じvisible module配列から二層menuを作る。`ShopDetailSections`はregistryへcontextを渡す薄いwrapperにし、新sectionの本文・表示条件を再び集約しない。セラピスト等は後続planでrendererとdefinitionが揃った時だけ登録し、空menuを先行表示しない。

- [ ] **Step 6: coverageと順位cardを実装する**

coverageは「確認済み 4/6」の横棒と項目label、最新確認日を表示し、品質点数・優良店表記を使わない。順位は明示snapshotだけを表示し、`isPr`ならPR labelを併記する。snapshotなしはcard自体を出さない。

- [ ] **Step 7: 初期投入と対象外店舗の非公開previewを生成する**

既存の`docs/data/sakaisujihonmachi-phase4-30-shops-2026-07-15.json`とevidenceを入力に、`prepare-shop-public-meta-seed.mjs`で非公開previewを生成する。一次情報で`verified`、source URLと確認日あり、かつ現在のWordPress snapshotをTask 7のcanonical hashへ通した値が確認値と一致するfieldだけを`shop_fact_provenance`候補にする。値が違うfieldは`blocked-value-mismatch`として理由を残し、hashや確認済みrecordを生成しない。`selection.ranking_claim=false`のため、選択順から順位snapshotを1件も生成しない。

対象外previewは、読取監査済みのWordPress ID 1259「あしぎぬ温泉」と1255「天然温泉 ひなたの湯」、現在状態、要求操作`draft`、`applied:false`、公開後に確認するroute・sitemap・内部link条件を持つ。scriptはWordPressへ書き込まない。実際のdraft化とmeta投入は、実装・レビュー完了後にユーザーが本番操作を明示許可した場合だけ別gateで行う。

`check-shop-public-meta-seed.mjs`は全候補にfield/sourceUrl/reviewedAt/publishedValueHashがあること、mismatchから候補が作られないこと、順位候補0件、対象外2件が`applied:false`であることを検証する。

- [ ] **Step 8: GREENを確認する**

Run: `cd headless && node scripts/prepare-shop-public-meta-seed.mjs && node scripts/check-shop-public-meta-seed.mjs && node scripts/check-shop-dashboard-foundation-contract.mjs && npm run test:shop-detail-view-model && npm run test:shop-detail-density && npm run test:shop-detail-responsive && npm run test:final-design-preservation && npm run test:internal-links && npm run typecheck && npm run lint && php -l ../shop-public-meta.php && php -l ../functions.php`

Expected: 全てPASS。

- [ ] **Step 9: commitする**

```bash
git add shop-public-meta.php functions.php docs/data/shop-public-meta-seed-preview-2026-07-18.json docs/data/excluded-shop-draft-preview-2026-07-18.json headless/lib/wp/types.ts headless/lib/shop-information-coverage.ts headless/lib/shop-detail-view-model.ts headless/lib/shop-detail-modules.ts headless/components/ShopDetail.tsx headless/components/shop-detail headless/scripts/prepare-shop-public-meta-seed.mjs headless/scripts/check-shop-public-meta-seed.mjs headless/scripts/check-shop-dashboard-foundation-contract.mjs headless/scripts/check-shop-detail-view-model.mjs headless/scripts/check-shop-detail-density-contract.mjs headless/scripts/check-shop-detail-responsive-contract.mjs headless/scripts/check-final-design-preservation.mjs headless/scripts/check-internal-link-map.mjs headless/package.json
git commit -m "feat: add verified shop dashboard foundation"
```

---

### Task 8: 全幅QA・SEO・進行記録

**Files:**
- Modify: `headless/scripts/check-portal-browser-layout.mjs`
- Modify: `task_plan.md`
- Modify: `progress.md`
- Modify: `pm/PROGRESS.md`
- Read: `pm/SECURITY-ROTATION-CHECKLIST-2026-07-18.md`

**Interfaces:**
- Consumes: Tasks 1〜7の全実装。
- Produces: Phase 0安全化、共通dashboard shell、公開店舗dashboardのローカル完了証跡。

- [ ] **Step 1: browser QAへdashboardと店舗詳細の失敗条件を追加する**

runnerは毎回`randomBytes()`でQA専用user/passwordを生成し、値をlogへ出さず、起動するローカルNext serverの`DASHBOARD_BASIC_AUTH_USER/PASSWORD`へだけ渡す。Playwrightのdashboard contextは同じ値を`httpCredentials`へ設定する。公開page contextには認証を付けない。既存起動済みserverを使う場合は`PORTAL_QA_DASHBOARD_USER/PASSWORD`の両方がある時だけdashboard QAを許可し、片方だけ・両方なしをskip成功にせず失敗させる。

各対象幅で次を実寸検査する。

```text
/dashboard/: shell 1個、navigation 1個、main 1個、横はみ出し0
/dashboard/analytics/: 同じshellとnavigation、現在地1個、横はみ出し0
/shops/{fixture}/: H1孤立改行0、表示中CTA group 1、二層menu移動先欠落0、graph文字切れ0、横はみ出し0
```

認証なしrequestは401、不正認証は401、QA認証では200を確認する。320pxではdashboard nav drawerを開閉し、focusがbutton→menu→mainへ移動できることを確認する。認証値をscreenshot名、trace、HTML report、consoleへ含めない。

- [ ] **Step 2: REDまたは新条件未達を確認する**

Run: `cd headless && npm run test:portal-browser-layout`

Expected: 新selectorまたはfixture条件が未対応ならFAILし、既に満たす場合は実測値をreportへ記録する。

- [ ] **Step 3: selectorとCSSの最小修正だけを行う**

表示実装が契約を満たさない場合は該当component/CSSを直す。検査を通すために閾値を緩めたり、対象要素不在を成功扱いにしない。

- [ ] **Step 4: fresh全検証を実行する**

Run:

```bash
cd headless
npm test
npm run lint
npm run typecheck
npm run build
npm run test:portal-browser-layout
npm run perf:check
npm audit --audit-level=high
cd ..
git diff --check
```

Expected: 全command exit 0、browser failures 0、High/Critical 0。

続けてsecurity rotation checklistを読み、外部確認が未完了なら検証成功と「本番反映可能」を分け、push/deployはblockedと記録する。資格情報の値は取得・表示しない。

- [ ] **Step 5: 記録を更新する**

`task_plan.md`のPhase 17へTask 1〜8のcommitとレビュー結果、`progress.md`と`pm/PROGRESS.md`へ検証値、未実装のAI staging・セラピスト計画、認証情報の失効・再発行gate状態、push/deploy未実施を記録する。

- [ ] **Step 6: docsだけcommitする**

```bash
git add headless/scripts/check-portal-browser-layout.mjs task_plan.md progress.md pm/PROGRESS.md
git commit -m "test: record dashboard shop foundation verification"
```

## Post-Task Plans

このplanの独立横断レビュー完了後、次の2 planを別々に作成・実行する。

1. `2026-07-18-eskomi-ai-content-admin.md`: `/dashboard/content/`の店舗一覧、手入力、AI指示書、JSON/CSV、Supabase staging、差分、承認、WordPress ledger、cache再検証。
2. `2026-07-18-eskomi-therapist-schedule-linkage.md`: therapist CPT、schedule CPT、年齢帯privacy、セラピスト詳細、店舗・トップ・一覧・地域連動。

両planも同じ`DashboardShell`へ実在routeだけを登録し、task別実装担当・別担当レビュー・最終横断レビューを必須にする。
