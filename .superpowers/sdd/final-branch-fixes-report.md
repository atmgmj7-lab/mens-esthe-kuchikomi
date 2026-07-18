# 最終横断レビュー修正レポート

## Status

- `completed_local`
- 基準HEAD: `930d49f`
- 対象: Important 3件、Minor 2件
- push、deploy、本番WordPress/Supabase操作: 未実施

## 修正内容

1. 旧GA公開入口
   - 通常HTTPはJSONのdisabled応答だけを404で返す。
   - `Cache-Control: no-store`と`X-Robots-Tag: noindex, nofollow`を付け、CORSを削除した。
   - GA4資格情報、token取得、GA4 Data API呼出しを公開PHPから削除した。
   - `PHP_SAPI === 'cli'`かつ`ESKOMI_GA_PROXY_LIBRARY_ONLY === true`の契約時だけpure parserを読み込む。
2. SSH deploy順
   - `functions.php`の無条件literal requireとpredeploy listを照合する。
   - 必須4 PHPと`ai-update-security.php`、`ai-update-log.php`をstageで検査する。
   - `ai-update-security.php`を`ai-update-log.php`より先に含め、全依存をremoteへ先行転送する。
   - full stage転送は`functions.php`を除外し、最後に`functions.php`だけを転送する。`--delete`は禁止のまま。
   - root`scripts/`はstage copyから除外し、post-copy scanとstage fixtureでも拒否する。
3. moderation cache
   - Next.js 16.2.10のローカル型、実装、`revalidateTag`文書を確認した。
   - `revalidateTag(tag, { expire: 0 })`へ変更し、`"max"`を禁止した。
   - secret認証、200/400/401/500/503応答、no-store/noindexは維持した。
4. 進行文書
   - SSH workflow実装・独立レビューを完了へ更新した。
   - 残作業は初回mainデプロイと1店舗疎通試験だけにした。
   - pushは承認済みと記録し、2件成功までrelease完了と判定しない。
5. 文書整形
   - 店舗詳細dashboard設計書の先頭4 metadata行から末尾空白を除去した。

## TDD evidence

- GA: `PHP_SAPI === 'cli'` gate欠如でRED後、実HTTP 404/header/body契約をGREEN化。
- cache: 旧`revalidateTag(tag, "max")`でRED後、`{ expire: 0 }`の実引数をGREEN化。
- deploy: predeploy list/validator欠如と旧同時転送順でRED後、stage fixture・YAML・順序契約をGREEN化。
- self-review: root`scripts/`除外欠如をREDで検出後、root rsync除外・post-copy禁止・fixture拒否をGREEN化。

## Verification

- `php tests/php/check-ga-proxy-contract.php`: PASS
- `npm run test:dashboard-shell`: PASS
- `npm run test:headless-admin-security`: PASS
- `npm run test:xserver-ssh-deploy`: PASS（必須PHP欠損6 fixture、scripts漏えいfixtureを含む）
- `php -l dashboard/public/api/ga-proxy.php`: PASS
- `php -l tests/php/check-ga-proxy-contract.php`: PASS
- `bash -n scripts/validate-xserver-deploy-stage.sh`: PASS
- Ruby YAML parse `.github/workflows/deploy.yml`: PASS
- `headless/npm test`: PASS
- `headless/npm run lint`: PASS
- `headless/npm run typecheck`: PASS
- `headless/npm run build`: PASS（824/824）
- `dashboard/npm run lint`: PASS
- `dashboard/npm run build`: PASS（5/5）
- `git diff --check`: PASS
- `git diff --check origin/main...HEAD`: PASS

## QA判断

- 公開画面component/CSS/表示文言は変更していない。変更は無効化されたPHP endpoint、server cache、deploy処理、契約検査、進行文書だけのためbrowser QAは不要。

## Remaining release checks

- 初回mainデプロイ成功確認
- 1店舗だけの日次更新疎通試験

上記2件が成功するまでrelease完了とは判定しない。

## Minor follow-up

- `pm/PROGRESS.md`冒頭の古い停止状態を現在の正本へ統一した。
- 旧password候補はprovider拒否で無効かつ再発行しない。専用SSH key設定、SSH workflow実装・独立レビュー、push・deploy承認は完了済みとして記録した。
- 未完了は初回main deployと1店舗疎通試験だけで、両方成功までrelease完了と判定しない。
- コード変更、test再実行、push、deploy、本番操作は行っていない。
