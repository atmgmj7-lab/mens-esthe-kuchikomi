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

function selectActions(actions: ShopDetailAction[], fixed: boolean): ShopDetailAction[] {
  if (!fixed) return actions;

  const reservationLike = actions.find((action) => action.kind !== "official");
  const official = actions.find((action) => action.kind === "official");
  if (reservationLike && official) return [reservationLike, official];

  return actions.slice(0, 2);
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
      {actions.map((action) => (
        <a
          key={`${position}-${action.kind}`}
          href={action.href}
          target={action.external ? "_blank" : undefined}
          rel={action.external ? rel : undefined}
          className={
            action.kind === "official"
              ? styles.secondaryAction
              : styles.primaryAction
          }
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
