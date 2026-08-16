# Priority 5 Primary Area Backfill Preview Summary

**Task:** UX-AREA-PRIMARY-BACKFILL-PREVIEW-01
**Generated at:** 2026-08-16T08:11:43.924Z
**Input SHA-256:** `0c64cec9c8be2e96495abc0c9acc9149e779de2fefeef08de1c614c77964309e`

## Input validation

- TOTAL_RECORDS = 214
- TOTAL_VERIFIED_EXACT = 44
- VERIFIED_NEARBY = 1
- REVIEW_REQUIRED = 156
- UNRESOLVED = 13
- WordPress public read rows = 44

## Preview classification

| Status | Count |
|---|---:|
| READY_PRIMARY_ONLY | 44 |
| NEEDS_AREA_RELATION_ADD | 0 |
| STALE_OR_IDENTITY_CONFLICT | 0 |
| EVIDENCE_OR_MAPPING_CONFLICT | 0 |

## Area counts

| Area | Slug | Exact | READY | RELATION ADD | STALE/IDENTITY | EVIDENCE/MAPPING |
|---|---|---:|---:|---:|---:|---:|
| 堺東 | sakai | 6 | 6 | 0 | 0 | 0 |
| 新大阪 | shinosaka | 3 | 3 | 0 | 0 | 0 |
| 大阪日本橋 | nihonbashi | 12 | 12 | 0 | 0 | 0 |
| 堺筋本町 | sakaisujihonmachi | 18 | 18 | 0 | 0 | 0 |
| 梅田 | umeda | 5 | 5 | 0 | 0 | 0 |

## Safety boundary

- 本番書込は実施していない。
- READY_PRIMARY_ONLYは将来`shop_primary_area_term_id`だけを設定するpreviewである。
- 既存Area relation、title、slug、status、他meta、canonical、URLは変更しない。
- 現行Primary値は`NOT_VERIFIED_CONTRACT_NOT_PRODUCTION`であり、nullとは推測しない。
- term ID 7はcanonical表示labelが「大阪日本橋」、現WordPress term nameが「日本橋」。ID・slug・routeの対応は一致している。
- この件数からT3-Aを開始できるかという事業判断は行わない。
