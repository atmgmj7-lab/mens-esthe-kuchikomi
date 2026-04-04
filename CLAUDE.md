# mens-esthe-kuchikomi プロジェクト憲法

## 作業開始時に必ずやること
1. pm/PROGRESS.mdを読んで現在の完了状況を把握
2. pm/BLOCKER.mdを読んでブロッカーを確認
3. 今日のタスクを決めてpm/PROGRESS.mdのログに追記
4. 作業終了時もpm/PROGRESS.mdに完了内容を追記してgit push

---

## プロジェクト概要
- **目標**: 「日本橋 メンズエステ」検索10位以内
- **サイト**: https://mens-esthe-kuchikomi.com
- **リポジトリ**: htp.php              # 店舗詳細テンプレート
├── taxonomy-area.php            # エリアアーカイブ
├── archive-shop.php             # エリア選択ハブ
├── front-page.php               # トップページ
├── css/
│   ├── base.css
│   ├── front-page.css
│   └── single.css
├── js/
│   └── front-page-editorial.js
├── ai-site-monitor/             # AI自動更新スクリプト群
├── pm/
│   ├── PROGRESS.md              # 進行ログ（毎回更新）
│   ├── BLOCKER.md               # ブロッカー管理
│   └── CURSOR_PROMPT.md         # プロンプト集
├── agents/                      # 未作成（要構築）
└── .github/workflows/
    ├── deploy.yml               # FTP自動デプロイ（Secrets待ち）
    └── daily_cron.yml           # AI監視CI（稼働状況要確認）
```

---

## 開発ルール
- 親テーマ（SWELL）は直接編集しない・フic_html/wp-content/themes/swell_child/

---

## 未完成タスク（優先順）
詳細はpm/BLOCKER.mdを参照

### 🔴 緊急（SEO直結）
- [ ] GitHub Secrets登録（FTPパスワード取得後）
- [ ] area_map_navのダミーURL差し替え（functions.php内【】の箇所）
- [ ] area-seo-hooks-optimized.phpをfunctions.phpに接続

### 🟡 中優先（機能完成）
- [ ] REST APIエンドポイントの権限強化（ai-update-log.php）
- [ ] ai-site-monitorの稼働確認・エラー解消
- [ ] daily_cron.yml動作確認（GEMINI_API_KEY・DISCORD_WEBHOOK_URL）

### 🟢 低優先（整備）
- [ ] agents/フォルダ作成・サブエージェント定義
- [ ] CSS条件分岐最適化（現在全ページ読み込み）

---

## 競合マップ（2026-04-05調査）
| 順位帯 | サイト | 特徴 |
|--------|--------|------|
| 上位 | リフナビ大阪 | 62件掲載・UGC豊富 |
| 上位 | 週刊エステ | クーポン付き |
| 上位 | men-esthe.jp | 口コミ量 |
| 圏外 cd ~/Desktop/dev/swell_child

# 変更をデプロイ
git add . && git commit -m "変更内容" && git push

# ブランチ作成
git checkout -b feature/機能名

# 状態確認
git status
git log --oneline -5
```
