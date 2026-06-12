# Escomi ヘッドレス WordPress 化 要件定義

作成日: 2026-06-11  
対象: mens-esthe-kuchikomi.com / Escomi  
方針: WordPress を当面 CMS として残し、表側を Next.js で段階的に再構築する

---

## 1. 目的

### 1.1 背景

現在の Escomi は WordPress + SWELL 子テーマで構築されている。店舗情報、エリア SEO、AI 更新、GitHub Actions デプロイはすでに動いている一方、表側の改善やバイブコーディングでは WordPress / SWELL / PHP / ACF / フック / CSS が絡み、変更工数と手戻りが増えやすい。

### 1.2 目標

- WordPress 管理画面の便利さを残しながら、表側を Next.js 化する。
- 既存 URL と SEO 評価をできる限り維持する。
- トップ、エリア、店舗、ブログを今と同等に表示できる状態にする。
- 将来、店舗側ログインや独自管理画面へ移れる余地を作る。
- WordPress が不要になった時点で完全 Web アプリ化できる設計にする。

### 1.3 最初の結論

最初から WordPress を捨てるのではなく、まずは「ヘッドレス WordPress + Next.js」で進める。  
理由は、現在の ACF、店舗データ、ブログ、画像、AI 更新、SEO 運用を活かせるため。

---

## 2. 現状整理

### 2.1 現在の技術構成

- CMS: WordPress
- テーマ: SWELL 親テーマ + swell_child
- 店舗データ: カスタム投稿タイプ `shop`
- エリア: タクソノミー `area`
- 店舗分類: `shop_category`
- 店舗特徴: `shop_feature`
- 入力項目: ACF
- デプロイ: GitHub Actions から Xserver へ FTP
- AI 更新: `ai-site-monitor` + Gemini + WordPress REST API
- 管理ダッシュボード: `dashboard/` の Next.js 静的書き出し

### 2.2 進捗済み

- GA4 実装済み。
- Search Console 設定済み。
- GitHub Actions 本番デプロイ済み。
- 日本橋エリアの ACF 一部投入済み。
- `taxonomy-area.php` でエリア SEO、店舗一覧、FAQ JSON-LD 出力済み。
- 店舗 AI 更新のパイロット実装済み。
- Next.js ダッシュボードは既に存在する。

### 2.3 未完・注意点

- 本番 REST API の `Missing API key.` 再発が残っている。
- `.htaccess` の Authorization ヘッダー転送設定が未完。
- 日本橋の `area_column_content` など、一部 SEO コンテンツが未入力。
- 日本橋 59 店舗の `shop_ai_summary` JSON 投入が待機中。
- `docs/ai-skills.md` は現時点で見つからない。
- Cursor Agent 調査は 2 回実行したが、どちらも空出力で失敗した。

---

## 3. 移行方針

### 3.1 採用する方針

段階的ヘッドレス化を採用する。

| 領域 | 当面 | 将来 |
|---|---|---|
| 表側 | Next.js | Next.js 継続 |
| 店舗管理 | WordPress | 店舗側専用画面へ移行可能 |
| ブログ | WordPress | 便利なら残す |
| 画像管理 | WordPress メディア | 必要なら外部ストレージ化 |
| AI 更新 | 既存 REST を整理して継続 | 独自 API 化も可能 |
| DB | WordPress DB | 必要なら専用 DB へ移行 |

### 3.2 今はやらないこと

- WordPress の即時廃止。
- 既存 URL の大幅変更。
- デザインの大幅刷新。
- 店舗側ログイン画面の同時実装。
- 全データの独自 DB 移行。

---

## 4. 対象ユーザー

### 4.1 一般ユーザー

- 関西のメンズエステ店舗を探す。
- エリア、価格、営業時間、特徴、出勤状況を確認する。
- 店舗詳細から電話、LINE、公式サイトへ移動する。

### 4.2 なりきよさん

- WordPress 管理画面で店舗データ、ブログ、SEO本文を更新する。
- AI 更新や検索流入を見ながら、ページ改善を進める。
- Cursor / Codex で表側 UI を改善する。

