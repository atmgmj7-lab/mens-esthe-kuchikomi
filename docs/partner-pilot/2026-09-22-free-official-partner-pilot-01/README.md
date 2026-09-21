# ESKOMI FREE OFFICIAL PARTNER PILOT 01

作成日: 2026-09-22
状態: `P1_WORKSPACES_PROVISIONED_NORMAL_LISTING`（P1のWorkspace作成済み。Partner有効化・外部操作は未実施）

この台帳は、最初の Free Official Partner パイロットの**運用順**を決めるための内部資料です。店舗の優劣・公開順位・掲載順位を意味しません。P1の2件はWorkspaceのみ作成済みで、招待、会員作成、Partner状態遷移、campaign作成、連絡、公開、デプロイは個別承認まで行いません。

## 選定根拠と確認範囲

- 既存の `docs/data-clean/priority5/primary-area-backfill-preview-2026-08-16.json` から、新大阪の `VERIFIED_EXACT` 3件と堺東の `VERIFIED_EXACT` 6件を母集団にしました。これらは WordPress のArea関係とprimary-area根拠が整合した既存確認済みレコードです。
- 10候補だけについて、2026-09-22に公開WordPress RESTの既存レコードを読み取りました。全件でEskomi canonical、公式URL、LINE導線を確認し、公式根拠のレビュー済み記録がある店舗をP1/P2に優先しました。公式サイト全体の再crawlはしていません。
- P1の `WP 766`（Mrs.L’Amant）と `WP 725`（BAMBI SPA）は、Production evidenceによりWorkspace provisioning済みです。いずれも現在は `normal_listing` であり、membership、Partner有効化、campaign、招待、outreachは未実施です。残り候補に対する追加writeは、この台帳では行いません。
- 「連絡可」は、公開中の公式サイト/LINE導線が記録されている意味です。相手方の担当者性・配信可否・営業継続を推測していません。送信を許可する別タスクで、P1の2件だけに最終到達性を確認します。

## Primary Pilot 5

| Pilot order | Shop | Area | WP shop ID | Official URL | Contact path | LINE | Website CTA possible | QR possible | Readiness | Pilot value | Risks |
|---|---|---|---:|---|---|---|---|---|---|---|---|
| P1-1 | Mrs.L’Amant（ミセスラマン） | 新大阪 | 766 | https://mrs-laman-esthe.com/ | 公式サイト / LINE / 電話 / Web予約 | Yes | Yes — 公式サイトとWeb予約導線あり。導入同意後にのみ提供 | Yes — counter QR | `WORKSPACE_PROVISIONED_NORMAL_LISTING` | 新大阪、LINE・Web予約の両方、公式/営業時間/予約根拠が9月レビュー済み | 連絡先担当者・サイト設置権限、Partner有効化は未確認/未実施 |
| P1-2 | BAMBI SPA（バンビスパ） | 堺東 | 725 | https://bambispa.com/ | 公式サイト / LINE / 電話 | Yes | Yes — 公式サイトあり。設置可否は承認後確認 | Yes — counter QR | `WORKSPACE_PROVISIONED_NORMAL_LISTING` | 堺東、LINE中心の取得導線、営業時間根拠が9月レビュー済み | 予約導線の詳細とサイト設置権限、Partner有効化は未確認/未実施 |
| P2-1 | Preseine 堺店（プリセーヌ） | 堺東 | 1176 | https://www.esthe-sakai.jp/ | 公式サイト / LINE / 電話 | Yes | Yes — 公式サイトあり。設置可否は承認後確認 | Yes — counter QR | `READY_FOR_APPROVAL` | 堺東、予約・料金根拠が9月レビュー済み。P1で得たQR/LINE運用を比較できる | 連絡先担当者とサイト設置権限は未確認 |
| P2-2 | Mrs.Emmy（ミセスエミー） | 新大阪 | 769 | https://salon-emmy.com/ | 公式サイト / LINE / 電話 | Yes | Yes — 公式サイトあり。設置可否は承認後確認 | Yes — counter QR | `READY_FOR_APPROVAL` | 新大阪、LINEと電話予約の運用比較、営業時間/アクセス根拠が9月レビュー済み | 公式URL自体の根拠記録と担当者性は送信前に確認 |
| P2-3 | LEON SPA（レオンスパ） | 堺東 | 731 | https://leonspa.net/ | 公式サイト / LINE / 電話 | Yes | Yes — 公式サイトあり。設置可否は承認後確認 | Yes — counter QR | `READY_FOR_APPROVAL` | 堺東、完全予約制、営業時間/予約根拠が9月レビュー済み | 連絡先担当者とサイト設置権限は未確認 |

