export type DashboardNavItem = {
  href: string;
  label: string;
  description: string;
};

export const DASHBOARD_NAV_GROUPS = [
  {
    label: "運用",
    items: [
      {
        href: "/dashboard/shops/",
        label: "店舗管理",
        description: "公開情報・Partner・口コミの統合確認",
      },
      {
        href: "/dashboard/partners/",
        label: "Partner運用",
        description: "申請・workspace・モデレーション",
      },
    ],
  },
  {
    label: "分析",
    items: [
      {
        href: "/dashboard/",
        label: "概要",
        description: "GA4・Search Console・SEO状況",
      },
      {
        href: "/dashboard/analytics/",
        label: "詳細分析",
        description: "期間別・ページ別の深掘り",
      },
    ],
  },
] satisfies Array<{ label: string; items: DashboardNavItem[] }>;
