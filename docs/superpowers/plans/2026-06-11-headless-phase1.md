# Headless Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first headless Next.js proof of concept for Escomi while keeping the current WordPress production site untouched.

**Architecture:** Add a new `headless/` Next.js app inside the existing repository. WordPress remains the CMS and data source; the Next.js app reads from WordPress REST API, renders preview pages, and uses reusable components that will later cover the full site.

**Tech Stack:** Next.js App Router, TypeScript, plain CSS modules or global CSS, WordPress REST API, Node.js runtime with ISR-ready configuration.

---

## Production Switch Strategy

The current WordPress-rendered site stays live until the Next.js version passes full comparison checks.

1. Development happens on `codex/headless-phase1`.
2. The new app lives in `headless/`.
3. The current WordPress production deploy remains unchanged.
4. Phase 1 is tested locally and then on a preview URL.
5. No DNS or production routing changes happen in Phase 1.
6. Production switch happens only after top, area, shop, archive, and blog pages are fully reproduced and verified.

---

## File Structure

Create:

- `headless/package.json` — Next.js app scripts and dependencies.
- `headless/next.config.ts` — image remote patterns and ISR-ready config.
- `headless/tsconfig.json` — TypeScript config.
- `headless/eslint.config.mjs` — lint config.
- `headless/app/layout.tsx` — site shell and metadata defaults.
- `headless/app/globals.css` — current Escomi dark/gold visual baseline.
- `headless/app/page.tsx` — top page reproduction skeleton.
- `headless/app/area/[slug]/page.tsx` — area page reproduction.
- `headless/app/shops/[slug]/page.tsx` — shop detail reproduction.
- `headless/app/column/[slug]/page.tsx` — blog article reproduction.
- `headless/app/not-found.tsx` — not found page.
- `headless/lib/wp/client.ts` — fetch wrapper.
- `headless/lib/wp/types.ts` — shared WordPress and ACF types.
- `headless/lib/wp/areas.ts` — area fetchers.
- `headless/lib/wp/shops.ts` — shop fetchers.
- `headless/lib/wp/posts.ts` — blog fetchers.
- `headless/lib/seo.ts` — description and JSON-LD helpers.
- `headless/components/SiteHeader.tsx` — common header.
- `headless/components/SiteFooter.tsx` — common footer.
- `headless/components/ShopCard.tsx` — list card for shops.
- `headless/components/ShopDetail.tsx` — shop detail sections.
- `headless/components/AreaPageView.tsx` — area page sections.
- `headless/components/BlogArticle.tsx` — blog article view.
- `headless/components/EmptyState.tsx` — empty/fallback display.
- `headless/.env.example` — required env variables.

Modify:

- `.github/workflows/deploy.yml` — exclude `headless/` from WordPress FTP deploy.
- `pm/PROGRESS.md` — log Phase 1 start and outcome.

Do not modify:

- Current WordPress PHP templates in this phase.
- Current production routing.
- DNS.

---

## Task 1: Protect Current WordPress Deploy

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Modify: `pm/PROGRESS.md`

- [ ] **Step 1: Add `headless/` to FTP deploy excludes**

In `.github/workflows/deploy.yml`, add this line under the existing exclude list:

```yaml
            headless/**
```

- [ ] **Step 2: Run YAML sanity check**

Run:

```bash
ruby -e "require 'yaml'; YAML.load_file('.github/workflows/deploy.yml'); puts 'deploy yaml ok'"
```

Expected:

```text
deploy yaml ok
```

- [ ] **Step 3: Log progress**

Append to `pm/PROGRESS.md`:

```markdown
### 2026-06-11 Headless Phase 1 開始

#### 内容
- `codex/headless-phase1` でヘッドレス Next.js 検証を開始。
- 既存 WordPress 本番表示は維持し、`headless/` を別アプリとして追加する方針。
- WordPress FTP デプロイ対象から `headless/` を除外し、本番テーマへ混入しないようにする。

#### 変更ファイル
- `.github/workflows/deploy.yml`
- `pm/PROGRESS.md`
```

---

## Task 2: Scaffold Headless Next.js App

**Files:**
- Create: `headless/package.json`
- Create: `headless/next.config.ts`
- Create: `headless/tsconfig.json`
- Create: `headless/eslint.config.mjs`
- Create: `headless/.env.example`
- Create: `headless/app/layout.tsx`
- Create: `headless/app/globals.css`
- Create: `headless/app/not-found.tsx`

