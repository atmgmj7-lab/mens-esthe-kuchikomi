import type { AreaDepthEditorial } from "@/lib/area-depth-editorial";
import styles from "./AreaEditorialDepth.module.css";

function formatRate(value: number) {
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`;
}

function formatYen(value: number) {
  return `${value.toLocaleString("ja-JP")}円`;
}

function SourceNote({ editorial }: { editorial: AreaDepthEditorial }) {
  return (
    <p className={styles.sourceNote}>
      公式情報など店舗自身が公開する一次情報を確認。調査更新日：{editorial.observedDateLabel}
    </p>
  );
}

export function AreaEditorialCoverageBlock({ editorial }: { editorial: AreaDepthEditorial | null }) {
  if (!editorial?.featureFlags.coverage) return null;

  return (
    <section className={`${styles.section} ${styles.coverage}`} data-area-depth="coverage" aria-labelledby="area-depth-coverage-title">
      <div className={styles.headingRow}>
        <div>
          <p className={styles.eyebrow}>ESKOMI EDITORIAL DATA</p>
          <h2 id="area-depth-coverage-title">エスコミ編集部の公開情報調査</h2>
        </div>
        <p className={styles.sampleBadge}>調査対象 {editorial.expectedPublicShopCount}店舗</p>
      </div>
      <p className={styles.lead}>
        {editorial.areaLabel}の公開{editorial.expectedPublicShopCount}店舗について、項目ごとに公式確認できた件数と未確認件数を分けて掲載します。
      </p>
      <dl className={styles.coverageGrid}>
        {editorial.fieldCoverage.map((field) => (
          <div className={styles.metricCard} key={field.key}>
            <dt>{field.label}</dt>
            <dd><strong>{field.verifiedCount}件</strong><span>{formatRate(field.verificationRate)}</span></dd>
            <dd className={styles.missing}>未確認 {field.missingCount}件</dd>
          </div>
        ))}
      </dl>
      <SourceNote editorial={editorial} />
    </section>
  );
}

export function AreaEditorialPortalTherapist({ editorial }: { editorial: AreaDepthEditorial | null }) {
  if (!editorial || (!editorial.featureFlags.portals && !editorial.featureFlags.therapists)) return null;

  return (
    <section className={styles.section} data-area-depth="portal-therapist" aria-labelledby="area-depth-source-title">
      <p className={styles.eyebrow}>CROSS-SOURCE CHECK</p>
      <h2 id="area-depth-source-title">編集部の横断確認データ</h2>
      <div className={styles.twoColumnGrid}>
        {editorial.featureFlags.portals ? (
          <article className={styles.detailCard}>
            <p className={styles.cardLabel}>外部媒体の掲載確認</p>
            <h3>複数の外部媒体で掲載を確認した店舗</h3>
            <p className={styles.largeValue}>{editorial.portals.multiPortalShopCount}<span>店舗</span></p>
            <p>
              掲載確認は{editorial.portals.presenceShopCount}店舗、そのうち複数媒体で確認できた店舗だけを集計しています。
            </p>
          </article>
        ) : null}
        {editorial.featureFlags.therapists ? (
          <article className={styles.detailCard}>
            <p className={styles.cardLabel}>在籍プロフィールの確認標本</p>
            <h3>{editorial.therapists.availableShopCount}店舗の公開プロフィール</h3>
            <p className={styles.largeValue}>{editorial.therapists.profileCount}<span>名</span></p>
            <p>年齢確認済み{editorial.therapists.ageKnownCount}名を分布の母数とし、店舗未割当や年齢不明は除外しています。</p>
            <ul className={styles.inlineList}>
              {editorial.therapists.ageBands.map((band) => <li key={band.label}>{band.label} {band.count}名</li>)}
            </ul>
          </article>
        ) : null}
      </div>
      <p className={styles.sourceNote}>
        外部媒体は公開掲載の確認事実、在籍プロフィールは店舗自身が公開する一次情報を集計。調査更新日：{editorial.observedDateLabel}
      </p>
    </section>
  );
}

export function AreaEditorialPriceSummary({ editorial }: { editorial: AreaDepthEditorial | null }) {
  if (!editorial?.featureFlags.price || editorial.price.sampleSize < 5) return null;
  const limited = editorial.price.status === "LIMITED_SAMPLE";

  return (
    <aside className={styles.inlinePanel} data-area-depth="price" aria-label="公式確認済み料金分布">
      <div className={styles.headingRow}>
        <div>
          <p className={styles.cardLabel}>公式確認済み料金分布</p>
          <h3>{limited ? `確認済み${editorial.price.sampleSize}件の限定標本` : `確認済み${editorial.price.sampleSize}件の料金データ`}</h3>
        </div>
        {limited ? <span className={styles.limitedBadge}>LIMITED SAMPLE</span> : null}
      </div>
      <dl className={styles.summaryGrid}>
        <div><dt>最小</dt><dd>{formatYen(editorial.price.minimumYen)}</dd></div>
        <div><dt>中央値</dt><dd>{formatYen(editorial.price.medianYen)}</dd></div>
        <div><dt>最大</dt><dd>{formatYen(editorial.price.maximumYen)}</dd></div>
      </dl>
      <ul className={styles.bandList}>
        {editorial.price.bands.map((band) => <li key={band.label}><span>{band.label}</span><strong>{band.count}件</strong></li>)}
      </ul>
      {limited ? <p className={styles.caution}>確認済み標本が少ないため、エリア全体の相場を示すものではありません。</p> : null}
      <SourceNote editorial={editorial} />
    </aside>
  );
}

export function AreaEditorialHoursSummary({ editorial }: { editorial: AreaDepthEditorial | null }) {
  if (!editorial?.featureFlags.hours || editorial.hours.verifiedCount < 5) return null;

  return (
    <aside className={styles.inlinePanel} data-area-depth="hours" aria-label="公式確認済み営業時間データ">
      <p className={styles.cardLabel}>公式確認済み営業時間データ</p>
      <h3>{editorial.expectedPublicShopCount}店舗中 {editorial.hours.verifiedCount}件を確認</h3>
      <dl className={styles.summaryGrid}>
        <div><dt>時刻解析可能</dt><dd>{editorial.hours.parsableSampleSize}件</dd></div>
        <div><dt>深夜営業確認</dt><dd>{editorial.hours.lateNightCount}件</dd></div>
        <div><dt>24時以降</dt><dd>{editorial.hours.afterMidnightCount}件</dd></div>
        <div><dt>最早開店</dt><dd>{editorial.hours.earliestOpening}</dd></div>
        <div><dt>最終閉店</dt><dd>{editorial.hours.latestClosing}</dd></div>
      </dl>
      <p className={styles.caution}>閉店時刻を解析できない確認済み行は件数だけに含め、時刻統計から除外しています。</p>
      <SourceNote editorial={editorial} />
    </aside>
  );
}

export function AreaEditorialStationSummary({ editorial }: { editorial: AreaDepthEditorial | null }) {
  if (!editorial?.featureFlags.station || editorial.station.sampleSize < 5) return null;

  return (
    <section className={styles.section} data-area-depth="station" aria-labelledby="area-depth-station-title">
      <p className={styles.eyebrow}>STATION &amp; ACCESS</p>
      <h2 id="area-depth-station-title">公式確認済みの駅・アクセス傾向</h2>
      <p className={styles.lead}>駅名またはアクセスを一次情報で確認できた{editorial.station.sampleSize}件の内訳です。住所から最寄駅を推測していません。</p>
      <ul className={styles.stationGrid}>
        {editorial.station.buckets.map((bucket) => <li key={bucket.label}><span>{bucket.label}</span><strong>{bucket.count}件</strong></li>)}
      </ul>
      <SourceNote editorial={editorial} />
    </section>
  );
}
