# Shop Owner Request Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 店舗詳細から店舗情報を引き継いだ登録・修正フォームを提供し、申請をSupabaseの非公開審査キューへ安全に保存する。

**Architecture:** ブラウザはNext.jsの同一オリジンAPIだけを呼ぶ。APIは入力検証、honeypot、回数制限を通過した申請だけを、サーバー専用のSupabase secretでRLS保護済み審査キューへ保存する。公開店舗情報はWordPressのままとし、申請からWordPressまたは公開viewへの自動反映は行わない。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript 5、Supabase Postgres/Data API、既存のGA4・回数制限実装

## Global Constraints

- 公開中の店舗情報はWordPressから取得し続ける。
- Supabase申請データを店舗詳細、公開view、schema.orgへ出力しない。
- `SUPABASE_SERVICE_ROLE_KEY` はサーバーだけで使用し、`NEXT_PUBLIC_` を付けない。
- RLSを有効にし、`anon` と `authenticated` にSELECT、INSERT、UPDATE、DELETEを許可しない。
- 画像ファイルを直接アップロードしない。公式画像URLだけを受け付ける。
- 氏名、メールアドレス、申請本文をGA4、エラーログ、公開HTMLへ送らない。
- 推測値、架空口コミ、出自不明文章を作らない。
- 本番Supabase migration、Secret登録、本番保存試験、push、deployを行わない。
- Git操作は対象パスだけに限定し、`git add -A` を使わない。

---

## File Structure

| Path | Responsibility |
|---|---|
| `supabase/migrations/<CLI生成時刻>_shop_owner_requests.sql` | 非公開審査キュー、RLS、権限 |
| `headless/scripts/check-shop-owner-request-schema.mjs` | migrationの安全条件を静的検査 |
| `headless/lib/shop-owner-request-validation.ts` | 申請payloadの正規化と検証 |
| `headless/lib/supabase/shop-owner-request.ts` | サーバー専用Data API保存 |
| `headless/app/api/shop-owner-request/route.ts` | POST受付、回数制限、保存、応答 |
| `headless/scripts/check-shop-owner-request-api.mjs` | 検証関数とAPI境界の回帰検査 |
| `headless/lib/shop-owner-request-links.ts` | 店舗詳細から申請画面へ渡すURL生成 |
| `headless/components/ShopOwnerRequestForm.tsx` | 登録・修正フォームと送信状態 |
| `headless/components/WpStaticPage.tsx` | `/storelisting/` に申請フォームを表示 |
| `headless/app/[slug]/page.tsx` | queryを安全に読み、フォームへ初期値を渡す |
| `headless/app/globals.css` | 既存静的ページ内のフォーム表示調整 |
| `headless/.env.example` | サーバー専用環境変数名とDRY RUN説明 |

### Task 1: Supabase非公開審査キュー

**Files:**
- Create via CLI: `supabase/migrations/<CLI生成時刻>_shop_owner_requests.sql`
- Create: `headless/scripts/check-shop-owner-request-schema.mjs`

**Interfaces:**
- Consumes: 既存 `api` schema、`service_role`、Supabase Data API設定
- Produces: `api.shop_owner_requests`。ブラウザ権限なし、service roleだけが管理する申請行

- [ ] **Step 1: 現在のSupabase仕様とCLIコマンドを確認する**

Run:

```bash
curl -fsSL https://supabase.com/changelog.md | rg -n "breaking-change|Data API|RLS|PostgREST" | head -n 40
supabase --version
supabase migration --help
supabase migration new --help
supabase db --help
```

Expected: changelogを取得でき、CLIがmigration作成とlocal DB検査に利用できる。コマンド名が異なる場合は公式helpの名称を採用し、この計画の実行記録へ残す。

- [ ] **Step 2: schema契約の失敗する検査を書く**

Create `headless/scripts/check-shop-owner-request-schema.mjs`:

