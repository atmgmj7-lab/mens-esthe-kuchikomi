# Eskomi v1.1 pre-production acceptance matrix (2026-10-17)

対象ブランチ: `codex/wp-independent-prep-20261017`。この文書は
`eskomi-approved-design-v1.1-full-20261017.md` の T01--T56 を、実装、隔離試験、
本番前に残る確認へ分解した運用用の対応表である。ここでいう「隔離 PASS」は
`ESKOMI_SQL_ONLY=1 scripts/run-eskomi-v11-replay-e2e.sh`（fresh PostgreSQL 17）又は
`scripts/run-eskomi-v11-populated-upgrade-e2e.sh` の結果であり、本番操作を意味しない。

状態の意味は次のとおり。

| 状態 | 意味 |
| --- | --- |
| 実装済 | コード/RPC/DB contract がある。 |
| 実行済 PASS | 上記の隔離試験又は明記した静的契約試験が通った。 |
| 未試験 | 実ブラウザ又は実HTTPなど、実装はあるがこの環境では未実行。 |
| ユーザー前提待ち | 本番データ、権利、資格情報、又は公開承認が必要でここでは実行しない。 |
| 未実装 | 意図的に公開していない機能又は素材。 |

## この変更で固定する通常店舗の正本経路

1. 運営が `/dashboard/partners/` の新規店に対して `POST /api/dashboard/partners/provision/`
   （`{ shopSlug }`）を行う。この route は最初に Supabase の `listPublished()` から WP ID のない
   canonical publication を解決するため、新規店で WordPress reader を必要としない。既存店だけが
   legacy reader に進む。`provisionPartnerWorkspace` はまず
   `api.provision_partner_workspace_for_published_managed_shop(p_shop_slug, p_source)` を呼ぶ。
   これは公開済み `private.managed_shops` と `app.shops` を slug で突合し、
   `app_shop_id` を持つ workspace だけを作る。WP ID は引数にも正本にもならない。
   0 行のときだけ旧 `provision_partner_workspace(p_wp_shop_id, ...)` へ戻る（既存店互換用）。
2. ログイン後の `/partner/` は `get_partner_compatible_auth_membership(p_auth_user_id)`、続いて
   `get_partner_compatible_workspace_identity(p_workspace_id, p_auth_user_id)` で DB 内の
   workspace、役割、公開状態を再確認する。canonical は owner/manager と published app/managed
   shop のみ、旧 WP workspace は安全な「移行が必要」画面のみを返す。停止・降格・失効は通さない。
3. `/partner/listing/` は `GET /api/partner/listing/` →
   `get_partner_canonical_listing_editor(p_workspace_id, p_auth_user_id)`、下書き保存は
   `PATCH /api/partner/listing/` →
   `save_partner_canonical_listing_draft(p_workspace_id, p_auth_user_id, p_expected_revision, p_patch)`、
   申請は `submit_partner_canonical_listing_change(p_workspace_id, p_auth_user_id, p_expected_revision)`。
   `p_patch` は `shop_name`, `area_slug`, `official_url`, `introduction`, `banner_asset_id` のみで、
   地域名をクライアントから受けない。`area_slug` は既存の `app.areas` 候補から選び、共有地域名を
   上書きできない。
4. 運営承認は `review_canonical_managed_shop_revision(...)` から transaction 内で
   `managed_shop_revisions`、`app.shops`、`app.shop_areas`、公開 projection を同期する。主地域変更は
   古い primary を先に解除してから新規 primary を upsert するため、unique 制約に衝突しない。
5. `/partner/growth/`、POP/QR、widget は canonical `app_shop_id` を使う。owner は発行/設定を作成でき、
   manager は既存の growth/widget を読むのみ。店舗 A の session で店舗 B を指定する値は RPC で拒否する。

## 切替に必要な環境変数・read source

