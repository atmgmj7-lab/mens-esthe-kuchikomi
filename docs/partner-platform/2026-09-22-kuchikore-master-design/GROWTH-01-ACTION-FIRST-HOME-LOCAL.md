# GROWTH-01 — Action-first Partner Home (local implementation)

状態: local implementation / local validation only。Production operationは含まない。

## 実装した範囲

- 既存の認可済みPartner identityとReview Growth Kitを入力にする、読み取り専用のHome view-modelを追加した。
- Homeを「店舗コンテキスト → 今やること → 口コミ状況 → 口コミを集める → 最近の動き」の順に再構成した。
- 正常な口コミ導線には一つのprimary actionを表示し、Campaign未準備時はURL・QR・KPIを捏造せず、理由を明示する。
- submitted / pending / published は既存Native Review集計のみを、`source=native_review`、`period=all_time`、`grain=workspace_shop` として投影する。率・比較期間・最近の活動は新設していない。
- Server projectionの待機中は、未取得・0件と混同しない読み込み状態を表示する。

## Reuse / boundary

- **REUSE:** Partner Auth、membership/workspace照合、canonical shop identity、Review Growth Kit、QR、LINE、Web CTA、Widget、Native Review metrics。
- **EXTEND:** Home用の安全なview-model、Action Required表示、available/unavailable/real zeroのUI分岐。
- **No schema change:** migration、RPC、RLS、grant、table、campaign、membership、Partner stateは変更していない。
- **No render side effect:** GET/renderは既存データのprojectionのみで、campaign作成、membership/state変更、WordPress/Supabase write、AI、通知・招待送信を実行しない。

## Next boundary

次は別承認・別taskの `GROWTH-02 — Review Growth Center readiness`。本taskから開始しない。

## Competitor evidence boundary

補助監査で確認された競合のKPI階層は、既存の「今やること → 口コミ状況」順のみの参考とした。競合mobileの横overflow、Review Inbox、Monthly Report、Widgetの推測、詳細role、通知は本taskへ取り込んでいない。既存のモバイルno-horizontal-overflow契約とEskomi Widget E2E contractを維持する。