```js
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migrationName = readdirSync(join(root, "../supabase/migrations"))
  .filter((name) => name.endsWith("_shop_owner_requests.sql"))
  .sort()
  .at(-1);

assert.ok(migrationName, "shop owner request migration must exist");
const sql = readFileSync(join(root, "../supabase/migrations", migrationName), "utf8");

assert.match(sql, /create table api\.shop_owner_requests/i);
assert.match(sql, /alter table api\.shop_owner_requests enable row level security/i);
assert.match(sql, /status text not null default 'received'/i);
assert.match(sql, /requested_fields text\[\] not null/i);
assert.match(sql, /consent_privacy boolean not null/i);
assert.match(sql, /consent_accuracy boolean not null/i);
assert.match(sql, /consent_image_rights boolean not null/i);
assert.match(sql, /revoke all on table api\.shop_owner_requests from anon, authenticated/i);
assert.match(sql, /grant select, insert, update, delete on table api\.shop_owner_requests to service_role/i);
assert.doesNotMatch(sql, /grant\s+select[^;]+to\s+(anon|authenticated)/i);
assert.doesNotMatch(sql, /grant\s+insert[^;]+to\s+(anon|authenticated)/i);
assert.doesNotMatch(sql, /create policy/i, "public policies are not required for server-only queue");

console.log("shop owner request schema check passed");
```

- [ ] **Step 3: 検査がmigration不在で失敗することを確認する**

Run:

```bash
cd headless
node scripts/check-shop-owner-request-schema.mjs
```

Expected: FAIL with `shop owner request migration must exist`.

- [ ] **Step 4: CLIでmigrationを作り、安全な表を実装する**

Run:

```bash
supabase migration new shop_owner_requests
```

Expected: `supabase/migrations/` に `_shop_owner_requests.sql` で終わるファイルが1件作成される。作成された正確なパスを実行記録へ残す。

Put this SQL in the CLI-created file:

```sql
create table api.shop_owner_requests (
  id uuid primary key default gen_random_uuid(),
  wp_shop_id bigint not null check (wp_shop_id > 0),
  shop_slug text not null check (shop_slug ~ '^[a-z0-9][a-z0-9-]{0,199}$'),
  shop_name text not null check (char_length(shop_name) between 1 and 120),
  target_url text not null check (char_length(target_url) between 1 and 500),
  source_url text not null check (char_length(source_url) between 1 and 2048),
  requester_name text not null check (char_length(requester_name) between 1 and 80),
  requester_role text not null check (requester_role in ('owner', 'manager', 'staff', 'authorized-agency')),
  requester_email text not null check (char_length(requester_email) between 3 and 254),
  requested_fields text[] not null check (cardinality(requested_fields) between 1 and 8),
  change_details text not null check (char_length(change_details) between 1 and 5000),
  evidence_url text check (evidence_url is null or char_length(evidence_url) <= 500),
  official_image_url text check (official_image_url is null or char_length(official_image_url) <= 500),
  consent_privacy boolean not null check (consent_privacy),
  consent_accuracy boolean not null check (consent_accuracy),
  consent_image_rights boolean not null check (consent_image_rights),
  status text not null default 'received' check (status in ('received', 'reviewing', 'approved-candidate', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  review_note text
);

comment on table api.shop_owner_requests is
  'Server-only owner submissions. Never joined into public shop views automatically.';

create index shop_owner_requests_status_created_idx
  on api.shop_owner_requests (status, created_at desc);
create index shop_owner_requests_wp_shop_created_idx
  on api.shop_owner_requests (wp_shop_id, created_at desc);

alter table api.shop_owner_requests enable row level security;

revoke all on table api.shop_owner_requests from public;
revoke all on table api.shop_owner_requests from anon, authenticated;
grant select, insert, update, delete on table api.shop_owner_requests to service_role;
```

- [ ] **Step 5: 静的検査とlocal DB再構築を実行する**

Run:

```bash
cd headless
node scripts/check-shop-owner-request-schema.mjs
cd ..
supabase db reset
supabase db lint --local --level error --fail-on error
```

Expected: schema check PASS、migration再適用成功、DB lint error 0。

