# メンズエステ口コミサイト 店舗表示機能強化 - フェーズ2

## 環境情報
- サイト: https://mens-esthe-kuchikomi.com
- サーバー: Xserver（OPcache無効化済み php.ini）
- テーマ: SWELL子テーマ（swell_child）
- デプロイ: GitHub Actions → FTP（push後約30秒で本番反映）
- リポジトリ: narikiyo/mens-esthe-kuchikomi（mainブランチ）
- カスタム投稿タイプ: shop（54店舗）
- タクソノミー: area
- AI更新: Gemini API（gemini-1.5-flash / gemini-1.5-pro）
- Python: 3.11

## 既存CSS構成
swell_child/
├── style.css ← テーマ情報＋空（緊急上書き用）
└── css/
├── base.css ← 全ページ共通（変数、ヘッダー、フッター、フォント）
├── front-page.css ← トップページ専用
└── single.css ← 店舗詳細・アーカイブ共通（★今回の追記先）

text
読み込み順: base.css → front-page.css → single.css → style.css

## 現在完了していること
- ✅ functions.php（1263行）が本番で正常動作
- ✅ 店舗詳細ページに店舗情報ボックス（コンセプト＋出勤リンク）表示確認済み
- ✅ 一覧ページに出勤バッジ・価格・更新日 表示確認済み（データがある店舗のみ）
- ✅ CSSスタイル適用済み（functions.phpのescomi_shop_info_box_styles()で直書き）
- ✅ daily_shop_update.yml（毎朝6時、出勤情報更新）
- ✅ ai_auto_updater.py（日次更新用）
- ✅ ai_monthly_updater.py（694行、月次更新用Pythonスクリプト）
- ✅ REST API escomi/v1/update 正常動作

## カスタムフィールド（shop投稿）
- shop_today_analysis - 本日出勤分析
- shop_availability - 空き状況
- shop_today_therapists - 本日出勤キャスト（配列: name, time, tags）
- shop_ai_summary - 店舗コンセプト（月1回更新用）← genie店舗でデータ確認済み
- shop_last_ai_check - 最終更新日時 ← 空（表示されない原因）
- basic_price - 最安価格 ← 空（表示されない原因）
- official_url - 公式サイトURL ← genie店舗でデータ確認済み

## 未完了の3タスク

### タスク1: CSS分離（functions.php → css/single.css に追記）
**目的**: functions.phpの可読性向上。店舗詳細・アーカイブ用CSSなので single.css に統合

