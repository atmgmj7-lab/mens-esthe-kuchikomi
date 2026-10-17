# Eskomi 総合実装設計 v1.1 — 実装対応表

承認済み原本: `docs/eskomi-approved-design-v1.1-full-20261017.md`。本書は原本ではなく、実装状況を追跡するための対応表である。原本の要求が既存コードと矛盾する場合は原本を優先する。

## 不変の実装規約

- 正規店舗は `app.shops.id`。WordPress ID/添付 ID は新規登録・投稿・公開の必須条件にしない。
- 口コミ入口は登録不要で、店舗と任意の担当者を一度に評価する。ニックネーム、共通コメント、各評価は任意だが、少なくとも一つの回答を必要とする。
- 公開前に Eskomi と店舗 HP へ掲載され得ることを明示する。公開 handle、編集控え、特典コードを共用しない。
- 特典は有効受付時に、運営承認済みの条件版にだけ発行する。星、批判、人物評価の有無、公開・取り下げだけでは取消さない。発行停止と既発行コードの利用可否は別状態で扱う。
- 店舗情報は申請・版管理、運営者の直接編集は監査付き。削除は復元可能な状態変更で、未公開編集 draft が既存 WP 公開を消してはならない。
- 公開 read は公開中店舗と承認済み投影だけ。draft/review/archived 店舗の入口、投稿、公開 read を拒否する。
- 自動メール・LINE・顧客台帳・価格や順位の未確定値は追加しない。広告は通常順位から分離する。

## 要件→実装→試験

| 要件 | 現在の実装 | 試験/状態 |
|---|---|---|
| E01/E02 正規店舗・WP非依存 | `app.shops`、`private.managed_shops.app_shop_id`、`create_canonical_managed_shop` と managed directory RPC。新規店は WP ID/添付 IDなしで作成・公開でき、legacy overlay はID+slug一致時だけ行う。 | `verify_eskomi_canonical_foundation.sql`、`verify_eskomi_canonical_integrity_fixes.sql`、`verify_operator_managed_shop_directory.sql`、`test:managed-shop-source`。fresh/upgrade で実行。 |
| E03 workspace と店舗一致 | `private.partner_workspaces.app_shop_id` と `(workspace_id, shop_id)` 複合 FK。 | integrity SQL に不一致 insert 拒否。 |
| E04–E06 人物・案内リンク | `therapists`、assignments、entry link resolver、一般リンクの同店active担当選択。`/partner/therapists/` と service-only API で公開名・写真資産・権利確認、revision付き更新/退店、常設リンク付きのコピー専用案内文を提供 | `verify_eskomi_review_entry_therapist_selection.sql` と `verify_eskomi_partner_therapist_tools.sql` で、1体験内の店舗/任意人物評価、他店改ざん拒否、共有一般リンク不変、退店後の店舗のみ継続、権利記録、常設URL再利用、offline-only文面をfresh DBで実行確認。実ブラウザ経路はDocker公開port到達不能のため未完走 |
| E07–E10 受付と共通回答 | `submit_review_experience_v2`、任意 nickname/評価/0–400 コメント | 要 DB transaction/E2E |
| E11 公開投影・詳細接続 | `app.review_experience_publications`（1体験1公開ID）、withdrawal hide、widget、`list_public_shop_detail_reviews_v11`/summary。詳細画面は `ESKOMI_V11_PUBLIC_REVIEW_SOURCE=supabase` のとき、canonical slugで承認済み本文・担当snapshot・承認済み店舗返信・集計を読む。 | `verify_eskomi_v11_vertical_slice.sql`、`test:review-public-adapter`。未設定では既存WordPress/旧native読取りを維持する。 |
| E12 編集控え | hash、30日控え、編集session、24h AES-GCM再送cache、タブ固有credential。 | DB/private-control SQLは通過。通信断ブラウザE2Eは `npm run qa:eskomi-v11-replay-browser` に保存、現環境ではDocker公開port到達不能のため未完走。 |
| E13/E14 審査・返信 | `DashboardV11ReviewOperations`、`/api/dashboard/reviews/v11/`、moderation audit、承認済み返信だけのpublic projection。 | fresh SQL と `test:eskomi-community-ui`。 |
| E15–E18 特典 | immutable version、期限、membership再検査付き消込、receipt recovery。 | `verify_eskomi_v11_operations.sql`、race script。 |
| UI 1/2→2/2→受付 | `/r/{handle}` 互換 resolver、`/reviews/entry/[handle]`、入力→確認→戻る保持→受付、編集/取り下げ、公開projection表示。 | TypeScript/lint/route契約は通過。通信断を含む実ブラウザfixtureは上記E2Eで再現可能化済み、現環境では未完走。 |
| 管理者店舗CRUD・店舗申請 | `/dashboard/shops/`、`/dashboard/shops/new/`、`/dashboard/shops/managed/[id]/` と `/api/dashboard/managed-shops/`。直接追加/編集/掲載停止/削除済み移動/掲載停止への復元、private画像、revision conflictを扱う。店舗側変更申請は既存 `/partner/listing/` 審査経路に限定する。 | `verify_operator_managed_shop_directory.sql`、`test:operator-managed-shop-directory`、`test:managed-shop-directory-repository`。物理削除なし。 |
| 公開店舗・地域・SEO | `lib/managed-shop-source.ts`、`lib/wp/shops.ts`、`lib/wp/areas.ts`、`app/shops/[slug]/page.tsx`、`app/sitemap.ts`。公開/停止状態を一覧・地域・詳細・sitemapへ同じ投影で反映し、既存canonical URLを保持する。 | `test:managed-shop-source`、`test:managed-area-membership`、`test:shop-detail-seo-asset`、`test:seo-cutover-check`。都道府県カードと通常順位の規則は変更しない。 |
| B01–B10 バナー | `lib/eskomi-banner-v2.ts` に10本すべての改訂コピー・CTA・既存/未提供遷移先を記録し、`EskomiBannerV2Slot` は承認済みlocal素材と実在hrefが揃うまでnullを返す。`StoreListingGuide` の既存バナーとは別物。 | `test:eskomi-banner-v2`。v2素材はLibraryネットワーク許可待ちで未取得・未配置のため、公開導線へ追加しない。 |
| 訂正/情報交換 E30–E32 | `/shops/[slug]/community/`、`/area/[slug]/community/`、community/correction API、運営審査、14日browser reaction、receipt-only withdrawal。 | `verify_eskomi_community_v11.sql`、`test:eskomi-community-ui`。公開はnoindexで、評価・順位・特典へ混入しない。 |

