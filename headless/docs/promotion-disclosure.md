# Q-05 PR・広告枠表記整理

## 判定方針

PR・広告判定は `headless/lib/promotion-disclosure.ts` に集約する。`is_pr`、`sponsored`、`paid_placement`、広告契約ID、アフィリエイト系フィールド、`promotion_type` が明示されている場合だけPR/広告として扱う。

`featured`、`recommended`、`pickup` はPRとは断定しない。ただし自然ランキングの順位番号を付ける根拠としても使わず、手動注目枠または要確認として扱う。

## 表示ルール

自然ランキングは `selectRankingTopShops()` でPR/広告を除外する。PR/広告は `AreaPromotionSection` で「PR・広告掲載枠」として別枠表示する。

## 外部リンクrel

PR/広告判定済み店舗の公式外部リンクだけ `sponsored nofollow noreferrer` を付ける。通常店舗の外部リンクには `sponsored` と `nofollow` を付けない。

## schema

エリアページの `ItemList` JSON-LD は自然枠のみを対象にし、PR/広告店舗を自然順位の構造化データに混ぜない。

## 未確定事項

PRラベルの最終文言、広告掲載基準、契約終了後の扱いは運用ルールとして人間確認が必要。現実装では期限外PRは自然順位に戻さず `unknown` として扱う。
