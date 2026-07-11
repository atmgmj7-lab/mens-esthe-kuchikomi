# 店舗ランキング（WordPress 手動 + 将来 Supabase 自動）

Headless（Next.js）エリアハブ `#ranking` の掲載順制御方針。

## 現状（短期）

- **データ源**: WordPress `shop` CPT の ACF
- **実装**: `lib/shop-ranking.ts` → `normalizeShop()` → `sortShopsForRanking()` / `selectRankingTopShops()`
- **本番 REST 確認済み**: `acf.area_rank` キーは全店舗に存在。値が入っている店舗のみ手動順位として反映（例: 日本橋 59 店中 1 店が `area_rank: 1`）

### `area_rank` の意味

| 値 | 意味 |
|---|---|
| `1` | 最上位 |
| `2`, `3`, … | 数値が小さいほど上位 |
| `0` / `null` / 空欄 | 未設定（自動スコアで並ぶ） |

## 正規化フィールド（ShopView.ranking）

| フィールド | 現 WP ACF | 未設定時 |
|---|---|---|
| `manualRank` | `area_rank` | `null` |
| `rankingPriority` | （将来）`ranking_priority` | `manualRank` と同値 |
| `isRankingEnabled` | （将来）`ranking_enabled` | `true` |
| `rankingReason` | （将来）`ranking_reason` | `""` |
| `isPr` | （将来）`is_pr` | `false` |
| `rankingLabel` | （将来）`ranking_label` | `""` |

## 並び替え優先順

1. `isRankingEnabled === false` → 最下位（TOP5 からは除外）
2. `manualRank` あり → 昇順（1 が最上位）
3. `manualRank` なし → 既存 `classifyShopRelation` + `areaRankingScore`
4. 更新日 → 店舗名（安定ソート）

## 表示文言（エリア共通）

- 導入文: `buildRankingIntro(hubContext)` — `displayName` + 「周辺で検討しやすい…」
- PR/広告: Q-05で自然ランキングから分離し、PR・広告掲載枠として別セクション表示
- 選定理由: `rankingReason` がある場合、ランキングカードに最大2行

---

## 将来追加したい WordPress ACF（今回は本番未追加）

店舗（`shop`）に追加推奨:

| フィールド名 | 型 | 用途 |
|---|---|---|
| `ranking_enabled` | true/false | ランキング掲載 ON/OFF（OFF は TOP 除外・下位） |
| `ranking_priority` | number | `area_rank` 代替または上書き用 |
| `ranking_reason` | text | 選定理由（カード1〜2行） |
| `ranking_label` | text | 「編集部おすすめ」等の短ラベル |
| `is_pr` | true/false | PR 表記 |
| `ranking_area_override` | relationship / text | エリア別順位の上書き（要設計） |

**運用手順（人）**: WP 管理画面 → 店舗編集 → `area_rank` に 1〜N を入力。1 が最上位。

REST 反映後、Next.js は revalidate / 再ビルドで反映。

---

## 将来 Supabase 連携（今回未実装）

手動（WP）+ 自動スコア（Supabase）を合成する想定テーブル:

```sql
-- 概念スキーマ（未作成）
ranking_overrides (
  area_slug text not null,
  shop_id bigint not null,
  manual_rank int,
  auto_score numeric,
  final_rank int,
  is_pr boolean default false,
  is_featured boolean default false,
  updated_by text,
  updated_at timestamptz,
  primary key (area_slug, shop_id)
);
```

**合成方針（案）**:

1. Supabase `manual_rank` / `auto_score` を取得（なければ WP `ShopView.ranking` をフォールバック）
2. `final_rank = coalesce(manual_rank, auto_score順)` で並べ替え
3. Headless UI は `ShopRankingMeta` の形を維持し、データ源だけ adapter で差し替え

関連コード: `lib/shop-ranking.ts`

---

## 関連ファイル

| ファイル | 役割 |
|---|---|
| `lib/shop-ranking.ts` | 正規化・ソート・TOP 抽出・文言 |
| `lib/wp/normalize.ts` | REST → `ShopView.ranking` |
| `components/area/area-hub-content.tsx` | `#ranking` セクション |
| `components/area/hub/RankingHeroCards.tsx` | ランキングカード UI |
| `lib/area-shop-list-controls.ts` | 店舗一覧「おすすめ順」も同一ソート |

## Q-03 追記（2026-07-11）

- 現在のランキング根拠は `manual` と `data-completeness`。ユーザー口コミ評価順ではない。
- `is_pr=true` の店舗は自然順位のTOP抽出から除外する。
- PR店舗へ自然順位番号を付けない。Q-05で `AreaPromotionSection` による別枠表示を実装済み。
- 口コミ評価を順位計算の主根拠には使用しない。実口コミ3件以上の信頼補正設計は、人間判断が必要な別タスクとする。