- [ ] **Step 1: Create package file**

Create `headless/package.json`:

```json
{
  "name": "escomi-headless",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "next": "16.2.6",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.6",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Create environment example**

Create `headless/.env.example`:

```bash
NEXT_PUBLIC_WP_BASE_URL=https://mens-esthe-kuchikomi.com
WP_API_BASE_URL=https://mens-esthe-kuchikomi.com/wp-json
```

- [ ] **Step 3: Create Next config**

Create `headless/next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "mens-esthe-kuchikomi.com"
      },
      {
        protocol: "http",
        hostname: "mens-esthe-kuchikomi.com"
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com"
      }
    ]
  }
};

export default nextConfig;
```

- [ ] **Step 4: Create app shell**

Create `headless/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: {
    default: "Escomi | 関西メンズエステ口コミナビ",
    template: "%s | Escomi"
  },
  description: "関西メンズエステの口コミ・店舗情報ポータル。エリア、料金、営業時間、出勤状況から店舗を探せます."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Create visual baseline CSS**

Create `headless/app/globals.css` with the Escomi dark/gold baseline:

```css
:root {
  --es-bg: #080808;
  --es-surface: #111318;
  --es-surface-soft: #181b22;
  --es-border: rgba(212, 175, 55, 0.24);
  --es-gold: #d4af37;
  --es-gold-soft: #f4d98c;
  --es-text: #f6f2e8;
  --es-muted: #b8b2a5;
  --es-danger: #d85f5f;
  --es-line: #31c15b;
}

* {
  box-sizing: border-box;
}

html {
  background: var(--es-bg);
  color: var(--es-text);
}

body {
  margin: 0;
  min-height: 100vh;
  background:
    radial-gradient(circle at 20% 0%, rgba(212, 175, 55, 0.12), transparent 34rem),
    linear-gradient(180deg, #060606 0%, #101114 42%, #070707 100%);
  color: var(--es-text);
  font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", sans-serif;
  letter-spacing: 0;
}

a {
  color: inherit;
  text-decoration: none;
}

img {
  display: block;
  max-width: 100%;
  height: auto;
}

.es-page {
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto;
  padding: 32px 0 64px;
}

.es-section {
  margin-top: 40px;
}

.es-section-title {
  margin: 0 0 20px;
  font-size: clamp(24px, 4vw, 40px);
  line-height: 1.25;
}

.es-section-title span {
  display: block;
  color: var(--es-gold);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.es-card {
  border: 1px solid var(--es-border);
  border-radius: 8px;
  background: rgba(17, 19, 24, 0.88);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.28);
}
```

---

## Task 3: Build WordPress Fetch Layer

**Files:**
- Create: `headless/lib/wp/client.ts`
- Create: `headless/lib/wp/types.ts`
- Create: `headless/lib/wp/areas.ts`
- Create: `headless/lib/wp/shops.ts`
- Create: `headless/lib/wp/posts.ts`
- Create: `headless/lib/seo.ts`

- [ ] **Step 1: Create fetch client**

Create `headless/lib/wp/client.ts`:

```ts
const DEFAULT_WP_BASE = "https://mens-esthe-kuchikomi.com/wp-json";

export const wpApiBase = process.env.WP_API_BASE_URL || DEFAULT_WP_BASE;

export async function wpFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith("http") ? path : `${wpApiBase}${path}`;
  const res = await fetch(url, {
    ...init,
    next: { revalidate: 300, ...(init?.next || {}) }
  });

  if (!res.ok) {
    throw new Error(`WordPress fetch failed: ${res.status} ${url}`);
  }

  return res.json() as Promise<T>;
}

export function stripHtml(value: string | undefined | null): string {
  return String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
```

- [ ] **Step 2: Create shared types**

Create `headless/lib/wp/types.ts`:

