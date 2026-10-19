function expectedCount(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
  return value;
}

function wpIds(value, name) {
  if (!Array.isArray(value) || value.length === 0 || value.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    throw new Error(`${name} must be a non-empty list of positive WordPress IDs`);
  }
  return [...new Set(value)].sort((left, right) => left - right);
}

function sqlText(value, name) {
  if (!/^[a-z0-9-]+$/i.test(value || "")) throw new Error(`${name} must contain only letters, numbers, and hyphens`);
  return value;
}

export function renderStatePreservingDeltaPreflightSql({
  expectedShopCount,
  expectedAreaCount,
  expectedImageCount,
  expectedPublishedShopCount,
  expectedPublishedAreaCount,
  expectedPublishedContentCount,
  reviewRequiredWpIds,
  retainedDraftWpIds,
  retainedUnlistedManagedWpIds,
  imageCutoverSourceSystem
}) {
  const shops = expectedCount(expectedShopCount, "expectedShopCount");
  const areas = expectedCount(expectedAreaCount, "expectedAreaCount");
  const images = expectedCount(expectedImageCount, "expectedImageCount");
  const publishedShops = expectedCount(expectedPublishedShopCount, "expectedPublishedShopCount");
  const publishedAreas = expectedCount(expectedPublishedAreaCount, "expectedPublishedAreaCount");
  const publishedContents = expectedCount(expectedPublishedContentCount, "expectedPublishedContentCount");
  if (publishedShops !== 0) throw new Error("published shop count must be zero for a state-preserving pre-production delta");
  if (publishedAreas !== 0) throw new Error("published area count must be zero for a state-preserving pre-production delta");
  if (publishedContents !== 0) throw new Error("published content count must be zero for a state-preserving pre-production delta");

  const reviewRequired = wpIds(reviewRequiredWpIds, "reviewRequiredWpIds");
  const retainedDrafts = wpIds(retainedDraftWpIds, "retainedDraftWpIds");
  const retainedUnlisted = wpIds(retainedUnlistedManagedWpIds, "retainedUnlistedManagedWpIds");
  const sourceSystem = sqlText(imageCutoverSourceSystem, "imageCutoverSourceSystem");

  return `begin read only;

set local statement_timeout = '30s';

do $$
declare
  actual_count integer;
begin
  select count(*) into actual_count from app.shops;
  if actual_count <> ${shops} then
    raise exception 'expected ${shops} app.shops, got %', actual_count;
  end if;

  select count(*) into actual_count from app.areas;
  if actual_count <> ${areas} then
    raise exception 'expected ${areas} app.areas, got %', actual_count;
  end if;

  select count(*) into actual_count from app.shops where publication_status = 'published';
  if actual_count <> ${publishedShops} then
    raise exception 'expected ${publishedShops} published app.shops, got %', actual_count;
  end if;

  select count(*) into actual_count from app.areas where is_published;
  if actual_count <> ${publishedAreas} then
    raise exception 'expected ${publishedAreas} published app.areas, got %', actual_count;
  end if;

  select count(*) into actual_count from app.contents where publication_status = 'published';
  if actual_count <> ${publishedContents} then
    raise exception 'expected ${publishedContents} published app.contents, got %', actual_count;
  end if;

  select count(*) into actual_count
  from app.shop_images as image
  join private.import_records as record
    on record.target_id = image.id
   and record.target_table = 'app.shop_images'
   and record.entity_type = 'shop-image-url'
   and record.status = 'imported'
   and record.transformed_payload ->> 'image_url' = image.image_url
  join private.import_batches as batch
    on batch.id = record.batch_id
   and batch.source_system = '${sourceSystem}'
   and batch.status = 'completed'
  where image.image_url like 'https://%.supabase.co/storage/v1/object/public/shop-images/wordpress-media/%';
  if actual_count <> ${images} then
    raise exception 'expected ${images} Storage image URLs recorded by ${sourceSystem}, got %', actual_count;
  end if;

  if exists (select 1 from app.shop_images where is_public) then
    raise exception 'shop images must remain nonpublic before primary cutover';
  end if;

  if exists (select 1 from app.shops where wp_post_id = any(array[${reviewRequired.join(", ")}])) then
    raise exception 'review-required WordPress-only rows must remain outside app.shops';
  end if;

  select count(*) into actual_count
  from app.shops
  where wp_post_id = any(array[${retainedDrafts.join(", ")}])
    and publication_status = 'draft'
    and published_at is null;
  if actual_count <> ${retainedDrafts.length} then
    raise exception 'retained Supabase-only drafts are missing or no longer drafts';
  end if;

  select count(*) into actual_count
  from private.managed_shops as managed
  join app.shops as shop on shop.wp_post_id = managed.existing_wp_shop_id
  where managed.existing_wp_shop_id = any(array[${retainedUnlisted.join(", ")}])
    and managed.publication_state = 'unlisted'
    and shop.publication_status = 'draft';
  if actual_count <> ${retainedUnlisted.length} then
    raise exception 'managed unlisted legacy identity changed state';
  end if;

end
$$;

set local role anon;
do $$
begin
  if exists (select 1 from app.shops) then
    raise exception 'anon must not observe nonpublic app.shops';
  end if;
  if exists (select 1 from app.areas) then
    raise exception 'anon must not observe nonpublic app.areas';
  end if;
  if exists (select 1 from app.shop_images) then
    raise exception 'anon must not observe nonpublic app.shop_images';
  end if;
end
$$;
reset role;

commit;
`;
}