- [ ] **Step 6: 匿名権限がなくservice role権限だけがあることをDBで確認する**

Run:

```bash
psql "$(supabase status -o env | sed -n 's/^DB_URL=//p' | tr -d '"')" -v ON_ERROR_STOP=1 -c "select grantee, privilege_type from information_schema.role_table_grants where table_schema='api' and table_name='shop_owner_requests' order by grantee, privilege_type;"
```

Expected: `service_role` のSELECT/INSERT/UPDATE/DELETE等だけが表示され、`anon` と `authenticated` は0行。

- [ ] **Step 7: チェックポイントを記録する**

Run:

```bash
git diff --check -- supabase/migrations headless/scripts/check-shop-owner-request-schema.mjs
git status --short -- supabase/migrations headless/scripts/check-shop-owner-request-schema.mjs
```

Expected: whitespace error 0。pushは行わない。commitはユーザーが明示承認した場合だけ、上記2パスだけをstageする。

### Task 2: 入力検証とサーバー専用保存

**Files:**
- Create: `headless/lib/shop-owner-request-validation.ts`
- Create: `headless/lib/supabase/shop-owner-request.ts`
- Create: `headless/app/api/shop-owner-request/route.ts`
- Create: `headless/scripts/check-shop-owner-request-api.mjs`
- Modify: `headless/.env.example`

**Interfaces:**
- Consumes: `api.shop_owner_requests`、`checkRateLimit(ip)`
- Produces: `validateShopOwnerRequestPayload(body)`、`saveShopOwnerRequest(data)`、`POST /api/shop-owner-request/`

- [ ] **Step 1: validationとAPI境界の失敗する検査を書く**

Create `headless/scripts/check-shop-owner-request-api.mjs` using the same TypeScript transpile pattern as `check-price-normalization.mjs`:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import vm from "node:vm";

