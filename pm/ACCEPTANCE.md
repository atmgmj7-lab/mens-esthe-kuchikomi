# Acceptance Checks

更新日: 2026-07-11

## Q-00

| 条件 | 状態 |
|---|---|
| 公開中Next.jsを対象に品質監査が定義されている | done |
| WordPressテーマ改善前提が削除されている | done |
| WordPressを一時的なデータ供給元として位置付けている | done |
| Supabase存在確認をSecret非表示で整理している | done |
| Q-01〜Q-07へ分解されている | done |
| 完全移行工程が整理されている | done |

## Q-01

| 条件 | 状態 |
|---|---|
| 他地域名が本文、FAQ、title、description、schemaに混入しない | pending |
| 地域テンプレートの流用を検知するテストがある | pending |
| 地域ごとの固有語句が確認できる | pending |

## Q-02

| 条件 | 状態 |
|---|---|
| 未確認料金を0円と表示しない | pending |
| null、空文字、0、不正値のテストがある | pending |
| 一覧と詳細で表示ルールが一致する | pending |

## Q-03

| 条件 | 状態 |
|---|---|
| 口コミ0件で星評価を表示しない | pending |
| 根拠のない固定評価を表示しない | pending |
| 画面とJSON-LDが一致する | pending |
| 広告と自然順位が区別される | pending |

## Q-04

| 条件 | 状態 |
|---|---|
| 口コミと編集部コメントがデータ上・表示上で区別される | pending |
| 編集部コメントを口コミ件数に含めない | pending |
| AI生成文をユーザー口コミとして表示しない | pending |

## Q-06

| 条件 | 状態 |
|---|---|
| 全公開ページに適切なtitleとdescriptionがある | pending |
| canonicalが自己参照または意図した正規URLを指す | pending |
| 不要ページがnoindexになる | pending |
| WordPressとの重複URLが整理される | pending |

## Q-07

| 条件 | 状態 |
|---|---|
| 口コミ0件ではAggregateRatingを出力しない | done |
| FAQが存在しないページではFAQPageを出力しない | done |
| 必須項目が不足するschemaを出力しない | done |
| 画面に存在しない情報をschemaだけに出さない | done |

## 移行

| 条件 | 状態 |
|---|---|
| 移行対象と対象外が確定している | pending |
| WordPress IDと新IDの対応方法がある | pending |
| 試験移行とロールバック手順がある | pending |
| WordPress停止前に差分同期方法がある | pending |

## 共通

| 条件 | 状態 |
|---|---|
| 本番DB操作なし | done |
| 本番デプロイなし | done |
| Secret実値表示なし | done |
| git pushなし | done |

## 2026-07-11 Q-01 受け入れ条件
- エリア別の禁止地名チェックが追加されていること。
- 新大阪・堺・堺東などで他エリアの地名を含むWP本文/FAQがそのまま出ないこと。
- 店舗詳細と店舗メタtitleに日本橋固定文言が残っていないこと。
- `npm run test:area-integrity` で再発検知できること。

### 2026-07-11 Q-01 検証結果
- lint / typecheck / test / build が成功。
- `test:area-integrity` により、固定の日本橋文言とエリア安全化処理の再発検知を確認。

## 2026-07-11 Q-02 受け入れ条件
- 代表料金未確認時に0円を表示しないこと。
- `0円〜` が生成されないこと。
- 空文字・null・undefined・不正値を確認済み価格として扱わないこと。
- 明示的な無料項目は fee/context 系で `free` として扱えること。
- 一覧、ランキング、Hub料金表、店舗詳細で料金表示ルールが共通化されていること。
- JSON-LDの価格出力は確認済み代表料金がある場合だけであること。
- 安い順ソートで未確認料金が先頭に来ないこと。

### 2026-07-11 Q-02 検証結果
- lint / typecheck / test / build が成功。
- `test:price-normalization` により、空文字、0、0円、無料、未確認、不正値、配列最小値、schema条件の再発検知を確認。
- `.next/server/app` の限定検索で、不正な0円表示・0円schemaはヒットなし。

## 2026-07-11 Q-03 受け入れ条件
- 口コミ0件で星評価・評価数値を表示しないこと。
- 口コミ1〜2件で総合評価・AggregateRatingを出力しないこと。
- 実口コミ3件以上かつ有効な集計根拠がある場合だけ総合評価を表示できること。
- `review_star` の固定値を公開評価表示に使わないこと。
- PR店舗を自然順位TOPから除外し、PR店舗へ自然順位番号を付けないこと。
- metadataに根拠のない順位・評価表現を追加しないこと。

### 2026-07-11 Q-03 検証結果
- lint / typecheck / test / build が成功。
- `test:review-rating` により、0件、1件、2件、3件、編集部コメント、未承認口コミ、不正評価値、固定4.0、PR自然順位除外を確認。
- `.next/server/app` の限定検索で、不正な固定評価・0件評価・AggregateRating出力はヒットなし。

## 2026-07-11 Q-04 受け入れ条件

- ユーザー口コミは content-provenance の明示条件を満たすものだけ。
- 編集部コメント、店舗紹介、店舗提供情報、AI生成経路、PR文章、unknownを口コミ件数・評価・schemaへ含めない。
- AreaLatestReviewsは確認済みユーザー口コミのみ、または空状態。
- ACF手入力件数はreferenceCountのみ。
- lint / typecheck / test / build が成功すること。

## Q-05 PR・広告枠表記整理

- [x] PR/広告判定が1箇所に集約されている
- [x] PR/広告店舗が自然順位番号を受けない
- [x] PR/広告店舗が別枠表示される
- [x] PR/広告の公式外部リンクだけ sponsored/nofollow が付く
- [x] ItemList schema からPR店舗が除外される
- [ ] PR表記文言は人間確認済み

## UI-FINAL-01 完成形UI Phase 1/2

- [x] デザインと既存コードの対応表がある
- [x] トップの画像アコーディオンが残っている
- [x] 大阪・京都・兵庫・奈良・滋賀・和歌山の画像が残っている
- [x] hover/focus/reduced motionのCSSがある
- [x] mobileは画像付きカードとして表示する
- [x] 日本橋画像付き重点エリア特集が残っている
- [x] デザインHTMLのDB注記を公開画面に出していない
- [x] DASH-DESIGN-00をBLOCKER登録した

## 完成形UI Phase 1-5 受け入れメモ 2026-07-12

- トップ、エリア詳細、店舗詳細、共通ヘッダー/フッターの完成形UI移行はローカル検証済み。
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` 成功。
- Playwright横断確認成功。
- 公開画面に `DB:` 注記なし。
- 口コミ、編集部コメント、店舗提供情報、PR情報の分離注記を表示。
- 未確認料金は問い合わせ文言で表示し、`0円` 表示を避ける既存保全テストが成功。
- 本番反映は未実行。

## 2026-07-13 Q-07 FAQ / schema出力条件確認

- `faqJsonLd([])` と不正FAQ行は `null` を返し、FAQPage JSON-LDを出力しない。
- 地域HubページのFAQPage JSON-LDは `faqJsonLd` がschemaを返す場合だけ出力する。
- 地域HubのFAQ表示セクションはFAQ行がない場合は描画しない。
- 店舗詳細のLocalBusiness JSON-LDは、ACFの口コミ件数・固定評価・編集部コメントだけでは `aggregateRating` / `review` を出力しない。
- `npm run test:schema-output` を追加し、`npm test` に接続済み。
