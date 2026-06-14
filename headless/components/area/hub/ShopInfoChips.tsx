type Props = {
  tags: string[];
  className?: string;
  max?: number;
};

export function ShopInfoChips({ tags, className = "", max = 5 }: Props) {
  if (tags.length === 0) return null;

  return (
    <ul className={`shop-info-chips ${className}`.trim()} aria-label="店舗の特徴">
      {tags.slice(0, max).map((tag) => (
        <li key={tag} className="shop-info-chips__item">
          {tag}
        </li>
      ))}
    </ul>
  );
}
