export type DashboardNavItem = {
  href: string;
  label: string;
  description: string;
};

export const DASHBOARD_NAV_GROUPS = [
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
