import type { ReactNode } from "react";
import DashboardNav from "./DashboardNav";
import styles from "./DashboardShell.module.css";

type Props = {
  children: ReactNode;
};

export default function DashboardShell({ children }: Props) {
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#dashboard-main">
        本文へ移動
      </a>
      <div className={styles.frame}>
        <DashboardNav />
        <div className={styles.content}>
          <header className={styles.header}>
            <div>
              <p>Eskomi Growth Command</p>
              <h1>エスコミ管理ダッシュボード</h1>
            </div>
            <span className={styles.headerStatus}>PRIVATE / NOINDEX</span>
          </header>
          <main id="dashboard-main" className={styles.main} tabIndex={-1}>
            {children}
          </main>
          <footer className={styles.footer}>
            Eskomi 管理ダッシュボード
          </footer>
        </div>
      </div>
    </div>
  );
}
