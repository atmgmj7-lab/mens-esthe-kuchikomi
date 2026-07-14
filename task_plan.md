# Task Plan: SEOを守るSupabase段階移行

## Goal

公開中のURL・検索向け設定・WordPress表示を変えずに、店舗・地域・口コミ・根拠情報をSupabaseへ段階移行できるローカル基盤を作り、本番接続と公開参照先の切替前で停止する。

## Current Phase

Phase 3

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
- [ ] テストを先に追加し、意図した失敗を確認する
- [ ] ローカルmigrationとAPI公開範囲を実装する
- [ ] WordPress移行元データの監査ツールを実装する
- **Status:** in_progress

### Phase 4: WordPress既定の移行接続点
- [ ] テストを先に追加し、意図した失敗を確認する
- [ ] WordPressを既定値にした参照先設定を実装する
- [ ] Supabase単独切替に承認ゲートを設ける
- **Status:** pending

### Phase 5: 検証と引き継ぎ
- [ ] Supabase契約、lint、型、既存テスト、buildを検証する
- [ ] SEO非変更、本番非変更、戻し方を確認する
- [ ] pm/PROGRESS.mdと計画ファイルを更新する
- **Status:** pending

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

## Notes

- 既存の公開12コミットと今回の移行基盤を混ぜない。
- Secret値を表示・記録・コミットしない。
- WordPress本番データ、Supabase本番データ、親リポジトリを変更しない。
- 外部調査結果は `findings.md` にのみ記録する。
