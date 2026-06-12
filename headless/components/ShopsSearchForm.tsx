import Link from "next/link";
import type { AreaView } from "@/lib/wp/types";
import type { ShopFilterParams } from "@/lib/wp/shop-filter";
import { hasActiveShopFilters } from "@/lib/wp/shop-filter";

type ShopsSearchFormProps = {
  areas: AreaView[];
  params: ShopFilterParams;
};

function buildAreaOptions(areas: AreaView[]) {
  const parents = areas.filter((area) => area.parent === 0).sort((a, b) => a.name.localeCompare(b.name, "ja"));
  const childrenByParent = new Map<number, AreaView[]>();

  for (const area of areas) {
    if (area.parent === 0) continue;
    const siblings = childrenByParent.get(area.parent) ?? [];
    siblings.push(area);
    childrenByParent.set(area.parent, siblings);
  }

  const options: { slug: string; label: string }[] = [{ slug: "", label: "すべてのエリア" }];

  for (const parent of parents) {
    options.push({ slug: parent.slug, label: parent.name });
    const children = (childrenByParent.get(parent.id) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name, "ja")
    );
    for (const child of children) {
      options.push({ slug: child.slug, label: `　${child.name}` });
    }
  }

  return options;
}

export function ShopsSearchForm({ areas, params }: ShopsSearchFormProps) {
  const areaOptions = buildAreaOptions(areas);
  const active = hasActiveShopFilters(params);

  return (
    <section className="hl-shops-filter" aria-label="店舗検索">
      <form className="hl-shops-filter__form" action="/shops/" method="get">
        <div className="hl-shops-filter__row">
          <label className="hl-shops-filter__field hl-shops-filter__field--grow">
            <span className="hl-shops-filter__label">キーワード</span>
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="店名・エリア・料金など"
              className="hl-shops-filter__input"
            />
          </label>
          <label className="hl-shops-filter__field">
            <span className="hl-shops-filter__label">エリア</span>
            <select name="area" defaultValue={params.area ?? ""} className="hl-shops-filter__select">
              {areaOptions.map((option) => (
                <option key={option.slug || "all"} value={option.slug}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="hl-shops-filter__row hl-shops-filter__row--actions">
          <label className="hl-shops-filter__checkbox">
            <input type="checkbox" name="available" value="1" defaultChecked={params.available === "1"} />
            <span>出勤中のみ</span>
          </label>
          <button type="submit" className="hl-shops-filter__submit mep-cta-btn mep-cta-btn--solid">
            検索
          </button>
          {active ? (
            <Link href="/shops/" className="hl-shops-filter__clear">
              条件をクリア
            </Link>
          ) : null}
        </div>
      </form>
    </section>
  );
}