## Expansion 5

| Pilot order | Shop | Area | WP shop ID | Official URL | Contact path | LINE | Website CTA possible | QR possible | Readiness | Pilot value | Risks |
|---|---|---|---:|---|---|---|---|---|---|---|---|
| P3-1 | Venus（ヴィーナス） | 新大阪 | 773 | https://venusesthe.com/ | 公式サイト / LINE / 電話 | Yes | Yes — 公式サイトあり。設置可否は承認後確認 | Yes — counter QR | `READY_FOR_APPROVAL` | 新大阪、完全予約制、P1/P2と異なる運用パターンの比較 | 公式根拠のレビュー記録と担当者性は送信前に確認 |
| P3-2 | CROWN MERMAID（クラウンマーメイド） | 堺東 | 728 | http://www.crown-mermaid.com/ | 公式サイト / LINE / 電話 | Yes | Yes — 公式サイトあり。設置可否は承認後確認 | Yes — counter QR | `READY_FOR_APPROVAL` | 堺東、完全予約制、LINE導線を比較できる | 公式根拠のレビュー記録、HTTPS可否、担当者性は送信前に確認 |
| P3-3 | Mrs.Bell＆Rose SPA（ミセスベルアンドローズスパ） | 堺東 | 727 | https://bellrose-osaka.com/ | 公式サイト / LINE / 電話 | Yes | Yes — 公式サイトあり。設置可否は承認後確認 | Yes — counter QR | `READY_FOR_APPROVAL` | 堺東、完全予約制、P2の店舗群と連絡・利用定着を比較できる | 公式根拠のレビュー記録と担当者性は送信前に確認 |
| P3-4 | Oil Madrid（オイルマドリード） | 堺東 | 733 | https://oilmadrid.com/ | 公式サイト / LINE / 電話 | Yes | Yes — 公式サイトあり。設置可否は承認後確認 | Yes — counter QR | `READY_FOR_APPROVAL` | 堺東、完全予約制、営業時間根拠が9月レビュー済み | 連絡先担当者とサイト設置権限は未確認 |
| P3-5 | SPALOT.Mrs 新大阪店（スパロットミセス） | 新大阪 | 712 | https://spalot-mrs.com/ | 公式サイト / LINE / 電話 | Yes | Yes — 公式サイトあり。設置可否は承認後確認 | Yes — counter QR | `EXPANSION_ONLY` | 新大阪、電話中心予約、料金/予約/営業時間根拠あり。導線の幅を広げられる | Area relationは単一leafだが、既存primary-area backfillの`VERIFIED_EXACT`対象外。P3前にcanonical/Areaを再確認 |

## Hold / excluded

| Shop | WP shop ID | Reason | Re-entry condition |
|---|---:|---|---|
| Mrs.Gold Tiara 新大阪店（ミセスゴールドティアラ） | 647 | 既存データで新大阪と京橋の複数leaf Area関係があり、同ブランドの新大阪系レコードとの店舗単位識別が曖昧 | canonical WordPress shop ID、実店舗/運営主体、公式連絡導線を一件ずつ照合してから再評価 |

「HOLD」は店舗品質・レビュー数・有料関係の評価ではありません。重複や誤帰属を避けるための識別保留です。

## Pilot waves