```ts
export type WpRendered = {
  rendered?: string;
};

export type WpMedia = {
  source_url?: string;
  alt_text?: string;
};

export type WpTerm = {
  id: number;
  count: number;
  name: string;
  slug: string;
  parent: number;
  description?: string;
  acf?: Record<string, unknown>;
};

export type WpPostBase = {
  id: number;
  date: string;
  modified: string;
  slug: string;
  link: string;
  title: WpRendered;
  content: WpRendered;
  excerpt?: WpRendered;
  featured_media?: number;
  acf?: Record<string, unknown>;
  _embedded?: {
    "wp:featuredmedia"?: WpMedia[];
    "wp:term"?: WpTerm[][];
  };
};

export type WpShop = WpPostBase & {
  official_url?: string;
  area_slug?: string;
};

export type ShopView = {
  id: number;
  slug: string;
  title: string;
  contentHtml: string;
  imageUrl: string;
  areaSlug: string;
  acf: Record<string, unknown>;
};

export type AreaView = {
  id: number;
  slug: string;
  name: string;
  parent: number;
  count: number;
  acf: Record<string, unknown>;
};
```

- [ ] **Step 3: Create SEO helpers**

Create `headless/lib/seo.ts`:

```ts
import { stripHtml } from "@/lib/wp/client";

export function makeDescription(value: string | undefined | null, fallback: string): string {
  const text = stripHtml(value);
  if (!text) return fallback;
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

export function faqJsonLd(rows: Array<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: rows.map((row) => ({
      "@type": "Question",
      name: row.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: stripHtml(row.answer)
      }
    }))
  };
}
```

---

## Task 4: Build Phase 1 Pages and Components

**Files:**
- Create: `headless/components/SiteHeader.tsx`
- Create: `headless/components/SiteFooter.tsx`
- Create: `headless/components/EmptyState.tsx`
- Create: `headless/components/ShopCard.tsx`
- Create: `headless/components/AreaPageView.tsx`
- Create: `headless/components/ShopDetail.tsx`
- Create: `headless/components/BlogArticle.tsx`
- Create: `headless/app/page.tsx`
- Create: `headless/app/area/[slug]/page.tsx`
- Create: `headless/app/shops/[slug]/page.tsx`
- Create: `headless/app/column/[slug]/page.tsx`

- [ ] **Step 1: Implement common header/footer**

Create reusable header and footer matching the current dark luxury direction.

- [ ] **Step 2: Implement area page**

`/area/nihonbashi/` must display:

- H1.
- Area characteristic text if available.
- Shop list.
- Area column if available.
- FAQ if available.
- FAQ JSON-LD if available.

- [ ] **Step 3: Implement shop detail page**

`/shops/{slug}/` must display:

- Shop title.
- Featured image.
- Catch text.
- Phone / LINE buttons.
- AI summary.
- Today availability.
- Age range.
- Price list.
- Shop info.

- [ ] **Step 4: Implement blog article page**

`/column/{slug}/` must display:

- Title.
- Featured image.
- Date.
- Content.
- SEO metadata.

- [ ] **Step 5: Implement top page skeleton**

`/` must display:

- Hero.
- Shop count.
- New shops.
- Area links.
- Column links.

---

## Task 5: Verify Locally

**Files:**
- Read only unless fixes are needed.

- [ ] **Step 1: Install dependencies**

Run:

```bash
cd headless
npm install
```

- [ ] **Step 2: Build**

Run:

```bash
cd headless
npm run build
```

Expected:

```text
Compiled successfully
```

- [ ] **Step 3: Start dev server**

Run:

```bash
cd headless
npm run dev
```

- [ ] **Step 4: Browser check**

Open:

- `http://localhost:3000/`
- `http://localhost:3000/area/nihonbashi/`
- One working shop URL under `http://localhost:3000/shops/{slug}/`
- One working blog URL under `http://localhost:3000/column/{slug}/`

Pass criteria:

- No blank page.
- No unhandled error.
- Mobile width has no major horizontal overflow.
- Area FAQ JSON-LD appears when source data exists.
- Current WordPress production site is unchanged.

---

## Full Reproduction Boundary

Phase 1 does not switch production. It creates the foundation for full reproduction.

Full reproduction is complete only when these are done:

1. Top page matches the current production structure.
2. Area pages match current parent/child behavior.
3. Shop archive matches current list and pagination behavior.
4. Shop detail matches current content sections.
5. Blog list and article pages are rendered by Next.js.
6. SEO metadata and structured data are verified.
7. WordPress updates revalidate Next.js pages.
8. GA4 and Search Console are verified.
9. Preview URL is approved by なりきよさん.
10. DNS or routing switch is performed with rollback ready.
