import Link from "next/link";
import type { OperatorShopPage, OperatorShopRecord } from "@/lib/dashboard/operator-shop-projection";
import { ManageLegacyShopButton, UnlistLegacyShopButton } from "./ManagedShopForms";
import styles from "./OperatorShops.module.css";

const partnerStateLabel: Record<string, string> = {
  normal_listing: "通常掲載",
  shop_confirmed: "店舗確認済み",
  free_official_partner: "公式パートナー",
  active_partner: "店舗アカウント有効",
};

const assetLabel = {
  ready: "利用可",
  not_ready: "未準備",
  unavailable: "確認不可",
  identity_mismatch: "照合不一致",
} as const;

function metric(value: number | null): string {
  return value === null ? "確認不可" : String(value);
}

function partnerLabel(record: OperatorShopRecord): string {
  if (record.partner.status === "available") return partnerStateLabel[record.partner.workspaceState ?? ""] ?? "状態を確認";
  if (record.partner.status === "identity_mismatch") return "照合不一致";
  if (record.partner.status === "not_observed") return "準備状況を確認中";
  return "確認不可";
}

function statusClass(status: string): string {
  return status === "available" || status === "ready" ? styles.statusReady : styles.statusPending;
}

function AssetSummary({ record }: { record: OperatorShopRecord }) {
  return (
    <dl className={styles.assetSummary} aria-label="口コミ導線の状態">
      <div><dt>QR</dt><dd className={statusClass(record.assets.qr)}>{assetLabel[record.assets.qr]}</dd></div>
      <div><dt>LINE</dt><dd className={statusClass(record.assets.line)}>{assetLabel[record.assets.line]}</dd></div>
      <div><dt>店舗サイト案内</dt><dd className={statusClass(record.assets.websiteCta)}>{assetLabel[record.assets.websiteCta]}</dd></div>
      <div><dt>口コミ表示</dt><dd className={statusClass(record.assets.widget)}>{assetLabel[record.assets.widget]}</dd></div>
    </dl>
  );
}

