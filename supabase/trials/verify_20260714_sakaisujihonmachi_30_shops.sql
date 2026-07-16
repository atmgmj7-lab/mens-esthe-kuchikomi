begin;

set local statement_timeout = '30s';

do $$
declare
  trial_shop_ids constant bigint[] := array[654, 655, 656, 657, 660, 662, 670, 674, 675, 678, 683, 686, 687, 689, 695, 696, 697, 701, 706, 708, 709, 715, 723, 799, 826, 853, 1203, 1210, 1221, 1237];
  stored_areas integer;
  stored_shops integer;
  stored_links integer;
  stored_prices integer;
  stored_images integer;
  stored_batches integer;
  stored_records integer;
begin
  select count(*) into stored_areas
  from app.areas
  where wp_term_id = 46
    and not is_published
    and published_at is null;

  select count(*) into stored_shops
  from app.shops
  where wp_post_id = any(trial_shop_ids)
    and publication_status = 'draft'
    and published_at is null;

  select count(*) into stored_links
  from app.shop_areas as links
  join app.shops as shops on shops.id = links.shop_id
  join app.areas as areas on areas.id = links.area_id
  where shops.wp_post_id = any(trial_shop_ids)
    and areas.wp_term_id = 46
    and not links.is_primary;

  select count(*) into stored_prices
  from app.shop_prices as prices
  join app.shops as shops on shops.id = prices.shop_id
  where shops.wp_post_id = any(trial_shop_ids)
    and not prices.is_public
    and prices.verified_at is null;

  select count(*) into stored_images
  from app.shop_images as images
  join app.shops as shops on shops.id = images.shop_id
  where shops.wp_post_id = any(trial_shop_ids)
    and not images.is_public
    and images.verified_at is null;

  select count(*) into stored_batches
  from private.import_batches
  where id = '0f17f6a1-3bf4-4d66-8ee6-3f589da4b030'::uuid
    and status = 'completed'
    and source_count = 30
    and imported_count = 30
    and failed_count = 0;

  select count(*) into stored_records
  from private.import_records
  where batch_id = '0f17f6a1-3bf4-4d66-8ee6-3f589da4b030'::uuid
    and entity_type = 'shop'
    and status = 'imported';

  if not stored_areas = 1 then
    raise exception 'Expected 1 nonpublic trial area, found %', stored_areas;
  end if;
  if not stored_shops = 30 then
    raise exception 'Expected 30 draft trial shops, found %', stored_shops;
  end if;
  if not stored_links = 30 then
    raise exception 'Expected 30 non-primary trial area links, found %', stored_links;
  end if;
  if not stored_prices = 25 then
    raise exception 'Expected 25 nonpublic trial prices, found %', stored_prices;
  end if;
  if not stored_images = 23 then
    raise exception 'Expected 23 nonpublic trial images, found %', stored_images;
  end if;
  if not stored_batches = 1 then
    raise exception 'Expected 1 completed trial batch, found %', stored_batches;
  end if;
  if not stored_records = 30 then
    raise exception 'Expected 30 imported trial records, found %', stored_records;
  end if;
end
$$;

set local role anon;

do $$
declare
  public_rows integer;
begin
  select
    (select count(*) from api.published_areas)
    + (select count(*) from api.published_shops)
    + (select count(*) from api.published_shop_areas)
    + (select count(*) from api.published_shop_prices)
    + (select count(*) from api.published_shop_business_hours)
    + (select count(*) from api.published_shop_images)
    + (select count(*) from api.published_shop_sources)
    + (select count(*) from api.published_contents)
    + (select count(*) from api.published_reviews)
  into public_rows;

  if public_rows <> 0 then
    raise exception 'Trial data leaked into public API views: % rows', public_rows;
  end if;
end
$$;

select
  (select count(*) from api.published_areas) as published_areas,
  (select count(*) from api.published_shops) as published_shops,
  (select count(*) from api.published_shop_areas) as published_shop_areas,
  (select count(*) from api.published_shop_prices) as published_shop_prices,
  (select count(*) from api.published_shop_business_hours) as published_shop_business_hours,
  (select count(*) from api.published_shop_images) as published_shop_images,
  (select count(*) from api.published_shop_sources) as published_shop_sources,
  (select count(*) from api.published_contents) as published_contents,
  (select count(*) from api.published_reviews) as published_reviews;

rollback;