const root = process.cwd();
const source = readFileSync(join(root, "lib/shop-owner-request-validation.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const module = { exports: {} };
vm.runInNewContext(compiled, { module, exports: module.exports, URL });
const { validateShopOwnerRequestPayload } = module.exports;

const valid = {
  shopId: 123,
  shopSlug: "c-r-e-a-m",
  shopName: "C.r.e.a.m（クリーム）",
  targetUrl: "https://mens-esthe-kuchikomi.com/shops/c-r-e-a-m/",
  sourceUrl: "https://mens-esthe-kuchikomi.com/storelisting/?shop_id=123",
  requesterName: "店舗責任者",
  requesterRole: "owner",
  requesterEmail: "owner@example.jp",
  requestedFields: ["price", "hours", "official-image"],
  changeDetails: "料金と営業時間を更新してください。",
  evidenceUrl: "https://example.jp/price/",
  officialImageUrl: "https://example.jp/images/shop.jpg",
  consentPrivacy: true,
  consentAccuracy: true,
  consentImageRights: true,
  website: ""
};

assert.equal(validateShopOwnerRequestPayload(valid).ok, true);
assert.equal(validateShopOwnerRequestPayload({ ...valid, website: "spam" }).ok, false);
assert.equal(validateShopOwnerRequestPayload({ ...valid, requestedFields: [] }).ok, false);
assert.equal(validateShopOwnerRequestPayload({ ...valid, shopId: 0 }).ok, false);
assert.equal(validateShopOwnerRequestPayload({ ...valid, targetUrl: "javascript:alert(1)" }).ok, false);
assert.equal(validateShopOwnerRequestPayload({ ...valid, targetUrl: "https://example.jp/shops/c-r-e-a-m/" }).ok, false);
assert.equal(validateShopOwnerRequestPayload({ ...valid, requesterEmail: "invalid" }).ok, false);
assert.equal(validateShopOwnerRequestPayload({ ...valid, consentImageRights: false }).ok, false);

const route = readFileSync(join(root, "app/api/shop-owner-request/route.ts"), "utf8");
assert.match(route, /checkRateLimit/);
assert.match(route, /validateShopOwnerRequestPayload/);
assert.match(route, /saveShopOwnerRequest/);
assert.doesNotMatch(route, /console\.(info|log)\([^\n]*(requesterEmail|changeDetails)/);

const persistence = readFileSync(join(root, "lib/supabase/shop-owner-request.ts"), "utf8");
assert.match(persistence, /SUPABASE_SERVICE_ROLE_KEY/);
assert.doesNotMatch(persistence, /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/);
assert.match(persistence, /Content-Profile/);
assert.match(persistence, /api/);

console.log("shop owner request API check passed");
```

- [ ] **Step 2: 検査が実装ファイル不在で失敗することを確認する**

Run:

```bash
cd headless
node scripts/check-shop-owner-request-api.mjs
```

Expected: FAIL with missing `shop-owner-request-validation.ts`.

- [ ] **Step 3: payload型と検証関数を実装する**

Create `headless/lib/shop-owner-request-validation.ts` with these exported contracts:

```ts
export const SHOP_OWNER_REQUEST_FIELDS = [
  "price",
  "hours",
  "access",
  "reservation",
  "introduction",
  "features",
  "official-image",
  "other"
] as const;

export const SHOP_OWNER_REQUEST_ROLES = [
  "owner",
  "manager",
  "staff",
  "authorized-agency"
] as const;

export type ShopOwnerRequestData = {
  shopId: number;
  shopSlug: string;
  shopName: string;
  targetUrl: string;
  sourceUrl: string;
  requesterName: string;
  requesterRole: (typeof SHOP_OWNER_REQUEST_ROLES)[number];
  requesterEmail: string;
  requestedFields: Array<(typeof SHOP_OWNER_REQUEST_FIELDS)[number]>;
  changeDetails: string;
  evidenceUrl?: string;
  officialImageUrl?: string;
  consentPrivacy: true;
  consentAccuracy: true;
  consentImageRights: true;
};

export type ShopOwnerRequestValidation =
  | { ok: true; data: ShopOwnerRequestData }
  | { ok: false; error: string };
```

Implement `validateShopOwnerRequestPayload(body: unknown)` with these exact rules:

```ts
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,199}$/;

function safeHttpUrl(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
```

For `targetUrl`, additionally require `hostname === "mens-esthe-kuchikomi.com"` and require its pathname to equal the canonical `/shops/${shopSlug}/` value after URL parsing. Return a Japanese error for each invalid field, deduplicate `requestedFields`, and reject values outside the exported enums. Honeypot `website` must be empty. Do not include the submitted value in an error message.

- [ ] **Step 4: Supabase保存関数を実装する**

Create `headless/lib/supabase/shop-owner-request.ts`:

```ts
import type { ShopOwnerRequestData } from "@/lib/shop-owner-request-validation";

type SaveResult = { ok: true } | { ok: false; reason: "not-configured" | "request-failed" };

export async function saveShopOwnerRequest(data: ShopOwnerRequestData): Promise<SaveResult> {
  if (process.env.SHOP_OWNER_REQUEST_DRY_RUN === "true" && process.env.NODE_ENV !== "production") {
    return { ok: true };
  }

  const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) return { ok: false, reason: "not-configured" };

  const response = await fetch(`${baseUrl}/rest/v1/shop_owner_requests`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      "Content-Profile": "api",
      Prefer: "return=minimal"
    },
    body: JSON.stringify({
      wp_shop_id: data.shopId,
      shop_slug: data.shopSlug,
      shop_name: data.shopName,
      target_url: data.targetUrl,
      source_url: data.sourceUrl,
      requester_name: data.requesterName,
      requester_role: data.requesterRole,
      requester_email: data.requesterEmail,
      requested_fields: data.requestedFields,
      change_details: data.changeDetails,
      evidence_url: data.evidenceUrl ?? null,
      official_image_url: data.officialImageUrl ?? null,
      consent_privacy: data.consentPrivacy,
      consent_accuracy: data.consentAccuracy,
      consent_image_rights: data.consentImageRights
    }),
    cache: "no-store"
  });

  return response.ok ? { ok: true } : { ok: false, reason: "request-failed" };
}
```

- [ ] **Step 5: API routeを実装する**

Create `headless/app/api/shop-owner-request/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/contact-rate-limit";
import { validateShopOwnerRequestPayload } from "@/lib/shop-owner-request-validation";
import { saveShopOwnerRequest } from "@/lib/supabase/shop-owner-request";

