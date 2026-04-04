# AI 自動更新システム デプロイ手順（Xserver 向け）

`ai_auto_updater.py` が WordPress の `/wp-json/ai-engine/v1/update` に POST する際に 404 が返る場合の対処手順です。

---

## 1. アップロードするファイル

以下のファイルを **Xserver の WordPress テーマフォルダ** にアップロードしてください。

| ファイル | アップロード先 |
|----------|----------------|
| `ai-update-log.php` | `wp-content/themes/swell_child/ai-update-log.php` |
| `functions.php` | `wp-content/themes/swell_child/functions.php` |

**重要**: `swell_child` が有効な子テーマであることを確認してください。

---

## 2. ファイル配置の確認

```
wp-content/themes/swell_child/
├── functions.php      ← 必須（ai-update-log.php を読み込む）
├── ai-update-log.php  ← 必須（REST API エンドポイント定義）
├── style.css
└── （その他テーマファイル）
```

---

## 3. WordPress 管理画面でのパーマリンク更新

**REST API のルートを有効にするため、必ず実行してください。**

1. WordPress 管理画面にログイン
2. **設定** → **パーマリンク**
3. 何も変更せず、そのまま **「変更を保存」** をクリック

これで REST API のルートが再登録されます。

---

## 4. エンドポイントの動作確認

### ブラウザで確認

以下の URL をブラウザで開いてください。

```
https://あなたのサイト.com/wp-json/ai-engine/v1/update
```

**正常時**: JSON で `{"status":"ok","message":"ai-engine/v1/update は稼働中です..."}` が表示される

**404 時**: `{"code":"rest_no_route",...}` が表示される → パーマリンクの更新を再度実行

### パーマリンクが「基本」の場合

```
https://あなたのサイト.com/?rest_route=/ai-engine/v1/update
```

---

## 5. Python スクリプトの再実行

```bash
cd ai-site-monitor
python ai_auto_updater.py
```

`ai_auto_updater.py` は `/wp-json/` と `?rest_route=` の両方の URL を自動で試します。

---

## トラブルシューティング

| 症状 | 対処 |
|------|------|
| 404 rest_no_route | パーマリンクを再保存（設定→パーマリンク→保存） |
| ファイルが見つからない | `ai-update-log.php` が `swell_child` 直下にあるか確認 |
| 401 認証エラー | `.env` の `WP_USER` と `WP_APP_PASSWORD` を確認 |
| 500 サーバーエラー | サーバーの PHP エラーログを確認 |
