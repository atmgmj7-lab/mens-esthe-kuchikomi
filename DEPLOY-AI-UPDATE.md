# AI 自動更新システム デプロイ手順（Xserver 向け）

`ai_auto_updater.py` が WordPress の `/wp-json/escomi/v1/update` に POST する際に 404 が返る場合の対処手順です。

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
https://あなたのサイト.com/wp-json/escomi/v1/update
```

**ルート存在の目安（匿名）**: `curl -X POST`（本文なし）で **401**（未認証）が返る→ルートは登録済み。**404** または `rest_no_route` → ファイル配置・パーマリンク「変更を保存」を再確認。

認証済み **POST の成功確認** は `DEPLOY-AI-UPDATE.md` の手順 のち Python／Actions で行う（Application Password と `edit_posts` 必須）。

### パーマリンクが「基本」の場合

```
https://あなたのサイト.com/?rest_route=/escomi/v1/update
```

---

## 5. Python スクリプトの再実行

```bash
cd ai-site-monitor
python ai_auto_updater.py
```

`ai_auto_updater.py` は `/wp-json/` と `?rest_route=` の両方の URL を自動で試します。

---

## 6. `Authorization` ヘッダが届かず 401 になる場合（Xserver／Apache）

テーマ・権限・アプリパスワードは正しいのに **`rest_cannot_edit`** が返るとき、サーバー側で **`Authorization`** が削除されていることがあります。サイト **ルート**（`public_html/`）の `.htaccess` で、WordPress に付いた `RewriteEngine`/`RewriteRule` ブロックの **直上（先頭付近・WordPress 標準より前）** に次だけ足して保存し、キャッシュプラグインがあればパージしてください。

```apache
RewriteEngine On
RewriteCond %{HTTP:Authorization} ^(.*)
RewriteRule ^(.*) - [E=HTTP_AUTHORIZATION:%1]
```

---

## トラブルシューティング

| 症状 | 対処 |
|------|------|
| 404 rest_no_route | パーマリンクを再保存（設定→パーマリンク→保存） |
| ファイルが見つからない | `ai-update-log.php` が `swell_child` 直下にあるか確認 |
| 401 認証エラー（一般） | `.env`／GitHub Secrets の `WP_USER` と `WP_APP_PASSWORD`。ユーザーに `edit_posts` があるか |
| 401 `rest_cannot_edit` が続く／Basic は送っているつもり | 上記 **§6**。HTTP_AUTHORIZATION 伝達用 `.htaccess` 3行をルートへ追加 |

---