function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(`shop-owner:${clientIp(request)}`);
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, message: `送信回数が多すぎます。${rate.retryAfterSec}秒後に再度お試しください。` },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "入力内容を確認してください。" }, { status: 400 });
  }

  const validation = validateShopOwnerRequestPayload(body);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, message: validation.error }, { status: 400 });
  }

  const saved = await saveShopOwnerRequest(validation.data);
  if (!saved.ok) {
    console.error("[shop-owner-request] save failed", { reason: saved.reason });
    return NextResponse.json(
      { ok: false, message: "現在申請を受け付けできません。時間をおいて再度お試しください。" },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true, message: "申請を受け付けました。" });
}
```

- [ ] **Step 6: 環境変数例を追加する**

Append to `headless/.env.example`:

```dotenv
# 店舗責任者申請。秘密鍵はサーバー専用で、NEXT_PUBLIC_ を付けない。
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
# ローカルUI確認だけでDBへ保存しない場合に true
SHOP_OWNER_REQUEST_DRY_RUN=true
```

- [ ] **Step 7: 検査を成功させる**

Run:

```bash
cd headless
node scripts/check-shop-owner-request-api.mjs
npm run typecheck
npm run lint
```

Expected: API check PASS、type error 0、lint error 0。

- [ ] **Step 8: チェックポイントを記録する**

Run:

```bash
git diff --check -- headless/lib/shop-owner-request-validation.ts headless/lib/supabase/shop-owner-request.ts headless/app/api/shop-owner-request/route.ts headless/scripts/check-shop-owner-request-api.mjs headless/.env.example
```

Expected: whitespace error 0。pushしない。

### Task 3: 事前入力URLと申請フォーム

**Files:**
- Create: `headless/lib/shop-owner-request-links.ts`
- Create: `headless/components/ShopOwnerRequestForm.tsx`
- Modify: `headless/components/WpStaticPage.tsx`
- Modify: `headless/app/[slug]/page.tsx`
- Modify: `headless/lib/static-pages.ts`
- Modify: `headless/app/globals.css`
- Create: `headless/scripts/check-shop-owner-request-form.mjs`

**Interfaces:**
- Consumes: `POST /api/shop-owner-request/`、店舗ID・slug・名称・URL query
- Produces: `buildShopOwnerRequestUrl(shop)`、`ShopOwnerRequestForm({ initial })`

- [ ] **Step 1: URL・事前入力・フォーム構造の失敗する検査を書く**

Create `headless/scripts/check-shop-owner-request-form.mjs`:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const links = read("lib/shop-owner-request-links.ts");
const form = read("components/ShopOwnerRequestForm.tsx");
const staticPage = read("components/WpStaticPage.tsx");
const route = read("app/[slug]/page.tsx");

assert.match(links, /buildShopOwnerRequestUrl/);
for (const key of ["shop_id", "shop_slug", "shop_name", "target_url", "source"]) {
  assert.ok(links.includes(key), `owner URL must include ${key}`);
}
assert.ok(form.startsWith('"use client";'));
assert.match(form, /\/api\/shop-owner-request\//);
assert.match(form, /requestedFields/);
assert.match(form, /officialImageUrl/);
assert.doesNotMatch(form, /type="file"/);
assert.match(staticPage, /slug === "storelisting"/);
assert.match(staticPage, /ShopOwnerRequestForm/);
assert.match(route, /searchParams/);
assert.match(route, /ownerRequestInitial/);

console.log("shop owner request form check passed");
```

- [ ] **Step 2: 検査がファイル不在で失敗することを確認する**

Run:

```bash
cd headless
node scripts/check-shop-owner-request-form.mjs
```

