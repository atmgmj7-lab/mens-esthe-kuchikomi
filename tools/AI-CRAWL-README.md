# AI巡回エンジン

## DEPRECATED / 実行禁止

この試作からWordPressへ直接POSTする旧方式は廃止しました。`ai_crawl_engine.py`は公式サイトを解析し、将来の非公開staging候補を組み立てるところまでに限定しています。

## 現在の利用範囲

- `TARGET_URL`、店舗ID、店舗名、Geminiキーを入力に使います。
- 料金、紹介、公式URL、年齢などの候補は公開画面へ反映しません。
- Supabaseの非公開staging、出典確認、差分承認が完成するまで定期実行しません。
- 日次3項目の更新はこの試作ではなく、日次専用bridgeだけを利用します。

## ローカル確認

```bash
python3 ai_crawl_engine.py
```

実行結果は候補作成の確認だけに使い、push、deploy、本番書込は別承認まで行いません。