| Wave | Shops | Start gate | Verify | Exit gate |
|---|---|---|---|---|
| P1 | P1-1, P1-2 | Workspace provisioning済み。outreach、招待、membership、Partner有効化、campaign作成はそれぞれ明示承認 | invitation/login、membership acceptance、Dashboard、QR/URL、最初の実レビュー、AI Assist、moderation、campaign attribution、任意Widget | Critical/Important production issue = 0。wrong-shop attribution、secret exposure、review loss、incorrect publication = 0 |
| P2 | P2-1〜P2-3 | P1 exit gateを満たす | P1と同じ確認を3店舗で再現。LINE/QR/Website CTAの採用差を記録 | Critical/Important production issue = 0、P1の学びをPackへ反映済み |
| P3 | Expansion 5 | 最初の5店舗から十分な運用証拠が得られ、ユーザーが追加承認 | optional Widgetと異なる予約/導線パターンを含む定着確認 | 全件を同時展開せず、P2の品質を維持できること |

## Onboarding flow

```text
Eskomi contacts shop
  -> existing Eskomi shop page shown
  -> "この店舗は御社で合っていますか？"
  -> Free Official Partner invitation
  -> magic-link login
  -> membership acceptance
  -> Partner Dashboard
  -> shop confirms known information (no re-entry)
  -> Review Growth Kit
  -> QR / LINE / optional Website CTA or Widget
  -> customer review (AI Assist optional)
  -> customer final confirmation
  -> pending moderation
  -> Eskomi moderation
  -> published review
  -> campaign and review metrics
```

## Pilot success and stop criteria

### Healthy

- Partner isolation、login、Dashboardが正常に動作する。
- QR/linkが正しい店舗に解決し、実レビューがpending moderationまで到達する。
- moderation / publish / attributionが正しい。
- AI Assistはrating・tag・sentimentを変更せず、障害時も投稿できる。
- Widgetはprivate dataを出さず、SEO regressionがない。

### Stop expansion immediately

- auth/workspace isolation issue、wrong-shop attribution、secret exposure、review loss、incorrect publication。
- Critical または Important のProduction regression。

Minorなコピー/UI課題は、onboardingを妨げない限りP1の停止理由にしません。

## Measurement plan

ショップ・キャンペーン単位で、次だけを集計します。analyticsに生のレビュー本文、連絡先、顧客識別子を入れません。

- shops contacted、invite accepted、login success、onboarding complete
- QR accessed、review URL copied、LINE copy used（計測可能な場合）、Widget installed
- campaign open、review form view、AI Assist used、review submitted
- moderation approved、published、campaign conversion
- Shop -> LINE/Web booking CTR（取得可能な場合）、human-review rate、AI calls/review、AI cost/review

## Pack source

店舗に渡す文章・運用手順・素材仕様は [launch-pack.md](launch-pack.md) にあります。`[[...]]` は、承認後の正しい店舗/キャンペーンに差し替える運用プレースホルダーです。P1のPartner有効化とcampaign作成前には配信・公開しません。Widgetの任意設置と差し替え点は [widget-installation.md](widget-installation.md) を正本とします。

## Creative asset status

- 「Eskomi公式パートナー募集」バナーは `APPROVED_FOR_PILOT`。Pilot募集ページHero、店舗向け1枚説明資料の表紙、営業資料の冒頭、メール遷移先LPに使用します。LINE / DMのメイン画像には、縦長・短文に最適化した別素材を使います。
- 店舗HP用口コミCTAバナーは `APPROVED`。店舗別のreview URLを差し込んだ配布版は、URL照合完了後にのみ利用します。
- 店頭口コミQRカードは `APPROVED_PENDING_TOKEN_INSERTION`。P1 campaign tokenとreview URLを差し込むまでは外部配布しません。
- 全assetの用途、personalization、未完成素材、次アクションは [creative-manifest.md](creative-manifest.md) を正本とします。ここにない画像・派生版を送信や公開に使いません。