### 4.3 将来の店舗側ユーザー

- 自店舗の情報を更新する。
- 営業時間、料金、出勤、写真、PR文を管理する。
- 反映前に運営確認を挟める状態が望ましい。

---

## 5. 必須画面

### 5.1 トップページ `/`

現状の `front-page.php` を基準に、以下を再現する。

- ヒーロー。
- 掲載店舗数。
- エリア導線。
- エリア特集。
- 新着店舗 6 件。
- 新着コラム / 体験レポート。
- サイト説明。
- 掲載問い合わせ導線。

### 5.2 エリアページ `/area/{slug}/`

現状の `taxonomy-area.php` を基準に、以下を再現する。

- H1: `{エリア名}のメンズエステ`。
- パンくず。
- 親エリアの場合: 地図、子エリア一覧。
- エリアランキング。
- エリア特性 `area_characteristics`。
- 店舗一覧。
- コラム `area_column_content`。
- FAQ `area_faq_content`。
- FAQPage JSON-LD。
- 子エリアの場合: 同一親エリア内の他エリアリンク。

### 5.3 店舗詳細 `/shops/{slug}/` または現行パーマリンク

現状の `single-shop.php` を基準に、以下を再現する。

- 店舗名、カテゴリ、公式サイトリンク。
- メイン画像。
- 評価、キャッチ、本文。
- 電話予約、LINE予約。
- Escomi 編集部レビュー `shop_ai_summary`。
- 最新ニュース `shop_latest_news`。
- おすすめセラピスト。
- 本日の出勤・空き状況 `shop_today_*`。
- 年齢層グラフ。
- エリア平均料金との比較。
- 料金表。
- 推しポイント `recommend_text`。
- 店舗詳細データ。
- 同エリアおすすめランキング。

### 5.4 店舗一覧 `/shops/`

現状の `archive-shop.php` を基準に、以下を再現する。

- 店舗一覧。
- ページネーション。
- エリア / カテゴリ / 特徴での絞り込み余地。
- 出勤中バッジ。
- 更新日表示。

### 5.5 ブログ / コラム

WordPress の通常投稿を Next.js で表示する。

- 記事一覧。
- 記事詳細。
- カテゴリ / タグ。
- アイキャッチ。
- title / description。
- 公開日時、更新日時。
- WordPress 更新後、Next.js 側に反映する。

### 5.6 管理ダッシュボード

既存 `dashboard/` は継続利用する。ただし表側 Next.js と統合するかは別判断。

- GA4 指標。
- ページ別ランキング。
- 広告クリエイティブ分析。
- WordPress 管理画面への導線。

### 5.7 共通レイアウト

WordPress テーマで暗黙に出ている共通部品を、Next.js 側で再設計する。

- ヘッダー。
- フッター。
- グローバルナビ。
- パンくず。
- お問い合わせ導線。
- 広告枠。
- サイトロゴ。
- 共通 SEO タグ。

### 5.8 下書きプレビュー

WordPress でブログや店舗を下書き保存したとき、公開前に Next.js 側の見え方を確認できる状態を目指す。

初期検証では必須ではないが、本番公開前には必要度を判断する。

---

## 6. WordPress に残すデータ

### 6.1 投稿タイプ

- `post`: ブログ / コラム。
- `page`: 固定ページ、エリア特集など。
- `shop`: 店舗情報。
- `ai_update_log`: AI 更新履歴。

### 6.2 タクソノミー

- `area`: 親子構造あり。
- `shop_category`: 店舗カテゴリ。
- `shop_feature`: 店舗特徴。
- 通常投稿の category / tag。

### 6.3 エリア ACF

- `area_characteristics`
- `area_editorial_picks`
- `area_ranking_shops`
- `area_ranking_pickup`
- `area_column_content`
- `area_faq_content`
- `area_avg_60`
- `area_avg_90`
- `area_avg_120`
- `area_avg_150`

### 6.4 店舗 ACF / post_meta