export function OperatorShopsList({ data }: { data: OperatorShopPage }) {
  const previousHref = data.page > 1 ? `/dashboard/shops/?page=${data.page - 1}&q=${encodeURIComponent(data.query)}` : null;
  const nextHref = data.page < data.totalPages ? `/dashboard/shops/?page=${data.page + 1}&q=${encodeURIComponent(data.query)}` : null;
  return (
    <section className={styles.page} aria-labelledby="operator-shops-heading">
      <div className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>運営用の確認画面</p>
          <h2 id="operator-shops-heading">店舗管理</h2>
          <p>公開中の掲載情報と、店舗アカウント・口コミ案内の準備状況を確認します。運営は新規追加・既存店編集をそのまま公開でき、掲載停止は確認画面からいつでも取り消せます。</p>
        </div>
        <Link href="/dashboard/shops/new/" className={styles.primaryLink}>新規店舗を追加</Link>
      </div>

      <form className={styles.search} method="get" action="/dashboard/shops/">
        <label htmlFor="operator-shop-query">店舗を検索</label>
        <input id="operator-shop-query" name="q" type="search" defaultValue={data.query} placeholder="店舗名・エリア" />
        <button type="submit">検索</button>
      </form>

      <p className={styles.resultMeta}>{data.total} 店舗中 {data.records.length} 件を表示 — 店舗アカウントの表示がない場合でも、未作成とは断定しません。</p>
      {data.records.length === 0 ? <p className={styles.empty}>条件に一致する公開店舗はありません。</p> : (
        <>
          <div className={styles.tableRegion} tabIndex={0} aria-label="店舗一覧">
            <table className={styles.table}>
              <thead><tr><th>店舗 / 公開情報</th><th>店舗アカウント</th><th>口コミ</th><th>口コミの案内</th><th><span className={styles.srOnly}>操作</span></th></tr></thead>
              <tbody>{data.records.map((record) => (
                <tr key={record.publicShop.wpShopId}>
                  <td><strong>{record.publicShop.title}</strong><span>{record.publicShop.areaName ?? "エリア未確認"}</span></td>
                  <td><strong className={statusClass(record.partner.status)}>{partnerLabel(record)}</strong><span>{record.partner.membershipStatus === "not_available" ? "担当者情報は非表示" : "担当者情報を確認中"}</span></td>
                  <td><strong>投稿 {metric(record.reviews.submitted)}</strong><span>審査中 {metric(record.reviews.pending)} / 公開 {metric(record.reviews.published)}</span></td>
                  <td><AssetSummary record={record} /></td>
                  <td><Link href={`/dashboard/shops/${record.publicShop.wpShopId}/`} className={styles.rowLink}>詳細</Link></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className={styles.cards} aria-label="店舗一覧（モバイル）">{data.records.map((record) => (
            <article className={styles.card} key={record.publicShop.wpShopId}>
              <p className={styles.cardMeta}>{record.publicShop.areaName ?? "エリア未確認"}</p>
              <h3>{record.publicShop.title}</h3>
              <p><strong className={statusClass(record.partner.status)}>{partnerLabel(record)}</strong></p>
              <p>口コミ: 投稿 {metric(record.reviews.submitted)} / 審査中 {metric(record.reviews.pending)} / 公開 {metric(record.reviews.published)}</p>
              <AssetSummary record={record} />
              <Link href={`/dashboard/shops/${record.publicShop.wpShopId}/`} className={styles.rowLink}>店舗詳細を開く</Link>
            </article>
          ))}</div>
        </>
      )}
      <nav className={styles.pagination} aria-label="店舗一覧のページ移動">
        {previousHref ? <Link href={previousHref}>前へ</Link> : <span>前へ</span>}
        <span>{data.page} / {data.totalPages}</span>
        {nextHref ? <Link href={nextHref}>次へ</Link> : <span>次へ</span>}
      </nav>
    </section>
  );
}

export function OperatorShopDetail({ record }: { record: OperatorShopRecord }) {
  const { publicShop, partner, reviews, campaigns, assets } = record;
  return (
    <section className={styles.page} aria-labelledby="operator-shop-detail-heading">
      <p className={styles.back}><Link href="/dashboard/shops/">← 店舗一覧</Link></p>
      <div className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>公開中の掲載情報</p>
          <h2 id="operator-shop-detail-heading">{publicShop.title}</h2>
          <p>{publicShop.areaName ?? "エリア未確認"}</p>
        </div>
        <Link href={`/dashboard/shops/${publicShop.wpShopId}/edit/`} className={styles.primaryLink}>掲載内容を確認</Link>
      </div>

      <div className={styles.detailGrid}>
        <section className={styles.panel}><h3>公開情報</h3><dl className={styles.detailList}>
          <div><dt>公開ページ</dt><dd><a href={publicShop.canonicalUrl} target="_blank" rel="noreferrer">公開店舗ページを確認 ↗</a></dd></div>
          <div><dt>公式URL</dt><dd>{publicShop.officialUrl ? <a href={publicShop.officialUrl} target="_blank" rel="noreferrer">公式サイト ↗</a> : "未入力"}</dd></div>
          <div><dt>公開状態</dt><dd>{publicShop.publicationStatus ?? "確認不可"}</dd></div>
        </dl></section>
        <section className={styles.panel}><h3>Web管理</h3><p>WordPress管理画面を開かず、現在の公開情報を読み込んで運営用のWeb管理を開始します。保存した内容はすぐに公開されます。</p><ManageLegacyShopButton wpShopId={publicShop.wpShopId} /></section>
        <section className={styles.panel}><h3>店舗アカウント</h3><dl className={styles.detailList}>
          <div><dt>準備状況</dt><dd>{partnerLabel(record)}</dd></div>
          <div><dt>担当者情報</dt><dd>{partner.membershipStatus === "not_available" ? "個人情報を含むため、この一覧には表示しません" : "確認中"}</dd></div>
          <div><dt>申請状況</dt><dd>{partner.registrationStatus ?? "確認中"}</dd></div>
        </dl><p className={styles.note}>{partner.message}</p></section>
        <section className={styles.panel}><h3>口コミ</h3><dl className={styles.detailList}>
          <div><dt>投稿済み</dt><dd>{metric(reviews.submitted)}</dd></div><div><dt>審査中</dt><dd>{metric(reviews.pending)}</dd></div><div><dt>公開済み</dt><dd>{metric(reviews.published)}</dd></div>
        </dl><p className={styles.note}>店舗運営者にレビュー本文・投稿者情報・モデレーション権限は投影しません。</p></section>
        <section className={styles.panel}><h3>口コミの案内</h3><dl className={styles.detailList}>
          <div><dt>案内の数</dt><dd>{campaigns.total ?? "確認不可"}</dd></div>
          <div><dt>使える案内</dt><dd>{campaigns.activeChannels.length ? campaigns.activeChannels.join(" / ") : "未準備"}</dd></div>
        </dl><p className={styles.note}>個別のリンクやQRの値は、この画面には表示しません。</p></section>
        <section className={styles.panel}><h3>店頭・店舗サイトで使うもの</h3><AssetSummary record={record} /><p className={styles.note}>利用可のものだけを表示します。個別の内容は、店舗用メニューで確認します。</p></section>
        <section className={styles.panel}><h3>掲載を停止・再開</h3><p>通常の削除は行いません。掲載を停止すると公開一覧・検索・詳細から外れますが、店舗ID・slug・口コミ・改訂履歴を保持したまま再掲載できます。</p><UnlistLegacyShopButton wpShopId={publicShop.wpShopId} shopName={publicShop.title} /></section>
      </div>
    </section>
  );
}
