# 堺筋本町 Phase 4 実データ強化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** WordPress堺筋本町アーカイブ先頭30店舗について、一次情報に基づく料金・営業時間・アクセス・予約先・確認日・出典を整理し、確認済みデータだけの比較集計とSupabase非公開draft投入前previewを作る。

**Architecture:** WordPress REST APIの公開値は対象同定と現状比較にだけ使い、調査正本は項目ごとに確認状態と一次情報URLを持つJSONにする。検証器が30件固定、出典必須、推測禁止、代表料金の選定、集計条件を機械検査し、既存のSupabase `app` schemaへ対応したdraft previewとSEO集計Markdownを生成する。公開画面の参照元はWordPressのまま変更しない。

**Tech Stack:** Node.js ESM、WordPress REST API、JSON、Markdown、既存の`headless/` npm検査。

## Global Constraints

- 対象は2026-07-15に `shop?area=46&per_page=30&page=1&_embed=1` で取得した30店舗をWordPress IDと選定順で固定する。
- 対象順は人気順位、口コミ順位、広告順位として表現しない。
- 料金、営業時間、住所、アクセス、電話、予約先は一次情報で確認できた値だけを `verified` にする。
- 検索結果と第三者ポータルは公式URL発見の補助に限り、事実値の出典にしない。
- 値が確認できない場合は `unverified` とし、0、空文字、類似店舗値、推測値で補完しない。
- AI文章や編集部文章を利用者口コミにせず、口コミ・評価は今回追加しない。
- 代表料金は確認済みの通常コースから「分数が最短、同分数なら金額が最小」を機械的に選ぶ。初回限定、指名料、延長、オプションは代表料金にしない。
- 深夜対応は公式の閉店時刻が24:00を超える、または24時間営業と明記された店舗だけを集計する。
- 初心者向け比較は公式の初回案内・初めての方向け案内が確認できた店舗だけを掲載する。
- WordPressを更新先にしない。本番Supabase、外部サービスへ書き込まず、push、deploy、本番公開を行わない。
- 公開参照先はWordPress既定のままにし、`CONTENT_DATA_SOURCE`、route、canonical、sitemapを変更しない。

---

## Data Contract

各店舗は次の型で保存する。

```ts
type VerificationStatus = "verified" | "unverified" | "not-published";
type SourceKind = "official-site" | "official-booking" | "official-social";
type BookingMethodType = "phone" | "web" | "line" | "dm" | "other";

type VerifiedFact<T> = {
  status: VerificationStatus;
  value: T | null;
  source_ids: string[];
};

type Phase4ShopRecord = {
  selection_position: number;
  wp_post_id: number;
  wp_slug: string;
  wordpress_title: string;
  wordpress_snapshot: Record<string, string>;
  official_name: VerifiedFact<string>;
  official_url: VerifiedFact<string>;
  address: VerifiedFact<string> & { visibility: "public" | "after-booking" | "unknown" };
  access_points: Array<{
    station: string;
    exit: string | null;
    walk_minutes: number | null;
    source_ids: string[];
  }>;
  business_hours: VerifiedFact<{
    display: string;
    opens_at: string | null;
    closes_at: string | null;
    closes_next_day: boolean;
    is_24_hours: boolean;
  }>;
  prices: {
    status: VerificationStatus;
    courses: Array<{
      name: string;
      duration_minutes: number;
      amount_yen: number;
      conditions: string;
      representative_eligible: boolean;
      source_ids: string[];
    }>;
    representative_course_index: number | null;
    source_ids: string[];
  };
  contact: {
    phone: VerifiedFact<string>;
    booking_methods: Array<{
      type: BookingMethodType;
      label: string;
      url: string | null;
      source_ids: string[];
    }>;
  };
  beginner_guidance: VerifiedFact<string>;
  verified_on: "2026-07-15";
  sources: Array<{
    id: string;
    kind: SourceKind;
    title: string;
    url: string;
    checked_on: "2026-07-15";
    fields: string[];
  }>;
  unverified_fields: string[];
  notes: string[];
};
```

