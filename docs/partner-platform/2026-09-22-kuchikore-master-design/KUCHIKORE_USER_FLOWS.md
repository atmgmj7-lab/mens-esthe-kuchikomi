# クチコレで観測したユーザーフロー

## 1. 口コミ取得

```text
管理者 / 店舗
  → アンケート一覧
  → preview または QR
  → 顧客の言語選択
  → 開始 CTA
  → 回答
  → AI生成を含みうる後続処理
```

良い点は、一覧からpreview / QRという配布物へ直接行けること。Eskomiでは顧客の投稿意思、rating/tags不変、user final confirmation、moderationを優先し、生成reviewを直接公開する流れにはしない。

## 2. 口コミ管理

```text
Dashboard
  → 口コミ一覧
  → 期間 / rating / reply state / language filter
  → 対象選択
  → 詳細または返信関連操作
```

Eskomiは、Partnerが見る集計と、Eskomi operatorが行うmoderation queueを分離する。Partnerにはcustomer identity、本文、moderation decision操作を公開しない。

## 3. 成果の振り返り

```text
Dashboard
  → KPI snapshot
  → 診断 / 月次レポート
  → period change
  → trend / delta / empty state
```

EskomiはReview acquisitionの値へ絞る。MEO順位、Google Business Profile、Google投稿は採用しない。

## 4. 管理と権限

```text
sidebar
  → 店舗情報 / スタッフ管理
  → list
  → create or edit
```

Eskomi Pilotは `owner` / `manager` と単一workspaceを維持する。将来はworkspace switcher → scope-confirmed action → audit logの順でmulti-shopへ拡張する。
