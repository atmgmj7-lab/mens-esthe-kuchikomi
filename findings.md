# Findings & Decisions

## Requirements

- SEO目標を妨げない範囲で、WordPressからSupabaseへの移行計画を実装する。
- 今後、店舗本文・口コミ・地域説明・出典・確認日を増やしやすい構成にする。
- 公開URL、canonical、サイトマップ、現在のWordPress表示は今回変えない。
- 本番Supabase作成、本番データ投入、公開参照先切替、push、deployは行わない。

## Research Findings

- WordPress REST APIには店舗382件、地域34件、画像268件がある。
- 店舗本文と抜粋は382件すべて空で、公開口コミAPIも確認できない。
- 画像、公式URL、料金、AI要約は一部店舗のみで、地域説明は34地域すべて空だった。
- 住所欄にはアクセス案内が混在し、一次情報の出典と確認日を保存する項目がない。
- 現在のNext.jsには `ShopView` / `AreaView` があり、保存先変更時の境界として使える。
- 現在のSupabase利用はダッシュボード取得に限られ、公開店舗コンテンツ用migrationは存在しない。
- Supabaseの現在仕様では、API公開schema、権限、RLSを明示する必要がある。
- 現行の代表料金候補は `shop_price_60min`、`price_50`〜`price_150`、`basic_price` で、数値0は未確認として扱う実装になっている。
- 店舗と地域の関係はWordPressの埋め込みtermを通じて取得でき、Supabaseでは多対多関係として保持する必要がある。
- 新しい読み取り専用監査でも店舗382件、地域34件を再確認し、本文0、抜粋0、地域説明0、専用出典URL0、確認日0だった。
- 画像241件、公式URL333件、確認可能な料金252件、AI要約76件、地域なし75店舗、複数地域230店舗、公開口コミAPI未接続も再確認できた。
- 住所判定は以前の概算より厳しくし、確実な町名・番地形式だけ49件を住所候補とした。残り333件は移行時に住所とアクセスを人間確認する。

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| 全41テーブル案を一括導入せず、店舗・地域・料金・営業時間・画像・出典・口コミ・本文・取込履歴に絞る | 未使用の複雑さを避け、SEOに必要な確認済み情報を先に蓄積するため |
| 生の取込記録はprivate schema、公開読み取りはapi schemaのviewに限定する | 管理データや審査前口コミの漏えいを防ぐため |
| 公開APIは読み取りのみ、書き込みは将来のNext.jsサーバー経由とする | ブラウザへ強い権限を渡さず、口コミ審査を必須にするため |
| `CONTENT_DATA_SOURCE=wordpress` を既定にする | 基盤追加だけで公開HTMLが変わらないため |
| `supabase` 単独参照は承認フラグがない限り拒否する | 未検証データへの誤切替を防ぐため |
| 公開routeへ参照先設定をまだ接続しない | schemaとデータ一致確認前に生成HTMLを変えないため |
| 非公開店舗・地域に紐づく本文と口コミはRLSで公開しない | 子データだけが先に公開される漏えいを防ぐため |

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| ルートにplanning-with-files用の3ファイルがなかった | 今回の移行作業用に新規作成した |
| `docs/ai-skills.md` がなかった | 利用可能なSupabase skillとAGENTS.mdの安全条件を正本として進める |
| 現行の `npm test` | 11種類の品質検査がすべて成功し、変更前基準は正常だった |
| Supabase CLI | ローカルにversion 2.101.0があり、公式migration生成手順を使える |
| Supabase実DB検査 | Docker Desktopを起動し、migration初回適用、db reset、api/app/private/public/extensionsのDB lintがすべて成功した |

## Conclusion

- WordPressからSupabaseへの移行は可能で、公開表示をWordPressのまま保つ限り今回の基盤追加はSEOへ直接影響しない。
- Supabase化だけでは順位は上がらない。本文0件、地域説明0件、口コミ公開経路なし、出典0件、確認日0件を埋める運用が主なSEO施策になる。
- 今回の構成は料金・営業時間・画像・出典・本文履歴・口コミ審査を分離しているため、現在のWordPress ACFへ項目を足し続けるより拡張しやすい。
- 次の安全な工程は、本番Supabaseの所有者・費用・Secret登録場所を別承認し、3店舗だけを非公開試験投入することである。

## Resources

- Google Search Central: https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- Google LocalBusiness structured data: https://developers.google.com/search/docs/appearance/structured-data/local-business
- Google review snippet: https://developers.google.com/search/docs/appearance/structured-data/review-snippet
- Supabase database migrations: https://supabase.com/docs/guides/deployment/database-migrations
- Supabase API security: https://supabase.com/docs/guides/api/securing-your-api
- `pm/DECISIONS.md`
- `pm/CODEX_TASKS.md`
- `headless/docs/content-provenance.md`
- `docs/design/escomi-ui-data-map.md`

## Visual/Browser Findings

- 公開対象の地域ページは店舗一覧と共通部品の文字量が中心で、独自の地域ガイドと利用者口コミが少ない。
- 堺筋本町の地域ガイドは約359文字で、検索意図へ答える独自情報を今後増やす余地が大きい。
