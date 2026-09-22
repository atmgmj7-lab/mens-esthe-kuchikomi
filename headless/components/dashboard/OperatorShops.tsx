import Link from "next/link";
import type { OperatorShopPage, OperatorShopRecord } from "@/lib/dashboard/operator-shop-projection";
import styles from "./OperatorShops.module.css";

const partnerStateLabel: Record<string, string> = {
  normal_listing: "通常掲載",
  shop_confirmed: "店舗確認済み",
  free_official_partner: "Free Official Partner",
  active_partner: "Active Partner",
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
  if (record.partner.status === "not_observed") return "安全な投影で未観測";
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
      <div><dt>CTA</dt><dd className={statusClass(record.assets.websiteCta)}>{assetLabel[record.assets.websiteCta]}</dd></div>
      <div><dt>Widget</dt><dd className={statusClass(record.assets.widget)}>{assetLabel[record.assets.widget]}</dd></div>
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
          <p className={styles.eyebrow}>Operator Control Center</p>
          <h2 id="operator-shops-heading">店舗管理</h2>
          <p>公開店舗情報はWordPressを正本として表示し、Partner・口コミ・Campaignは安全なサーバー投影だけを統合します。</p>
        </div>
        <Link href="/dashboard/shops/new/" className={styles.primaryLink}>店舗を追加</Link>
      </div>

      <form className={styles.search} method="get" action="/dashboard/shops/">
        <label htmlFor="operator-shop-query">店舗を検索</label>
        <input id="operator-shop-query" name="q" type="search" defaultValue={data.query} placeholder="店舗名・slug・エリア" />
        <button type="submit">検索</button>
      </form>

      <p className={styles.resultMeta}>{data.total} 店舗中 {data.records.length} 件を表示 — Partner情報が未観測でも未作成とは断定しません。</p>
      {data.records.length === 0 ? <p className={styles.empty}>条件に一致する公開店舗はありません。</p> : (
        <>
          <div className={styles.tableRegion} tabIndex={0} aria-label="店舗一覧">
            <table className={styles.table}>
              <thead><tr><th>店舗 / 公開情報</th><th>Partner</th><th>口コミ</th><th>Campaign / 導線</th><th><span className={styles.srOnly}>操作</span></th></tr></thead>
              <tbody>{data.records.map((record) => (
                <tr key={record.publicShop.wpShopId}>
                  <td><strong>{record.publicShop.title}</strong><span>{record.publicShop.areaName ?? "エリア未確認"}</span><span className={styles.muted}>WP ID {record.publicShop.wpShopId}</span></td>
                  <td><strong className={statusClass(record.partner.status)}>{partnerLabel(record)}</strong><span>Membership: {record.partner.membershipStatus === "not_available" ? "個人情報非表示" : "未観測"}</span></td>
                  <td><strong>投稿 {metric(record.reviews.submitted)}</strong><span>審査中 {metric(record.reviews.pending)} / 公開 {metric(record.reviews.published)}</span></td>
                  <td><AssetSummary record={record} /></td>
                  <td><Link href={`/dashboard/shops/${record.publicShop.wpShopId}/`} className={styles.rowLink}>詳細</Link></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className={styles.cards} aria-label="店舗一覧（モバイル）">{data.records.map((record) => (
            <article className={styles.card} key={record.publicShop.wpShopId}>
              <p className={styles.cardMeta}>{record.publicShop.areaName ?? "エリア未確認"} · WP ID {record.publicShop.wpShopId}</p>
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
          <p className={styles.eyebrow}>Canonical WordPress Shop</p>
          <h2 id="operator-shop-detail-heading">{publicShop.title}</h2>
          <p>{publicShop.areaName ?? "エリア未確認"} · WP ID {publicShop.wpShopId}</p>
        </div>
        <Link href={`/dashboard/shops/${publicShop.wpShopId}/edit/`} className={styles.primaryLink}>公開情報を編集</Link>
      </div>

      <div className={styles.detailGrid}>
        <section className={styles.panel}><h3>公開情報</h3><dl className={styles.detailList}>
          <div><dt>Canonical URL</dt><dd><a href={publicShop.canonicalUrl} target="_blank" rel="noreferrer">公開店舗ページを確認 ↗</a></dd></div>
          <div><dt>公式URL</dt><dd>{publicShop.officialUrl ? <a href={publicShop.officialUrl} target="_blank" rel="noreferrer">公式サイト ↗</a> : "未入力"}</dd></div>
          <div><dt>公開状態</dt><dd>{publicShop.publicationStatus ?? "確認不可"}</dd></div>
        </dl></section>
        <section className={styles.panel}><h3>Partner</h3><dl className={styles.detailList}>
          <div><dt>Workspace / state</dt><dd>{partnerLabel(record)}</dd></div>
          <div><dt>Membership</dt><dd>{partner.membershipStatus === "not_available" ? "個人情報を含むため一覧投影なし" : "安全な投影で未観測"}</dd></div>
          <div><dt>申請状態</dt><dd>{partner.registrationStatus ?? "未観測"}</dd></div>
        </dl><p className={styles.note}>{partner.message}</p></section>
        <section className={styles.panel}><h3>口コミ</h3><dl className={styles.detailList}>
          <div><dt>投稿済み</dt><dd>{metric(reviews.submitted)}</dd></div><div><dt>審査中</dt><dd>{metric(reviews.pending)}</dd></div><div><dt>公開済み</dt><dd>{metric(reviews.published)}</dd></div>
        </dl><p className={styles.note}>店舗運営者にレビュー本文・投稿者情報・モデレーション権限は投影しません。</p></section>
        <section className={styles.panel}><h3>Campaign</h3><dl className={styles.detailList}>
          <div><dt>Campaign数</dt><dd>{campaigns.total ?? "確認不可"}</dd></div>
          <div><dt>有効チャネル</dt><dd>{campaigns.activeChannels.length ? campaigns.activeChannels.join(" / ") : "未準備"}</dd></div>
        </dl><p className={styles.note}>Campaign token・公開リンクの値はこの画面に表示しません。</p></section>
        <section className={styles.panel}><h3>QR / LINE / CTA / Widget</h3><AssetSummary record={record} /><p className={styles.note}>利用可は有効Campaignの安全な状態投影です。素材の値は詳細なPartner運用画面でのみ確認します。</p></section>
        <section className={styles.panel}><h3>掲載対象外</h3><p>通常の削除は行いません。対象外化は履歴を保持し、理由を記録した可逆操作としてWordPress Writerへ渡します。</p><Link href={`/dashboard/shops/${publicShop.wpShopId}/edit/#listing-exclusion`} className={styles.secondaryLink}>掲載対象外の準備を開く</Link></section>
      </div>
    </section>
  );
}
