# SHOP-DETAIL-INFORMATION-UX-TEMPLATE-02 — WordPress入力と画面の対応

基準: origin/main `9dcab69`。2026-09-13 公開WordPressをREAD-ONLYで照合。
正本は `headless/lib/wp/normalize.ts` の `normalizeShop` → `headless/lib/shop-detail-view-model.ts` の `buildShopDetailViewModel`。WordPress ACFは既存readerが `post.acf` を受け渡す。今回reader、ViewModel、WordPress meta定義は変更していない。

| WordPress / ViewModel field | 表示label | 表示section | 空時 |
| --- | --- | --- | --- |
| `basic_price` → price normalization → `facts.price` | 料金目安 | Hero（基本情報には重複追加しない） | 既存価格契約で非表示。文字列から任意の価格を推測しない |
| 既存 `price_60` 等のcourse price → `prices` | 既存コースlabel | 料金・予約 | 有効なコース0件ならsection非表示 |
| `shop_hours` → `facts.hours` / `infoRows.hours` | 営業時間 | Hero / 基本情報 | 非表示 |
| `shop_holiday` → `infoRows.holiday` | 定休日 | 基本情報 | 非表示 |
| `shop_booking` → `infoRows.booking` | 予約 | 基本情報 | 非表示 |
| `shop_tel` → `actions.tel` | 電話予約 | Hero / 固定CTA | 既存電話URL検証に通らなければ非表示。基本情報に番号行は既存未実装 |
| `shop_line` → `actions.line` | LINE予約 | Hero / 固定CTA | 有効なHTTP(S) URLがなければ非表示 |
| `shop_booking_url`, `booking_url`, `reservation_url`, `shop_reservation_url` → `actions.reservation` | 空き状況・Web予約 | Hero / 固定CTA | 既存優先順で有効URLがなければ非表示 |
| `actions` の最初の非official CTA → `facts.booking` | 予約方法 | Hero | 有効な予約CTAなしなら非表示。`shop_booking` の文章とは別の既存契約 |
| post `official_url` / ACF `official_url` → `officialUrl` / `actions.official` / `infoRows.official` | 基本情報label: 公式サイト / リンク・CTA: 公式サイトを見る | Hero / 固定CTA / 基本情報 | 有効URLなしなら非表示。rel/target/計測属性維持 |
| `shop_address` → address normalization → `infoRows.address` | 住所 または アクセス案内 | 地図・アクセス | 空・正規化後空なら非表示。近郊・駅案内を住所と断定せず、長い文章も1値のまま |
| `shop_station`, `nearest_station`, `station` → `infoRows.station` | 最寄駅 / Heroではアクセス | 地図・アクセス / Hero (`station || access` の既存優先順) | 正式な別値がなければ非表示。住所等から推測しない |
| `shop_access` → `infoRows.access` | アクセス案内 / Heroではアクセス | 地図・アクセス / Hero（stationが空の場合） | 非表示。住所等から分割しない |
| `shop_parking` → `infoRows.parking` | 駐車場 | 基本情報 | 非表示。候補名 `parking` 自体は未対応 |
| `payment` / 支払い方法 | — | — | `DATA_MAPPING_REQUIRED`: reader/ViewModelに正式な表示mappingなし。新meta契約は作成しない |
| WordPress `content.rendered` → `introductionText` | 店舗紹介 | 店舗紹介 | 本文・catch・recommend・summaryが全て空なら紹介見出し非表示 |
| `shop_catch`, `recommend_text` → `catchText`, `recommendText` | 既存本文 | 店舗紹介 | 非表示 |
| `shop_ai_summary` → `summaryText` | 掲載情報コメント | 店舗紹介 | 非表示。ユーザー口コミとは分離 |
| `shop_features`, `features`, `shop_facilities` → `featureNames` | こだわり | こだわり | 正式な配列値なしなら非表示 |
| `shop_updated_at` → `verifiedAt` | 掲載情報の確認日 | 基本情報等の既存箇所 | 有効な日付なしなら非表示 |
| `shop_fact_provenance` → `buildShopInformationCoverage` | 店舗情報確認済み n/6 / 最終確認 | `shop-information` | provenance無効/なしなら非表示。本文なし時はcompact disclosure。開くと各項目の確認済み/未確認を表示 |
| 承認済み口コミreader → review ViewModel | 承認済み口コミ / 口コミ・体験 | Hero / 口コミ | 取得成功0件のみcompact。取得不能は従来エラー案内。3件のgraph/AggregateRating契約維持 |

## WordPress入力時の注意

- ACFに入力され、公開RESTの `acf` に含まれた既存対応キーだけが反映される。キーを独自に新設するだけでは表示を保証しない。
- 代表2店舗の公開RESTには `shop_station` / `shop_access` / `shop_parking` / `shop_updated_at` が含まれていなかった。ViewModelの既存対応はあるが、このWordPress環境での入力欄・REST公開設定は `NOT_VERIFIED`。必要ならWordPress側の正式mapping確認を別途行う。今回は変更しない。
- `shop_tel` は既存CTAモデル対応。番号の独立した基本情報行は追加していない。`payment` は `DATA_MAPPING_REQUIRED`。
- 入力後の反映時間は既存WordPress reader / Next cacheの契約による。即時更新の保証やキャッシュ設定変更は今回の対象外。
- 確認済みの件数は値の有無だけでは増えない。既存provenanceの値一致・出典・review status・日付等の検証を通る必要がある。

## 公開データ実照合

`node scripts/check-shop-detail-information-browser.mjs` は公開originへGETし、実際のnormalizeShopとViewModelを通し、local production buildの店舗route表示値に照合する。資格情報不使用、外部CTA遷移・投稿送信なし。

| エリア / 公開店舗 | 確認したWordPress → UI | 空値・CTA・Trust |
| --- | --- | --- |
| 新大阪 / ゆだねて（ID 775） | `shop_hours` → 営業時間「10:00～2:00」、`shop_holiday` →「不定休」、`shop_booking` →「電話 / LINE / Web予約」、`shop_address` → 複数駅を含むアクセス案内全文、公式URL → 公式リンク | LINE / 電話 / 公式CTAあり。Trust 3/6、最終確認2026-09-13。駅を文章から分離していない |
| 堺東 / Mrs.Nostalgia（ミセス ノスタルジー）（ID 5137、slug `eskomi-m0663`） | `shop_hours` →「10:00 - 05:00」、`shop_booking` →「LINE・WEB・電話」、`shop_address` →「大阪府堺市堺区近郊南瓦町近郊」、公式URL → 公式リンク | 電話 / 公式CTAあり。有効LINE URLがないためLINE CTAなし（予約文からURLを作らない）。Trust 2/6、最終確認2026-09-13 |
| 堺東 / ミセスムーンR 堺東ルーム（ID 5189、追加READ-ONLY確認） | 公開値は予約「完全予約制」、営業時間・基本料金・住所は空 | 空欄を仮値で補わないことを確認。6幅QAの対象は上記2店舗 |

電話番号・生provenance payload・レビュー個人情報は成果物に転記しない。