- `shop_catch`
- `shop_tel`
- `shop_hours`
- `shop_address`
- `shop_line`
- `official_url`
- `review_star`
- `recommend_text`
- `shop_holiday`
- `shop_booking`
- `shop_parking`
- `basic_price`
- `basic_time`
- `price_50`
- `price_60`
- `price_70`
- `price_80`
- `price_90`
- `price_100`
- `price_120`
- `price_150`
- `price_180`
- `price_200`
- `price_210`
- `price_extension`
- `price_nomination`
- `price_textarea`
- `shop_price_60min`
- `area_average_60min`
- `shop_ai_summary`
- `shop_latest_news`
- `shop_today_analysis`
- `shop_availability`
- `shop_today_therapists`
- `shop_last_ai_check`
- `age_18`
- `age_20`
- `age_25`
- `age_30`
- `age_35`
- `age_40`
- `age_18_19`
- `age_20_24`
- `age_25_29`
- `age_30_34`
- `age_35_39`
- `age_40_44`
- `age_45_plus`
- `therapist_1_name`
- `therapist_1_img`
- `therapist_1_text`
- `therapist_1_url`
- `therapist_2_name`
- `therapist_2_img`
- `therapist_2_text`
- `therapist_2_url`
- `therapist_3_name`
- `therapist_3_img`
- `therapist_3_text`
- `therapist_3_url`

---

## 7. API 要件

### 7.1 基本方針

WordPress から Next.js へデータを渡す方法は、最初は WordPress REST API を基本とする。ACF や関連データの取得が複雑になる場合は WPGraphQL を検討する。

根拠:

- WordPress REST API は WordPress の投稿、固定ページ、タクソノミーなどを JSON で扱える。
- Next.js は ISR により静的表示と更新反映を両立できる。
- ただし ISR は `output: export` では使えないため、本体サイトは Node.js 実行環境で動かす必要がある。

### 7.2 必要な読み取り API

- 店舗一覧取得。
- 店舗詳細取得。
- エリア一覧取得。
- エリア詳細取得。
- エリアに属する店舗取得。
- 親エリア / 子エリア取得。
- ランキング用店舗取得。
- ブログ一覧取得。
- ブログ詳細取得。
- メディア URL 取得。
- SEO title / description 取得。
- FAQ JSON-LD 用データ取得。
- ヘッダー / フッター / ナビ情報取得。
- プレビュー用の下書き取得。

### 7.2.1 ショートコード移行要件

現在 `functions.php` には複数のショートコードがある。Next.js では PHP のショートコードはそのまま動かないため、必要なものを React コンポーネントまたは API 処理へ置き換える。

移行対象候補:

- `[shop_count]`
- `[area_shop_count]`
- `[shop_search_form]`
- `[kansai_area_list]`
- `[latest_blog_posts]`
- `[escomi_column]`
- `[area_map_nav]`
- `[pickup_shops]`
- `[auto_date]`
- `[ai_shop_summary]`
- `[shop_concept]`
- `[shop_update_date]`
- `[shop_price]`
- `[shop_today_badge]`

### 7.3 必要な更新 API

既存の `POST /wp-json/escomi/v1/update` を継続する。

用途:

- AI による店舗情報更新。
- 本日出勤。
- 空き状況。
- 年齢層。
- 料金。
- 更新ログ作成。

### 7.4 API セキュリティ要件

- 公開ページ表示に必要なデータだけ公開する。
- 管理用更新 API は認証必須。
- Application Password を使う場合、Authorization ヘッダー転送を必ず確認する。
- `Missing API key.` 再発原因を移行前に解消する。
- 将来の店舗側入力では、店舗ごとに編集可能範囲を制限する。

---

## 8. SEO 要件

### 8.1 URL 維持

原則として既存 URL を維持する。

- `/`
- `/area/{slug}/`
- `/shops/`
- `/shops/{slug}/`
- `/column/`
- `/contact/`
- 既存ブログ記事 URL

現行で店舗詳細が別パーマリンクになっている場合は、実URLを調査して確定する。

### 8.2 meta 要件

