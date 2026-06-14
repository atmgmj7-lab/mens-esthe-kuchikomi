"use client";

import { useEffect, useState, type ReactNode } from "react";

export type RankingTabItem = {
  id: string;
  label: string;
  content: ReactNode;
};

export function RankingTabs({ tabs }: { tabs: RankingTabItem[] }) {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? "");

  useEffect(() => {
    const syncFromHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (tabs.some((tab) => tab.id === hash)) {
        setActiveId(hash);
      }
    };

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [tabs]);

  return (
    <section className="ranking-tabs" aria-label="条件別ランキング">
      <div className="ranking-tabs__nav" role="tablist" aria-label="条件別表示">
        {tabs.map((tab) => {
          const selected = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={tab.id}
              className={`ranking-tabs__tab ${selected ? "is-active" : ""}`.trim()}
              onClick={() => {
                setActiveId(tab.id);
                history.replaceState(null, "", `#${tab.id}`);
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => {
        const selected = tab.id === activeId;
        return (
          <div
            key={tab.id}
            id={tab.id}
            role="tabpanel"
            aria-labelledby={`tab-${tab.id}`}
            className={`ranking-tabs__panel ${selected ? "is-active" : ""}`.trim()}
          >
            {tab.content}
          </div>
        );
      })}
    </section>
  );
}
