begin;

set local statement_timeout = '30s';

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
  '0f17f6a1-3bf4-4d66-8ee6-3f589da4b030',
  'wordpress',
  'https://mens-esthe-kuchikomi.com/wp-json/wp/v2/shop/?area=46&per_page=100&_embed=1',
  'completed',
  now(),
  now(),
  30,
  30,
  0,
  jsonb_build_object(
    'trial_key', '20260714-sakaisujihonmachi-30-shops',
    'area_wp_term_id', 46,
    'selection', jsonb_build_array(
      'all-missing-price',
      'all-missing-image',
      'all-missing-official-url',
      'complete-and-multi-area-controls'
    ),
    'selected_at', '2026-07-14T06:47:24.000Z',
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

create temporary table trial_import_shops (
  payload jsonb not null
) on commit drop;

-- shop wp_post_id=654
-- shop wp_post_id=655
-- shop wp_post_id=656
-- shop wp_post_id=657
-- shop wp_post_id=660
-- shop wp_post_id=662
-- shop wp_post_id=670
-- shop wp_post_id=674
-- shop wp_post_id=675
-- shop wp_post_id=678
-- shop wp_post_id=683
-- shop wp_post_id=686
-- shop wp_post_id=687
-- shop wp_post_id=689
-- shop wp_post_id=695
-- shop wp_post_id=696
-- shop wp_post_id=697
-- shop wp_post_id=701
-- shop wp_post_id=706
-- shop wp_post_id=708
-- shop wp_post_id=709
-- shop wp_post_id=715
-- shop wp_post_id=723
-- shop wp_post_id=799
-- shop wp_post_id=826
-- shop wp_post_id=853
-- shop wp_post_id=1203
-- shop wp_post_id=1210
-- shop wp_post_id=1221
-- shop wp_post_id=1237
insert into trial_import_shops (payload)
select value
from jsonb_array_elements(
$trial$[
  {
    "wp_post_id": 654,
    "slug": "1st-the-best%ef%bc%88%e3%83%95%e3%82%a1%e3%83%bc%e3%82%b9%e3%83%88%e3%82%b6%e3%83%99%e3%82%b9%e3%83%88%ef%bc%89",
    "canonical_path": "/shops/1st-the-best%ef%bc%88%e3%83%95%e3%82%a1%e3%83%bc%e3%82%b9%e3%83%88%e3%82%b6%e3%83%99%e3%82%b9%e3%83%88%ef%bc%89/",
    "name": "1st the best（ファーストザベスト）",
    "description_html": "",
    "excerpt": "",
    "official_url": "https://www.1st5610.net/",
    "phone": "080-5333-5610",
    "address_text": null,
    "access_text": "堺筋本町 / 地下鉄各線「堺筋本町駅」3番出口より徒歩3分",
    "booking_url": null,
    "date_gmt": "2026-02-01T17:52:21",
    "modified_gmt": "2026-02-28T23:02:24",
    "area_ids": [
      46,
      2,
      16
    ],
    "featured_media": 1025,
    "image_url": "http://mens-esthe-kuchikomi.com/wp-content/uploads/images/大阪_堺筋本町の人気リラクゼーションサロン_1st the best_ファーストザベスト.jpg",
    "shop_hours": "10:00～翌5:00（受付時間9:00～翌2:00）",
    "shop_booking": "完全予約制",
    "basic_price": 12000,
    "issues": [
      "address-access-mixed",
      "price-unverified",
      "image-unverified",
      "multi-area-source"
    ]
  },
  {
    "wp_post_id": 655,
    "slug": "%e3%83%9f%e3%82%bb%e3%82%b9%e3%81%82%e3%81%be%e3%81%8a%e3%81%86%e3%82%bb%e3%83%a9%e3%83%94",
    "canonical_path": "/shops/%e3%83%9f%e3%82%bb%e3%82%b9%e3%81%82%e3%81%be%e3%81%8a%e3%81%86%e3%82%bb%e3%83%a9%e3%83%94/",
    "name": "ミセスあまおうセラピ",
    "description_html": "",
    "excerpt": "",
    "official_url": "https://amaou-therapi.jp/",
    "phone": "090-6758-6265",
    "address_text": null,
    "access_text": "堺筋本町・日本橋・谷町・長堀橋・松屋町 / 地下鉄各線「堺筋本町駅」3番出口より徒歩5分・地下鉄各線「日本橋駅」7番・8番出口より徒歩3分、地下鉄各線「谷町九丁目駅」3番出口より徒歩7分・地下鉄各線「谷町九丁目駅」2番出口より徒歩4分、地下鉄各線「日本橋駅」7番出口より徒歩7分・地下鉄各線「長堀橋駅」2-B・1番出口より徒歩7分、地下鉄長堀鶴見緑地線「松屋町駅」1・2番出口より徒歩9分",
    "booking_url": null,
    "date_gmt": "2026-02-01T17:52:21",
    "modified_gmt": "2026-02-28T23:02:32",
    "area_ids": [
      47,
      46,
      2,
      7,
      16
    ],
    "featured_media": 1048,
    "image_url": "http://mens-esthe-kuchikomi.com/wp-content/uploads/images/大阪_堺筋本町_日本橋_谷町_長堀橋_松屋町の人気メンズエステ_メンエス_ミセスあまおうセラピ.jpg",
    "shop_hours": "11:00～翌2:00（受付時間9:30～24:30）",
    "shop_booking": "完全予約制",
    "basic_price": 12000,
    "issues": [
      "address-access-mixed",
      "price-unverified",
      "image-unverified",
      "multi-area-source"
    ]
  },
  {
    "wp_post_id": 656,
    "slug": "aqua-spa%ef%bc%88%e3%82%a2%e3%82%af%e3%82%a2%e3%82%b9%e3%83%91%ef%bc%89",
    "canonical_path": "/shops/aqua-spa%ef%bc%88%e3%82%a2%e3%82%af%e3%82%a2%e3%82%b9%e3%83%91%ef%bc%89/",
    "name": "aqua SPA（アクアスパ）",
    "description_html": "",
    "excerpt": "",
    "official_url": "https://aquaspa-osaka.com/",
    "phone": "090-8686-1151",
    "address_text": null,
    "access_text": "堺筋本町・日本橋 / 大阪メトロ（Osaka Metro）各線「堺筋本町駅」より徒歩7分、大阪メトロ（Osaka Metro）各線「本町駅」より徒歩7分、大阪メトロ（Osaka Metro）各線「心斎橋駅」より徒歩10分・大阪メトロ（Osaka Metro）各線「日本橋駅」7番出口より徒歩5分、大阪メトロ（Osaka Metro）各線「谷町九丁目駅」より徒歩7分、近鉄各線「近鉄日本橋駅」より徒歩6分、大阪メトロ（Osaka Metro）長堀鶴見緑地線「松屋町駅」より徒歩10分、近鉄各線「大阪上本町駅」より徒歩10分、阪神なんば線「大阪難波駅」より徒歩15分、大阪メトロ（Osaka Metro）各線「なんば駅」より徒歩17分",
    "booking_url": null,
    "date_gmt": "2026-02-01T17:52:21",
    "modified_gmt": "2026-02-28T23:02:45",
    "area_ids": [
      52,
      47,
      46,
      2,
      7,
      12,
      16
    ],
    "featured_media": 922,
    "image_url": "http://mens-esthe-kuchikomi.com/wp-content/uploads/images/大阪_堺筋本町_日本橋の人気メンズエステ_メンエス_aqua SPA_アクアスパ.jpg",
    "shop_hours": "12:00～翌6:00（受付時間10:00～翌5:00）",
    "shop_booking": "完全予約制",
    "basic_price": 13000,
    "issues": [
      "address-access-mixed",
      "price-unverified",
      "image-unverified",
      "multi-area-source"
    ]
  },
  {
    "wp_post_id": 657,
    "slug": "%e7%be%8e%e9%ad%94%e5%a5%b3%e3%82%bb%e3%83%a9%e3%83%94%e3%83%bc",
    "canonical_path": "/shops/%e7%be%8e%e9%ad%94%e5%a5%b3%e3%82%bb%e3%83%a9%e3%83%94%e3%83%bc/",
    "name": "美魔女セラピー",
    "description_html": "",
    "excerpt": "",
    "official_url": null,
    "phone": "080-8327-6366",
    "address_text": "大阪市中央区久太郎町",
    "access_text": null,
    "booking_url": null,
    "date_gmt": "2026-02-01T17:52:21",
    "modified_gmt": "2026-02-01T17:52:21",
    "area_ids": [
      46
    ],
    "featured_media": 1004,
    "image_url": "http://mens-esthe-kuchikomi.com/wp-content/uploads/images/大阪_堺筋本町_天満橋_日本橋の人気リラクゼーションエステ_美魔女セラピー.jpg",
    "shop_hours": "10:00～翌3:00（最終受付）",
    "shop_booking": "完全予約制",
    "basic_price": 13000,
    "issues": [
      "price-unverified",
      "image-unverified",
      "official-url-missing"
    ]
  },
  {
    "wp_post_id": 660,
    "slug": "%e5%bf%83%e5%92%8c-%e5%a0%ba%e7%ad%8b%e6%9c%ac%e7%94%ba%e5%ba%97%ef%bc%88%e3%81%93%e3%82%88%e3%82%8a%ef%bc%89",
    "canonical_path": "/shops/%e5%bf%83%e5%92%8c-%e5%a0%ba%e7%ad%8b%e6%9c%ac%e7%94%ba%e5%ba%97%ef%bc%88%e3%81%93%e3%82%88%e3%82%8a%ef%bc%89/",
    "name": "心和 堺筋本町店（こより）",
    "description_html": "",
    "excerpt": "",
    "official_url": null,
    "phone": "090-8529-0546",
    "address_text": "大阪市中央区久太郎町",
    "access_text": null,
    "booking_url": null,
    "date_gmt": "2026-02-01T17:52:21",
    "modified_gmt": "2026-02-01T17:52:21",
    "area_ids": [
      46
    ],
    "featured_media": 1098,
    "image_url": "http://mens-esthe-kuchikomi.com/wp-content/uploads/images/大阪_堺筋本町の人気メンズエステ_メンエス_心和 堺筋本町店_こより.jpg",
    "shop_hours": "11:00～翌3:00（受付時間10:00～翌3:00）",
    "shop_booking": "完全予約制",
    "basic_price": 13000,
    "issues": [
      "price-unverified",
      "image-unverified",
      "official-url-missing"
    ]
  },
  {
    "wp_post_id": 662,
    "slug": "eminy-luxury%ef%bc%88%e3%82%a8%e3%83%9f%e3%83%8b%e3%83%bc%e3%83%a9%e3%82%b0%e3%82%b8%e3%83%a5%e3%82%a2%e3%83%aa%e3%83%bc%ef%bc%89",
    "canonical_path": "/shops/eminy-luxury%ef%bc%88%e3%82%a8%e3%83%9f%e3%83%8b%e3%83%bc%e3%83%a9%e3%82%b0%e3%82%b8%e3%83%a5%e3%82%a2%e3%83%aa%e3%83%bc%ef%bc%89/",
    "name": "Eminy Luxury（エミニーラグジュアリー）",
    "description_html": "",
    "excerpt": "",
    "official_url": null,
    "phone": "070-8963-7338",
    "address_text": "大阪市中央区南久宝寺町1丁目",
    "access_text": null,
    "booking_url": null,
    "date_gmt": "2026-02-01T17:52:21",
    "modified_gmt": "2026-02-01T17:52:21",
    "area_ids": [
      46
    ],
    "featured_media": 1140,
    "image_url": "http://mens-esthe-kuchikomi.com/wp-content/uploads/images/大阪_堺筋本町_日本橋の人気アロマオイルマッサージ_Eminy Luxury_エミニーラグジュアリー.jpg",
    "shop_hours": "11:00～翌3:00",
    "shop_booking": null,
    "basic_price": 16000,
    "issues": [
      "price-unverified",
      "image-unverified",
      "official-url-missing"
    ]
  },
  {
    "wp_post_id": 670,
    "slug": "%e7%a5%87%e5%9c%92-the-mrs-%e5%a0%ba%e7%ad%8b%e6%9c%ac%e7%94%ba%e5%ba%97%ef%bc%88%e3%81%8e%e3%81%8a%e3%82%93%e3%82%b6%e3%83%9f%e3%82%bb%e3%82%b9%ef%bc%89",
    "canonical_path": "/shops/%e7%a5%87%e5%9c%92-the-mrs-%e5%a0%ba%e7%ad%8b%e6%9c%ac%e7%94%ba%e5%ba%97%ef%bc%88%e3%81%8e%e3%81%8a%e3%82%93%e3%82%b6%e3%83%9f%e3%82%bb%e3%82%b9%ef%bc%89/",
    "name": "祇園 the.Mrs 堺筋本町店（ぎおんザミセス）",
    "description_html": "",
    "excerpt": "",
    "official_url": null,
    "phone": "070-9003-3363",
    "address_text": "大阪市中央区南久宝寺町",
    "access_text": null,
    "booking_url": null,
    "date_gmt": "2026-02-01T17:52:21",
    "modified_gmt": "2026-02-28T23:06:02",
    "area_ids": [
      46,
      2
    ],
    "featured_media": 995,
    "image_url": "http://mens-esthe-kuchikomi.com/wp-content/uploads/images/大阪_堺筋本町_新大阪の人気オイルたっぷりマッサージ_祇園 the.Mrs 堺筋本町店_ぎおんザミセス.jpg",
    "shop_hours": "11:00～翌5:00（受付時間10:00～翌3:00）",
    "shop_booking": "完全予約制",
    "basic_price": 15000,
    "issues": [
      "price-unverified",
      "image-unverified",
      "official-url-missing",
      "multi-area-source"
    ]
  },
  {
    "wp_post_id": 674,
    "slug": "%e6%84%9f%e8%ac%9d",
    "canonical_path": "/shops/%e6%84%9f%e8%ac%9d/",
    "name": "感謝",
    "description_html": "",
    "excerpt": "",
    "official_url": "https://kansya-osaka.com/",
    "phone": "050-8883-9626",
    "address_text": null,
    "access_text": "堺筋本町 / 地下鉄各線「堺筋本町駅」3番出口より徒歩5分",
    "booking_url": null,
    "date_gmt": "2026-02-01T17:52:21",
    "modified_gmt": "2026-02-28T23:07:00",
    "area_ids": [
      46,
      2,
      16
    ],
    "featured_media": null,
    "image_url": null,
    "shop_hours": "10:00～翌2:00（受付時間9:00～翌2:00）",
    "shop_booking": "完全予約制",
    "basic_price": 13000,
    "issues": [
      "address-access-mixed",
      "price-unverified",
      "image-missing",
      "multi-area-source"
    ]
  },
  {
    "wp_post_id": 675,
    "slug": "%e7%b6%ba%e9%ba%97%e3%81%aa%e3%82%b5%e3%83%ad%e3%83%b3",
    "canonical_path": "/shops/%e7%b6%ba%e9%ba%97%e3%81%aa%e3%82%b5%e3%83%ad%e3%83%b3/",
    "name": "綺麗なサロン",
    "description_html": "",
    "excerpt": "",
    "official_url": null,
    "phone": "080-4640-5407",
    "address_text": null,
    "access_text": "堺筋本町 / 地下鉄各線「堺筋本町駅」より徒歩1分",
    "booking_url": null,
    "date_gmt": "2026-02-01T17:52:21",
    "modified_gmt": "2026-02-28T23:07:16",
    "area_ids": [
      46,
      2,
      16
    ],
    "featured_media": 1121,
    "image_url": "http://mens-esthe-kuchikomi.com/wp-content/uploads/images/大阪_堺筋本町の人気メンズエステ_メンエス_綺麗なサロン.jpg",
    "shop_hours": "10:00～翌1:00（受付時間9:00～24:00）",
    "shop_booking": "完全予約制",
    "basic_price": 14000,
    "issues": [
      "address-access-mixed",
      "price-unverified",
      "image-unverified",
      "official-url-missing",
      "multi-area-source"
    ]
  },
  {
    "wp_post_id": 678,
    "slug": "la-nature%ef%bc%88%e3%83%a9%e3%83%bb%e3%83%8a%e3%83%81%e3%83%a5%e3%83%bc%e3%83%ab%ef%bc%89",
    "canonical_path": "/shops/la-nature%ef%bc%88%e3%83%a9%e3%83%bb%e3%83%8a%e3%83%81%e3%83%a5%e3%83%bc%e3%83%ab%ef%bc%89/",
    "name": "la nature（ラ・ナチュール）",
    "description_html": "",
    "excerpt": "",
    "official_url": null,
    "phone": "06-6796-7121",
    "address_text": "大阪市中央区南船場1丁目",
    "access_text": null,
    "booking_url": null,
    "date_gmt": "2026-02-01T17:52:21",
    "modified_gmt": "2026-02-01T17:52:21",
    "area_ids": [
      46
    ],
    "featured_media": 1040,
    "image_url": "http://mens-esthe-kuchikomi.com/wp-content/uploads/images/大阪_長堀橋_松屋町_梅田の人気メンズエステ_メンエス_la nature_ラ_ナチュール.jpg",
    "shop_hours": "10:00～24:00（受付時間9:30～23:00）",
    "shop_booking": "完全予約制",
    "basic_price": 14000,
    "issues": [
      "price-unverified",
      "image-unverified",
      "official-url-missing"
    ]
  },
  {
    "wp_post_id": 683,
    "slug": "%e3%83%9f%e3%82%bb%e3%82%b9%e3%81%ae%e5%ad%90%e5%ae%88%e5%94%84",
    "canonical_path": "/shops/%e3%83%9f%e3%82%bb%e3%82%b9%e3%81%ae%e5%ad%90%e5%ae%88%e5%94%84/",
    "name": "ミセスの子守唄",
    "description_html": "",
    "excerpt": "",
    "official_url": "https://mrs-komoriuta.com/",
    "phone": "090-4292-4129",
    "address_text": null,
    "access_text": "堺筋本町・新大阪・堺東・十三 / 大阪メトロ（Osaka Metro）各線「堺筋本町駅」7番口より徒歩5分・大阪メトロ（Osaka Metro）御堂筋線「新大阪駅」東口より徒歩5分・南海高野線「堺東駅」中央出口より徒歩10分・阪急各線「十三駅」西口より徒歩6分",
    "booking_url": null,
    "date_gmt": "2026-02-01T17:52:21",
    "modified_gmt": "2026-02-28T23:09:08",
    "area_ids": [
      49,
      46,
      2,
      16,
      17,
      13
    ],
    "featured_media": 988,
    "image_url": "http://mens-esthe-kuchikomi.com/wp-content/uploads/images/大阪_堺筋本町_新大阪_堺東_十三の人気メンズエステ_ミセスの子守唄.jpg",
    "shop_hours": "9:00～翌3:00",
    "shop_booking": "完全予約制",
    "basic_price": 14000,
    "issues": [
      "address-access-mixed",
      "price-unverified",
      "image-unverified",
      "multi-area-source"
    ]
  },
  {
    "wp_post_id": 686,
    "slug": "mrs-flowerspa%ef%bc%88%e3%83%9f%e3%82%bb%e3%82%b9%e3%83%95%e3%83%a9%e3%83%af%e3%83%bc%e3%82%b9%e3%83%91%ef%bc%89",
    "canonical_path": "/shops/mrs-flowerspa%ef%bc%88%e3%83%9f%e3%82%bb%e3%82%b9%e3%83%95%e3%83%a9%e3%83%af%e3%83%bc%e3%82%b9%e3%83%91%ef%bc%89/",
    "name": "Mrs.FlowerSPA（ミセスフラワースパ）",
    "description_html": "",
    "excerpt": "",
    "official_url": null,
    "phone": "080-4583-9121",
    "address_text": "大阪市中央区久太郎町2丁目",
    "access_text": null,
    "booking_url": null,
    "date_gmt": "2026-02-01T17:52:21",
    "modified_gmt": "2026-02-01T17:52:21",
    "area_ids": [
      46
    ],
    "featured_media": 1022,
    "image_url": "http://mens-esthe-kuchikomi.com/wp-content/uploads/images/大阪_堺筋本町_梅田_新大阪の人気メンズエステ_メンエス_Mrs.FlowerSPA_ミセスフラワースパ.jpg",
    "shop_hours": "11:00～翌5:00（受付時間10:00～翌3:00）",
    "shop_booking": "完全予約制",
    "basic_price": 15000,
    "issues": [
      "price-unverified",
      "image-unverified",
      "official-url-missing"
    ]
  },
  {
    "wp_post_id": 687,
    "slug": "mrs-mirage%ef%bc%88%e3%83%9f%e3%82%bb%e3%82%b9%e3%83%9f%e3%83%a9%e3%83%bc%e3%82%b8%e3%83%a5%ef%bc%89",
    "canonical_path": "/shops/mrs-mirage%ef%bc%88%e3%83%9f%e3%82%bb%e3%82%b9%e3%83%9f%e3%83%a9%e3%83%bc%e3%82%b8%e3%83%a5%ef%bc%89/",
    "name": "Mrs.Mirage（ミセスミラージュ）",
    "description_html": "",
    "excerpt": "",
    "official_url": null,
    "phone": "070-1842-1888",
    "address_text": null,
    "access_text": "堺筋本町・福島・京橋 / 地下鉄各線「堺筋本町駅」3番出口より徒歩5分・JR大阪環状線「福島駅」より徒歩2分、JR東西線「新福島駅」より徒歩4分、阪神本線「福島駅」より徒歩4分・京阪本線「京橋駅」より徒歩6分、JR各線「京橋駅」より徒歩7分",
    "booking_url": null,
    "date_gmt": "2026-02-01T17:52:21",
    "modified_gmt": "2026-02-28T23:09:44",
    "area_ids": [
      46,
      2,
      16,
      15
    ],
    "featured_media": 1095,
    "image_url": "http://mens-esthe-kuchikomi.com/wp-content/uploads/images/大阪_堺筋本町_福島_京橋の人気メンズエステ_メンエス_Mrs.Mirage_ミセスミラージュ.jpg",
    "shop_hours": "10:00～翌3:00（受付時間9:00～翌3:00）",
    "shop_booking": null,
    "basic_price": 15000,
    "issues": [
      "address-access-mixed",
      "price-unverified",
      "image-unverified",
      "official-url-missing",
      "multi-area-source"
    ]
  },
  {
    "wp_post_id": 689,
    "slug": "mrs-grand-noble%ef%bc%88%e3%83%9f%e3%82%bb%e3%82%b9-%e3%82%b0%e3%83%a9%e3%83%b3%e3%83%8e%e3%83%bc%e3%83%96%e3%83%ab%ef%bc%89",
    "canonical_path": "/shops/mrs-grand-noble%ef%bc%88%e3%83%9f%e3%82%bb%e3%82%b9-%e3%82%b0%e3%83%a9%e3%83%b3%e3%83%8e%e3%83%bc%e3%83%96%e3%83%ab%ef%bc%89/",
    "name": "Mrs.Grand Noble（ミセス グランノーブル）",
    "description_html": "",
    "excerpt": "",
    "official_url": null,
    "phone": "080-1569-2679",
    "address_text": "大阪市中央区北久宝寺町1丁目",
    "access_text": null,
    "booking_url": null,
    "date_gmt": "2026-02-01T17:52:21",
    "modified_gmt": "2026-02-01T17:52:21",
    "area_ids": [
      46
    ],
    "featured_media": 996,
    "image_url": "http://mens-esthe-kuchikomi.com/wp-content/uploads/images/大阪_堺筋本町_新大阪の人気アロマオイルマッサージ_Mrs.Grand Noble_ミセス グランノーブル.jpg",
    "shop_hours": "12:00～翌5:00（受付時間11:00～翌4:00）",
    "shop_booking": null,
    "basic_price": 15000,
    "issues": [
      "price-unverified",
      "image-unverified",
      "official-url-missing"
    ]
  },
  {
    "wp_post_id": 695,
    "slug": "muse%ef%bc%88%e3%83%9f%e3%83%a5%e3%83%bc%e3%82%ba%ef%bc%89",
    "canonical_path": "/shops/muse%ef%bc%88%e3%83%9f%e3%83%a5%e3%83%bc%e3%82%ba%ef%bc%89/",
    "name": "MUSE（ミューズ）",
    "description_html": "",
    "excerpt": "",
    "official_url": "https://osaka-muse.com/",
    "phone": "070-6507-0062",
    "address_text": null,
    "access_text": "堺筋本町 / 地下鉄各線「堺筋本町駅」3番出口より徒歩5分",
    "booking_url": null,
    "date_gmt": "2026-02-01T17:52:21",
    "modified_gmt": "2026-02-28T23:10:56",
    "area_ids": [
      46,
      2,
      16
    ],
    "featured_media": 1009,
    "image_url": "http://mens-esthe-kuchikomi.com/wp-content/uploads/images/大阪_堺筋本町の人気メンズエステ_メンエス_MUSE_ミューズ.jpg",
    "shop_hours": "10:00～翌3:00",
    "shop_booking": "完全予約制",
    "basic_price": 14000,
    "issues": [
      "address-access-mixed",
      "price-unverified",
      "image-unverified",
      "multi-area-source"
    ]
  },
  {
    "wp_post_id": 696,
    "slug": "elin%ef%bc%88%e3%82%a8%e3%83%aa%e3%83%b3%ef%bc%89",
    "canonical_path": "/shops/elin%ef%bc%88%e3%82%a8%e3%83%aa%e3%83%b3%ef%bc%89/",
    "name": "Elin（エリン）",
    "description_html": "",
    "excerpt": "",
    "official_url": null,
    "phone": "090-2746-7153",
    "address_text": "大阪市中央区大手通3丁目",
    "access_text": null,
    "booking_url": null,
    "date_gmt": "2026-02-01T17:52:21",
    "modified_gmt": "2026-02-01T17:52:21",
    "area_ids": [
      46
    ],
    "featured_media": 1008,
    "image_url": "http://mens-esthe-kuchikomi.com/wp-content/uploads/images/大阪_堺筋本町の人気メンズエステ_メンエス_Elin_エリン.jpg",
    "shop_hours": "10:00～翌8:00（受付時間9:00～翌7:00）",
    "shop_booking": "完全予約制",
    "basic_price": 17000,
    "issues": [
      "price-unverified",
      "image-unverified",
      "official-url-missing"
    ]
  },
  {
    "wp_post_id": 697,
    "slug": "feliz%ef%bc%88%e3%83%95%e3%82%a7%e3%83%aa%e3%82%b9%ef%bc%89",
    "canonical_path": "/shops/feliz%ef%bc%88%e3%83%95%e3%82%a7%e3%83%aa%e3%82%b9%ef%bc%89/",
    "name": "Feliz（フェリス）",
    "description_html": "",
    "excerpt": "",
    "official_url": null,
    "phone": "080-8332-5233",
    "address_text": "大阪市中央区大手通3丁目",
    "access_text": null,
    "booking_url": null,
    "date_gmt": "2026-02-01T17:52:21",
    "modified_gmt": "2026-02-01T17:52:21",
    "area_ids": [
      46
    ],
    "featured_media": 1078,
    "image_url": "http://mens-esthe-kuchikomi.com/wp-content/uploads/images/大阪_堺筋本町の人気アロマオイルマッサージ_Feliz_フェリス.jpg",
    "shop_hours": "10:00～翌8:00（受付時間9:00～翌8:00）",
    "shop_booking": "完全予約制",
    "basic_price": 20000,
    "issues": [
      "price-unverified",
      "image-unverified",
      "official-url-missing"
    ]
  },
  {
    "wp_post_id": 701,
    "slug": "queen-spumante-%e9%95%b7%e5%a0%80%e6%a9%8b%e5%ba%97%ef%bc%88%e3%82%af%e3%82%a4%e3%83%bc%e3%83%b3%e3%82%b9%e3%83%97%e3%83%9e%e3%83%b3%e3%83%86%ef%bc%89",
    "canonical_path": "/shops/queen-spumante-%e9%95%b7%e5%a0%80%e6%a9%8b%e5%ba%97%ef%bc%88%e3%82%af%e3%82%a4%e3%83%bc%e3%83%b3%e3%82%b9%e3%83%97%e3%83%9e%e3%83%b3%e3%83%86%ef%bc%89/",
    "name": "Queen Spumante 長堀橋店（クイーンスプマンテ）",
    "description_html": "",
    "excerpt": "",
    "official_url": null,
    "phone": "080-9602-0880",
    "address_text": "大阪市中央区南船場",
    "access_text": null,
    "booking_url": null,
    "date_gmt": "2026-02-01T17:52:22",
    "modified_gmt": "2026-02-01T17:52:22",
    "area_ids": [
      46
    ],
    "featured_media": 1019,
    "image_url": "http://mens-esthe-kuchikomi.com/wp-content/uploads/images/大阪_長堀橋_松屋町_堺筋本町の人気メンズエステ_メンエス_Queen Spumante 長堀橋店_クイーンスプマンテ.jpg",
    "shop_hours": "10:00～翌3:30（受付時間9:30～翌3:30）",
    "shop_booking": "予約優先",
    "basic_price": 12000,
    "issues": [
      "price-unverified",
      "image-unverified",
      "official-url-missing"
    ]
  },
  {
    "wp_post_id": 706,
    "slug": "%e3%82%b7%e3%83%bc%e3%82%af%e3%83%ac%e3%83%83%e3%83%88%e3%83%ab%e3%83%bc%e3%83%a0-%e3%83%92%e3%83%9e%e3%83%af%e3%83%aa",
    "canonical_path": "/shops/%e3%82%b7%e3%83%bc%e3%82%af%e3%83%ac%e3%83%83%e3%83%88%e3%83%ab%e3%83%bc%e3%83%a0-%e3%83%92%e3%83%9e%e3%83%af%e3%83%aa/",
    "name": "シークレットルーム ヒマワリ",
    "description_html": "",
    "excerpt": "",
    "official_url": "https://sr-himawari.com/",
    "phone": "090-1583-0608",
    "address_text": null,
    "access_text": "堺筋本町・梅田・堺東・新大阪・高槻 / 地下鉄各線「堺筋本町駅」・「本町駅」より徒歩5分・阪急各線「大阪梅田駅」・地下鉄谷町線「東梅田駅」より徒歩7分、JR各線「大阪駅」より徒歩10分、地下鉄谷町線「中崎町駅」3番出口より徒歩2分・南海高野線「堺東駅」より徒歩7分・JR各線「新大阪」東口より徒歩5分・阪急京都本線「高槻市駅」より徒歩5分、JR東海道本線「高槻駅」より徒歩10分",
    "booking_url": null,
    "date_gmt": "2026-02-01T17:52:22",
    "modified_gmt": "2026-02-28T23:12:29",
    "area_ids": [
      46,
      5,
      2,
      4,
      16,
      17,
      13
    ],
    "featured_media": 1052,
    "image_url": "http://mens-esthe-kuchikomi.com/wp-content/uploads/images/大阪_堺筋本町_梅田_堺東_新大阪_高槻の人気個室メンズリラクゼーション_シークレットルーム ヒマワリ.jpg",
    "shop_hours": "9:00～翌5:00（最終受付翌3:00）",
    "shop_booking": "完全予約制",
    "basic_price": null,
    "issues": [
      "address-access-mixed",
      "price-missing",
      "image-unverified",
      "multi-area-source"
    ]
  },
  {
    "wp_post_id": 708,
    "slug": "%e7%b4%a0%e4%ba%ba%e3%82%bb%e3%83%a9%e3%83%94%e3%83%bc%ef%bc%88%e3%81%97%e3%82%8d%e3%81%86%e3%81%a8%e3%82%bb%e3%83%a9%e3%83%94%e3%83%bc%ef%bc%89",
    "canonical_path": "/shops/%e7%b4%a0%e4%ba%ba%e3%82%bb%e3%83%a9%e3%83%94%e3%83%bc%ef%bc%88%e3%81%97%e3%82%8d%e3%81%86%e3%81%a8%e3%82%bb%e3%83%a9%e3%83%94%e3%83%bc%ef%bc%89/",
    "name": "素人セラピー（しろうとセラピー）",
    "description_html": "",
    "excerpt": "",
    "official_url": null,
    "phone": "080-8313-9282",
    "address_text": "大阪市中央区北久宝寺町",
    "access_text": null,
    "booking_url": null,
    "date_gmt": "2026-02-01T17:52:22",
    "modified_gmt": "2026-02-01T17:52:22",
    "area_ids": [
      46
    ],
    "featured_media": 1075,
    "image_url": "http://mens-esthe-kuchikomi.com/wp-content/uploads/images/大阪_堺筋本町の人気メンズエステ_メンエス_素人セラピー_しろうとセラピー.jpg",
    "shop_hours": "10:00～翌2:00（受付時間9:00～24:00）",
    "shop_booking": "完全予約制",
    "basic_price": 14000,
    "issues": [
      "price-unverified",
      "image-unverified",
      "official-url-missing"
    ]
  },
  {
    "wp_post_id": 709,
    "slug": "sirena-ii%ef%bc%88%e3%82%b7%e3%83%ac%e3%83%bc%e3%83%8a%ef%bc%89",
    "canonical_path": "/shops/sirena-ii%ef%bc%88%e3%82%b7%e3%83%ac%e3%83%bc%e3%83%8a%ef%bc%89/",
    "name": "sirena II（シレーナ）",
    "description_html": "",
    "excerpt": "",
    "official_url": null,
    "phone": "080-3830-9229",
    "address_text": "大阪市中央区南久宝寺町1丁目",
    "access_text": null,
    "booking_url": null,
    "date_gmt": "2026-02-01T17:52:22",
    "modified_gmt": "2026-02-28T23:12:43",
    "area_ids": [
      46,
      2
    ],
    "featured_media": 932,
    "image_url": "http://mens-esthe-kuchikomi.com/wp-content/uploads/images/大阪_堺筋本町_日本橋_長堀橋_松屋町_心斎橋_難波_梅田の人気メンズエステ_メンエス_sirena II_シレーナ.jpg",
    "shop_hours": "10:00～翌6:00（受付時間10:00～翌5:00）",
    "shop_booking": "完全予約制",
    "basic_price": 14000,
    "issues": [
      "price-unverified",
      "image-unverified",
      "official-url-missing",
      "multi-area-source"
    ]
  },
  {
    "wp_post_id": 715,
    "slug": "the-gloss%ef%bc%88%e3%82%b6%e3%83%bb%e3%82%b0%e3%83%ad%e3%82%b9%ef%bc%89",
    "canonical_path": "/shops/the-gloss%ef%bc%88%e3%82%b6%e3%83%bb%e3%82%b0%e3%83%ad%e3%82%b9%ef%bc%89/",
    "name": "The.gloss（ザ・グロス）",
    "description_html": "",
    "excerpt": "",
    "official_url": null,
    "phone": "080-3039-4363",
    "address_text": null,
    "access_text": "堺筋本町 / 大阪メトロ（Osaka Metro）各線「堺筋本町駅」より徒歩4分",
    "booking_url": null,
    "date_gmt": "2026-02-01T17:52:22",
    "modified_gmt": "2026-02-28T23:13:21",
    "area_ids": [
      46,
      2,
      16
    ],
    "featured_media": 1088,
    "image_url": "http://mens-esthe-kuchikomi.com/wp-content/uploads/images/大阪_堺筋本町の人気オイルマッサージ_The.gloss_ザ_グロス.jpg",
    "shop_hours": "9:00～翌5:00（受付時間9:00～翌3:00）",
    "shop_booking": "完全予約制",
    "basic_price": 16000,
    "issues": [
      "address-access-mixed",
      "price-unverified",
      "image-unverified",
      "official-url-missing",
      "multi-area-source"
    ]
  },
  {
    "wp_post_id": 723,
    "slug": "%e3%82%86%e3%82%8a%e3%81%8b%e3%81%94",
    "canonical_path": "/shops/%e3%82%86%e3%82%8a%e3%81%8b%e3%81%94/",
    "name": "ゆりかご",
    "description_html": "",
    "excerpt": "",
    "official_url": "https://kokoronoyurikago-osaka.site/",
    "phone": "06-6125-5838",
    "address_text": null,
    "access_text": "堺筋本町・北浜・新大阪 / 地下鉄各線「堺筋本町駅」11番出口より徒歩3分・地下鉄堺筋線「北浜駅」4番出口より徒歩5分・地下鉄御堂筋線・JR各線「新大阪駅」東出口より徒歩4分",
    "booking_url": null,
    "date_gmt": "2026-02-01T17:52:22",
    "modified_gmt": "2026-02-26T04:09:26",
    "area_ids": [
      46,
      2,
      16,
      13
    ],
    "featured_media": 1100,
    "image_url": "http://mens-esthe-kuchikomi.com/wp-content/uploads/images/大阪_神戸_兵庫県_尼崎の人気メンズエステ_ゆりかご 神戸尼崎店.jpg",
    "shop_hours": "10:00～翌2:00（受付時間9:00～24:30）",
    "shop_booking": "要予約",
    "basic_price": 13000,
    "issues": [
      "address-access-mixed",
      "price-unverified",
      "image-unverified",
      "multi-area-source"
    ]
  },
  {
    "wp_post_id": 799,
    "slug": "firstclass%ef%bc%88%e3%83%95%e3%82%a1%e3%83%bc%e3%82%b9%e3%83%88%e3%82%af%e3%83%a9%e3%82%b9%ef%bc%89",
    "canonical_path": "/shops/firstclass%ef%bc%88%e3%83%95%e3%82%a1%e3%83%bc%e3%82%b9%e3%83%88%e3%82%af%e3%83%a9%e3%82%b9%ef%bc%89/",
    "name": "Firstclass（ファーストクラス）",
    "description_html": "",
    "excerpt": "",
    "official_url": "https://firstclass-osaka.net/",
    "phone": "06-6633-7886",
    "address_text": null,
    "access_text": "日本橋・梅田・長堀橋・松屋町・谷町・堺筋本町 / 地下鉄各線「日本橋駅」7番出口より徒歩3分、地下鉄各線「谷町九丁目駅」2番出口より徒歩5分・阪メトロ（Osaka Metro）谷町線「中崎町駅」3番出口より徒歩4分・大阪メトロ（Osaka Metro）長堀鶴見緑地線「松屋町駅」2番出口より徒歩2分・大阪メトロ（Osaka Metro）各線「長堀橋駅」6番出口より徒歩5分・地下鉄各線「谷町九丁目駅」3番出口より徒歩1分・地下鉄各線「堺筋本町駅」より徒歩5分",
    "booking_url": null,
    "date_gmt": "2026-02-01T17:52:24",
    "modified_gmt": "2026-02-28T23:05:36",
    "area_ids": [
      47,
      46,
      2,
      4,
      7,
      16
    ],
    "featured_media": null,
    "image_url": null,
    "shop_hours": "10:00～翌2:00（受付時間9:00～翌1:00）",
    "shop_booking": "完全予約制",
    "basic_price": 14000,
    "issues": [
      "address-access-mixed",
      "price-unverified",
      "image-missing",
      "multi-area-source"
    ]
  },
  {
    "wp_post_id": 826,
    "slug": "un-secret%ef%bc%88%e3%82%a2%e3%83%b3%e3%82%b9%e3%82%af%e3%83%ac%ef%bc%89",
    "canonical_path": "/shops/un-secret%ef%bc%88%e3%82%a2%e3%83%b3%e3%82%b9%e3%82%af%e3%83%ac%ef%bc%89/",
    "name": "Un Secret（アンスクレ）",
    "description_html": "",
    "excerpt": "",
    "official_url": "https://unsecret-osaka.com/top.php",
    "phone": "06-4256-1639",
    "address_text": null,
    "access_text": "日本橋・梅田・心斎橋・堺筋本町・新大阪・谷町 / 地下鉄各線「日本橋駅」7・8番出口より徒歩5分、地下鉄各線「谷町九丁目駅」2・3番出口より徒歩7分・阪急各線／阪神本線「大阪梅田駅」より徒歩10分、地下鉄御堂筋線「梅田駅」より徒歩10分、地下鉄谷町線「東梅田駅」より徒歩10分、JR各線「大阪駅」より徒歩15分・地下鉄各線「心斎橋駅」2番出口より徒歩5分、地下鉄各線「長堀橋駅」より徒歩5分・地下鉄各線「堺筋本町駅」より徒歩4分・JR各線・地下鉄御堂筋線「新大阪駅」東口より徒歩3分・地下鉄各線「谷町九丁目駅」2・3番出口より徒歩3分",
    "booking_url": null,
    "date_gmt": "2026-02-01T17:52:24",
    "modified_gmt": "2026-02-28T23:13:41",
    "area_ids": [
      47,
      46,
      2,
      4,
      7,
      12,
      16,
      13
    ],
    "featured_media": 920,
    "image_url": "http://mens-esthe-kuchikomi.com/wp-content/uploads/images/大阪_日本橋_梅田_心斎橋_堺筋本町_新大阪_谷町の人気メンズエステ_メンエス_Un Secret_アンスクレ.jpg",
    "shop_hours": "10:00～翌4:00（受付時間9:00～翌2:30）",
    "shop_booking": "完全予約制",
    "basic_price": 15000,
    "issues": [
      "address-access-mixed",
      "price-unverified",
      "image-unverified",
      "multi-area-source"
    ]
  },
  {
    "wp_post_id": 853,
    "slug": "mrs-flowerspa-%e5%8c%97%e6%96%b0%e5%a4%a7%e9%98%aa%e5%9c%b0%ef%bc%88%e3%83%9f%e3%82%bb%e3%82%b9%e3%83%95%e3%83%a9%e3%83%af%e3%83%bc%e3%82%b9%e3%83%91%ef%bc%89",
    "canonical_path": "/shops/mrs-flowerspa-%e5%8c%97%e6%96%b0%e5%a4%a7%e9%98%aa%e5%9c%b0%ef%bc%88%e3%83%9f%e3%82%bb%e3%82%b9%e3%83%95%e3%83%a9%e3%83%af%e3%83%bc%e3%82%b9%e3%83%91%ef%bc%89/",
    "name": "Mrs.FlowerSPA（ミセスフラワースパ）",
    "description_html": "",
    "excerpt": "",
    "official_url": "https://mrs-flowerspa.com/",
    "phone": "080-4583-9121",
    "address_text": null,
    "access_text": "堺筋本町・新大阪・梅田 / 地下鉄各線「堺筋本町駅」12番出口より徒歩3分・JR各線「新大阪駅」東口より徒歩9分・地下鉄谷町線「東梅田駅」より徒歩8分、地下鉄御堂筋線「淀屋橋駅」より徒歩9分、地下鉄御堂筋線「梅田駅」より徒歩12分、JR各線「大阪駅」より徒歩18分",
    "booking_url": null,
    "date_gmt": "2026-02-01T17:52:25",
    "modified_gmt": "2026-02-28T23:09:39",
    "area_ids": [
      46,
      2,
      4,
      16,
      13
    ],
    "featured_media": null,
    "image_url": null,
    "shop_hours": "11:00～翌5:00（受付時間10:00～翌3:00）",
    "shop_booking": "完全予約制",
    "basic_price": 15000,
    "issues": [
      "address-access-mixed",
      "price-unverified",
      "image-missing",
      "multi-area-source"
    ]
  },
  {
    "wp_post_id": 1203,
    "slug": "feliz%ef%bc%88%e3%83%95%e3%82%a7%e3%83%aa%e3%82%b9%ef%bc%89-2",
    "canonical_path": "/shops/feliz%ef%bc%88%e3%83%95%e3%82%a7%e3%83%aa%e3%82%b9%ef%bc%89-2/",
    "name": "Feliz（フェリス）",
    "description_html": "",
    "excerpt": "",
    "official_url": "https://www.osakafeliz.com/",
    "phone": "080-1444-9300",
    "address_text": null,
    "access_text": "堺筋本町 / 地下鉄各線「堺筋本町駅」12番出口より徒歩8分",
    "booking_url": null,
    "date_gmt": "2026-02-26T04:09:18",
    "modified_gmt": "2026-02-28T23:11:03",
    "area_ids": [
      46,
      2,
      16
    ],
    "featured_media": null,
    "image_url": null,
    "shop_hours": "10:00～翌8:00（受付時間9:00～翌8:00）",
    "shop_booking": "完全予約制",
    "basic_price": null,
    "issues": [
      "address-access-mixed",
      "price-missing",
      "image-missing",
      "multi-area-source"
    ]
  },
  {
    "wp_post_id": 1210,
    "slug": "elin%ef%bc%88%e3%82%a8%e3%83%aa%e3%83%b3%ef%bc%89-2",
    "canonical_path": "/shops/elin%ef%bc%88%e3%82%a8%e3%83%aa%e3%83%b3%ef%bc%89-2/",
    "name": "Elin（エリン）",
    "description_html": "",
    "excerpt": "",
    "official_url": "http://www.osakaelin.com/",
    "phone": "080-8556-2541",
    "address_text": null,
    "access_text": "堺筋本町 / 地下鉄各線「堺筋本町駅」12番出口より徒歩8分",
    "booking_url": null,
    "date_gmt": "2026-02-26T04:09:19",
    "modified_gmt": "2026-02-28T23:11:00",
    "area_ids": [
      46,
      2,
      16
    ],
    "featured_media": null,
    "image_url": null,
    "shop_hours": "10:00～翌8:00（受付時間9:00～翌7:00）",
    "shop_booking": "完全予約制",
    "basic_price": null,
    "issues": [
      "address-access-mixed",
      "price-missing",
      "image-missing",
      "multi-area-source"
    ]
  },
  {
    "wp_post_id": 1221,
    "slug": "riru-cheri%ef%bc%88%e3%83%aa%e3%83%ab%e3%82%b7%e3%82%a7%ef%bc%89",
    "canonical_path": "/shops/riru-cheri%ef%bc%88%e3%83%aa%e3%83%ab%e3%82%b7%e3%82%a7%ef%bc%89/",
    "name": "Riru cheri（リルシェ）",
    "description_html": "",
    "excerpt": "",
    "official_url": "https://riru-cheri.com/",
    "phone": "080-9831-1557",
    "address_text": null,
    "access_text": "堺筋本町 / 地下鉄各線「堺筋本町駅」7番出口より徒歩5分",
    "booking_url": null,
    "date_gmt": "2026-02-26T04:09:20",
    "modified_gmt": "2026-02-28T23:12:03",
    "area_ids": [
      46,
      2,
      16
    ],
    "featured_media": null,
    "image_url": null,
    "shop_hours": "11:00～翌5:00（受付時間10:00～翌3:00）",
    "shop_booking": "完全予約制",
    "basic_price": null,
    "issues": [
      "address-access-mixed",
      "price-missing",
      "image-missing",
      "multi-area-source"
    ]
  },
  {
    "wp_post_id": 1237,
    "slug": "%e6%ae%bf%e6%a7%98%e6%b0%97%e5%88%86",
    "canonical_path": "/shops/%e6%ae%bf%e6%a7%98%e6%b0%97%e5%88%86/",
    "name": "殿様気分",
    "description_html": "",
    "excerpt": "",
    "official_url": "https://spa-tono.com/",
    "phone": "070-8581-0708",
    "address_text": null,
    "access_text": "堺筋本町 / 大阪メトロ（Osaka Metro）各線「堺筋本町駅」1番出口より徒歩5分",
    "booking_url": null,
    "date_gmt": "2026-02-26T04:09:21",
    "modified_gmt": "2026-02-28T23:13:28",
    "area_ids": [
      46,
      2,
      16
    ],
    "featured_media": null,
    "image_url": null,
    "shop_hours": "10:00～23:00（受付時間9:30～21:30）",
    "shop_booking": "完全予約制",
    "basic_price": null,
    "issues": [
      "address-access-mixed",
      "price-missing",
      "image-missing",
      "multi-area-source"
    ]
  }
]$trial$::jsonb
);

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
  updated_at = now();

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
  null,
  payload,
  'draft',
  null
from trial_import_shops
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
  updated_at = now();

insert into app.shop_areas (shop_id, area_id, is_primary, source_system)
select shops.id, areas.id, false, 'wordpress'
from trial_import_shops as trial
join app.shops as shops
  on shops.wp_post_id = (trial.payload ->> 'wp_post_id')::bigint
join app.areas as areas
  on areas.wp_term_id = 46
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
  shops.id,
  '基本料金（WordPress移行値）',
  (trial.payload ->> 'basic_price')::integer,
  'trial-source:wordpress-basic_price; verification required',
  false,
  null
from trial_import_shops as trial
join app.shops as shops
  on shops.wp_post_id = (trial.payload ->> 'wp_post_id')::bigint
where trial.payload ->> 'basic_price' is not null
  and not exists (
    select 1
    from app.shop_prices as existing
    where existing.shop_id = shops.id
      and existing.course_name = '基本料金（WordPress移行値）'
      and existing.amount_yen = (trial.payload ->> 'basic_price')::integer
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
select
  shops.id,
  (trial.payload ->> 'featured_media')::bigint,
  trial.payload ->> 'image_url',
  '',
  'featured',
  0,
  false,
  null
from trial_import_shops as trial
join app.shops as shops
  on shops.wp_post_id = (trial.payload ->> 'wp_post_id')::bigint
where nullif(trial.payload ->> 'image_url', '') is not null
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
select
  '0f17f6a1-3bf4-4d66-8ee6-3f589da4b030'::uuid,
  'shop',
  trial.payload ->> 'wp_post_id',
  'app.shops',
  shops.id,
  'imported',
  trial.payload,
  jsonb_build_object(
    'publication_status', 'draft',
    'linked_area_wp_term_id', 46,
    'price_is_public', false,
    'image_is_public', false
  ),
  coalesce(trial.payload -> 'issues', '[]'::jsonb),
  now()
from trial_import_shops as trial
join app.shops as shops
  on shops.wp_post_id = (trial.payload ->> 'wp_post_id')::bigint
on conflict (batch_id, entity_type, source_id) do update set
  target_table = excluded.target_table,
  target_id = excluded.target_id,
  status = excluded.status,
  source_payload = excluded.source_payload,
  transformed_payload = excluded.transformed_payload,
  issues = excluded.issues,
  imported_at = excluded.imported_at,
  updated_at = now();

commit;
