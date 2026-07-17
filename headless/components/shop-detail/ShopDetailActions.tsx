import type {
  ShopDetailAction,
  ShopDetailViewModel
} from "@/lib/shop-detail-view-model";
import { normalizePublicShopSlug } from "@/lib/shop-slug";
import styles from "./ShopDetail.module.css";

type ShopDetailActionsProps = {
  model: ShopDetailViewModel;
  rel: string;
  position: "hero" | "body" | "fixed";
  fixed?: boolean;
};

const ACTION_PRIORITY: Record<ShopDetailAction["kind"], number> = {
  reservation: 0,
  official: 1,
  line: 2,
  tel: 3
};

function selectActions(actions: ShopDetailAction[], fixed: boolean): ShopDetailAction[] {
  const seenKinds = new Set<ShopDetailAction["kind"]>();
  const seenUrls = new Set<string>();
  const ordered = [...actions]
    .sort((first, second) => ACTION_PRIORITY[first.kind] - ACTION_PRIORITY[second.kind])
    .filter((action) => {
      if (seenKinds.has(action.kind) || seenUrls.has(action.href)) return false;
      seenKinds.add(action.kind);
      seenUrls.add(action.href);
      return true;
    });

  return ordered.slice(0, fixed ? 2 : 4);
}

export function ShopDetailActions({
  model,
  rel,
  position,
  fixed = false
}: ShopDetailActionsProps) {
  if (model.actions.length === 0) return null;

  const actions = selectActions(model.actions, fixed);
  const shopSlug = normalizePublicShopSlug(model.slug);

  return (
    <div
      className={fixed ? styles.fixedActions : styles.actions}
      role="group"
      aria-label="予約・公式情報"
    >
      {actions.map((action, index) => (
        <a
          key={`${position}-${action.kind}`}
          href={action.href}
          target={action.external ? "_blank" : undefined}
          rel={action.external ? rel : undefined}
          className={index === 0 ? styles.primaryAction : styles.secondaryAction}
          data-shop-cta-kind={action.kind}
          data-shop-cta-position={position}
          data-shop-slug={shopSlug}
        >
          {action.label}
        </a>
      ))}
    </div>
  );
}