確認状態は `verified`、`unverified`、`not-published` の3種類だけを使う。`not-published` は公式が「住所は予約確定後に案内」など非公開方針を明示した場合に限る。

---

### Task 1: 対象30店舗の固定とデータ契約検査

**Files:**
- Create: `docs/data/sakaisujihonmachi-phase4-30-shops-2026-07-15.json`
- Create: `headless/scripts/check-sakaisujihonmachi-phase4-data.mjs`
- Create: `headless/scripts/lib/sakaisujihonmachi-phase4-data.mjs`
- Modify: `headless/package.json`

**Interfaces:**
- Consumes: WordPress REST API area ID 46の先頭30件。
- Produces: `validatePhase4Dataset(dataset)` と `buildPhase4Summary(dataset)`。

- [x] **Step 1: 30件・ID・出典・確認状態を要求する失敗検査を書く**

検査は、対象JSON未作成、30件未満、重複ID、`verified` なのに出典なし、出典に第三者ポータル、未確認値に数値0、代表料金規則違反をそれぞれ失敗させる。

- [x] **Step 2: REDを確認する**

Run: `cd headless && node scripts/check-sakaisujihonmachi-phase4-data.mjs`

Expected: `ENOENT` または `Phase 4 dataset must contain exactly 30 shops` で終了コード1。

- [x] **Step 3: WordPress snapshotと空の確認状態を持つ30件JSONを作る**

30件すべてに選定順、WordPress ID、slug、WordPress登録名、WordPress現行値を入れる。調査前の一次情報項目は `unverified` とし、WordPress現行値を自動で `verified` へ昇格させない。

- [x] **Step 4: 最小検証器を実装する**

`validatePhase4Dataset` は対象ID・順序を固定し、全 `verified` 値に実在する `source_ids` と一次情報種別を要求する。`portal`、`directory`、`search-result` は出典種別として拒否する。

- [x] **Step 5: GREENを確認する**

Run: `cd headless && npm run test:sakaisujihonmachi-phase4-data`

Expected: `30 shops checked; verified facts have primary sources`。

### Task 2: 30店舗の一次情報調査

**Files:**
- Modify: `docs/data/sakaisujihonmachi-phase4-30-shops-2026-07-15.json`
- Modify: `findings.md`

**Interfaces:**
- Consumes: 固定30店舗と公式URL候補。
- Produces: 項目別の確認状態、値、出典、確認日。

- [x] **Step 1: 5店舗単位で公式サイトを確認する**

トップ、アクセス、料金、システム、予約、初めての方向けページを優先する。JavaScript表示等で読めない場合は公式予約ページ・公式SNSへ切り替え、確認できなければ未確認にする。

- [x] **Step 2: 各5店舗の直後に検査する**

Run: `cd headless && npm run test:sakaisujihonmachi-phase4-data`

Expected: 対象30件を維持し、追加済みの全確認値に一次情報と確認日がある。

- [x] **Step 3: WordPress現行値を比較用snapshotとして分離する**

WordPress現行値は公開状態の比較にだけ使い、一次情報で確認済みの値と混ぜない。WordPress更新候補は生成しない。

### Task 3: Supabase非公開draft previewと比較集計の生成

**Files:**
- Create: `headless/scripts/render-sakaisujihonmachi-phase4-report.mjs`
- Create: `docs/data/sakaisujihonmachi-phase4-supabase-draft-preview-2026-07-15.json`
- Create: `docs/seo/sakaisujihonmachi-phase4-data-report-2026-07-15.md`
- Test: `headless/scripts/check-sakaisujihonmachi-phase4-data.mjs`

**Interfaces:**
- Consumes: 検証済み30店舗JSON。
- Produces: 読み取り専用のSupabase非公開draft候補とSEO比較表。

- [x] **Step 1: 生成物がない状態で失敗する検査を追加する**

検査はSupabase draft previewが30件であること、WordPress更新候補を含まないこと、`app.shops` がdraft、料金・営業時間・項目別出典が `is_public=false` であること、未確認値と口コミ・評価フィールドを含まないことを要求する。