- title をページごとに出す。
- description をページごとに出す。
- エリアページは `area_characteristics` から description を生成できるようにする。
- OGP / Twitter Card を出す。
- canonical を出す。
- noindex ページを明確にする。

### 8.3 構造化データ

- エリア FAQ は FAQPage JSON-LD を維持する。
- 店舗ページは LocalBusiness 相当を追加検討する。
- パンくずは BreadcrumbList を追加検討する。

### 8.4 サイトマップ

- Next.js 側で sitemap.xml を生成する。
- WordPress 側 sitemap と重複させない。
- Search Console へ新しい sitemap を送信する。

### 8.5 移行時チェック

- 旧 URL と新 URL の一致確認。
- 404 がないこと。
- title / description の比較。
- FAQ JSON-LD の比較。
- ページ表示速度。
- Search Console の URL 検査。
- GA4 計測。

---

## 9. 表示・UI 要件

### 9.1 初期方針

最初は現デザインの再現を優先する。  
大幅刷新は、公開後に改善タスクとして進める。

### 9.2 モバイル優先

ユーザーの大半がスマホ想定のため、以下を必須とする。

- 店舗一覧はスマホで見やすくする。
- 電話 / LINE ボタンは押しやすくする。
- 料金表は横にはみ出さない。
- エリア導線は横スクロールまたは選択しやすい UI にする。
- 画像は遅延読み込みする。

### 9.3 デザイン再現対象

- ダーク基調。
- ゴールドアクセント。
- エリアランキング。
- 店舗カード。
- 出勤中バッジ。
- 更新日表示。
- 価格比較グラフ。
- 年齢層グラフ。

---

## 10. 更新反映要件

### 10.1 ブログ更新

WordPress でブログを公開したら、Next.js 側に反映されること。

推奨:

- 通常は ISR で数分以内に反映。
- 重要ページは WordPress 保存時に再生成 API を叩く。

### 10.2 店舗更新

WordPress で店舗情報を更新したら、Next.js 側に反映されること。

推奨:

- 店舗詳細は該当ページだけ再生成。
- 店舗一覧、エリアページも必要に応じて再生成。

### 10.3 AI 更新

AI 更新で `shop_today_*` が更新されたら、該当店舗と所属エリアを再生成する。

---

## 11. インフラ要件

### 11.1 推奨構成

- WordPress: 既存 Xserver 継続。
- Next.js: Vercel または Node.js 実行可能な環境。
- DNS: 本番切替時に慎重に変更。
- 画像: 初期は WordPress メディア URL を利用。

### 11.2 注意

現在の `dashboard/next.config.ts` は `output: "export"` で静的書き出し。  
本体サイトで ISR を使う場合、この方式ではなく Node.js 実行環境で動かす。

---

## 12. 開発フェーズ

### Phase 0: 要件確定

成果物:

- 本ドキュメント。
- URL 一覧。
- API 項目一覧。
- 優先ページ一覧。

### Phase 1: 技術検証

対象:

- `/area/nihonbashi/`
- 店舗詳細 1 件。
- ブログ記事 1 件。

合格条件:

- WordPress からデータ取得できる。
- 現デザインに近い表示ができる。
- title / description / FAQ JSON-LD が出る。
- 更新後に Next.js 側へ反映できる。

目安:

- 3〜5日。

### Phase 2: 最小公開版

対象:

- トップ。
- エリア一覧。
- エリア詳細。
- 店舗一覧。
- 店舗詳細。
- ブログ一覧。
- ブログ詳細。

目安:

- 2〜4週間。

### Phase 3: 本番同等版

対象:

- 既存 UI の細かい再現。
- 検索 / 絞り込み。
- ランキング。
- AI 更新反映。
- sitemap / robots。
- GA4。
- Search Console。

目安:

- 4〜8週間。

### Phase 4: 店舗側入力

対象:

- 店舗ログイン。
- 自店舗情報編集。
- 承認フロー。
- 画像アップロード。

目安:

- 追加 3〜6週間。

### Phase 5: WordPress 卒業判断

