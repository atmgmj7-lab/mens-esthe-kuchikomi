# ACF source audit and bounded schema activation

Audit: 2026-09-19 JST, read-only `ssh xserver`, WP CLI in `/home/xs454693/mens-esthe-kuchikomi.com/public_html`. No production mutation executed.

## Verified source of truth

| Field | DB field ID / key | DB group / REST | Definition |
|---|---|---|---|
| price_90 | 375 / field_696fcb4e89be6 | 370 / group_696fc97dd404a / show_in_rest=0 | label 90分, number, optional |
| official_url | 252 / field_6963dc02cb703 | 66 / group_6961cc89d86dc / show_in_rest=1 | url, optional |
| shop_booking | 289 / field_696452111cbb2 | 66 / group_6961cc89d86dc / show_in_rest=1 | text, default 完全予約制 |

Both groups target `post_type == shop`. `acf_get_local_field_group` returned null for both; no theme acf-json files exist. ACF load/save JSON path is the child theme's `acf-json`. These are DB-managed definitions, not local PHP/JSON overrides. No definition for any of the four booking URL aliases appeared in the live group inventory.

Published-shop price inventory: 168 empty; all nonempty physical metadata values were decimal integer strings from 10000 through 32500. Existing CSV importer maps price_90 to price_90. No integer storage migration is needed. Projection preserves digit strings and returns null for absent, empty, negative, decorated, HTML or nonscalar values; positive values are bounded to seven digits.

## Canonical decision

`shop_booking_url` is accepted. It already leads the dedicated projection and frontend reservation alias order, follows shop_* naming, and does not collide with a live ACF definition. `booking_url` in historical Supabase draft data includes telephone/LINE values, reinforcing that this historical generic field must not become the canonical WordPress write target. `shop_booking` remains prose. Reader aliases remain read-only fallbacks; no aliases are populated by this change.

## Public read contract

`shop-price-booking-public.php` follows existing `shop-public-meta.php`'s `rest_prepare_shop` response projection. It reads exactly two public keys and adds sanitized `acf.price_90` / `acf.shop_booking_url`. It does not enable the private price group, register arbitrary meta, or expose a new write endpoint. Missing/invalid values become null. Valid URLs remain exact strings, including query parameters. HTTP(S), absolute URLs only; credentials/control characters and malformed values are suppressed. Upstream evidence must establish booking purpose.

## Exact schema mutation plan — approval required, NOT executed

Artifact: `docs/schema/shop-booking-url-field.json`. This is a SINGLE-FIELD ACF API payload, **not** a whole-group ACF GUI import. Do not import a replacement group or overwrite its existing fields.

1. Release approved code first. Re-read the two groups/field keys above and compare exact source of truth; export existing group 66 with all fields for rollback evidence. Confirm group 66 still targets shop and has show_in_rest=1; confirm field key `field_escomi_shop_booking_url_v1` and field name `shop_booking_url` do not exist anywhere. Abort on any mismatch or collision.
2. After explicit production-schema approval, load the JSON artifact locally in the approved WP CLI operation, resolve `acf_get_field_group('group_6961cc89d86dc')`, require ID 66, replace payload `parent` with integer 66, and call `acf_update_field($payload)` exactly once. This changes only the field definition. No shop values are written. Do not call `acf_add_local_field_group`, toggle group REST settings, or create a direct-meta writer.
3. Read back via `acf_get_field('field_escomi_shop_booking_url_v1')`; compare name/type/required/default/parent and verify old group fields are unchanged. Record the new field ID and exact group snapshot. Verify price field 375 remains unchanged and price group REST remains disabled.
4. Anonymous public shop REST readback must expose price_90 and null booking URL (until approved data exists). Check other keys/metadata for no new exposure. Run writer zero-write validation using a fresh read/CAS snapshot before a separately approved one-shop canary.
5. Schema rollback, if separately authorized and before data population: re-read the exact new field key/ID and confirm no stored shop values exist, then delete only that new definition via `acf_delete_field` with the recorded ID. Never overwrite/reimport the whole group. After data population, preserve the schema until data rollback/readback is complete; approval must cover that exact rollback.

No executable migration is auto-loaded or auto-applied by the theme. Production schema application and live REST/writer proof remain pending.

## Focused evidence

RED: `php tests/php/check-shop-price-booking-public.php` exited 1 with `FAIL: price_90 and booking public projection absent` before implementation.
GREEN: same command passed projection/schema checks; `php -l shop-price-booking-public.php` passed. These are local fixture tests, not production activation proof.

## OPTIONS schema integration

Live installed WP/ACF source was read without mutation: ACF registers request-specific `acf` schema on `rest_pre_dispatch` priority 10. WP's `rest_shop_item_schema` filter runs before additional REST fields are added, so it is not suitable for adding nested ACF properties. The narrow priority-20 callback instead extends the existing registered ACF field only on `/wp/v2/shop` and `/wp/v2/shop/{id}`. It preserves existing callbacks and properties and declares the two projected values as nullable strings, read-only, view/embed/edit. Missing ACF registration is not replaced with an independent schema/writer.

Schema RED: `FAIL: OPTIONS schema projection absent`; GREEN: focused PHP test verifies the two properties and existing callback/schema preservation. Live OPTIONS readback still requires approved deployment.

## Dedicated-only native HTTP mutation guard

Nested `readonly` is schema documentation, not an ACF authorization boundary. The installed ACF updater can otherwise accept nested values. A separate `rest_pre_dispatch` guard rejects native shop POST/PUT/PATCH when `acf` contains either target name, its exact audited/planned ACF key, or an `_acf_field_key_map` alias mapped to either reserved field. Rejection is 403 `dedicated_official_facts_writer_required`. GET/HEAD/OPTIONS, the dedicated endpoint, unrelated native ACF fields and WordPress admin GUI edits are unchanged. WordPress supplies the effective method via `get_method()`.

Guard RED: `FAIL: native REST target-field write guard absent`. GREEN: both names across three mutation methods, null writes, exact field-key and key-map aliases rejected; unrelated fields and read methods unaffected. No database schema mutation occurred.