| 用途 | 値/条件 | 切替上の扱い |
| --- | --- | --- |
| 店舗・地域・sitemap の canonical read | `SHOP_DIRECTORY_SOURCE=supabase` | backfill 差分、停止/tombstone、地域/詳細/sitemap の HTTP 観測後にのみ昇格。 |
| v1.1 店舗口コミと全体口コミ | `ESKOMI_V11_PUBLIC_REVIEW_SOURCE=supabase` | 新規の canonical 口コミと全体 projection を同時に切り替える。`REVIEW_READ_SOURCE` 単独では v1.1 の全体 reader を切り替えない。 |
| 旧 native review reader | `REVIEW_READ_SOURCE=supabase` | legacy reader のみ。二重読取比較が終わるまで v1.1 cutover の根拠にしない。 |
| Rank UP native review pilot | `RANKUP_NATIVE_REVIEW_READ_SOURCE=supabase` | 別 pilot。v1.1 全体口コミ・新規通常店舗の読取切替と混同しない。 |
| server Supabase | `SUPABASE_URL`、server 専用 `SUPABASE_SECRET_KEY`（又は既存の互換 service key） | browser に secret を出さない。既存の安全な実行環境にだけ設定する。 |
| Partner auth | `SUPABASE_AUTH_PUBLISHABLE_KEY`、`PARTNER_AUTH_REDIRECT_ORIGIN` | Auth redirect と cookie/session を preview で確認する。永続テスト認証を新設しない。 |

本番でフラグを変更する前に、対象 SHA を preview へ配備し、公開 GET、Auth、非破壊 listing
取得、sitemap、JSON-LD を観測する。ここでは production deploy、production DB migration、flag
変更をしない。

## legacy workspace / review の移行ゲート

WP-only workspace は今回の compatibility RPC で既存 login を壊さないが、canonical 書込みは許可
しない。移行は `wp_shop_id`、canonical slug、`app_shop_id` の**確認済み対応表**だけで行い、店名類似
による自動結合をしない。実施者は read-only 接続で次を記録してから、別承認の migration を行う。

```sql
-- 実行先は production ではなく承認済み read-only replica / snapshot に限定する。
-- 候補、未対応、重複、slug 衝突を個別に出し、件数を release ticket に添付する。
select pw.id, pw.wp_shop_id, ms.shop_slug, ms.app_shop_id as candidate_app_shop_id
from private.partner_workspaces pw
left join private.managed_shops ms
  on ms.existing_wp_shop_id = pw.wp_shop_id
 and ms.existing_shop_slug = pw.shop_slug
where pw.app_shop_id is null and pw.wp_shop_id is not null;

select wp_shop_id, count(*)
from private.partner_workspaces
where wp_shop_id is not null
group by wp_shop_id having count(*) > 1;
```

canonical schema 適用後の dry-run は `api.list_legacy_partner_workspace_mapping_candidates_v11()` を使い、
`mapping_status='ready'` のみを個別承認対象にする。実行順は (1) exact WP ID + slug を確認、(2) 既存
`app.shops` を `api.bind_legacy_managed_shop_to_app_shop_v11(managed_shop_id, app_shop_id, actor)` で明示的に
bind、(3) 同じ三IDを `api.map_legacy_partner_workspace_to_canonical_v11(workspace_id, managed_shop_id, app_shop_id, actor)`
へ再提示する、である。どちらも名称照合・自動実行をしない。workspace UUID/membership、旧 canonical URL、
`app.shop_images` は更新しない。dry-run の合格条件は、対応済み/未対応/重複/slug衝突を全て記録し、二度目の計算が差分 0、孤立 FK 0、
停止/tombstone が legacy/canonical の両方で優先されること。旧口コミ・旧 public banner は自動削除も
自動再公開もしない。legacy review の件数・公開状態・URL の二重読取比較が 0 差分になるまで、
`ESKOMI_V11_PUBLIC_REVIEW_SOURCE` の production 切替はしない。

## release / rollback

1. preview の fresh/upgrade/権限/HTTP smoke を対象 SHA で保存する。
2. 承認済みの additive migration を一回だけ適用し、ledger と mapping 件数を確認する。
3. read source flag を段階的に上げ、公開 reader の詳細、地域、sitemap、JSON-LD、widget を監視する。
4. 異常時は v1.1 入口と read flag を直前のアプリ設定へ戻す。DB down migration、履歴削除、
   旧 WP を必須に戻すことはしない。
5. rollback 後にも deny/tombstone overlay、最新の停止・却下・取り下げ、特典消込済み状態を両 reader
   に適用し、非公開データを復活させない。

## T01--T56 対応表

