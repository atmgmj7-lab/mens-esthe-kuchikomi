# Free Official Partner Widget — 設置・運用

状態: `LOCAL_VERIFIED`。この資料は既存Phase 3 Widgetの設置手順を補足するもので、campaign発行、Partner状態遷移、外部配布、Production操作を承認するものではありません。

## 目的と表示範囲

Widgetは、対象店舗がEskomi Free Official Partnerであること、許可された口コミ集計、口コミ投稿CTAを店舗サイトに表示する任意のiframeです。口コミ本文・連絡先・Partner内部ID・認証情報・secretは表示しません。通常のShop pageへ共通Widget JavaScriptを読み込みません。

利用できるのは、公開済み店舗に紐づく有効な `shop_website` campaignと、`free_official_partner` または `active_partner` のWorkspaceだけです。Widget URLとReview URLは同じcampaign tokenから生成され、canonical shopが一致しない場合は表示しません。Widget routeは `noindex, nofollow` です。

## Partner Dashboardからの設置

設置は任意です。Partner Dashboardで次の順に進めます。

1. **Widgetを確認**で対象店舗のpreviewを開き、店名と投稿CTAを確認する。
2. **Widgetコードをコピー**で、Dashboardが生成したiframe snippetをコピーする。URL・安全なtitle・`loading="lazy"`・responsiveな最小styleを手作業で置き換えない。
3. **設置方法を見る**の案内に従い、店舗サイトの任意のHTML表示位置へ貼り付け、スマートフォン幅でも横スクロールしないことを確認する。

別店舗のsnippet、Review URL、QR、campaign tokenを混在させないでください。previewの店名、設置先店舗、CTA遷移先のcanonical shopがすべて同じであることを確認してから公開します。

## 口コミの反映

`shop_website` campaignからの投稿は、利用者の最終確認後に既存のpending moderationへ入り、承認・公開されたものだけが既存のpublic review adapterを通じてWidget集計に反映されます。pending、rejected、spamは表示しません。

有効な評価が3件未満の場合は件数のみ、3件以上では既存のAggregateRating契約が許す平均と件数のみを表示します。高評価だけを選ぶ表示は行いません。Widget routeはリクエスト時に解決するため、投稿を重複送信して更新を促す必要はありません。

## トラブルシューティング

- **Widgetが開かない**: 対象WorkspaceのPartner状態、`shop_website` campaignの有効性、店舗slugとcanonical URLの一致を運用担当へ確認してください。
- **別店舗へ遷移する / 店名が違う**: 設置を止め、Dashboardで生成したsnippetを再コピーしてください。tokenを手編集しないでください。
- **平均が表示されない**: 有効な公開評価が3件未満なら正常です。pending reviewを公開済みとして扱わないでください。
- **公開後に件数が変わらない**: review adapterの読取りを確認してください。投稿を再送せず、公開状態と既存revalidation境界を運用担当が確認します。

## Badge asset replacement point

最終のOfficial Partner画像はまだ未登録です。現行Widgetは `Eskomi Official Partner` のテキストfallbackを使います。将来の承認済みassetへ置き換える際は、`headless/lib/partner/partner-review-widget.ts` の公開Widget `badge` 表示だけを対象とし、asset pathを推測したり、Widgetの認可・campaign・口コミ集計契約を変更したりしません。asset状態は [creative-manifest.md](creative-manifest.md) を正本とします。
