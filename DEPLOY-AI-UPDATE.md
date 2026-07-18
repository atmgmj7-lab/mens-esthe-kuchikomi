# 日次AI更新bridge 運用メモ

## DEPRECATED / 実行禁止

公開URLへWordPress認証を付けて直接POSTする旧手順は廃止しました。旧curlや認証headerを再利用しないでください。

## 現在の境界

- WordPressは公開データの正本です。
- 分析、空き状況、当日出勤の3項目だけをHeadlessの日次専用bridgeから更新します。
- callerは日次専用秘密鍵だけを持ち、WordPress認証はHeadlessのserver環境だけに置きます。
- 料金、紹介、公式URL、年齢、順位は、Supabaseの非公開stagingと差分承認が完成するまで公開書込禁止です。

## 安全な確認

1. 日次専用秘密鍵なしのPOSTが401になることを確認します。
2. 日次専用秘密鍵付きの空JSONが400になることを確認します。
3. 1店舗試験は、資格情報の失効・再発行チェック完了後に別途承認を得て行います。
4. 応答やログへ秘密値を表示しません。

ローカル実装ではpush、deploy、本番WordPress操作を行いません。
