import Link from "next/link";
import type { OperatorListingStatus, OperatorShopPage, OperatorShopRecord } from "@/lib/dashboard/operator-shop-projection";
import { ManageLegacyShopButton, UnlistLegacyShopButton } from "./ManagedShopForms";
import styles from "./OperatorShops.module.css";

const partnerStateLabel: Record<string, string> = {
  normal_listing: "通常掲載",
  shop_confirmed: "店舗確認済み",
  free_official_partner: "無料公式パートナー",
  active_partner: "店舗アカウント有効",
};

const assetLabel = {
  ready: "利用可",
  not_ready: "有効な案内なし",
  unavailable: "取得できません",
  identity_mismatch: "照合不一致",
} as const;

const listingLabel: Record<OperatorListingStatus, string> = {
  listed: "掲載中",
  unlisted: "掲載停止",
  deleted: "削除済み",
};

function metric(value: number | null, status: OperatorShopRecord["reviews"]["status"]): string {
  if (value !== null) return String(value);
  if (status === "not_observed") return "未連携";
  if (status === "identity_mismatch") return "照合不一致";
  return "取得できません";
}

function partnerLabel(record: OperatorShopRecord): string {
  if (record.partner.status === "available") return partnerStateLabel[record.partner.workspaceState ?? ""] ?? "状態を確認";
  if (record.partner.status === "identity_mismatch") return "照合不一致";
  if (record.partner.status === "not_observed") return "未確認";
  return "取得できません";
}

function partnerNote(record: OperatorShopRecord): string {
  if (record.partner.status === "not_observed") return "未導入・未設定とは断定しません";
  if (record.partner.status === "identity_mismatch") return "照合不一致のため非表示";
  if (record.partner.status === "unavailable") return "利用状況を取得できません";
  return record.partner.membershipStatus === "not_available" ? "担当者情報は非表示" : "担当者情報を取得できません";
}

function statusClass(status: string): string {
  return status === "available" || status === "ready" ? styles.statusReady : styles.statusPending;
}

function listingClass(status: OperatorListingStatus): string {
  return status === "listed" ? styles.listingPublished : status === "unlisted" ? styles.listingUnlisted : styles.listingDeleted;
}

function ListingBadge({ status }: { status: OperatorListingStatus }) {
  return <span className={`${styles.listingBadge} ${listingClass(status)}`}>{listingLabel[status]}</span>;
}

