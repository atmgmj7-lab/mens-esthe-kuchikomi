"use client";

import { useEffect } from "react";

export function AreaShopListScrollOnPage({
  currentPage,
  targetId = "shop-list"
}: {
  currentPage: number;
  targetId?: string;
}) {
  useEffect(() => {
    if (currentPage <= 1) return;
    requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [currentPage, targetId]);

  return null;
}