Expected: FAIL with missing `shop-owner-request-links.ts`.

- [ ] **Step 3: 店舗詳細から使うURL生成関数を実装する**

Create `headless/lib/shop-owner-request-links.ts`:

```ts
import type { ShopView } from "@/lib/wp/types";

export type ShopOwnerRequestInitial = {
  shopId: string;
  shopSlug: string;
  shopName: string;
  targetUrl: string;
  source: string;
};

export function buildShopOwnerRequestUrl(shop: Pick<ShopView, "id" | "slug" | "title">): string {
  const params = new URLSearchParams({
    shop_id: String(shop.id),
    shop_slug: shop.slug,
    shop_name: shop.title,
    target_url: `https://mens-esthe-kuchikomi.com/shops/${encodeURIComponent(shop.slug)}/`,
    source: "shop-detail"
  });
  return `/storelisting/?${params.toString()}#shop-owner-request`;
}
```

- [ ] **Step 4: queryをサーバー側で制限して初期値へ変換する**

Modify `headless/app/[slug]/page.tsx`:

```ts
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function ownerRequestInitial(query: Record<string, string | string[] | undefined>) {
  const requestedSource = first(query.source);
  return {
    shopId: first(query.shop_id).slice(0, 20),
    shopSlug: first(query.shop_slug).slice(0, 200),
    shopName: first(query.shop_name).slice(0, 120),
    targetUrl: first(query.target_url).slice(0, 500),
    source: requestedSource === "shop-detail" ? "shop-detail" : "storelisting"
  };
}
```

Await `searchParams` in `StaticWpPage` and pass `ownerRequestInitial={slug === "storelisting" ? ownerRequestInitial(query) : undefined}` to `WpStaticPage`.

- [ ] **Step 5: client formを実装する**

Create `headless/components/ShopOwnerRequestForm.tsx` with:

```tsx
"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { gaEvent } from "@/lib/gtag";
import { SHOP_OWNER_REQUEST_FIELDS, SHOP_OWNER_REQUEST_ROLES } from "@/lib/shop-owner-request-validation";
import type { ShopOwnerRequestInitial } from "@/lib/shop-owner-request-links";

const FIELD_LABELS = {
  price: "料金",
  hours: "営業時間",
  access: "アクセス",
  reservation: "予約先",
  introduction: "店舗紹介",
  features: "特徴・設備",
  "official-image": "公式画像",
  other: "その他"
} as const;

const ROLE_LABELS = {
  owner: "オーナー",
  manager: "店舗責任者",
  staff: "店舗スタッフ",
  "authorized-agency": "正規代理担当者"
} as const;