function detailHref(record: OperatorShopRecord): string {
  return record.publicShop.managedShopId
    ? `/dashboard/shops/managed/${record.publicShop.managedShopId}/`
    : `/dashboard/shops/${record.publicShop.wpShopId}/`;
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
  const href = (listing = data.listingFilter, page = 1) => {
    const params = new URLSearchParams({ listing });
    if (data.query) params.set("q", data.query);
    if (page > 1) params.set("page", String(page));
    return `/dashboard/shops/?${params.toString()}`;
  };
  const previousHref = data.page > 1 ? href(data.listingFilter, data.page - 1) : null;
  const nextHref = data.page < data.totalPages ? href(data.listingFilter, data.page + 1) : null;
  return (
    <section className={styles.page} aria-labelledby="operator-shops-heading">
      <div className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>運営用の確認画面</p>
          <h2 id="operator-shops-heading">店舗管理</h2>
          <p>掲載状態、パートナー利用準備、口コミ導線を別々に確認します。掲載停止と削除済みは公開されず、削除済みを復元しても自動で再掲載されません。</p>
        </div>
        <Link href="/dashboard/shops/new/" className={styles.primaryLink}>新規店舗を追加</Link>
      </div>

      <form className={styles.search} method="get" action="/dashboard/shops/">
        <input type="hidden" name="listing" value={data.listingFilter} />
        <label htmlFor="operator-shop-query">店舗を検索</label>
        <input id="operator-shop-query" name="q" type="search" defaultValue={data.query} placeholder="店舗名・エリア" />
        <button type="submit">検索</button>
      </form>

      <nav className={styles.listingTabs} aria-label="掲載状態で店舗を絞り込み">
        {(["listed", "unlisted", "deleted"] as const).map((status) => <Link key={status} href={href(status)} className={`${styles.listingTab} ${data.listingFilter === status ? styles.listingTabActive : ""}`} aria-current={data.listingFilter === status ? "page" : undefined}>{listingLabel[status]} <span>{data.listingCounts[status]}</span></Link>)}
      </nav>
      <p className={styles.resultMeta}>{listingLabel[data.listingFilter]} {data.total} 店舗中 {data.records.length} 件を表示 — パートナー欄の未確認は、未導入・未設定の確定ではありません。</p>
      {data.records.length === 0 ? <p className={styles.empty}>条件に一致する{listingLabel[data.listingFilter]}店舗はありません。</p> : (
        <>
          <div className={styles.tableRegion} tabIndex={0} aria-label="店舗一覧">
            <table className={styles.table}>
              <thead><tr><th>店舗 / 掲載状態</th><th>パートナー利用準備<br /><span>掲載状態・料金とは別</span></th><th>口コミ</th><th>口コミの案内</th><th><span className={styles.srOnly}>操作</span></th></tr></thead>
              <tbody>{data.records.map((record) => (
                <tr key={record.publicShop.wpShopId}>
                  <td><strong>{record.publicShop.title}</strong><span className={styles.listingLine}><ListingBadge status={record.publicShop.listingStatus} />{record.publicShop.areaName ?? "エリア未確認"}</span></td>
                  <td><strong className={statusClass(record.partner.status)}>{partnerLabel(record)}</strong><span>{partnerNote(record)}</span></td>
                  <td><strong>投稿 {metric(record.reviews.submitted, record.reviews.status)}</strong><span>審査中 {metric(record.reviews.pending, record.reviews.status)} / 公開 {metric(record.reviews.published, record.reviews.status)}</span></td>
                  <td><AssetSummary record={record} /></td>
                  <td><Link href={detailHref(record)} className={styles.rowLink}>詳細</Link></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className={styles.cards} aria-label="店舗一覧（モバイル）">{data.records.map((record) => (
            <article className={styles.card} key={record.publicShop.wpShopId}>
              <p className={styles.cardMeta}><ListingBadge status={record.publicShop.listingStatus} /> {record.publicShop.areaName ?? "エリア未確認"}</p>
              <h3>{record.publicShop.title}</h3>
              <p><strong className={statusClass(record.partner.status)}>{partnerLabel(record)}</strong><br /><span className={styles.cardAssist}>{partnerNote(record)}</span></p>
              <p>口コミ: 投稿 {metric(record.reviews.submitted, record.reviews.status)} / 審査中 {metric(record.reviews.pending, record.reviews.status)} / 公開 {metric(record.reviews.published, record.reviews.status)}</p>
              <AssetSummary record={record} />
              <Link href={detailHref(record)} className={styles.rowLink}>店舗詳細を開く</Link>
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
          <p className={styles.eyebrow}>{listingLabel[publicShop.listingStatus]}</p>
          <h2 id="operator-shop-detail-heading">{publicShop.title}</h2>
          <p>{publicShop.areaName ?? "エリア未確認"}</p>
        </div>
        <Link href={`/dashboard/shops/${publicShop.wpShopId}/edit/`} className={styles.primaryLink}>掲載内容を確認</Link>
      </div>

      <div className={styles.detailGrid}>
        <section className={styles.panel}><h3>掲載状態</h3><dl className={styles.detailList}>
          <div><dt>掲載状態</dt><dd><ListingBadge status={publicShop.listingStatus} /></dd></div>
          <div><dt>公開ページ</dt><dd>{publicShop.listingStatus === "listed" ? <a href={publicShop.canonicalUrl} target="_blank" rel="noreferrer">公開店舗ページを確認 ↗</a> : "公開対象外（URLは保持）"}</dd></div>
          <div><dt>公式URL</dt><dd>{publicShop.officialUrl ? <a href={publicShop.officialUrl} target="_blank" rel="noreferrer">公式サイト ↗</a> : "未入力"}</dd></div>
          <div><dt>WordPress状態</dt><dd>{publicShop.publicationStatus ?? "取得できません"}</dd></div>
        </dl></section>
        <section className={styles.panel}><h3>Web管理</h3><p>WordPress管理画面を開かず、現在の公開情報を読み込んで運営用のWeb管理を開始します。保存した内容はすぐに公開されます。</p><ManageLegacyShopButton wpShopId={publicShop.wpShopId} /></section>
        <section className={styles.panel}><h3>店舗アカウント</h3><dl className={styles.detailList}>
          <div><dt>準備状況</dt><dd>{partnerLabel(record)}</dd></div>
          <div><dt>担当者情報</dt><dd>{partner.membershipStatus === "not_available" ? "個人情報を含むため、この一覧には表示しません" : "確認中"}</dd></div>
          <div><dt>申請状況</dt><dd>{partner.registrationStatus ?? "確認中"}</dd></div>
        </dl><p className={styles.note}>{partner.message}</p></section>
        <section className={styles.panel}><h3>口コミ</h3><dl className={styles.detailList}>
          <div><dt>投稿済み</dt><dd>{metric(reviews.submitted, reviews.status)}</dd></div><div><dt>審査中</dt><dd>{metric(reviews.pending, reviews.status)}</dd></div><div><dt>公開済み</dt><dd>{metric(reviews.published, reviews.status)}</dd></div>
        </dl><p className={styles.note}>店舗運営者にレビュー本文・投稿者情報・モデレーション権限は投影しません。</p></section>
        <section className={styles.panel}><h3>口コミの案内</h3><dl className={styles.detailList}>
          <div><dt>案内の数</dt><dd>{campaigns.total ?? "確認不可"}</dd></div>
          <div><dt>使える案内</dt><dd>{campaigns.activeChannels.length ? campaigns.activeChannels.join(" / ") : "未準備"}</dd></div>
        </dl><p className={styles.note}>個別のリンクやQRの値は、この画面には表示しません。</p></section>
        <section className={styles.panel}><h3>店頭・店舗サイトで使うもの</h3><AssetSummary record={record} /><p className={styles.note}>利用可のものだけを表示します。個別の内容は、店舗用メニューで確認します。</p></section>
        <section className={styles.panel}><h3>掲載を停止・削除済み</h3>{publicShop.listingStatus === "listed" ? <><p>掲載停止は一時非公開です。公開一覧・検索・詳細から外れますが、店舗ID・slug・口コミ・改訂履歴を保持したまま、あとで明示的に再掲載できます。</p><UnlistLegacyShopButton wpShopId={publicShop.wpShopId} shopName={publicShop.title} /></> : publicShop.listingStatus === "unlisted" ? <p>掲載停止中です。削除済みに移す・再掲載する操作は、Web管理画面で確認付きで行います。</p> : <p>削除済みとして保管中です。復元すると掲載停止へ戻り、再掲載は別の明示操作が必要です。</p>}</section>
      </div>
    </section>
  );
}
