# クチコレ UI / デザインシステム分析

## 観測したパターン

- 左sidebarに機能群を置き、アンケート・店舗管理・スタッフ管理はdisclosureで畳む。
- headerに店舗context、notification badge、user menuを置く。
- DashboardはKPIカード、時系列、表、詳細リンクの縦積み。
- 一覧はtable中心、状態列とrow-level actionを持つ。
- empty stateは「対象なし」を明示し、数値欠損を0として扱わない箇所がある。

## Eskomiへの設計原則

| 原則 | 採用方法 |
|---|---|
| 5秒理解 | Homeの先頭を Action Required → review performance → acquisition assets に固定 |
| Workspace context | 画面上部に選択店舗と公開Shop linkを常設。switch時は全assetを再解決 |
| 少ない主CTA | Homeは「口コミを集める」「公開状況を見る」の二つまで |
| 安全な空状態 | 未campaignは `未準備` と次の承認/確認を説明。0レビューとは表示しない |
| 情報の段階化 | HomeはBento、Inboxは全画面table、Widget Studioはpreview中心の2カラム |
| mobile | desktopのsidebarをdrawerへ、Action Required / QR / copy / previewを一列の優先順で表示 |

## 採用しないこと

- MEOのグレード、順位カード、Google関連指標、Google投稿管理。
- customer連絡先リスト、配信、クーポン、抽選を口コミ取得の前提にする構造。
- 保存/編集/削除を一覧行に密集させる操作設計。
- 未定義または未連携の数値を見栄えのために表示すること。

## Accessibility / performance guard

- KPIはラベル、単位、更新時刻、前期間比較をテキストで併記する。
- 色のみでpending / published / action requiredを区別しない。
- chartsは必要時にlazy load、campaign tableはpagination、mobileではchartより要約とtableを優先する。
- visual orderとDOM orderを一致させ、copy / preview / install guideはキーボード到達可能にする。
