# Task Plan: SEOを守るSupabase段階移行

## Goal

公開中のURL・検索向け設定・WordPress表示を変えずに、店舗・地域・口コミ・根拠情報をSupabaseへ段階移行できるローカル基盤を作り、本番接続と公開参照先の切替前で停止する。

## Current Phase

Phase 5

## Phases

### Phase 1: 現状復元と安全確認
- [x] ユーザーの移行条件とSEO調査結果を整理する
- [x] 正式作業場所、Git状態、本番変更禁止を確認する
- [x] 現行テストが通ることを確認する
- **Status:** complete

### Phase 2: 設計と実装計画
- [x] 最小データ構成と安全な切替方式を設計する
- [x] 実装手順と検査条件を文書化する
- [x] 現行コードの接続点を確定する
- **Status:** complete

### Phase 3: Supabaseローカル基盤
- [x] テストを先に追加し、意図した失敗を確認する
- [x] ローカルmigrationとAPI公開範囲を実装する
- [x] WordPress移行元データの監査ツールを実装する
- **Status:** complete

### Phase 4: WordPress既定の移行接続点
- [x] テストを先に追加し、意図した失敗を確認する
- [x] WordPressを既定値にした参照先設定を実装する
- [x] Supabase単独切替に承認ゲートを設ける
- **Status:** complete

### Phase 5: 検証と引き継ぎ
- [x] Supabase契約、lint、型、既存テスト、buildを検証する
- [x] SEO非変更、本番非変更、戻し方を確認する
- [x] pm/PROGRESS.mdと計画ファイルを更新する
- **Status:** complete

## Key Questions

1. 最小構成で、現在不足している本文・口コミ・出典・確認日を拡張できるか。
2. 公開ページをWordPress既定のまま保ち、Supabase比較確認だけを先行できるか。
3. 本番Supabaseや公開参照先の切替なしに、次工程の安全性を検証できるか。

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| 現在の正式フォルダ内に `codex/supabase-seo-safe-migration` ブランチを作る | mainへの混入と自動本番反映を防ぎ、既存の一時作業ツリーを変更しないため |
| 公開表示はWordPressを既定値のまま維持する | URL、canonical、サイトマップ、生成HTMLを今回の基盤整備で変えないため |
| 本番Supabase作成・本番DB投入・公開参照先切替の前で停止する | 外部サービスへの書き込みとSEO切替には別の承認が必要なため |

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| `docs/ai-skills.md` が存在しない | 1 | AGENTS.mdのルールと利用可能なSupabase手順を直接適用し、不在を進行ログへ記録する |
| `../pm/DECISIONS.md` と `../docs/design/...` を誤った相対位置で読もうとして失敗 | 1 | リポジトリルート基準の `pm/...` と `docs/...` に直して再確認する |
| Docker daemonが起動しておらず、SupabaseローカルDBへ接続できない | 1 | SQL契約検査とCLI生成を継続し、DB実適用はDocker起動後の未実施検査として残す |
| 監査moduleの正規表現でword boundaryへ量指定子を付け、構文エラー | 1 | 不要な `?` を削除し、同じ検査を再実行する |
| VM内オブジェクトを `deepEqual` し、別realmのprototype差で失敗 | 1 | JSON値として比較し、設定内容そのものを検査する |
| 既存 `WP_API_BASE_URL=/wp-json` を監査CLIが二重に扱えない | 1 | `/wp-json` と `/wp-json/wp/v2` を正規化する関数を追加する |
| 公開content/reviewの親店舗・地域が非公開でも行policyだけでは出せた | 1 | RLSへ公開親の存在条件を追加する |
| Secret検査commandの引用符が壊れてshell構文エラー | 1 | 複雑な引用をやめ、JWTとSupabase secret形式の単純な検査へ分けて成功させた |
| commit前の `git diff --check` が文書末尾の余分な空行2件を検出 | 1 | 2文書の末尾空行を削除し、再検査する |

## Notes

- 既存の公開12コミットと今回の移行基盤を混ぜない。
- Secret値を表示・記録・コミットしない。
- WordPress本番データ、Supabase本番データ、親リポジトリを変更しない。
- 外部調査結果は `findings.md` にのみ記録する。
- Docker daemon起動後の `supabase db reset` と `supabase db lint --local` は次の未実施検査として残る。
