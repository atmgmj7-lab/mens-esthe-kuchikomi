# プロジェクト設計書

## プロジェクト目的

リフナビからのスクレイピングによる店舗情報・料金の自動収集と WordPress への自動反映。

## 技術スタック

- Python 3.14
- WordPress REST API
- BeautifulSoup4

## スクレイピング仕様

- **ページネーション**: `?page=X` 方式による全ページ巡回
- **料金テーブル抽出**: `#container > div:nth-child(14)` を優先ターゲットとする
- **フォールバック**: 上記が取得できない場合は `div.salondata` クラスを参照
- **対象URL**: リフナビ大阪 `https://osaka.refle.info/G0000/`（約420店舗）

## データフロー

1. **URL 探索** … `?page=0`〜`?page=8` を巡回し、`div.salondata` 内の `/shop/xxx/` リンクを収集
2. **shop_menu.html 解析** … 各店舗の `shop_menu.html` にアクセスし、料金テーブルを抽出
3. **scraped_menus.json 保存** … 10件ごとに中間保存、最終的に全件を JSON に出力
4. **WP API 送信** … `price_migrator.py` 等で WordPress REST API 経由で ACF（shop_price_60min 等）に登録
