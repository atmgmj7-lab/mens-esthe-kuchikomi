# クチコレ 認証済み画面インベントリ

監査日: 2026-09-22
方法: ユーザーがログイン済みのChrome sessionをREAD-ONLYで巡回。送信、保存、編集、削除、同期、CSV/PDF出力、配信、権限・課金操作は実行していない。

## 観測した画面

| Screen | 到達方法 | 観測した目的 / 主な構造 | Eskomiへの扱い |
|---|---|---|---|
| Dashboard | sidebar | 最新診断、期間切替、インサイトKPI、口コミ状態、流入/順位、配信先サマリーを一画面に集約 | 情報優先度だけを参考。MEO KPIは除外 |
| 診断レポート | sidebar | 日付ごとの完了カード、カテゴリ別評価、ページネーション、詳細導線 | 「時系列の診断履歴」パターンのみ参考 |
| アンケート一覧 | sidebar | 状態、回答結果、特典、作成日時、結果/preview/QRなどの行アクション | Review Acquisitionのasset一覧に転用可能 |
| アンケート新規作成 | sidebar | 質問、生成設定、preview、保存の一画面構成 | AI支援の設定を本文作成と混在させない反例として参照 |
| AIヒアリング作成 | アンケート一覧 | 目的、特典、質問数、補足を入力してAI作成へ進む | EskomiではP2以降。Pilotでは作成機能を増やさない |
| 顧客用アンケートpreview | 一覧のpreview | 多言語切替と一つの開始CTA | customer review flowの短さのみ参考 |
| 口コミ一覧 | sidebar | 期間、星分布、返信状態filter、言語filter、検索、empty state、選択詳細ペイン | Partner用は集計中心、operator用はModeration Inboxへ分離 |
| 月次レポート | sidebar | 月切替、前月比KPI、変化、空テーブル、時系列・内訳 | Eskomi Reportsの後続P2候補 |
| LINE配信先一覧 | sidebar | 宛先の状態列と一覧構造 | PIIをPartner analyticsに出さないため、Eskomiはリストを保持しない |
| 店舗管理 / ビジネス情報 | sidebar disclosure | 店舗基本情報、営業時間、サービスのまとまり | Eskomiは既存WordPress正本を確認する画面に限定 |
| スタッフ管理 | sidebar disclosure | staff list、招待/作成導線、empty state | 複数店舗・rolesの将来候補。Pilotではowner/managerを維持 |
| Sidebar / notifications | 全画面共通 | section disclosure、通知badge、account context | Eskomiのコンパクトなworkspace switcher / Action Centerに参考 |

## 監査対象外

GBP、Google Maps順位、キーワード順位、Google投稿、MEO診断、クーポン、抽選、配信実行、課金、外部integrationはEskomi実装候補にしない。画面内に見えても、ここではIA上の分離方法だけを記録する。

## Mobile evidence boundary

認証済みChromeのdesktop viewportで、navigation、画面構造、空状態、操作ラベルを確認した。競合UIの実mobile viewportでの折返し、drawer、横スクロール、タップ領域は今回実測していない。Eskomiの各GROWTH実装では、390px程度のmobile browser QAと横overflow 0を必須にする。

## 安全な証跡

- DOM / URL / 見出し・操作ラベルだけを記録した。
- customer review本文、宛先、メール、電話、token、account secret、billing情報を保存していない。
- screenshotはアカウント・customer情報の混入を避けるため保持していない。再監査が必要なら、空状態または伏せ字表示が確認できる画面だけを別承認で撮影する。