- [x] **Step 2: REDを確認する**

Run: `cd headless && npm run test:sakaisujihonmachi-phase4-data`

Expected: `Supabase draft preview file is missing` で終了コード1。

- [x] **Step 3: レポート生成器を実装する**

Supabase previewは既存の `app.shops`, `app.shop_prices`, `app.shop_business_hours`, `app.sources`, `app.shop_source_links` に対応する候補だけを出す。WordPressは `wordpress_comparison` として残し、更新候補にはしない。

- [x] **Step 4: 確認済みデータだけを集計する**

料金は代表料金の件数・最小・中央値・最大・価格帯別件数を出す。営業時間は深夜対応件数と営業時間確認済み件数を分母付きで出す。駅出口は確認済みaccessだけを数える。初心者向けは公式案内確認済みだけを列挙する。

- [x] **Step 5: GREENを確認する**

Run: `cd headless && node scripts/render-sakaisujihonmachi-phase4-report.mjs && npm run test:sakaisujihonmachi-phase4-data`

Expected: 30件preview、推測値0件、口コミ・評価0件、出典欠損0件。

### Task 4: QAと公開前停止

**Files:**
- Modify: `pm/PROGRESS.md`
- Modify: `pm/NEXT_ACTIONS.md`
- Modify: `progress.md`
- Modify: `task_plan.md`

**Interfaces:**
- Consumes: 全生成物とGit差分。
- Produces: 人間確認用の完了報告と本番反映判断材料。

- [x] **Step 1: 対象検査と全体検査を実行する**

Run: `cd headless && npm run test:sakaisujihonmachi-phase4-data && npm run lint && npm run typecheck && npm test && npm run build`

Expected: 全コマンド終了コード0。buildは既存のWordPress fallback通知を許容するが、新規エラーを許容しない。

- [x] **Step 2: Git差分と禁止操作を確認する**

Run: `git diff --check && git status --short --branch`

Expected: whitespace error 0。本番WordPress・Supabase変更、push、deployなし。

- [x] **Step 3: PM記録を更新する**

確認済み件数、未確認件数、料金分布、深夜対応、駅出口、初心者案内、対象ファイル、検査結果を記録する。

- [x] **Step 4: Supabase非公開投入・push・本番公開前で停止する**

draft preview、出典方針、未確認項目を提示し、Supabase非公開投入はユーザーの明示承認を待つ。公開切替はさらに別承認とする。

### Task 5: Supabase非公開投入SQLの作成とローカル検証

**Files:**
- Create: `headless/scripts/lib/sakaisujihonmachi-phase4-supabase-sql.mjs`
- Create: `headless/scripts/prepare-sakaisujihonmachi-phase4-supabase-import.mjs`
- Create: `headless/scripts/check-sakaisujihonmachi-phase4-supabase-import.mjs`
- Generate: `supabase/imports/20260715_sakaisujihonmachi_phase4_verified_draft.sql`（Git除外）
- Generate: `supabase/imports/verify_20260715_sakaisujihonmachi_phase4_verified_draft.sql`（Git除外）

- [x] **Step 1: 生成module不在で失敗する契約検査を追加する**
- [x] **Step 2: 26店舗・料金89行・営業時間23行・出典71行・項目別出典189行の非公開SQLを生成する**
- [x] **Step 3: 営業時間注記のJSON評価順エラーを実DBで再現し、失敗検査後に修正する**
- [x] **Step 4: 既存382店舗をローカルへ復元し、Phase 4 SQLを2回適用する**
- [x] **Step 5: 件数不変、重複0、匿名公開view全9種0件、DB lint error 0を確認する**
- [x] **Step 6: 本番Supabase・push・deploy・公開切替前で停止する**

ローカル検証結果は店舗26、料金89、営業時間23、公式URL単位の出典71、項目別出典189、取込record 26。調査記録72件の重複URL1件は出典行だけ統合し、項目別確認は保持した。本番投入は別承認とする。
