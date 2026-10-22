-- Preserve the fourteen WordPress-only public records exactly as captured from
-- the public REST source on 2026-10-22.  This is a deliberately narrow,
-- fail-closed data migration: it neither infers a primary area/category nor
-- touches managed projections, review data, images, prices, business hours,
-- contents, RLS, or grants.
--
-- Capture: public WordPress REST, 14 published rows, SHA-256
-- 023b3cf2db97bef560cbc537791a54ceb68daa44c090c80205d7d0686b30c003
begin;

do $$
declare
  target_ids constant bigint[] := array[5070, 5074, 5079, 5082, 5129, 5135, 5137, 5175, 5177, 5181, 5183, 5185, 5187, 5189];
  target_slugs constant text[] := array['eskomi-m0064', 'eskomi-m0145', 'eskomi-m0167', 'eskomi-m0250', 'eskomi-m0251', 'eskomi-m0287', 'eskomi-m0293', 'eskomi-m0408', 'eskomi-m0654', 'eskomi-m0660', 'eskomi-m0661', 'eskomi-m0663', 'eskomi-m0668', 'eskomi-m0757'];
  actual_count integer;
begin
  select count(*) into actual_count from app.shops;
  if actual_count <> 382 then
    raise exception 'expected 382 app.shops before preservation, got %', actual_count;
  end if;

  select count(*) into actual_count from app.shops where publication_status = 'published';
  if actual_count <> 379 then
    raise exception 'expected 379 published app.shops before preservation, got %', actual_count;
  end if;

  if exists (select 1 from app.shops where wp_post_id = any(target_ids)) then
    raise exception 'target WordPress identities already exist';
  end if;

  if exists (select 1 from app.shops where slug = any(target_slugs) or canonical_path = any(array(select '/shops/' || slug || '/' from unnest(target_slugs) as slug))) then
    raise exception 'target slug or canonical path collides';
  end if;

  select count(*) into actual_count
  from app.areas
  where wp_term_id = any(array[2::bigint, 13::bigint, 17::bigint]) and is_published and published_at is not null;
  if actual_count <> 3 then
    raise exception 'expected all three existing target areas to be published, got %', actual_count;
  end if;
end
$$;