## 2026-10-17 隔離検証の証跡

- fresh PostgreSQL 17で全migrationを適用し、canonical/integrity/review/therapist/private-control/operations/community/vertical-slice SQLを通過した。vertical sliceには canonical store detail review projection（aggregate と withdrawal hide）を含む。PostgRESTは公式 `postgrest/postgrest:v16.4` を固定する。
- `headless/scripts/run-eskomi-v11-replay-e2e.sh` は非公開Docker network内に使い捨てPostgreSQL/PostgRESTを作り、migrationと上記SQLをfresh適用後、Nextを同一shellで起動し、`check-eskomi-v11-replay-browser.mjs` を実行する。最初の成功レスポンスだけを切断し、同一Cookie・同一冪等キーの秘密控え復元、別session非開示、期限切れ時の新規発行なしを確認する。Docker socketはどのコンテナにもmountしない。
- この実行環境ではDocker公開port `127.0.0.1:57001` へホストのNext/Chromiumから接続できず（PostgREST起動後も `curl` が接続拒否）、実ブラウザ経路は未完走。`ESKOMI_SQL_ONLY=1` は同じfresh DB migration・SQL受入だけを明示的に完走させる検証モードであり、ブラウザ合格の代替にはしない。

## リリース境界

本書は G0/G1 の実装正本であり、G3 の特典条件・保存/同意・鍵設定、G4 の全受入、G5 の本番承認を代替しない。10/08 duplicate migration の no-op 化は fresh reset の修正であり、既存DB migration ledger の読取り照合を本番前ゲートとして残す。

## 引継ぎ時点の未完成範囲

- 実ブラウザHTTP E2E：この環境ではホストChromiumがDocker公開PostgREST portへ接続できず未完走。Docker socket mount、host network、権限変更は行わない。
- 実ブラウザHTTP E2E：この環境ではホストChromiumがDocker公開PostgREST portへ接続できず未完走（SQL/race は完走）。
- canonical read切替は feature flag のまま。本番のbackfill件数・差分・sitemap/JSON-LD HTTP観測、legacy口コミ移行の承認が必要であり、ここでは行わない。
- B01–B10 v2画像はLibraryのネットワーク許可待ち。コピー・リンク候補以外は未実装で、未提供機能を示すバナーは公開しない。
- スパワールド／メンズリゼ大阪梅田は対象ID・公式根拠・正規対応を本番で確認後、managed archive（復元先unlisted）の操作手順を使う候補に留める。本作業ではDB変更・掲載停止・削除をしていない。
- `run-eskomi-v11-populated-upgrade-e2e.sh` はbf46aa1境界までのmigration＋代表データから後続migrationを適用する隔離upgrade証跡であり、本番migration ledger照合の代替ではない。
