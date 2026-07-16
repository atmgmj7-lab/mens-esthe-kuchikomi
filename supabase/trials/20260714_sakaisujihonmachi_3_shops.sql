begin;

insert into private.import_batches (
  id,
  source_system,
  source_url,
  status,
  started_at,
  finished_at,
  source_count,
  imported_count,
  failed_count,
  metadata
)
values (
  '0f17f6a1-3bf4-4d66-8ee6-3f589da4b001',
  'wordpress',
  'https://mens-esthe-kuchikomi.com/wp-json/wp/v2/shop/?include=695,709,1237&per_page=100&_embed=1',
  'completed',
  now(),
  now(),
  3,
  3,
  0,
  jsonb_build_object(
    'trial_key', '20260714-sakaisujihonmachi-3-shops',
    'area_wp_term_id', 46,
    'selection', jsonb_build_array(
      'missing-price-and-image',
      'missing-official-url',
      'complete-comparison-row'
    ),
    'public_cutover', false
  )
)
on conflict (id) do update set
  source_url = excluded.source_url,
  status = excluded.status,
  finished_at = excluded.finished_at,
  source_count = excluded.source_count,
  imported_count = excluded.imported_count,
  failed_count = excluded.failed_count,
  metadata = excluded.metadata;

do $$
declare
  trial_batch_id constant uuid := '0f17f6a1-3bf4-4d66-8ee6-3f589da4b001';
  trial_area_id uuid;
  trial_shop_id uuid;