| ID | 実装/証跡 | 状態 | 残る確認 |
| --- | --- | --- | --- |
| T01 | v1.1 QR/entry RPC、既存 entry fixture | 実行済 PASS | 既存 WP 店の実画面は未試験 |
| T02 | canonical provision、通常登録→審査一覧→承認、session、growth/widget、公開 projection | 実行済 PASS | 実HTTP/Chromium は未試験 |
| T03 | therapist selection と公開 snapshot | 実行済 PASS | 実写真/同名データはユーザー前提待ち |
| T04 | ownership/expiry/membership RPC reject | 実行済 PASS | 実 Auth 失効イベントは未試験 |
| T05 | review entry v2 acceptance | 実行済 PASS / 隔離 HTTP context 200 | Next→PostgREST の context 実HTTPは確認済み。実入力・送信 Chromium はCDP/proxy環境制約で未試験。 |
| T06 | draft/confirmation contract | 実行済 PASS | 長文ブラウザ操作・送信/replay Chromium はCDP/proxy環境制約で未試験。 |
| T07 | idempotency/race SQL | 実行済 PASS | 実ネットワーク中断は未試験 |
| T08 | invite/permanent-link SQL | 実行済 PASS | 実 QR scan は未試験 |
| T09 | replay/recovery contract | 実行済 PASS | browser abort は未試験 |
| T10 | revision expected-version RPC | 実行済 PASS | 運営画面実操作は未試験 |
| T11 | withdrawal/public projection | 実行済 PASS | HTTP/JSON-LD 観測は未試験 |
| T12 | redemption race fixture | 実行済 PASS | 実担当者並列は未試験 |
| T13 | redemption expiry/state fixture | 実行済 PASS | 実時計境界は未試験 |
| T14 | redemption idempotency fixture | 実行済 PASS | 実HTTP再送は未試験 |
| T15 | private controls SQL | 実行済 PASS | production log/GA 監査はユーザー前提待ち |
| T16 | reply moderation/ownership | 実行済 PASS | ブラウザ画面は未試験 |
| T17 | aggregate/source isolation | 実行済 PASS | production backfill はユーザー前提待ち |
| T18 | canonical/legacy/manager role matrix | 実行済 PASS | 実 Auth revoke は未試験 |
| T19 | explicit legacy mapping candidate/bind/map fixture | 実行済 PASS | production mapping dry-run はユーザー前提待ち |
| T20 | failure contracts | 実行済 PASS | 実 service outage は未試験 |
| T21 | responsive UI source/static contracts | 未試験 | 320--1440px Chromium・a11y が必要 |
| T22 | canonical readers/SEO implementation、UUID人物プロフィール/写真proxy/店舗詳細リンク/sitemap | 未試験 | preview HTTP canonical/404/robots/sitemap/ProfilePage JSON-LD |
| T23 | CRUD/stop/restore/listing/POP/widget fixtures | 実行済 PASS | 実 dashboard 操作は未試験 |
| T24 | deny/tombstone rollback design + SQL controls | 実行済 PASS | flag rollback preview は未試験 |
| T25 | 手順のみ | ユーザー前提待ち | production 非破壊 smoke の承認 |
| T26 | context/version check | 実行済 PASS | 実HTTP conflict は未試験 |
| T27 | stop state/provisioning reject | 実行済 PASS | 既発行コードの production 観測待ち |
| T28 | retry lifetime/secret controls | 実行済 PASS | 実時計/HTTPは未試験 |
| T29 | answer model no star coercion | 実行済 PASS | 入力 UI は未試験 |
| T30 | therapist registration contract、active所属・使用許諾済写真・公開店舗だけを返すUUIDプロフィールprojection | 実行済 PASS | 実画像権利確認とChromiumプロフィール表示はユーザー前提待ち |
| T31 | public labels/offer isolation | 実行済 PASS | 公開HTML確認は未試験 |
| T32 | gateway/optional therapist contract | 実行済 PASS | 実画面通過は未試験 |
| T33 | message template/offer guard | 実行済 PASS | 全文面ブラウザ確認は未試験 |
| T34 | cross-shop RPC denial | 実行済 PASS | 実 session は未試験 |
| T35 | copy-only audit contract | 実行済 PASS | OS clipboard 実機は未試験 |
| T36 | permanent handle reuse | 実行済 PASS | 実URL繰返しは未試験 |
| T37 | latest state at posting | 実行済 PASS | 実時系列 UI は未試験 |
| T38 | widget aggregate denominator | 実行済 PASS | 公開 widget HTTP は未試験 |
| T39 | widget cursor/withdrawal SQL | 実行済 PASS | embed browser は未試験 |
| T40 | widget failure contract | 実行済 PASS | DB/API/cache 障害注入は未試験 |
| T41 | common public projection | 実行済 PASS | all-surface HTTP 比較は未試験 |
| T42 | embed/RPC privacy contract | 実行済 PASS | third-party cookie browser は未試験 |
| T43 | owner/manager growth/widget/POP flow、店舗別の匿名日次「計測できた閲覧/公式LINEクリック」報告（予約・来店・売上とは分離） | 実装済・隔離PG PASS | 7/28/90日比較は昨日までの確定期間（前期比較は最大180日）、今日は暫定表示。server署名・店舗/日/session scopeの短期contextで同一eventを除外し、同一店舗/日/sessionは最大2件。context発行は session 短期上限と信頼 proxy IP のHMACによる粗い新規session上限を併用する（raw IPを保持せず、完全防止・本人確認ではない）。期限行はfinalizer/pruner成功時だけ削除され、失敗・未実行は監視対象。独立したアクセス計測health collector完了時だけ0、partial/missing/unknownは比較不可。WordPress更新job成功はcomplete根拠にしない。本文/編集控え/特典コードを保持しない。独立collector設定、実Auth画面・Chromium/HTTPは環境接続待ち。 |
| T44 | transient credential controls | 実行済 PASS | 実ブラウザ cookie lifecycle は未試験 |
| T45 | GET side-effect/idempotency controls | 実行済 PASS | link-preview 実HTTPは未試験 |
| T46 | neutral fraud controls | 実行済 PASS | 実IP/複数browserは未試験 |
| T47 | private-control SQL | 実行済 PASS | production analytics/log audit 待ち |
| T48 | neutral review-flag controls | 実行済 PASS | retention/key rotation 実運用待ち |
| T49 | correction intake/moderation | 実行済 PASS | UI/HTTP は未試験 |
| T50 | community の審査・自己取り下げ、API/画面の未処理・履歴ページ切替、最新hide event/revisionに束縛した異議 | 実装済・隔離PG PASS | fresh PGで本人撤回済み行の除外、51件超/1000件超履歴、古い異議の再審査拒否を再実行。既存未解決異議は現行の対象revision/eventを証明できる時だけ束縛し、証明不能なものは監査付き要確認へ移して運営がdismiss可能。通報は自動非公開にせず運営の再審査へ戻す。 |
| T51 | reaction expiry/concurrency | 実行済 PASS | UI/HTTP は未試験 |
| T52 | read-only candidate mechanism | ユーザー前提待ち | 権利・正規ID・実画像の確認 |
| T53 | R1--R4 ranking | 実行済 PASS | hub・通常地域とも全候補をページング前に、地域関係→料金/営業時間/アクセス/公式連絡・予約の180日以内確認数→各店の最古有効確認日が新しい順→正規化店名→正規app_shop_id UUID（旧データは安定WP ID）で安定比較。公式サイト/LINE等のOR候補は各々を先に有効期限判定し、古い予約証跡が新しい公式確認を隠さない。PRは別枠。2ページ超の逆順fixture、料金のみ/予約先のみ、同名UUID同点を静的契約で確認。 |
| T54 | B01--B10 config/slot safety | 実行済 PASS | Library 素材・各提供条件/実在先の承認 |
| T55 | WP-free lifecycle、area switch、provision、registration review、legacy one-to-one mapping fixture | 実行済 PASS | 写真/投稿を含む Chromium 完走、production legacy差分確認 |
| T56 | managed CRUD/direct edit/revision/restore fixtures | 実行済 PASS | production 非変更確認と画面通過 |

## B01--B10 の公開条件

すべての banner は `headless/lib/eskomi-banner-v2.ts` にコピーと destination を記録し、
`EskomiBannerV2Slot` は `assetStatus === "ready"`、ローカル承認済み `imageSrc`、実在する `href` の
三つが揃うまで `null` を返す。現在は Library 素材のネットワーク許可待ちであり、画像を取得・生成・
公開していない。B03/B05/B06/B07/B10 は提供条件又は実在リンクが未確認のため、素材到着だけで公開しては
ならない。B01/B02/B04/B08/B09 の配置・CTA は承認設計に記録済みだが、実素材/previewで PC-SP・頻度・
リンク先を確認するまで非表示を維持する。入力画面には営業 banner を置かない。
