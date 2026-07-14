# Supabase SEO安全移行 実装計画

> **実行方法:** 現在の正式フォルダ内の `codex/supabase-seo-safe-migration` ブランチで、テスト先行により順番に実行する。

**目標:** 公開SEOとWordPress表示を変えず、Supabaseへの段階移行に必要なローカルDB構造、移行監査、安全な参照先設定を作る。

**構成:** Supabaseは `app` に業務テーブル、`private` に取込履歴、`api` に公開済み読み取りviewを置く。Next.jsの公開routeは変更せず、WordPress既定の参照先判定だけを独立モジュールとして追加する。

**使用技術:** Supabase CLI 2.101.0、PostgreSQL migration、Next.js 16、TypeScript、Node.js検査script

---

## Task 1: 設計を固定する

**Files:**
- Create: `docs/superpowers/specs/2026-07-14-supabase-seo-safe-migration-design.md`
- Create: `docs/superpowers/plans/2026-07-14-supabase-seo-safe-migration.md`
- Update: `task_plan.md`
- Update: `findings.md`
- Update: `progress.md`

1. 調査結果、実装範囲、非対象、停止点を記録する。
2. 公開WordPress既定と最小schemaを確定する。
3. 差分を確認し、設計単位でcommitする。

## Task 2: Supabase schema契約をテスト先行で作る

**Files:**
- Create: `headless/scripts/check-supabase-content-schema.mjs`
- Update: `headless/package.json`
- Create: `supabase/config.toml`
- Create: `supabase/migrations/*_seo_safe_content_core.sql`

1. 必須テーブル、RLS、`security_invoker` view、明示権限、禁止権限を検査するscriptを先に作る。
2. `npm run test:supabase-content-schema` を実行し、migration未実装を理由に失敗することを確認する。
3. Supabase CLIでローカル設定と空migrationを生成する。
4. 最小schema、index、RLS、policy、view、grantをmigrationへ実装する。
5. 検査を再実行し、成功させる。

## Task 3: WordPress移行元監査をテスト先行で作る

**Files:**
- Create: `headless/scripts/fixtures/wp-migration-sample.json`
- Create: `headless/scripts/check-wp-migration-audit.mjs`
- Create: `headless/scripts/lib/wp-migration-audit.mjs`
- Create: `headless/scripts/audit-wp-migration-source.mjs`
- Update: `headless/package.json`

1. 本文欠損、料金0、住所/アクセス混在、口コミ未確認、出典欠損を含む小さなfixtureを作る。
2. 期待する監査結果の検査を先に書く。
3. 検査を実行し、監査module未実装を理由に失敗することを確認する。
4. 監査moduleと読み取り専用CLIを実装する。
5. fixture検査を成功させる。
6. 公開WordPress APIへ読み取りだけを行い、現在件数と欠損傾向を再確認する。

## Task 4: WordPress既定の参照先安全装置をテスト先行で作る

**Files:**
- Create: `headless/scripts/check-content-source-config.mjs`
- Create: `headless/lib/content-source/config.ts`
- Update: `headless/.env.example`
- Update: `headless/package.json`

1. 設定なし、wordpress、shadow、未承認supabase、不正値の期待動作を検査するscriptを先に作る。
2. 検査を実行し、設定module未実装を理由に失敗することを確認する。
3. 既定WordPress、shadow比較、Supabase承認ゲートを実装する。
4. Secretではない環境変数名だけを `.env.example` に追加する。
5. 検査を成功させる。

## Task 5: 移行項目と運用を文書化する

**Files:**
- Create: `docs/data/supabase-wp-field-map-2026-07-14.md`
- Create: `docs/runbooks/supabase-seo-safe-migration.md`
- Update: `pm/DECISIONS.md`
- Update: `pm/NEXT_ACTIONS.md`

1. WordPress項目、Supabase項目、欠損時、出典、要確認条件を一覧化する。
2. local、試験投入、shadow、cutoverの各停止点と戻し方を書く。
3. 本番未作成、未投入、未切替を明記する。

## Task 6: 全体検証と進行記録

**Files:**
- Update: `pm/PROGRESS.md`
- Update: `task_plan.md`
- Update: `findings.md`
- Update: `progress.md`

1. `npm run test:supabase-content-schema` を実行する。
2. `npm run test:wp-migration-audit` を実行する。
3. `npm run test:content-source-config` を実行する。
4. `npm run lint`、`npm run typecheck`、`npm test`、`npm run build` を実行する。
5. `git diff --check` と差分一覧を確認する。
6. 公開route、metadata、sitemap、表示componentに差分がないことを確認する。
7. QAセルフレビューを行い、問題があれば修正後に全検査をやり直す。
8. 本番操作を行っていないこと、戻し方、次の承認点を報告する。
