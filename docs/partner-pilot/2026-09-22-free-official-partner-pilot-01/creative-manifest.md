# Free Official Partner Pilot — Creative Asset Manifest

作成日: 2026-09-22
状態: Pilot asset運用の正本

このmanifestは、承認状態、用途、店舗別差し込みの要否、次アクションを分けて管理します。`APPROVED` は基本クリエイティブの承認であり、店舗固有のreview URL / QR / shop名を含む外部配布版の完成を意味しません。

## Asset registry

| Asset name | Status | Intended use | Required personalization | Owner / next action | Notes |
|---|---|---|---|---|---|
| Eskomi logo | `AVAILABLE_REPOSITORY_SOURCE` | Pilot資料、CTA、QRカード、説明資料のブランド表記 | 不要。縦横比・色を変えない | Creative owner: 既存SVGを使用 | Headless: `headless/public/images/eskomi-logo.svg`。WordPress theme: `assets/img/eskomi-logo.svg` |
| Eskomi公式パートナー募集バナー | `APPROVED_FOR_PILOT` | Pilot募集ページHero、店舗向け1枚説明資料表紙、営業資料冒頭、メール遷移先LP | 不要 | Creative owner: 承認済み外部マスターのファイル名・保管場所・版をasset registryへ登録 | LINE / DMのメイン画像には別素材を推奨。リポジトリに未登録のため、推測したパスや代替画像を作らない |
| 店舗画像準備中placeholder | `AVAILABLE_REPOSITORY_SOURCE` | 店舗画像未設定時の公開fallback | 店舗名を埋め込まない | Product owner: 既存fallbackを維持 | `headless/public/images/eskomi-shop-fallback.svg`。Partner募集用の訴求画像には使わない |
| 店舗HP用口コミCTAバナー | `APPROVED` | 店舗公式サイト上の中立的な口コミ導線 | P1 review URL、対象shop名、必要時に店舗ロゴ | Partner operations: campaign発行後にP1完成版を作成し、URL照合を実施 | 外部配布版は `APPROVED_PENDING_TOKEN_INSERTION` として扱う。Widgetは任意で、CTA導入を必須にしない |
| 店頭口コミQRカード | `APPROVED_PENDING_TOKEN_INSERTION` | 受付・会計後に実利用者へ渡す中立的な口コミ案内 | P1 campaign token、review URL、対象shop名、QR | Partner operations: token差し込み、実機読み取り、対象店舗照合 | 差し込み前・読み取り未検証の版は外部配布禁止 |
| Official Partner badge | `MISSING_PRIORITY_1` | Dashboard、説明資料、将来の承認済みPartner表示 | Partner statusと利用箇所に応じた表示ルール | Creative owner: badgeを制作。Product owner: 表示条件を確認 | 公開ページへの実装・表示はこのtaskの対象外 |
| 店舗向け1枚説明資料 | `MISSING_PRIORITY_2` | 初回説明、承認後の補足資料 | 対象shop名・Eskomi店舗ページURL・相談先 | Creative owner: approved bannerを表紙に用いて1枚資料を制作 | 原稿は `launch-pack.md` のBを正本にする |
| LINE / DM用案内画像 | `MISSING_PRIORITY_3` | LINE / DMの初回・follow-up案内 | 必要時にshop名または店舗ページURL | Creative owner: 短文・縦長の専用素材を制作 | 募集バナーをLINE / DMのメイン画像として流用しない |
| 店頭QRカード本番差し込み版 | `MISSING_PRIORITY_4` | P1の実配布カード | P1 token、review URL、shop名、QR | Partner operations: token発行・URL/QR照合後に完成版を作成 | 基本デザインの承認とは別に、店舗固有値の誤差し込み防止確認が必要 |
| 店舗HP用CTA本番差し込み版 | `MISSING_PRIORITY_5` | P1対象店舗の公式サイト用CTA | P1 review URL、shop名、設置先のサイズ | Partner operations: token発行・URL照合後に完成版を作成 | 実装/設置は店舗の同意後であり、このtaskでは行わない |

## Missing-asset priority

1. Official Partner badge
2. 店舗向け1枚説明資料
3. LINE / DM用案内画像
4. 店頭QRカード本番差し込み版
5. 店舗HP用CTA本番差し込み版

## Placeholder and personalization control

### Completion rule

P1のQRカードとCTAバナーは、P1 campaign tokenから生成したreview URLを差し込んだ時点でのみ完成候補です。token、review URL、QR、shop名のうち一つでも未差し込み・未照合なら、完成版ではありません。

### Wrong-shop prevention

1. `wp_shop_id`、shop名、canonical URL、campaign tokenを対象ごとに一つの作業記録へ固定する。
2. tokenから生成したreview URLが、その同じcanonical shopへ解決することを確認する。
3. QRを実機で読み取り、CTAリンクと同じreview URLへ到達することを確認する。
4. 完成画像のファイル名にshop slugと作成日を記録し、確認者による二者照合を残す。

### External-distribution prohibition

review URL / QR / shop名の差し替え前、または上記照合前のQRカード・CTAバナーは、メール、LINE/DM、店舗サイト、印刷物、公開LPを含む外部チャネルへ配布しません。

## Scope boundary

このmanifestはdocsとasset運用の整理だけです。asset生成、公開ページ実装、店舗サイト設置、token発行、招待送信、outreach送信、Production DB write、WordPress write、deploy、push、secret/env変更は含みません。
