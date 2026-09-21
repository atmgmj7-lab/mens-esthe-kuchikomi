# クチコレ 機能マトリクス

この表は認証済みUIから観測できた範囲の機能構造であり、実装内部や非表示権限を推測しない。

| FEATURE / SCREEN | PURPOSE / USER PROBLEM | PRIMARY / SECONDARY ACTION | INPUT → OUTPUT | STEPS | GOOD UX | BAD UX / MOBILE | ESKOMI VALUE | EVIDENCE |
|---|---|---|---|---:|---|---|---|---|
| Dashboard | 現状把握を一画面で行う | 期間変更 / 詳細へ遷移 | period → KPI・内訳 | 1 | 上段KPI→詳細の順 | MEO/順位情報が主役で高密度 | Action Required中心なら高い | observed desktop |
| 診断履歴 | 時系列で改善点を把握 | 詳細を見る / page切替 | date → category score | 2 | 日付カードとカテゴリ内訳 | 画面に長い履歴が連続 | Reportsに限定してP2 | observed desktop |
| Survey list | 取得assetを管理 | preview / QR / result | survey → status・entry points | 2 | 行アクションが明確 | 編集・削除も近く誤操作余地 | Campaign asset一覧に転用 | observed desktop |
| Survey builder | 回答からreview draftを生成 | 設定 / preview / save | questions+prompt → survey | 3+ | previewが同じ画面 | 高度設定が初回ユーザーへ露出 | PilotではSKIP | observed, no write |
| AI hearing | AI作成の前提を集める | guided answer → create | objective+benefit → generated survey | 4+ | 質問数や目的を明文化 | creation前に多入力 | P2 research only | observed, no input |
| Customer preview | 回答者を開始へ導く | language / start | locale → survey flow | 1 | 一つのCTA・多言語 | loading state以外は未観測 | Low-friction reviewに参考 | partial; no submit |
| Review inbox | 口コミ状態を処理 | filter/search / reply setting | status+locale → selected review | 2 | 状態filterとempty state | customer contentを扱うため誤操作高 | Operator moderationへ分離 | observed desktop |
| Review distribution | rating内訳を知る | period/filter | review set → count/average | 1 | count/average/星別を併記 | arbitrary high-rating selectionは不可 | Aggregate contractをREUSE | observed desktop |
| QR / URL | 店頭・Webから取得する | QR / preview / copy | campaign → public entry URL | 1–2 | assetから行動へ直結 | token表示面は最小にすべき | Growth CenterでREUSE | observed via survey asset controls |
| LINE / email lists | 配信可能な母集団を管理 | filter / list read | recipients → status | 1 | 有効・block状態列 | PII・配信リスクが大きい | EskomiではSKIP | labels only; no rows retained |
| Monthly report | 成果を月単位で振り返る | month change / export | month → KPI delta | 1 | 前月比とempty state | MEO指標に依存 | Review/campaign reportをP2 | observed desktop |
| Store management | 公開情報を管理 | edit / group schedule | store data → profile | 2 | 情報分類が明確 | write-firstの管理画面 | WordPress確認導線へEXTEND | labels only; no edit |
| Staff management | 操作者を管理 | invite/create | user → staff record | 2 | empty stateが明瞭 | roles詳細は未観測 | Owner/manager REUSE、multi-shopはP2 | observed empty state |
| Notifications | 要対応を知らせる | open notification | event → context link | 1 | global badge | priority / read behavior未観測 | Action CenterのP1候補 | badge only; not opened |

## UX上の抽出

1. **Asset→配布→結果**を同じnavigation groupに置くと、非技術者が次の行動を選びやすい。
2. **一覧 + 状態 + preview**は取得導線の運用に有効。ただし編集・削除を同列に置かない。
3. **KPI + change + explanation**はレポートに有効。定義できない値を0で埋めない。
4. **Inboxとpublic metricsは別画面**にする。Partnerに生のcustomer dataやmoderation権限を渡さない。

## Evidence limits

- `observed desktop` は、ログイン済みChromeの通常UIで読み取り専用に
  確認した構造を意味する。実装、API、非表示権限、または書込み結果を示さない。
- `partial` / `labels only` / `badge only` は仕様根拠として不足している。
  Eskomiが採用する場合は、独自のproduct contractとfocused testを先に定義する。
- 実機幅でのモバイル操作、通知の既読副作用、スタッフ権限の詳細、顧客回答・
  返信・配信の動作は、今回の安全な監査範囲では `NOT_VERIFIED` である。