export function ShopOwnerRequestForm({ initial }: { initial: ShopOwnerRequestInitial }) {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      shopId: Number(initial.shopId),
      shopSlug: initial.shopSlug,
      shopName: initial.shopName,
      targetUrl: initial.targetUrl,
      sourceUrl: window.location.href,
      requesterName: String(data.get("requesterName") || ""),
      requesterRole: String(data.get("requesterRole") || ""),
      requesterEmail: String(data.get("requesterEmail") || ""),
      requestedFields: data.getAll("requestedFields").map(String),
      changeDetails: String(data.get("changeDetails") || ""),
      evidenceUrl: String(data.get("evidenceUrl") || ""),
      officialImageUrl: String(data.get("officialImageUrl") || ""),
      consentPrivacy: data.get("consentPrivacy") === "on",
      consentAccuracy: data.get("consentAccuracy") === "on",
      consentImageRights: data.get("consentImageRights") === "on",
      website: String(data.get("website") || "")
    };
    try {
      const response = await fetch("/api/shop-owner-request/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || "送信に失敗しました。");
      setStatus("success");
      gaEvent("shop_owner_request_submit", { shop_slug: initial.shopSlug, source: initial.source });
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "送信に失敗しました。");
    }
  }

  if (!initial.shopId || !initial.shopSlug || !initial.shopName || !initial.targetUrl) {
    return <p className="hl-owner-request-empty">対象店舗を確認できません。店舗詳細ページからお進みください。</p>;
  }
  if (status === "success") {
    return <div className="hl-contact-success" role="status"><p className="hl-contact-success-title">申請を受け付けました</p><p>内容を確認後、必要に応じてご連絡します。申請内容は自動公開されません。</p></div>;
  }

  return (
    <form id="shop-owner-request" className="hl-contact-form hl-owner-request-form" onSubmit={submit} noValidate>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hl-contact-honeypot" aria-hidden="true" />
      <div className="hl-owner-request-prefill"><span>対象店舗</span><strong>{initial.shopName}</strong><small>{initial.targetUrl}</small></div>
      <label className="hl-contact-field">お名前・ご担当者名<input name="requesterName" required maxLength={80} /></label>
      <label className="hl-contact-field">店舗との関係<select name="requesterRole" required defaultValue=""><option value="" disabled>選択してください</option>{SHOP_OWNER_REQUEST_ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></label>
      <label className="hl-contact-field">確認用メールアドレス<input name="requesterEmail" type="email" required maxLength={254} /></label>
      <fieldset className="hl-owner-request-fields"><legend>登録・修正したい内容</legend>{SHOP_OWNER_REQUEST_FIELDS.map((field) => <label key={field}><input type="checkbox" name="requestedFields" value={field} />{FIELD_LABELS[field]}</label>)}</fieldset>
      <label className="hl-contact-field">変更内容<textarea name="changeDetails" required rows={7} maxLength={5000} /></label>
      <label className="hl-contact-field">根拠となる公式URL<input name="evidenceUrl" type="url" maxLength={500} /></label>
      <label className="hl-contact-field">公式画像URL<input name="officialImageUrl" type="url" maxLength={500} /></label>
      <label className="hl-contact-consent"><input type="checkbox" name="consentPrivacy" required />個人情報の取り扱いに同意します。</label>
      <label className="hl-contact-consent"><input type="checkbox" name="consentAccuracy" required />入力内容が正確であることを確認しました。</label>
      <label className="hl-contact-consent"><input type="checkbox" name="consentImageRights" required />画像を申請する場合、掲載権限を保有しています。</label>
      {status === "error" && message ? <div><p className="hl-contact-error" role="alert">{message}</p><p><Link href="/contact/">通常のお問い合わせフォームを利用する</Link></p></div> : null}
      <button className="hl-contact-submit" disabled={status === "submitting"}>{status === "submitting" ? "送信中…" : "登録・修正内容を送信する"}</button>
    </form>
  );
}
```

- [ ] **Step 6: `/storelisting/` だけにフォームを表示する**

Modify `headless/components/WpStaticPage.tsx` to accept `ownerRequestInitial?: ShopOwnerRequestInitial`, import `ShopOwnerRequestForm`, and render:

```tsx
{slug === "storelisting" && ownerRequestInitial ? (
  <section className="hl-contact-section" aria-labelledby="shop-owner-request-heading">
    <p className="hl-static-page-kicker">FOR SHOP OWNER</p>
    <h2 id="shop-owner-request-heading" className="hl-contact-heading">掲載情報の登録・修正申請</h2>
    <p>申請内容は運営確認前に公開されません。現在の公開情報はWordPressのまま維持されます。</p>
    <ShopOwnerRequestForm initial={ownerRequestInitial} />
  </section>
) : null}
```

Update the `storelisting` fallback copy in `headless/lib/static-pages.ts` so it explains verified information, review-before-publish, and links users to `#shop-owner-request` instead of the generic contact page when prefilled data is present.

- [ ] **Step 7: 角丸カードを増やさないフォームCSSを追加する**

Append a labeled block to `headless/app/globals.css`:

