# Local validation

Run from repository root with PHP intl/mysqli, Node dependencies installed in headless, and Python3. No command below invokes production writes.

```sh
php tests/php/check-price-booking-writer.php
php tests/php/check-shop-price-booking-public.php
node --test scripts/area_official_sync_v2/*.test.mjs
python3 -m unittest discover -s scripts/area_official_sync_v2 -p 'test_*.py'
npm --prefix headless test
npm --prefix headless run lint
npm --prefix headless run typecheck
npm --prefix headless run build
git diff --check
```

Optional real SQL regression uses a NEW isolated local MariaDB container/database only. `tests/php/check-price-booking-db.php` drops fixture tables; never point it at an existing workspace/service database. It accepts loopback, fixed `escomi_fixture` DB and fixture-only password. Set `ESKOMI_FIXTURE_DB_PORT` to the fresh container's loopback published port, then run `php tests/php/check-price-booking-db.php`. This proves transaction/CAS/readback/rollback through real InnoDB with WordPress boundary shims, not full WP/ACF lifecycle.

RED evidence before changes:

- price_90 rejected by deployed allowlist.
- absent public projection and OPTIONS schema.
- missing field audit semantic evidence / source-host binding.
- physical hidden price60 incorrectly included in public price aggregate (cross-language mismatch).
- historical snapshot read-key order compatibility.
- native REST target write guard absent.
- blank target/provenance public projection mismatches.
- missing runtime include coverage in client code revision check.

Release gates and pending real WordPress checks are in RELEASE_PLAN.md. Output logs and fresh baseline population/predicate evidence are retained locally under outputs/wp-price-web-booking-schema-writer-foundation-01, not shipped to WordPress.