with source(payload) as (
  select value
  from jsonb_array_elements($source$[
    {"wp_post_id":5070,"slug":"eskomi-m0145","canonical_path":"/shops/eskomi-m0145/","name":"イチゴみるく","description_html":"","excerpt":"","official_url":"https://ichigo-milk.com/","phone":"090-4464-1515","address_text":null,"access_text":null,"booking_url":"https://ichigo-milk.com/reserve.php","date_gmt":"2026-08-26T22:00:13","modified_gmt":"2026-08-26T22:00:13","area_ids":[2,17,13],"featured_media":null,"image_url":null,"shop_hours":"11:00〜翌6:00","shop_booking":"電話","basic_price":null,"source_status":"publish"},
    {"wp_post_id":5074,"slug":"eskomi-m0251","canonical_path":"/shops/eskomi-m0251/","name":"MONOTONE SPA（モノトーンスパ）","description_html":"","excerpt":"","official_url":"https://monotone-spa.com/top","phone":"080-7716-6175","address_text":"大阪府大阪市淀川区","access_text":null,"booking_url":null,"date_gmt":"2026-08-26T23:00:34","modified_gmt":"2026-08-26T23:00:34","area_ids":[2,13],"featured_media":null,"image_url":null,"shop_hours":"営業時間 10:00〜05:00","shop_booking":"LINE・WEB・電話","basic_price":null,"source_status":"publish"},
    {"wp_post_id":5079,"slug":"eskomi-m0654","canonical_path":"/shops/eskomi-m0654/","name":"ROYAL MADAM（ロイヤルマダム）","description_html":"","excerpt":"","official_url":"https://royal-madam.com/","phone":"090-6902-9720","address_text":"大阪府堺市堺区翁橋町1-8","access_text":null,"booking_url":"https://estama.jp/shop/43375/reserve/","date_gmt":"2026-08-26T23:01:46","modified_gmt":"2026-08-26T23:01:46","area_ids":[2,17],"featured_media":null,"image_url":null,"shop_hours":"10:00～翌5:00","shop_booking":"完全予約制","basic_price":16000,"source_status":"publish"},
    {"wp_post_id":5082,"slug":"eskomi-m0167","canonical_path":"/shops/eskomi-m0167/","name":"大人時間","description_html":"","excerpt":"","official_url":"https://otonajikan.net/","phone":"080-9659-5121","address_text":null,"access_text":null,"booking_url":null,"date_gmt":"2026-08-26T23:03:20","modified_gmt":"2026-08-26T23:03:20","area_ids":[2,13],"featured_media":null,"image_url":null,"shop_hours":"11:00〜翌2:00","shop_booking":"電話・Web予約","basic_price":null,"source_status":"publish"},
    {"wp_post_id":5129,"slug":"eskomi-m0250","canonical_path":"/shops/eskomi-m0250/","name":"Mrs.Two Heart（ミセストゥーハート）","description_html":"","excerpt":"","official_url":"https://mrs-two-heart.com/","phone":"080-4371-9845","address_text":null,"access_text":null,"booking_url":null,"date_gmt":"2026-08-27T10:02:41","modified_gmt":"2026-08-27T10:02:41","area_ids":[2,13],"featured_media":null,"image_url":null,"shop_hours":"営業時間 10:30～","shop_booking":"完全予約制","basic_price":15000,"source_status":"publish"},
    {"wp_post_id":5135,"slug":"eskomi-m0660","canonical_path":"/shops/eskomi-m0660/","name":"Mrs.C’est la vie（ミセス セラヴィ）","description_html":"","excerpt":"","official_url":"https://mrs-cest-la-vie.com/","phone":"080-9760-4077","address_text":"大阪府堺市堺区翁橋町1丁目近郊","access_text":null,"booking_url":null,"date_gmt":"2026-08-27T10:02:45","modified_gmt":"2026-08-27T10:02:45","area_ids":[2,17],"featured_media":null,"image_url":null,"shop_hours":"営業時間 10:00 - 03:00","shop_booking":"LINE・電話","basic_price":null,"source_status":"publish"},
    {"wp_post_id":5137,"slug":"eskomi-m0663","canonical_path":"/shops/eskomi-m0663/","name":"Mrs.Nostalgia（ミセス ノスタルジー）","description_html":"","excerpt":"","official_url":"https://mrs-nostalgia.com/","phone":"090-3206-3368","address_text":"大阪府堺市堺区近郊南瓦町近郊","access_text":null,"booking_url":"https://estama.jp/shop/40127/reserve/","date_gmt":"2026-08-27T10:02:47","modified_gmt":"2026-08-27T10:02:47","area_ids":[2,17],"featured_media":null,"image_url":null,"shop_hours":"10:00 - 05:00","shop_booking":"LINE・WEB・電話","basic_price":null,"source_status":"publish"},
    {"wp_post_id":5175,"slug":"eskomi-m0064","canonical_path":"/shops/eskomi-m0064/","name":"MACHERIE（マシェリ）","description_html":"","excerpt":"","official_url":null,"phone":null,"address_text":null,"access_text":null,"booking_url":null,"date_gmt":"2026-08-29T01:36:45","modified_gmt":"2026-08-29T01:36:45","area_ids":[2,13],"featured_media":null,"image_url":null,"shop_hours":null,"shop_booking":"完全予約制","basic_price":null,"source_status":"publish"},
    {"wp_post_id":5177,"slug":"eskomi-m0287","canonical_path":"/shops/eskomi-m0287/","name":"Mrs.Merci SPA（メルシースパ）","description_html":"","excerpt":"","official_url":null,"phone":null,"address_text":null,"access_text":null,"booking_url":null,"date_gmt":"2026-08-29T01:36:48","modified_gmt":"2026-08-29T01:36:48","area_ids":[2,13],"featured_media":null,"image_url":null,"shop_hours":null,"shop_booking":"完全予約制","basic_price":null,"source_status":"publish"},
    {"wp_post_id":5181,"slug":"eskomi-m0293","canonical_path":"/shops/eskomi-m0293/","name":"Pulchra （プルクラ）","description_html":"","excerpt":"","official_url":null,"phone":null,"address_text":null,"access_text":null,"booking_url":null,"date_gmt":"2026-08-29T01:39:45","modified_gmt":"2026-08-29T01:39:45","area_ids":[2,13],"featured_media":null,"image_url":null,"shop_hours":null,"shop_booking":"完全予約制","basic_price":null,"source_status":"publish"},
    {"wp_post_id":5183,"slug":"eskomi-m0408","canonical_path":"/shops/eskomi-m0408/","name":"ヌまるSPA新大阪","description_html":"","excerpt":"","official_url":null,"phone":null,"address_text":null,"access_text":null,"booking_url":null,"date_gmt":"2026-08-29T01:39:48","modified_gmt":"2026-08-29T01:39:48","area_ids":[2,13],"featured_media":null,"image_url":null,"shop_hours":null,"shop_booking":"完全予約制","basic_price":null,"source_status":"publish"},
    {"wp_post_id":5185,"slug":"eskomi-m0661","canonical_path":"/shops/eskomi-m0661/","name":"Mr.Dandies（ミスター・ダンディーズ）","description_html":"","excerpt":"","official_url":null,"phone":null,"address_text":null,"access_text":null,"booking_url":null,"date_gmt":"2026-08-29T01:39:51","modified_gmt":"2026-08-29T01:39:51","area_ids":[2,17],"featured_media":null,"image_url":null,"shop_hours":null,"shop_booking":"完全予約制","basic_price":null,"source_status":"publish"},
    {"wp_post_id":5187,"slug":"eskomi-m0668","canonical_path":"/shops/eskomi-m0668/","name":"Mrs.美Witch（ミセスビィウィッチ）一条通ルーム","description_html":"","excerpt":"","official_url":null,"phone":null,"address_text":null,"access_text":null,"booking_url":null,"date_gmt":"2026-08-29T01:39:54","modified_gmt":"2026-08-29T01:39:54","area_ids":[2,17],"featured_media":null,"image_url":null,"shop_hours":null,"shop_booking":"完全予約制","basic_price":null,"source_status":"publish"},
    {"wp_post_id":5189,"slug":"eskomi-m0757","canonical_path":"/shops/eskomi-m0757/","name":"ミセスムーンR 堺東ルーム","description_html":"","excerpt":"","official_url":null,"phone":null,"address_text":null,"access_text":null,"booking_url":null,"date_gmt":"2026-08-29T01:39:58","modified_gmt":"2026-08-29T01:39:58","area_ids":[2,17],"featured_media":null,"image_url":null,"shop_hours":null,"shop_booking":"完全予約制","basic_price":null,"source_status":"publish"}
  ]$source$::jsonb)
), inserted as (
  insert into app.shops (
    wp_post_id, slug, canonical_path, name, description_html, excerpt,
    official_url, phone, address_text, access_text, booking_url,
    legacy_payload, publication_status, published_at, created_at, updated_at
  )
  select
    (payload ->> 'wp_post_id')::bigint,
    payload ->> 'slug',
    payload ->> 'canonical_path',
    payload ->> 'name',
    coalesce(payload ->> 'description_html', ''),
    coalesce(payload ->> 'excerpt', ''),
    nullif(payload ->> 'official_url', ''),
    nullif(payload ->> 'phone', ''),
    nullif(payload ->> 'address_text', ''),
    nullif(payload ->> 'access_text', ''),
    nullif(payload ->> 'booking_url', ''),
    payload,
    'published',
    ((payload ->> 'date_gmt') || 'Z')::timestamptz,
    ((payload ->> 'date_gmt') || 'Z')::timestamptz,
    ((payload ->> 'modified_gmt') || 'Z')::timestamptz
  from source
  returning id, wp_post_id
)
select count(*) from inserted;