**手順**:
1. `css/single.css` の末尾に以下を追記（functions.phpのescomi_shop_info_box_styles()から抽出）:
```css
/* ============================================================
   店舗情報ボックス（2026-05-17 追加）
   ============================================================ */
.escomi-shop-info-box{background:#FDFBF6;border:1px solid #D4AF37;border-radius:8px;padding:24px 28px 20px;margin-bottom:28px;box-shadow:0 2px 12px rgba(212,175,55,0.12)}
.escomi-shop-concept__title{font-size:.85rem;font-weight:600;letter-spacing:.12em;color:#D4AF37;margin:0 0 12px;text-transform:uppercase;border-bottom:1px solid rgba(212,175,55,.2);padding-bottom:8px}
.escomi-shop-concept__content{font-size:1rem;line-height:1.7;color:#5a4a3a;margin-bottom:20px}
.escomi-shop-info-box__meta{display:flex;flex-wrap:wrap;align-items:center;gap:16px;padding-top:16px;border-top:1px solid rgba(212,175,55,.2)}
.escomi-shop-info-box__price,.escomi-shop-info-box__update{display:flex;flex-direction:column;gap:2px}
.escomi-shop-info-box__label{font-size:.65rem;font-weight:600;letter-spacing:.1em;color:#8b7d6b;text-transform:uppercase}
.escomi-shop-info-box__value{font-size:.9rem;font-weight:500;color:#5a4a3a}
.escomi-shop-info-box__value--price{font-size:1.1rem;font-weight:700;color:#1b5e20}
.escomi-shop-info-box__link{margin-left:auto}
.escomi-shop-info-box__button{display:inline-flex;align-items:center;gap:6px;padding:10px 20px;background:linear-gradient(135deg,#D4AF37,#b8962e);color:#fff;font-size:.82rem;font-weight:600;letter-spacing:.05em;border-radius:4px;text-decoration:none;transition:all .2s ease;box-shadow:0 2px 6px rgba(212,175,55,.3)}
.escomi-shop-info-box__button:hover{background:linear-gradient(135deg,#c19b2f,#a38424);box-shadow:0 4px 12px rgba(212,175,55,.4);transform:translateY(-1px);color:#fff;text-decoration:none}
.escomi-shop-info-box__button-icon{font-size:.9rem;transition:transform .2s ease}
.escomi-shop-info-box__button:hover .escomi-shop-info-box__button-icon{transform:translateX(3px)}
.escomi-archive-shop-meta{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:8px}
.escomi-archive-badge{display:inline-block;font-size:.65rem;font-weight:600;letter-spacing:.08em;padding:3px 10px;border-radius:3px}
.escomi-archive-badge--active{background:linear-gradient(135deg,#2e7d32,#1b5e20);color:#fff}
.escomi-archive-badge--pending{background:#e0e0e0;color:#888}
.escomi-archive-price{font-size:.8rem;font-weight:600;color:#1b5e20}
.escomi-archive-update{font-size:.65rem;color:#999;margin-left:auto}
.escomi-badge{display:inline-block;font-size:.7rem;font-weight:600;letter-spacing:.08em;padding:4px 12px;border-radius:3px}
.escomi-badge--active{background:linear-gradient(135deg,#2e7d32,#1b5e20);color:#fff}
.escomi-badge--pending{background:#e0e0e0;color:#888}
@media (max-width:767px){.escomi-shop-info-box{padding:16px 16px 14px;margin-bottom:20px}.escomi-shop-info-box__meta{flex-direction:column;align-items:flex-start;gap:10px}.escomi-shop-info-box__link{margin-left:0;width:100%}.escomi-shop-info-box__button{width:100%;justify-content:center;text-align:center}.escomi-shop-concept__content{font-size:.9rem}}
functions.php の escomi_shop_info_box_styles() 関数と add_action('wp_head', 'escomi_shop_info_box_styles', 26) を削除

single.css は既に全ページで読み込み済み（wp_enqueue_style('child-single', ...)）なので、追加の読み込み処理は不要

GitHubプッシュ → デプロイ確認（30秒後）

タスク2: monthly_shop_summary.yml の新規作成
目的: 毎月1日朝7時に全店舗の公式サイトから店舗コンセプトを取得・要約し、shop_ai_summaryに保存。同時にshop_last_ai_checkも更新。

ファイル: .github/workflows/monthly_shop_summary.yml
cron: 0 22 * * *（毎日UTC 22:00=日本時間7:00実行。Python側で1日のみ処理する）

仕様（daily_shop_update.ymlをベースに作成）:

yaml
name: Monthly Shop Summary Update
on:
  schedule:
    - cron: '0 22 * * *'
  workflow_dispatch:
    inputs:
      max_shops:
        description: '最大店舗数。空欄なら全店舗'
        required: false
        type: string
        default: ''
jobs:
  update-monthly-summaries:
    runs-on: ubuntu-latest
    timeout-minutes: 120
    env:
      MAX_SHOPS_MANUAL: ${{ github.event_name == 'workflow_dispatch' && github.event.inputs.max_shops || '' }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - name: Cache pip
        uses: actions/cache@v4
        with:
          path: ~/.cache/pip
          key: ${{ runner.os }}-pip-${{ hashFiles('ai-site-monitor/requirements.txt') }}
      - name: Install dependencies
        run: cd ai-site-monitor && pip install -r requirements.txt
      - name: Install Playwright browsers
        run: cd ai-site-monitor && python -m playwright install chromium --with-deps
      - name: Pre-flight REST check
        env:
          WP_SITE_URL: ${{ secrets.WP_SITE_URL }}
        run: |
          HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "${WP_SITE_URL}/wp-json/escomi/v1/update" -H "Content-Type: application/json" --max-time 15)
          echo "REST health: HTTP ${HTTP_CODE}"
          if [ "$HTTP_CODE" = "404" ]; then exit 1; fi
      - name: Run ai_monthly_updater
        env:
          WP_SITE_URL: ${{ secrets.WP_SITE_URL }}
          WP_USER: ${{ secrets.WP_USER }}
          WP_APP_PASSWORD: ${{ secrets.WP_APP_PASSWORD }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          SHOP_DELAY_SECONDS: '5'
        run: |
          cd ai-site-monitor
          if [ -n "${MAX_SHOPS_MANUAL}" ]; then
            python ai_monthly_updater.py --limit "${MAX_SHOPS_MANUAL}"
          else
            python ai_monthly_updater.py --all
          fi
      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: monthly-update-results-${{ github.run_id }}
          path: ai-site-monitor/results/
          retention-days: 14
          if-no-files-found: warn
注意: ai_monthly_updater.py が --all 引数に対応しているか要確認。未対応の場合は追加修正。

タスク3: 不足データの補完
目的: basic_price（最安料金）とshop_last_ai_check（最終更新日）を補完し、店舗詳細ページの全要素を表示可能にする

対応:

ai_monthly_updater.py が月次更新時に shop_last_ai_check を現在日時で自動更新するよう確認・修正

basic_price は手動 or CSVインポートで補完（shops.csv に価格データがあれば活用）

注意点
.htaccess 触らない（Authorization設定済み）

ai-update-log.php はCloudSecure保護対象のため要注意

SWELLフックの優先度維持: shop_info_box=3, Today's Analysis=5

single.css は全ページ読み込み済みなので、追加のenqueue不要

GitHub ActionsのSecretsは daily_shop_update.yml と共通（WP_SITE_URL, WP_USER, WP_APP_PASSWORD, GEMINI_API_KEY）

実行順序
タスク1（CSS分離: functions.php削除 + single.css追記）

タスク2（monthly_shop_summary.yml作成）

タスク3（ai_monthly_updater.py修正 + テストデータ補完）

全ファイルをgit add → commit → push

デプロイ完了後、本番サイトで表示確認

text

---

このプロンプトをClaude Codeに渡してください。既存CSS構成を踏まえて、`single.css` に追記する方式に修正済みです。