```css
/* Q-DESIGN shop owner request */
.hl-owner-request-form { border-top: 1px solid #14211d; padding-top: 28px; }
.hl-owner-request-prefill { display: grid; gap: 4px; padding: 18px 0; border-bottom: 1px solid #d8dedb; }
.hl-owner-request-prefill span,
.hl-owner-request-prefill small { color: #66726e; font-size: 0.75rem; }
.hl-owner-request-prefill strong { font-size: 1.15rem; }
.hl-owner-request-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 20px; margin: 24px 0; padding: 20px 0; border: 0; border-top: 1px solid #d8dedb; border-bottom: 1px solid #d8dedb; }
.hl-owner-request-fields legend { padding: 0 12px 0 0; font-weight: 700; }
.hl-owner-request-fields label { min-height: 44px; display: flex; align-items: center; gap: 9px; }
.hl-owner-request-empty { padding: 20px 0; border-top: 1px solid #d8dedb; border-bottom: 1px solid #d8dedb; }
@media (max-width: 600px) {
  .hl-owner-request-fields { grid-template-columns: 1fr; }
}
```

- [ ] **Step 8: 検査、型、lintを成功させる**

Run:

```bash
cd headless
node scripts/check-shop-owner-request-form.mjs
node scripts/check-shop-owner-request-api.mjs
npm run typecheck
npm run lint
```

Expected: 2 checks PASS、type error 0、lint error 0。

### Task 4: local統合検証と停止

**Files:**
- Modify: `progress.md`
- Modify: `pm/PROGRESS.md`
- Modify: `task_plan.md`

**Interfaces:**
- Consumes: Tasks 1–3のschema、API、フォーム
- Produces: local検証記録と店舗詳細C案が使える申請URL

- [ ] **Step 1: Supabase localを再構築してserver-only INSERTを確認する**

Run:

```bash
supabase db reset
supabase status -o env
```

Expected: local stackが起動し、API URLとservice role keyが確認できる。値をログや文書へ転記しない。

Use local service role values only in the current shell, start Next.js with `SHOP_OWNER_REQUEST_DRY_RUN=false`, submit the fixture from Task 2, and verify:

```sql
select wp_shop_id, shop_slug, requested_fields, status, created_at
from api.shop_owner_requests
order by created_at desc
limit 1;
```

Expected: 1 row、`status = 'received'`。氏名・メール・本文は確認出力へ含めない。

- [ ] **Step 2: 匿名read/writeが拒否されることを確認する**

Issue GET and POST requests with the local anon key against `/rest/v1/shop_owner_requests` and `Accept-Profile: api` / `Content-Profile: api`.

Expected: GETとPOSTが401または403。service role POSTだけが201または204。

- [ ] **Step 3: フォームの4状態を確認する**

Run `npm run dev` and open:

```text
http://localhost:3000/storelisting/?shop_id=123&shop_slug=c-r-e-a-m&shop_name=C.r.e.a.m&target_url=https%3A%2F%2Fmens-esthe-kuchikomi.com%2Fshops%2Fc-r-e-a-m%2F&source=shop-detail#shop-owner-request
```

Expected:

- 事前入力: 店舗名と対象URLが表示される。
- 検証エラー: 入力値を保持して日本語エラーを表示する。
- 送信中: 二重送信できない。
- 成功: 自動公開されない旨を表示する。

- [ ] **Step 4: 全検査とbuildを実行する**

Run:

```bash
cd headless
node scripts/check-shop-owner-request-schema.mjs
node scripts/check-shop-owner-request-api.mjs
node scripts/check-shop-owner-request-form.mjs
npm test
npm run lint
npm run typecheck
npm run build
cd ..
git diff --check
```

Expected: 全command exit 0、production build完了。

- [ ] **Step 5: 進行文書へ停止状態を追記する**

Record in all three progress files:

```text
- 店舗責任者申請はlocal Supabaseの非公開審査キューで検証済み。
- WordPress公開情報とSupabase公開viewは変更していない。
- 本番migration、Secret登録、本番申請保存、push、deployは未実施。
```

- [ ] **Step 6: local Supabaseを停止する**

Run:

```bash
supabase stop
git status --short
```

Expected: local container停止。既存のPhase 4差分を含め、push・本番公開なしで次計画へ引き継ぐ。
