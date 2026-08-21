# Eskomi New UX Release Close

Task: `UX-PROD-FINAL-CLOSE-01`

Release date: 2026-08-22 JST

State: PRE-MAIN-SYNC REVIEW

## Release scope

このreleaseは、既存URLとWordPress公開データ正本を維持したまま、次を公開した範囲を閉じる。

- T1: Public Data Boundary / Review & Ranking Contract
- T2: Global Discovery / Top + Reviews Hub
- T3: Priority Area SEO Hubs + Area relation全件Shop list
- T4: Shop Detail / Reviews & Experience / SEO asset
- Follow-up: editorial placeholder、Hello world stale route、Area list UX revision

対象外はGSC、SEO戦略、Analytics、次フェーズ、DATA-CLEAN、Phase18、Supabase public cutover、WordPress停止である。ユーザー判断は「次戦略は新UX完成後に決める」であり、このcloseから次戦略を開始しない。

## Git and production identity

| Item | Value | Evidence status |
|---|---|---|
| Fresh `origin/main` before sync | `bc203610e9bb041c84a63695d71938ba58261730` | CONFIRMED 2026-08-22 |
| Area UX implementation | `867aab90811420e906ebcb3c787d2655cd8379e5` | CONFIRMED |
| Evidence candidate | `48f45591cb606f960934f20a6a8ce8b419bdb9a6` | CONFIRMED; application diff after implementation is 0 |
| Current production deployment | `dpl_H7Y3rUbGHabM1K6pKiQzdj5vxxE7` | READY; alias target confirmed |
| Production application identity | `867aab90811420e906ebcb3c787d2655cd8379e5` equivalent | INFERRED from deployment time and docs-only subsequent diff; Vercel metadata has no source SHA |
| Main sync method | fast-forward, 22 commits, force pushなし | CONFIRMED |

`origin/main..candidate`には`headless/**`と`functions.php`が含まれるため、main同期はVercelとXserverの両workflowを起動する。XserverはBLOCK-001と同じ認証前停止か、別原因・partial transferかを同期後に区別する。

## Final independent public QA

独立3担当がproductionのみをread-only確認した。実装担当の以前の自己QAをそのままPASS根拠には使用していない。

| Check | Result |
|---|---|
| Critical / Important | 0 / 0 |
| Responsive visual | 45 screenshots; Top/Shop 320、390、1440、Priority5 390/1440 |
| Priority Area WP relation / DOM | sakai 18、shinosaka 48、nihonbashi 59、sakaisujihonmachi 93、umeda 59 |
| Shop links | 214 unique、214/214 HTTP 200、double encoding 0、`/shops//` 0 |
| Reviews / rating | production Reviews 0、fake review/rating/count 0、`AggregateRating` 0 |
| Ranking | formal record 0、ranking section 0、fake 1/2/3 badge 0 |
| Hello world | direct 404、Top/Reviews/Column link 0、sitemap 0 |
| SEO | normal unexpected noindex 0、reviews filter/submitの既存noindex、robots/sitemap 200、Priority5 sitemap掲載 |
| Visual safety | overflow 0、H1複数0、broken confirmed link 0、公開Primary内部文言0 |

Post ID 1の内部`draft`はpublic-only QAではNOT_VERIFIEDである。2026-08-21の内部after snapshotではdraft、公開結果は今回も404/link 0/sitemap 0であり、異なる証拠層として保持する。

## Fresh local verification

- `npm test`: exit 0
- `npm run lint`: exit 0
- `npm run typecheck`: exit 0
- `npm run build`: exit 0、821/821
- `npm audit --audit-level=high`: exit 0、vulnerabilities 0
- `git diff --check`: exit 0

## Production data state

- Public content source: WordPress / Xserver
- Public UI: Next.js / Vercel
- Public Shops: 380
- Explicit Primary Area rows: 44
- Approved Reviews: 0
- Priority Area relation/DOM counts: 18 / 48 / 59 / 93 / 59
- Last internal non-target snapshot Area relations: 782
- Current public-Shop REST relation assignments: 779。last internal 782との差3件は、このpublic-only closeでは内部再読込しておらず内訳NOT_VERIFIED
- Supabase public cutover: false
- WordPress shutdown: false

Primary 44件は明示保存値で、Primary状態を公開Area listingの除外条件には使わない。Area listingはWordPress Area relationを持つ全公開Shopを表示する。

## Known Minor backlog

1. `/favicon.ico` returns 404.
2. Topの堺筋本町Priority Area cardだけ`掲載店舗 集計準備中`。Area本体は93件で正常。
3. 別Vercel project `headless`の誤deployment `dpl_7xzDvACjtFpFnqNYcpFvt1ZCJTkL`は公開domain未接続のため、この非破壊closeでは削除しない。
4. formal ranking dataは0。fake rankingを出さずsection非表示となる仕様で、不具合ではない。

## Known blockers and monitoring risks

- `BLOCK-001`: GitHub standard runnerからXserverへの国外SSH制限。現在のproduction PHPは国内経路で検証済み。公開障害ではない。
- `BLOCK-005`: `ai-site-monitor`の全店舗運用・品質面。今回のrelease scope外。
- `wp-json` transient 500: 現在再現なし、root cause NOT_VERIFIED。monitoring riskとして残し、推測code fixは行わない。

## Rollback record

| Layer | Rollback point | Current action |
|---|---|---|
| Vercel | pre-main-sync verified deployment `dpl_H7Y3rUbGHabM1K6pKiQzdj5vxxE7` | rollback未実行 |
| WordPress PHP | `/home/xs454693/escomi-backups/ux-prod-op-wp-code-01-20260816T194437Z/`、`MANIFEST.sha256` | 4fileとmanifestをread-only再確認。manifest: shop meta `80342ad…`, reviews CPT `edb3edd…`, reviews REST `45d776b…`, functions `b13b255…` |
| Primary P1 | `/home/xs454693/escomi-backups/ux-prod-op-primary-p1-01-20260816T201255Z/` | `before.json` SHA-256 `d05c2657…`、`after.json` `06c74836…` |
| Primary P2 | `/home/xs454693/escomi-backups/ux-prod-op-primary-p2-01-20260816T210224Z/` | `manifest.sha256`; target `413cf3f1…`、before `071ed90b…`、after `4992dc95…` |
| Primary P3 | `/home/xs454693/escomi-backups/ux-prod-op-primary-p3-01-20260817T120622Z/` | `manifest.sha256`; target `cef71648…`、before `ff6fb948…`、after `13b300d9…` |
| Hello world | `/home/xs454693/escomi-backups/ux-prod-cleanup-hello-world-01-resume-20260821T064006Z`、Post ID 1 draft | publishへ戻さない |
| Git | pre-main-sync `origin/main` `bc203610e9bb041c84a63695d71938ba58261730` | force push/rewrite禁止 |

Rollbackが必要な場合は自動実行せず、Gitはrevert commit、Vercelは前verified deployment、WordPress PHPは依存3fileを先にして`functions.php`を最後にする既存手順を使う。

## Post-sync completion fields

この文書の最終commitで、次を実観測値へ更新する。

- latest `origin/main`
- main push result
- Vercel workflow run / deployment / alias
- Xserver workflow run、BLOCK-001または別原因、partial deploy有無
- production post-sync HTTP、Area counts、Shops 380、Primary 44、Reviews 0
- final close flags

## Close flags

```text
NEW_UX_RELEASE=PENDING_MAIN_SYNC
PRODUCTION_QA=PASS
GIT_PRODUCTION_ALIGNED=NO
CRITICAL=0
IMPORTANT=0
RELEASE_CLOSED=NO
```