条件:

- ブログ運用が WordPress でなくても困らない。
- 店舗管理を独自画面で完結できる。
- 画像管理、権限、SEO、AI 更新が独自側で成立している。

---

## 13. 工数見積もり

| 範囲 | 目安 |
|---|---:|
| 技術検証 | 3〜5日 |
| 最小公開版 | 2〜4週間 |
| 本番同等版 | 4〜8週間 |
| 店舗側ログイン | +3〜6週間 |
| 完全 Web アプリ化 | 3〜6か月 |

### 13.1 工数が増えやすい箇所

- ACF の関連データ取得。
- エリア親子ランキング。
- SEO meta の完全一致。
- 画像 URL / サイズ最適化。
- WordPress 保存時の再生成。
- 本番 REST 認証問題。
- 既存 CSS の再現。

---

## 14. 受け入れ条件

### 14.1 技術検証の受け入れ条件

- `/area/nihonbashi/` が Next.js で表示できる。
- 店舗詳細 1 件が Next.js で表示できる。
- ブログ記事 1 件が Next.js で表示できる。
- WordPress 更新後、Next.js 側に反映できる。
- FAQ JSON-LD がソースに出る。
- 主要表示がスマホで崩れない。

### 14.2 最小公開版の受け入れ条件

- 主要 URL がすべて表示できる。
- 旧 URL からの流入を失わない。
- 404 がない。
- GA4 が動く。
- sitemap が出る。
- Search Console でエラーが出ない。
- WordPress 管理画面で通常更新できる。

---

## 15. リスク

| リスク | 影響 | 対策 |
|---|---|---|
| URL変更 | SEO低下 | 原則URL維持、必要なら301 |
| ACF取得漏れ | 表示欠落 | API項目表を作る |
| REST認証問題 | AI更新停止 | `.htaccess` と認証経路を先に解消 |
| ISR不使用 | 更新反映が重い | 本体は静的 export にしない |
| デザイン再現不足 | 離脱増 | まず現デザイン再現、後で改善 |
| WordPressとNext.js二重管理 | 運用負荷 | 役割を明確化 |
| 店舗側入力の権限 | 情報事故 | 承認制、編集範囲制限 |

---

## 16. 未決事項

1. Next.js 本体の配置先を Vercel にするか、他環境にするか。
2. API は REST API 中心で進めるか、WPGraphQL を採用するか。
3. 店舗詳細 URL は現行の `/shops/{slug}/` で確定しているか。
4. WordPress 保存時の即時再生成を最初から入れるか。
5. 店舗側ログインをいつ開始するか。
6. ブログは将来も WordPress に残すか。
7. 現デザイン再現の範囲をどこまで「同じ」とみなすか。
8. 下書きプレビューを Phase 1 に含めるか、本番前対応に回すか。
9. ヘッダー / フッター / ナビを WordPress 管理に残すか、Next.js 側固定にするか。

---

## 17. 次にやること

最初の作業は、Phase 1 の技術検証とする。

対象:

- `/area/nihonbashi/`
- 店舗詳細 1 件
- ブログ記事 1 件

確認すること:

- WordPress から必要データが取れるか。
- ACF / タクソノミー / アイキャッチ / SEO meta が取れるか。
- Next.js で現デザインに近い表示ができるか。
- WordPress 更新後に反映できるか。

---

## 18. 参照

- `AGENTS.md`
- `.cursorrules`
- `pm/PROGRESS.md`
- `pm/BLOCKER.md`
- `pm/CONTENT-IMPLEMENTATION-GUIDE.md`
- `pm/SHOP-AI-ROLLOUT.md`
- `front-page.php`
- `taxonomy-area.php`
- `single-shop.php`
- `functions.php`
- `ai-update-log.php`
- `dashboard/next.config.ts`
- WordPress REST API: https://developer.wordpress.org/rest-api/
- Next.js ISR: https://nextjs.org/docs/app/guides/incremental-static-regeneration
- WPGraphQL: https://www.wpgraphql.com/docs/introduction