begin
  insert into app.areas (
    wp_term_id,
    slug,
    name,
    description,
    legacy_payload,
    is_published,
    published_at
  )
  values (
    46,
    'sakaisujihonmachi',
    '堺筋本町',
    '',
    jsonb_build_object(
      'id', 46,
      'slug', 'sakaisujihonmachi',
      'name', '堺筋本町',
      'parent', 2,
      'description', '',
      'count_at_selection', 93
    ),
    false,
    null
  )
  on conflict (wp_term_id) do update set
    slug = excluded.slug,
    name = excluded.name,
    description = excluded.description,
    legacy_payload = excluded.legacy_payload,
    is_published = false,
    published_at = null,
    updated_at = now()
  returning id into trial_area_id;

  -- shop wp_post_id=695
  insert into app.shops (
    wp_post_id,
    slug,
    canonical_path,
    name,
    description_html,
    excerpt,
    official_url,
    phone,
    address_text,
    access_text,
    booking_url,
    legacy_payload,
    publication_status,
    published_at
  )
  values (
    695,
    'muse%ef%bc%88%e3%83%9f%e3%83%a5%e3%83%bc%e3%82%ba%ef%bc%89',
    '/shops/muse%ef%bc%88%e3%83%9f%e3%83%a5%e3%83%bc%e3%82%ba%ef%bc%89/',
    'MUSE（ミューズ）',
    '',
    '',
    'https://osaka-muse.com/',
    '070-6507-0062',
    null,
    '堺筋本町 / 地下鉄各線「堺筋本町駅」3番出口より徒歩5分',
    null,
    jsonb_build_object(
      'id', 695,
      'date_gmt', '2026-02-01T17:52:21',
      'modified_gmt', '2026-02-28T23:10:56',
      'area', jsonb_build_array(46, 2, 16),
      'featured_media', 1009,
      'official_url', 'https://osaka-muse.com/',
      'shop_tel', '070-6507-0062',
      'shop_address', '堺筋本町 / 地下鉄各線「堺筋本町駅」3番出口より徒歩5分',
      'shop_hours', '10:00～翌3:00',
      'shop_booking', '完全予約制',
      'basic_price', 14000
    ),
    'draft',
    null
  )
  on conflict (wp_post_id) do update set
    slug = excluded.slug,
    canonical_path = excluded.canonical_path,
    name = excluded.name,
    description_html = excluded.description_html,
    excerpt = excluded.excerpt,
    official_url = excluded.official_url,
    phone = excluded.phone,
    address_text = excluded.address_text,
    access_text = excluded.access_text,
    booking_url = excluded.booking_url,
    legacy_payload = excluded.legacy_payload,
    publication_status = 'draft',
    published_at = null,
    updated_at = now()
  returning id into trial_shop_id;

  insert into app.shop_areas (shop_id, area_id, is_primary, source_system)
  values (trial_shop_id, trial_area_id, false, 'wordpress')
  on conflict (shop_id, area_id) do update set
    is_primary = false,
    source_system = excluded.source_system;

  insert into app.shop_prices (
    shop_id,
    course_name,
    amount_yen,
    notes,
    is_public,
    verified_at
  )
  select
    trial_shop_id,
    '基本料金（WordPress移行値）',
    14000,
    'trial-source:wordpress-basic_price; verification required',
    false,
    null
  where not exists (
    select 1
    from app.shop_prices
    where shop_id = trial_shop_id
      and course_name = '基本料金（WordPress移行値）'
      and amount_yen = 14000
  );

  insert into app.shop_images (
    shop_id,
    wp_media_id,
    image_url,
    alt_text,
    image_role,
    sort_order,
    is_public,
    verified_at
  )
  values (
    trial_shop_id,
    1009,
    'http://mens-esthe-kuchikomi.com/wp-content/uploads/images/大阪_堺筋本町の人気メンズエステ_メンエス_MUSE_ミューズ.jpg',
    '',
    'featured',
    0,
    false,
    null
  )
  on conflict (shop_id, image_url) do update set
    wp_media_id = excluded.wp_media_id,
    alt_text = excluded.alt_text,
    image_role = excluded.image_role,
    sort_order = excluded.sort_order,
    is_public = false,
    verified_at = null,
    updated_at = now();

  insert into private.import_records (
    batch_id,
    entity_type,
    source_id,
    target_table,
    target_id,
    status,
    source_payload,
    transformed_payload,
    issues,
    imported_at
  )
  values (
    trial_batch_id,
    'shop',
    '695',
    'app.shops',
    trial_shop_id,
    'imported',
    jsonb_build_object(
      'wp_post_id', 695,
      'slug', 'muse%ef%bc%88%e3%83%9f%e3%83%a5%e3%83%bc%e3%82%ba%ef%bc%89',
      'area', jsonb_build_array(46, 2, 16),
      'basic_price', 14000,
      'featured_media', 1009,
      'official_url', 'https://osaka-muse.com/'
    ),
    jsonb_build_object(
      'publication_status', 'draft',
      'linked_area_wp_term_id', 46,
      'price_is_public', false,
      'image_is_public', false
    ),
    jsonb_build_array('address-access-mixed', 'price-unverified', 'image-unverified'),
    now()
  )
  on conflict (batch_id, entity_type, source_id) do update set
    target_table = excluded.target_table,
    target_id = excluded.target_id,
    status = excluded.status,
    source_payload = excluded.source_payload,
    transformed_payload = excluded.transformed_payload,
    issues = excluded.issues,
    imported_at = excluded.imported_at,
    updated_at = now();

  -- shop wp_post_id=709
  insert into app.shops (
    wp_post_id,
    slug,
    canonical_path,
    name,
    description_html,
    excerpt,
    official_url,
    phone,
    address_text,
    access_text,
    booking_url,
    legacy_payload,
    publication_status,
    published_at
  )
  values (
    709,
    'sirena-ii%ef%bc%88%e3%82%b7%e3%83%ac%e3%83%bc%e3%83%8a%ef%bc%89',
    '/shops/sirena-ii%ef%bc%88%e3%82%b7%e3%83%ac%e3%83%bc%e3%83%8a%ef%bc%89/',
    'sirena II（シレーナ）',
    '',
    '',
    null,
    '080-3830-9229',
    '大阪市中央区南久宝寺町1丁目',
    null,
    null,
    jsonb_build_object(
      'id', 709,
      'date_gmt', '2026-02-01T17:52:22',
      'modified_gmt', '2026-02-28T23:12:43',
      'area', jsonb_build_array(46, 2),
      'featured_media', 932,
      'official_url', '',
      'shop_tel', '080-3830-9229',
      'shop_address', '大阪市中央区南久宝寺町1丁目',
      'shop_hours', '10:00～翌6:00（受付時間10:00～翌5:00）',
      'shop_booking', '完全予約制',
      'basic_price', 14000
    ),
    'draft',
    null
  )
  on conflict (wp_post_id) do update set
    slug = excluded.slug,
    canonical_path = excluded.canonical_path,
    name = excluded.name,
    description_html = excluded.description_html,
    excerpt = excluded.excerpt,
    official_url = excluded.official_url,
    phone = excluded.phone,
    address_text = excluded.address_text,
    access_text = excluded.access_text,
    booking_url = excluded.booking_url,
    legacy_payload = excluded.legacy_payload,
    publication_status = 'draft',
    published_at = null,
    updated_at = now()
  returning id into trial_shop_id;

  insert into app.shop_areas (shop_id, area_id, is_primary, source_system)
  values (trial_shop_id, trial_area_id, false, 'wordpress')
  on conflict (shop_id, area_id) do update set
    is_primary = false,
    source_system = excluded.source_system;

  insert into app.shop_prices (
    shop_id,
    course_name,
    amount_yen,
    notes,
    is_public,
    verified_at
  )
  select
    trial_shop_id,
    '基本料金（WordPress移行値）',
    14000,
    'trial-source:wordpress-basic_price; verification required',
    false,
    null
  where not exists (
    select 1
    from app.shop_prices
    where shop_id = trial_shop_id
      and course_name = '基本料金（WordPress移行値）'
      and amount_yen = 14000
  );

  insert into app.shop_images (
    shop_id,
    wp_media_id,
    image_url,
    alt_text,
    image_role,
    sort_order,
    is_public,
    verified_at
  )
  values (
    trial_shop_id,
    932,
    'http://mens-esthe-kuchikomi.com/wp-content/uploads/images/大阪_堺筋本町_日本橋_長堀橋_松屋町_心斎橋_難波_梅田の人気メンズエステ_メンエス_sirena II_シレーナ.jpg',
    '',
    'featured',
    0,
    false,
    null
  )
  on conflict (shop_id, image_url) do update set
    wp_media_id = excluded.wp_media_id,
    alt_text = excluded.alt_text,
    image_role = excluded.image_role,
    sort_order = excluded.sort_order,
    is_public = false,
    verified_at = null,
    updated_at = now();

  insert into private.import_records (
    batch_id,
    entity_type,
    source_id,
    target_table,
    target_id,
    status,
    source_payload,
    transformed_payload,
    issues,
    imported_at
  )
  values (
    trial_batch_id,
    'shop',
    '709',
    'app.shops',
    trial_shop_id,
    'imported',
    jsonb_build_object(
      'wp_post_id', 709,
      'slug', 'sirena-ii%ef%bc%88%e3%82%b7%e3%83%ac%e3%83%bc%e3%83%8a%ef%bc%89',
      'area', jsonb_build_array(46, 2),
      'basic_price', 14000,
      'featured_media', 932,
      'official_url', ''
    ),
    jsonb_build_object(
      'publication_status', 'draft',
      'linked_area_wp_term_id', 46,
      'price_is_public', false,
      'image_is_public', false
    ),
    jsonb_build_array('official-url-missing', 'address-unverified', 'price-unverified', 'image-unverified'),
    now()
  )
  on conflict (batch_id, entity_type, source_id) do update set
    target_table = excluded.target_table,
    target_id = excluded.target_id,
    status = excluded.status,
    source_payload = excluded.source_payload,
    transformed_payload = excluded.transformed_payload,
    issues = excluded.issues,
    imported_at = excluded.imported_at,
    updated_at = now();

  -- shop wp_post_id=1237
  insert into app.shops (
    wp_post_id,
    slug,
    canonical_path,
    name,
    description_html,
    excerpt,
    official_url,
    phone,
    address_text,
    access_text,
    booking_url,
    legacy_payload,
    publication_status,
    published_at
  )
  values (
    1237,
    '%e6%ae%bf%e6%a7%98%e6%b0%97%e5%88%86',
    '/shops/%e6%ae%bf%e6%a7%98%e6%b0%97%e5%88%86/',
    '殿様気分',
    '',
    '',
    'https://spa-tono.com/',
    '070-8581-0708',
    null,
    '堺筋本町 / 大阪メトロ（Osaka Metro）各線「堺筋本町駅」1番出口より徒歩5分',
    null,
    jsonb_build_object(
      'id', 1237,
      'date_gmt', '2026-02-26T04:09:21',
      'modified_gmt', '2026-02-28T23:13:28',
      'area', jsonb_build_array(46, 2, 16),
      'featured_media', 0,
      'official_url', 'https://spa-tono.com/',
      'shop_tel', '070-8581-0708',
      'shop_address', '堺筋本町 / 大阪メトロ（Osaka Metro）各線「堺筋本町駅」1番出口より徒歩5分',
      'shop_hours', '10:00～23:00（受付時間9:30～21:30）',
      'shop_booking', '完全予約制',
      'basic_price', ''
    ),
    'draft',
    null
  )
  on conflict (wp_post_id) do update set
    slug = excluded.slug,
    canonical_path = excluded.canonical_path,
    name = excluded.name,
    description_html = excluded.description_html,
    excerpt = excluded.excerpt,
    official_url = excluded.official_url,
    phone = excluded.phone,
    address_text = excluded.address_text,
    access_text = excluded.access_text,
    booking_url = excluded.booking_url,
    legacy_payload = excluded.legacy_payload,
    publication_status = 'draft',
    published_at = null,
    updated_at = now()
  returning id into trial_shop_id;

  insert into app.shop_areas (shop_id, area_id, is_primary, source_system)
  values (trial_shop_id, trial_area_id, false, 'wordpress')
  on conflict (shop_id, area_id) do update set
    is_primary = false,
    source_system = excluded.source_system;

  insert into private.import_records (
    batch_id,
    entity_type,
    source_id,
    target_table,
    target_id,
    status,
    source_payload,
    transformed_payload,
    issues,
    imported_at
  )
  values (
    trial_batch_id,
    'shop',
    '1237',
    'app.shops',
    trial_shop_id,
    'imported',
    jsonb_build_object(
      'wp_post_id', 1237,
      'slug', '%e6%ae%bf%e6%a7%98%e6%b0%97%e5%88%86',
      'area', jsonb_build_array(46, 2, 16),
      'basic_price', '',
      'featured_media', 0,
      'official_url', 'https://spa-tono.com/'
    ),
    jsonb_build_object(
      'publication_status', 'draft',
      'linked_area_wp_term_id', 46,
      'price_is_public', false,
      'image_is_public', false
    ),
    jsonb_build_array('address-access-mixed', 'price-missing', 'image-missing'),
    now()
  )
  on conflict (batch_id, entity_type, source_id) do update set
    target_table = excluded.target_table,
    target_id = excluded.target_id,
    status = excluded.status,
    source_payload = excluded.source_payload,
    transformed_payload = excluded.transformed_payload,
    issues = excluded.issues,
    imported_at = excluded.imported_at,
    updated_at = now();
end
$$;

commit;
