import styles from "./ShopRankCell.module.css";

export function ShopRankCell({ rank, className }: { rank: number; className?: string }) {
  return (
    <div
      className={[styles.root, className].filter(Boolean).join(" ")}
      aria-label={`おすすめランキング${rank}位`}
    >
      <span className={styles.number}>{rank}</span>
      <span className={styles.unit}>位</span>
    </div>
  );
}
