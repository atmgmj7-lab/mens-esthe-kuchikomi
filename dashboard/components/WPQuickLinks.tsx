type Props = {
  adminUrl?: string;
};

const LINKS = [
  { label: "投稿一覧", path: "/wp-admin/edit.php" },
  { label: "新規投稿", path: "/wp-admin/post-new.php" },
  { label: "固定ページ", path: "/wp-admin/edit.php?post_type=page" },
  { label: "店舗管理", path: "/wp-admin/edit.php?post_type=shop" },
  { label: "メディア", path: "/wp-admin/upload.php" },
  { label: "外観", path: "/wp-admin/themes.php" },
  { label: "プラグイン", path: "/wp-admin/plugins.php" },
  { label: "設定", path: "/wp-admin/options-general.php" },
  { label: "WP管理TOP", path: "/wp-admin/" },
];

export default function WPQuickLinks({
  adminUrl = "https://mens-esthe-kuchikomi.com",
}: Props) {
  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
      <p className="text-sm font-medium text-zinc-300 mb-3">WP管理画面</p>
      <div className="flex flex-wrap gap-2">
        {LINKS.map((link) => (
          <a
            key={link.path}
            href={`${adminUrl}${link.path}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-xs rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors border border-zinc-700"
          >
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}
