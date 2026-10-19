# Fixed-page media 357 — Storage migration preparation

## Scope and current evidence

This prepares, but does not execute, the public-image copy for fixed-page
media **357**. It is the featured image for WordPress page `343`, route
`/osaka-nihonbashi/`. It is outside the 241-row `app.shop_images` mapping and
must never be treated as a shop image row.

| Field | Verified preserved value |
| --- | --- |
| Source media ID | `357` |
| Source URL | `https://mens-esthe-kuchikomi.com/wp-content/uploads/2026/01/Gemini_Generated_Image_f8kg5yf8kg5yf8kg-scaled.png` |
| MIME / size | `image/png` / `6,487,809` bytes |
| SHA-256 | `96f59d37e745108178e23c1ba2533328b7ffb615c079e43228f449d28dd5486c` |
| Existing preservation location | `supabase/imports/wp-media-preservation/20261019-wp-media-preservation-v1/objects/357.png` |
| Existing preservation manifest | `manifest-shop-image-reconciled.json`, `transfer_state: not_transferred` |

## Planned public-object mapping

The approved public-image copy scope may include this object, but the current
manifest has no bucket/key or database reference for it. Create a separate
fixed-page media mapping record before any upload:

```json
{
  "wp_media_id": 357,
  "route_key": "/osaka-nihonbashi/",
  "source_sha256": "96f59d37e745108178e23c1ba2533328b7ffb615c079e43228f449d28dd5486c",
  "target_bucket": "shop-images",
  "target_key": "wordpress-media/357/96f59d37e745108178e23c1ba2533328b7ffb615c079e43228f449d28dd5486c.png",
  "expected_content_type": "image/png",
  "state": "prepared-not-applied"
}
```

`shop-images` and the public URL base must be reconciled against the existing
approved 241-object project mapping before execution; do not create a new
bucket, change a bucket policy, or substitute a project reference here.

## Required execution and verification sequence

1. Confirm the existing public-copy authorization explicitly covers fixed-page
   media 357 and the retained SHA-256 above.
2. Use the already preserved local object, never re-fetch WordPress as a
   substitute source. Upload with no overwrite (`x-upsert: false`).
3. Read the object back over the intended public URL and verify status, PNG
   MIME type, byte count, and SHA-256 exactly.
4. Record the object key and final URL in a dedicated fixed-page import batch.
5. Only after page body/content reconciliation is independently approved,
   replace the page HTML reference conditionally: its current URL must still
   equal the recorded WordPress source URL.
6. Re-run `/osaka-nihonbashi/` and sitemap HTTP checks. A missing or mismatched
   object stops the migration; no fallback to the WordPress URL is silently
   introduced.

No Storage call, bucket change, upload, page mutation, or secret use occurred
while preparing this procedure.