with source(payload) as (
  select value
  from jsonb_array_elements($source$[
    {"wp_post_id":5070,"area_ids":[2,17,13]}, {"wp_post_id":5074,"area_ids":[2,13]}, {"wp_post_id":5079,"area_ids":[2,17]}, {"wp_post_id":5082,"area_ids":[2,13]}, {"wp_post_id":5129,"area_ids":[2,13]}, {"wp_post_id":5135,"area_ids":[2,17]}, {"wp_post_id":5137,"area_ids":[2,17]}, {"wp_post_id":5175,"area_ids":[2,13]}, {"wp_post_id":5177,"area_ids":[2,13]}, {"wp_post_id":5181,"area_ids":[2,13]}, {"wp_post_id":5183,"area_ids":[2,13]}, {"wp_post_id":5185,"area_ids":[2,17]}, {"wp_post_id":5187,"area_ids":[2,17]}, {"wp_post_id":5189,"area_ids":[2,17]}
  ]$source$::jsonb)
)
insert into app.shop_areas (shop_id, area_id, is_primary, source_system)
select shops.id, areas.id, false, 'wordpress'
from source
join app.shops as shops on shops.wp_post_id = (source.payload ->> 'wp_post_id')::bigint
cross join lateral jsonb_array_elements_text(source.payload -> 'area_ids') as area_term(value)
join app.areas as areas on areas.wp_term_id = area_term.value::bigint
on conflict (shop_id, area_id) do nothing;

do $$
declare
  target_ids constant bigint[] := array[5070, 5074, 5079, 5082, 5129, 5135, 5137, 5175, 5177, 5181, 5183, 5185, 5187, 5189];
  actual_count integer;
begin
  select count(*) into actual_count from app.shops where wp_post_id = any(target_ids) and publication_status = 'published' and published_at is not null;
  if actual_count <> 14 then
    raise exception 'expected 14 preserved shops after insert, got %', actual_count;
  end if;

  select count(*) into actual_count
  from app.shop_areas as relation
  join app.shops as shops on shops.id = relation.shop_id
  where shops.wp_post_id = any(target_ids) and relation.source_system = 'wordpress';
  if actual_count <> 29 then
    raise exception 'expected 29 preserved WordPress area links, got %', actual_count;
  end if;

  if exists (
    select 1
    from app.shop_areas as relation
    join app.shops as shops on shops.id = relation.shop_id
    where shops.wp_post_id = any(target_ids) and relation.is_primary
  ) then
    raise exception 'no preserved shop may gain a primary area';
  end if;

  select count(*) into actual_count from app.shops where publication_status = 'published';
  if actual_count <> 393 then
    raise exception 'expected 393 published app.shops after preservation, got %', actual_count;
  end if;

  select count(*) into actual_count from app.shops;
  if actual_count <> 396 then
    raise exception 'expected 396 app.shops after preservation, got %', actual_count;
  end if;
end
$$;

commit;
