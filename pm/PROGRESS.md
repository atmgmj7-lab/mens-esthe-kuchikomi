# 進行ログ

## ステータスサマリー
| 項目 | 状態 | 備考 |
|------|------|------|
| GA4実装 | ✅ 完了 | G-6XFMW5XKBW |
| Search Console | ✅ 完了 | サイトマップ送信済み |
| GitHubリポジトリ | ✅ 完了 | atmgmj7-lab/mens-esthe-kuchikomi |
| GitHub Actions | ✅ 完了 | deploy.yml作成済み |
| CLAUDE.md整理 | ✅ 完了 | スリム化・ファイル分担構成 |
| .gitignore | ✅ 完了 | |
| GitHub Secrets登録 | ⏳ 待機 | FTPパスワード確認待ち |
| 自動デプロイ動作確認 | ⏳ 待機 | Secrets登録後 |
| エリア地図 iframe 化（area_map_nav ＋ taxonomy-area） | ✅ 完了 | Google Maps embed 6エリア |
| area-seo-hooks-optimized接続 | ⏳ 未着手 | |
| REST API権限強化 | ⏳ 未着手 | |
| ai-site-monitor稼働確認 | ⏳ 未着手 | |
| agents/フォルダ構築 | ⏳ 未着手 | |

#### ブロッカー
- FTPパスワード未取得（自動デプロイ完成待ち）

#### 次のアクション
- [ ] FTPパスワード取得 → GitHub Secrets登録
- [ ] 自動デプロイ動作確認
- [ ] デプロイ後 `/area/osaka/` で `lux-map-iframe` の表示確認
- [ ] SEOツールをRenderにデプロイ

### 2026-04-05 06:01
#### コミット
test: auto log hook動作確認

#### 変更ファイル
.DS_Store
---

### 2026-04-05 06:54
#### コミット
test: 自動デプロイ動作確認

#### 変更ファイル

---

### 2026-04-05 07:04
#### コミット
fix: correct deploy.yml secret variable names

#### 変更ファイル
.DS_Store
.github/workflows/deploy.yml
pm/PROGRESS.md
---

### 2026-04-05 エリア地図 iframe 化
#### コミット
fix: replace img with iframe in area map nav

#### 変更内容
- `functions.php` の `area_map_nav`: 6エリア Google Maps embed URL、`lux-map-bg`（img）を `lux-map-iframe`（iframe）に変更
- `taxonomy-area.php`: 親エリアの地図を同じ6 URL・同じ iframe マークアップに統一
- `css/single.css`: `.lux-map-frame iframe.lux-map-iframe` を追加（画像用の回転・ブレンドは iframe では無効化）

#### 確認メモ
- 本番を `curl` で取得した時点（このコミットのデプロイ前）: 旧 `<img class="lux-map-bg">` のHTMLのまま
- **大阪（親）** `/area/osaka/`: デプロイ後、PC表示（`u-pc-only`）で iframe が出る想定
- **日本橋（子）** `/area/nihonbashi/` 等: `taxonomy-area.php` は `is_parent_area` のときだけ地図セクションを出すため、**子エリアには地図＋ピンは表示されない**（店舗一覧アーカイブ）。ピン重ねは親エリアページのみ

---
