# P1 Production activation plan — approval required

対象はMrs.L’Amant（WP 766）とBAMBI SPA（WP 725）の既存 `normal_listing` workspace。各操作は別承認であり、ここでは実行しない。

| OPERATION_ID | TARGET | WHY_REQUIRED / EXACT_CHANGE | PRECHECK / UNCHANGED | STOP / ROLLBACK / POSTCHECK |
|---|---|---|---|---|
| P1-01 | release branch | `6144b0f78edb02a0b3d258d2cb8e5e51e02b1cee` までのP1 UIをmainへfast-forward push | **CLOSED**: exact SHA readback済み。DB/WordPress/dataは不変 | 実行済み。rollbackは前SHAへの別承認 |
| P1-BRAND-01 | release branch | 承認済み新ロゴ・店舗画像準備中fallbackのlocal commitだけをmainへfast-forward push | P1-01後のBrand Asset Refresh exact SHA、CI、rollback SHA。DB/WordPress/dataは不変 | **別の明示承認が必要**。CI失敗で停止。rollbackは前SHAへの別承認。main SHA readback |
| P1-02 | Vercel Production | P1 UIとP1-BRAND-01を含む最終exact SHAをstaged deploy/promotion | `P1-BRAND-01` のmain readback、env名存在、staged E2E。DB/secretは不変 | staged failureで停止。前artifactへrollback。alias SHA readback |
| P1-03 | each confirmed shop | 招待先Auth userとmembershipを正しい店舗だけに作成 | 店舗/支店/担当窓口の一致。既存workspaceは不変 | mismatchで停止。membership revoke/session invalidateの承認済み手順。login→own shop確認 |
| P1-04 | each confirmed shop | Partner lifecycleを承認済み状態へ移す | membership readback。別shop/stateは不変 | state不一致で停止。既存stateへ戻す別承認。Dashboard identity readback |
| P1-05 | each activated workspace | 必要なchannelのactive campaignを作成し、個別Review URL/QR/CTA/Widgetを発行 | canonical shop/workspace/channel。private schema/anon grants不変 | duplicate/wrong-shopで停止。campaign deactivateの別承認。canonical URL/assets readback |
| P1-06 | external outreach | 承認済み文面を1店舗ずつ送信 | 正規窓口、店舗名、Eskomi URL、送信許諾。未確認店舗は不変 | ambiguityで停止。送信取消は通常不可。delivery記録のみ |
| P1-07 | real review/moderation | 実利用者の投稿とhuman moderation | 中立性、canonical campaign、本人最終確認。auto publish不変 | wrong attribution/PIIで停止。pending/rejectへ戻す承認済み手順。public/readback/Widget確認 |

P1-01は完了済みです。`P1-BRAND-01`、P1-02以降の各行は `USER_APPROVAL_REQUIRED = YES`。migrationはこのBatchで必要と確認されていないため、operationに含めない。

## Model Shop substitution checklist

Model Shopの `shop/workspace/state/campaign/asset` はP1へコピーしない。P1ごとに、canonical shop → existing workspace → confirmed membership → lifecycle → per-channel campaign → server readback Review URL/QR/LINE/CTA/Widget の順で新規に照合する。実token/URLはreadback前に作成・配布しない。
