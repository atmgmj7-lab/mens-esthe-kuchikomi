import { ResponsiveTag, ResponsiveTagList } from "@/components/common/ResponsiveTag";

type Props = {
  tags: string[];
  className?: string;
  max?: number;
};

export function ShopInfoChips({ tags, className = "", max = 5 }: Props) {
  if (tags.length === 0) return null;

  return (
    <ResponsiveTagList as="ul" className={`shop-info-chips ${className}`.trim()} ariaLabel="店舗の特徴">
      {tags.slice(0, max).map((tag) => (
        <ResponsiveTag as="li" key={tag} className="shop-info-chips__item" tone="teal">
          {tag}
        </ResponsiveTag>
      ))}
    </ResponsiveTagList>
  );
}
