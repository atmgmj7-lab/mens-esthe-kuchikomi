#!/usr/bin/env bash
set -euo pipefail

# Disposable HTTP/browser acceptance without a host port, host network, or a
# Docker socket mount.  PostgREST, Next, and Playwright stay on one internal
# Docker network.  It deliberately shares no production configuration.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
headless_root="$repo_root/headless"
network_name="${ESKOMI_E2E_NETWORK:-eskomi-v11-replay-http-e2e-net}"
database_container="${ESKOMI_PG17_CONTAINER:-eskomi-pg17-v11-http-e2e}"
postgrest_container="${ESKOMI_POSTGREST_CONTAINER:-eskomi-postgrest-v164-http-e2e}"
next_container="${ESKOMI_NEXT_CONTAINER:-eskomi-next-v11-http-e2e}"
browser_container="${ESKOMI_BROWSER_CONTAINER:-eskomi-browser-v11-http-e2e}"
runtime_volume="${ESKOMI_E2E_RUNTIME_VOLUME:-eskomi-v11-runtime-${RANDOM}-${RANDOM}}"
runtime_volume_created=0
network_created=0
database_created=0
postgrest_created=0
next_created=0
browser_created=0
database_name="${ESKOMI_PG17_DATABASE:-eskomi_verify}"
jwt_secret="e2e-only-local-postgrest-jwt-secret-012345678901234567890123456789"
replay_key="${ESKOMI_REVIEW_REPLAY_KEY:-MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=}"
dashboard_user="${ESKOMI_E2E_DASHBOARD_USER:-isolated-review-operator}"
dashboard_password="${ESKOMI_E2E_DASHBOARD_PASSWORD:-isolated-review-operator-password}"
access_context_secret="isolated-access-context-secret-0123456789"
primary_partner_user="11111111-1111-4111-8111-111111111111"
other_partner_user="22222222-2222-4222-8222-222222222222"
operator_partner_user="33333333-3333-4333-8333-333333333333"

cleanup() {
  [ "$browser_created" -eq 1 ] && docker rm -f "$browser_container" >/dev/null 2>&1 || true
  [ "$next_created" -eq 1 ] && docker rm -f "$next_container" >/dev/null 2>&1 || true
  [ "$postgrest_created" -eq 1 ] && docker rm -f "$postgrest_container" >/dev/null 2>&1 || true
  [ "$database_created" -eq 1 ] && docker rm -f "$database_container" >/dev/null 2>&1 || true
  [ "$network_created" -eq 1 ] && docker network rm "$network_name" >/dev/null 2>&1 || true
  if [ "$runtime_volume_created" -eq 1 ]; then docker volume rm "$runtime_volume" >/dev/null 2>&1 || true; fi
}
for resource in "$network_name" "$database_container" "$postgrest_container" "$next_container" "$browser_container"; do
  if docker network inspect "$resource" >/dev/null 2>&1 || docker container inspect "$resource" >/dev/null 2>&1; then echo "Refusing existing Docker resource: $resource" >&2; exit 1; fi
done
trap cleanup EXIT

service_role_jwt="$(node -e 'const c=require("node:crypto");const b=(x)=>Buffer.from(JSON.stringify(x)).toString("base64url");const h=b({alg:"HS256",typ:"JWT"});const p=b({role:"service_role"});process.stdout.write(h+"."+p+"."+c.createHmac("sha256",process.argv[1]).update(h+"."+p).digest("base64url"));' "$jwt_secret")"

# The host's node_modules may contain macOS-native SWC binaries. Install the
# lockfile-pinned Linux runtime before the application joins the internal test
# network, so Next never needs outbound registry access while exercising data.
if docker volume inspect "$runtime_volume" >/dev/null 2>&1; then
  echo "Refusing to use existing runtime volume: $runtime_volume" >&2
  exit 1
fi
docker volume create "$runtime_volume" >/dev/null
runtime_volume_created=1
docker run --rm \
  --mount "type=bind,src=$headless_root,dst=/source,readonly" \
  --mount "type=volume,src=$runtime_volume,dst=/app" \
  node:24-bookworm-slim sh -ceu '
    tar -C /source --exclude=node_modules --exclude=.next -cf - . | tar -C /app -xf -
    cd /app
    npm ci --ignore-scripts
  ' >/dev/null

docker network create --internal "$network_name" >/dev/null
network_created=1
docker run -d --rm --name "$database_container" --network "$network_name" --network-alias postgres \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB="$database_name" postgres:17 >/dev/null
database_created=1
for _ in $(seq 1 30); do
  if docker exec "$database_container" pg_isready -U postgres -d "$database_name" >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$database_container" pg_isready -U postgres -d "$database_name" >/dev/null

docker exec -i "$database_container" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$database_name" <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role authenticator login password 'fixture-authenticator-password';
grant anon, authenticated, service_role to authenticator;
create schema extensions;
create extension pgcrypto with schema extensions;
create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean not null default false, file_size_limit bigint, allowed_mime_types text[]);
SQL
for migration in "$repo_root"/supabase/migrations/*.sql; do
  docker exec -i "$database_container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$database_name" < "$migration"
done
for acceptance in \
  verify_eskomi_canonical_foundation.sql \
  verify_eskomi_canonical_managed_directory_e2e.sql \
  verify_eskomi_canonical_partner_home_listing.sql \
  verify_eskomi_canonical_integrity_fixes.sql \
  verify_eskomi_review_entry_v2.sql \
  verify_eskomi_review_entry_therapist_selection.sql \
  verify_eskomi_partner_therapist_tools.sql \
  verify_eskomi_public_profiles_access.sql \
  verify_eskomi_v11_acceptance_hardening.sql \
  verify_eskomi_v11_operations.sql \
  verify_eskomi_v11_rpc_contract.sql \
  verify_eskomi_community_v11.sql \
  verify_eskomi_v11_private_controls.sql \
  verify_eskomi_v11_vertical_slice.sql; do
  docker exec -i "$database_container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$database_name" < "$repo_root/supabase/tests/$acceptance"
done
ESKOMI_PG17_CONTAINER="$database_container" ESKOMI_PG17_DATABASE="$database_name" "$headless_root/scripts/verify-eskomi-v11-mutation-races.sh"

entry_handle="$(docker exec -i "$database_container" psql -X -q -A -t -v ON_ERROR_STOP=1 -U postgres -d "$database_name" <<'SQL'
with shop as (
  insert into app.shops(slug, canonical_path, name, publication_status, published_at)
  values ('v11-replay-e2e', '/shops/v11-replay-e2e/', 'V11 replay E2E fixture', 'published', now())
  returning id
)
insert into private.review_entry_links(shop_id, link_kind, created_by)
select id, 'shop_qr', 'isolated-v11-replay-e2e' from shop
returning public_handle;
SQL
)"

# The widget is a separate public projection and needs its own local-only
# workspace fixture.  It never uses a production workspace or credential.
widget_handle="$(docker exec -i "$database_container" psql -X -q -A -t -v ON_ERROR_STOP=1 -U postgres -d "$database_name" <<'SQL'
do $$
declare v_shop uuid; v_workspace uuid;
begin
  select id into v_shop from app.shops where slug='v11-replay-e2e';
  select workspace_id into v_workspace from private.provision_partner_workspace_for_app_shop(v_shop,'provisioning');
  insert into private.review_widget_settings_v11(workspace_id,shop_id)
  values(v_workspace,v_shop) on conflict(workspace_id) do nothing;
end $$;
select public_handle from private.review_widget_settings_v11
where shop_id=(select id from app.shops where slug='v11-replay-e2e');
SQL
)"

# A pre-approved local benefit program lets the customer submit route issue a
# real opaque code. A second workspace proves that redemption stays shop-bound.
benefit_workspaces="$(docker exec -i "$database_container" psql -X -q -A -t -v ON_ERROR_STOP=1 -U postgres -d "$database_name" <<SQL
do \$\$
declare v_shop uuid; v_workspace uuid; v_program uuid; v_revision integer; v_other_shop uuid; v_other_workspace uuid;
begin
  select id into v_shop from app.shops where slug='v11-replay-e2e';
  select id into v_workspace from private.partner_workspaces where app_shop_id=v_shop;
  update private.partner_workspaces set state='active_partner' where id=v_workspace;
  insert into private.partner_memberships(workspace_id,auth_user_id,role,status,accepted_at)
  values(v_workspace,'$primary_partner_user','owner','active',now());
  select program_id,revision into v_program,v_revision from private.save_partner_benefit_program_v11(
    v_workspace,'$primary_partner_user',0,'Isolated HTTP benefit','other',null,null,'Fixture terms','Fixture issuer','Fixture funder',now()-interval '1 minute',null,30,false
  );
  perform private.approve_benefit_program_v11(v_program,v_revision,'isolated-fixture');
  insert into app.shops(slug,canonical_path,name,publication_status,published_at)
  values('v11-other-shop-e2e','/shops/v11-other-shop-e2e/','V11 other shop fixture','published',now()) returning id into v_other_shop;
  select workspace_id into v_other_workspace from private.provision_partner_workspace_for_app_shop(v_other_shop,'provisioning');
  update private.partner_workspaces set state='active_partner' where id=v_other_workspace;
  insert into private.partner_memberships(workspace_id,auth_user_id,role,status,accepted_at)
  values(v_other_workspace,'$other_partner_user','owner','active',now());
end \$\$;
select (select id from private.partner_workspaces where shop_slug='v11-replay-e2e') || ',' || (select id from private.partner_workspaces where shop_slug='v11-other-shop-e2e');
SQL
)"
IFS=, read -r primary_workspace other_workspace <<< "$benefit_workspaces"

docker exec -i "$database_container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$database_name" <<'SQL'
do $$
declare payload jsonb;
begin
  payload:=jsonb_build_object('shop_name','V11 access HTTP fixture','area_slug','v11-access-area','area_name','V11 access area','official_url','https://example.test/v11-access','introduction','fixture','address',null,'business_hours',null,'phone',null,'line_url',null,'booking_url',null,'basic_price',null,'price_90',null,'banner_asset_id',null,'gallery_asset_ids','[]'::jsonb);
  perform private.create_canonical_managed_shop('v11-access-e2e',payload,'isolated-http-fixture');
  update app.shops set publication_status='published',published_at=now() where slug='v11-access-e2e';
  update private.managed_shops set publication_state='published' where shop_slug='v11-access-e2e';
  payload:=payload||jsonb_build_object('shop_name','V11 raw access HTTP fixture');
  perform private.create_canonical_managed_shop('v11-access-raw-e2e',payload,'isolated-http-fixture');
  update app.shops set publication_status='published',published_at=now() where slug='v11-access-raw-e2e';
  update private.managed_shops set publication_state='published' where shop_slug='v11-access-raw-e2e';
end $$;
SQL

docker exec -i "$database_container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$database_name" <<'SQL'
create or replace function api.eskomi_e2e_replay_counts(p_session_hash text)
returns table(experience_count bigint, operation_count bigint, replay_count bigint)
language sql security definer set search_path = private, pg_temp as $$
  select (select count(*) from private.review_experiences e join private.operation_idempotency o on o.result_entity_id=e.id where o.operation='review_submit' and o.actor_scope_hash=p_session_hash),
    (select count(*) from private.operation_idempotency o where o.operation='review_submit' and o.actor_scope_hash=p_session_hash),
    (select count(*) from private.operation_secret_replays r join private.operation_idempotency o on o.id=r.operation_id where o.operation='review_submit' and o.actor_scope_hash=p_session_hash)
$$;
create or replace function api.eskomi_e2e_expire_replay(p_session_hash text)
returns void language sql security definer set search_path = private, pg_temp as $$
  update private.guest_operation_sessions set replay_expires_at=now()-interval '1 second' where session_secret_hash=p_session_hash
$$;
create or replace function api.eskomi_e2e_existing_store_ownership_counts()
returns table(workspace_count bigint, membership_count bigint, owned_listing_store_count bigint)
language sql security definer set search_path = private, pg_temp as $$
  select
    (select count(*) from private.partner_workspaces),
    (select count(*) from private.partner_memberships),
    (select count(*) from private.listing_stores where workspace_id is not null)
$$;
revoke all on function api.eskomi_e2e_replay_counts(text), api.eskomi_e2e_expire_replay(text), api.eskomi_e2e_existing_store_ownership_counts() from public, anon, authenticated;
grant execute on function api.eskomi_e2e_replay_counts(text), api.eskomi_e2e_expire_replay(text), api.eskomi_e2e_existing_store_ownership_counts() to service_role;
notify pgrst, 'reload schema';
SQL

docker run -d --rm --name "$postgrest_container" --network "$network_name" --network-alias postgrest \
  -e PGRST_DB_URI="postgres://authenticator:fixture-authenticator-password@postgres:5432/$database_name" \
  -e PGRST_DB_SCHEMAS=api -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET="$jwt_secret" \
  postgrest/postgrest:v16.4 >/dev/null
postgrest_created=1
for _ in $(seq 1 30); do
  postgrest_logs="$(docker logs "$postgrest_container" 2>&1)"
  grep -q 'API server listening' <<<"$postgrest_logs" && break
  sleep 1
done
grep -q 'API server listening' <<<"$postgrest_logs"

# This is direct PostgREST HTTP, not a unit test and not production traffic.
# It verifies named JSON argument resolution plus stable per-event dedupe.
docker run --rm --network "$network_name" -e JWT="$service_role_jwt" node:24-bookworm-slim node -e '
  const base="http://postgrest:3000/rpc/"; const headers={Authorization:`Bearer ${process.env.JWT}`,apikey:process.env.JWT,"Content-Type":"application/json","Content-Profile":"api","Accept-Profile":"api"};
  const call=async(name,body)=>{const r=await fetch(base+name,{method:"POST",headers,body:JSON.stringify(body)});if(!r.ok)throw new Error(`${name} ${r.status} ${await r.text()}`)};
  const shop="v11-access-raw-e2e", session="c".repeat(64);
  await call("reserve_public_shop_access_context_v11",{p_shop_slug:shop,p_session_scope_hash:session,p_network_scope_hash:null,p_is_new_session:false});
  await call("record_public_shop_access_v11",{p_shop_slug:shop,p_event_kind:"shop_view",p_access_context_hash:"a".repeat(64),p_session_scope_hash:session});
  await call("record_public_shop_access_v11",{p_shop_slug:shop,p_event_kind:"shop_view",p_access_context_hash:"a".repeat(64),p_session_scope_hash:session});
  await call("record_public_shop_access_v11",{p_shop_slug:shop,p_event_kind:"official_line_click",p_access_context_hash:"b".repeat(64),p_session_scope_hash:session});
  console.log("PostgREST named reserve and stable event calls: PASS");
 '
access_counts="$(docker exec -i "$database_container" psql -X -q -A -t -v ON_ERROR_STOP=1 -U postgres -d "$database_name" -c "select shop_view_count||','||official_line_click_count from private.partner_shop_access_daily_v11 daily join app.shops shop on shop.id=daily.shop_id where shop.slug='v11-access-raw-e2e' and daily.observed_on=(now() at time zone 'Asia/Tokyo')::date")"
test "$access_counts" = "1,1"
echo "PostgREST access dedupe view=1 line=1: PASS"

docker run -d --rm --name "$next_container" --network "$network_name" --network-alias next \
  --mount "type=volume,src=$runtime_volume,dst=/app" -w /app \
  -e SUPABASE_URL="http://postgrest:3000" -e SUPABASE_SERVICE_ROLE_KEY="$service_role_jwt" -e ESKOMI_E2E_RAW_POSTGREST=1 -e ESKOMI_REVIEW_REPLAY_KEY="$replay_key" \
  -e DASHBOARD_BASIC_AUTH_USER="$dashboard_user" -e DASHBOARD_BASIC_AUTH_PASSWORD="$dashboard_password" -e ESKOMI_ACCESS_CONTEXT_SECRET="$access_context_secret" \
  -e SHOP_OWNER_REQUEST_DRY_RUN=true \
  node:24-bookworm-slim sh -c 'npm run dev -- --hostname 0.0.0.0 --port 57000' >/dev/null
next_created=1
for _ in $(seq 1 90); do
  next_logs="$(docker logs "$next_container" 2>&1)"
  grep -Eq 'Ready|started server' <<<"$next_logs" && break
  sleep 1
done
grep -Eq 'Ready|started server' <<<"$next_logs"

# Store-operation acceptance starts with public application and dashboard
# moderation surfaces.  It uses only fresh fixture data on this internal
# network; no production store, contact, or Auth identity is involved.
docker run --rm --network "$network_name" \
  -e ESKOMI_E2E_DASHBOARD_USER="$dashboard_user" -e ESKOMI_E2E_DASHBOARD_PASSWORD="$dashboard_password" -e ESKOMI_E2E_JWT="$service_role_jwt" \
  node:24-bookworm-slim node -e '
    const base="http://next:57000", postgrest="http://postgrest:3000/rpc/";
    const origin=base, basic=`Basic ${Buffer.from(`${process.env.ESKOMI_E2E_DASHBOARD_USER}:${process.env.ESKOMI_E2E_DASHBOARD_PASSWORD}`).toString("base64")}`;
    const fail=(m)=>{throw new Error(m)};
    const json=async(path,init={},expected=200)=>{const r=await fetch(base+path,init),t=await r.text();let v;try{v=JSON.parse(t)}catch{v=null}if(r.status!==expected)fail(`${path} expected ${expected}, got ${r.status}: ${t}`);return v};
    const rpc=async(name,body)=>{const r=await fetch(postgrest+name,{method:"POST",headers:{Authorization:`Bearer ${process.env.ESKOMI_E2E_JWT}`,apikey:process.env.ESKOMI_E2E_JWT,"Content-Type":"application/json","Content-Profile":"api","Accept-Profile":"api"},body:JSON.stringify(body)});if(!r.ok)fail(`${name} ${r.status}: ${await r.text()}`);return r.json()};
    const payload=(shop_name,introduction)=>({shop_name,area_slug:"osaka-city",area_name:"大阪市",official_url:"https://example.test/operator",introduction,address:null,business_hours:null,phone:null,line_url:null,booking_url:null,basic_price:null,price_90:null,banner_asset_id:null,gallery_asset_ids:[]});
    const listing=(kind, id, name, existing={})=>({idempotencyKey:id,kind,...existing,shopName:name,area:"大阪市",websiteUrl:"https://example.test/listing",introduction:"隔離掲載申請",contactName:"隔離担当",contactEmail:`${id.slice(0,8)}@fixture.test`,contactRole:"owner",editPreference:"shop",consentPrivacy:true,consentAccuracy:true,consentImageRights:true});
    (async()=>{
      const created=await json("/api/dashboard/managed-shops",{method:"POST",headers:{Authorization:basic,"Content-Type":"application/json",Origin:origin,"X-ESKOMI-CSRF":"managed-shop-write"},body:JSON.stringify({action:"create_and_publish",slug:"v11-operator-e2e",payload:payload("Operator direct original","direct-original")})});
      if(!created?.ok||typeof created.managedShopId!=="string")fail("operator direct create/publish failed");
      const directRows=await rpc("list_published_managed_shops",{});if(!directRows.some(x=>x.shop_slug==="v11-operator-e2e"&&x.introduction==="direct-original"))fail("operator direct publication missing");
      const registration=await json("/api/partner/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({shopSlug:"v11-operator-e2e",contactName:"隔離オーナー",contactRole:"owner",contactEmail:"operator-owner@fixture.test",confirmationDetails:"isolated fixture",sourceUrl:"https://example.test/ignored",consentTerms:true})});
      if(!registration?.ok)fail("published canonical partner registration failed");
      const reviews=await rpc("list_partner_registration_reviews_v11",{});const submission=reviews.find(x=>x.shop_slug==="v11-operator-e2e"&&x.contact_email==="operator-owner@fixture.test");
      if(!submission?.submission_id)fail("partner registration queue missing fixture");
      const approved=await json("/api/dashboard/partners/review",{method:"POST",headers:{Authorization:basic,"Content-Type":"application/json"},body:JSON.stringify({submissionId:submission.submission_id,decision:"approved",reason:"isolated approval"})});
      if(!approved?.ok||approved.review?.status!=="approved")fail(`partner registration approval did not persist: ${JSON.stringify(approved)}`);
      console.log("Published store registration, approval, workspace linkage: PASS");

      const newApplication=await json("/api/listing-applications",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(listing("new_listing","a1010101-1111-4111-8111-111111111111","隔離未掲載店舗"))});
      if(!newApplication?.ok||typeof newApplication.applicationId!=="string")fail("new listing application failed");
      const before=await json("/api/listing-applications/public/");if(before.listings.some(x=>x.application_id===newApplication.applicationId))fail("unapproved listing leaked publicly");
      const queued=await json("/api/dashboard/listing-applications",{headers:{Authorization:basic}});const pending=queued.applications.find(x=>x.id===newApplication.applicationId);if(!pending||pending.revision!==1)fail("new listing absent from dashboard queue");
      await json(`/api/dashboard/listing-applications/${newApplication.applicationId}`,{method:"POST",headers:{Authorization:basic,"Content-Type":"application/json"},body:JSON.stringify({expectedRevision:1,decision:"approved",note:"isolated approval"})});
      const after=await json("/api/listing-applications/public/");if(!after.listings.some(x=>x.application_id===newApplication.applicationId&&x.shop_name==="隔離未掲載店舗"))fail("approved new listing missing public projection");
      console.log("Unlisted store application, operator approval, public projection: PASS");

      const existing={existingWpShopId:8400000000000123,existingShopSlug:"v11-existing-e2e"};
      const ownershipBefore=(await rpc("eskomi_e2e_existing_store_ownership_counts",{}))[0];
      const first=await json("/api/listing-applications",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(listing("existing_change","a2020202-2222-4222-8222-222222222222","既存店舗の初回申請",existing))});
      const second=await json("/api/listing-applications",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(listing("existing_change","a3030303-3333-4333-8333-333333333333","既存店舗の二回目申請",existing))});
      for(const id of [first.applicationId,second.applicationId])await json(`/api/dashboard/listing-applications/${id}`,{method:"POST",headers:{Authorization:basic,"Content-Type":"application/json"},body:JSON.stringify({expectedRevision:1,decision:"approved",note:"existing isolated approval"})});
      const firstDetail=await json(`/api/dashboard/listing-applications/${first.applicationId}`,{headers:{Authorization:basic}}),secondDetail=await json(`/api/dashboard/listing-applications/${second.applicationId}`,{headers:{Authorization:basic}});
      if(!firstDetail.application?.listing_store_id||firstDetail.application.listing_store_id!==secondDetail.application?.listing_store_id)fail("existing-store applications did not bind the same stable store");
      const stable=await rpc("get_public_listing_store_by_slug",{p_shop_slug:"v11-existing-e2e"});if(stable.length!==1||stable[0].shop_name!=="既存店舗の二回目申請")fail("existing store public projection did not update stable target");
      const ownershipAfter=(await rpc("eskomi_e2e_existing_store_ownership_counts",{}))[0];
      if(JSON.stringify(ownershipAfter)!==JSON.stringify(ownershipBefore))fail(`existing store flow changed workspace, membership, or owner counts: ${JSON.stringify({ownershipBefore,ownershipAfter})}`);
      console.log("Existing store reuses the stable target without creating a workspace, membership, or owner: PASS");
    })().catch(e=>{console.error(e);process.exit(1)});
  '

operator_fixture="$(docker exec -i "$database_container" psql -X -q -A -t -v ON_ERROR_STOP=1 -U postgres -d "$database_name" <<SQL
do \$\$
declare v_workspace uuid; v_store uuid;
begin
  select id into v_workspace from private.partner_workspaces where shop_slug='v11-operator-e2e';
  if v_workspace is null then raise exception 'operator fixture workspace missing'; end if;
  update private.partner_workspaces set state='active_partner' where id=v_workspace;
  insert into private.partner_memberships(workspace_id,auth_user_id,role,status,accepted_at)
  values(v_workspace,'$operator_partner_user','owner','active',now()) on conflict (workspace_id,auth_user_id) do update set role='owner',status='active',accepted_at=now(),revoked_at=null;
  v_store:=private.create_listing_store('v11-operator-e2e','店舗側の初期公開値','大阪市','https://example.test/partner-initial',v_workspace,null);
  update private.listing_store_revisions set state='approved' where listing_store_id=v_store and revision=1;
  insert into private.listing_store_publications(listing_store_id,approved_revision,shop_slug,shop_name,area,website_url,introduction,banner_asset_id)
  values(v_store,1,'v11-operator-e2e','店舗側の初期公開値','大阪市','https://example.test/partner-initial','initial-public',null);
end \$\$;
select id || ',' || (select id from private.listing_stores where shop_slug='v11-operator-e2e') from private.partner_workspaces where shop_slug='v11-operator-e2e';
SQL
)"
IFS=, read -r operator_workspace operator_listing_store <<< "$operator_fixture"

docker run --rm --network "$network_name" \
  -e ESKOMI_E2E_DASHBOARD_USER="$dashboard_user" -e ESKOMI_E2E_DASHBOARD_PASSWORD="$dashboard_password" -e ESKOMI_E2E_JWT="$service_role_jwt" \
  -e ESKOMI_E2E_OPERATOR_WORKSPACE="$operator_workspace" -e ESKOMI_E2E_OPERATOR_STORE="$operator_listing_store" \
  -e ESKOMI_E2E_PRIMARY_USER="$operator_partner_user" \
  node:24-bookworm-slim node -e '
    const base="http://next:57000", pg="http://postgrest:3000/rpc/", origin=base;
    const basic=`Basic ${Buffer.from(`${process.env.ESKOMI_E2E_DASHBOARD_USER}:${process.env.ESKOMI_E2E_DASHBOARD_PASSWORD}`).toString("base64")}`;
    const fail=m=>{throw new Error(m)};
    const rpc=async(name,body)=>{const r=await fetch(pg+name,{method:"POST",headers:{Authorization:`Bearer ${process.env.ESKOMI_E2E_JWT}`,apikey:process.env.ESKOMI_E2E_JWT,"Content-Type":"application/json","Content-Profile":"api","Accept-Profile":"api"},body:JSON.stringify(body)});if(!r.ok)fail(`${name} ${r.status}: ${await r.text()}`);return r.json()};
    const json=async(path,init={},expected=200)=>{const r=await fetch(base+path,init),t=await r.text();let v;try{v=JSON.parse(t)}catch{v=null}if(r.status!==expected)fail(`${path} expected ${expected}, got ${r.status}: ${t}`);return v};
    const workspace=process.env.ESKOMI_E2E_OPERATOR_WORKSPACE,store=process.env.ESKOMI_E2E_OPERATOR_STORE,user=process.env.ESKOMI_E2E_PRIMARY_USER;
    const draft=introduction=>({shop_name:"店舗側の初期公開値",area:"大阪市",website_url:"https://example.test/partner-initial",introduction,banner_asset_id:null});
    (async()=>{
      if(await rpc("save_partner_listing_draft",{p_workspace_id:workspace,p_expected_revision:1,p_payload:draft("承認待ちの変更値")})!=="ok")fail("partner listing draft was not saved");
      if(await rpc("submit_partner_listing_change",{p_workspace_id:workspace,p_expected_revision:2})!=="ok")fail("partner listing change was not submitted");
      const before=await rpc("get_public_listing_store_by_slug",{p_shop_slug:"v11-operator-e2e"});if(before.length!==1||before[0].introduction!=="initial-public")fail("unapproved partner change leaked publicly");
      const queue=await json("/api/dashboard/partner-listing-revisions",{headers:{Authorization:basic}});const pending=queue.revisions.find(x=>x.store_id===store&&x.revision===2);if(!pending)fail("partner listing review queue missing submitted revision");
      await json("/api/dashboard/partner-listing-revisions",{method:"POST",headers:{Authorization:basic,"Content-Type":"application/json"},body:JSON.stringify({storeId:store,revision:2,decision:"approved",note:"isolated listing approval"})});
      const after=await rpc("get_public_listing_store_by_slug",{p_shop_slug:"v11-operator-e2e"});if(after.length!==1||after[0].introduction!=="承認待ちの変更値")fail("approved partner change did not update public projection");
      console.log("Partner change stays private until dashboard approval: PASS");

      const directPayload={shop_name:"Operator direct edited",area_slug:"osaka-city",area_name:"大阪市",official_url:"https://example.test/operator-direct",introduction:"direct-published",address:null,business_hours:null,phone:null,line_url:null,booking_url:null,basic_price:null,price_90:null,banner_asset_id:null,gallery_asset_ids:[]};
      const managed=(await rpc("list_published_managed_shops",{})).find(x=>x.shop_slug==="v11-operator-e2e");if(!managed?.managed_shop_id||!Number.isInteger(managed.approved_revision))fail("operator managed fixture missing");
      const direct=await json("/api/dashboard/managed-shops",{method:"POST",headers:{Authorization:basic,"Content-Type":"application/json",Origin:origin,"X-ESKOMI-CSRF":"managed-shop-write"},body:JSON.stringify({action:"save_and_publish",managedShopId:managed.managed_shop_id,expectedRevision:managed.approved_revision,payload:directPayload})});
      if(!direct?.ok)fail("operator direct edit failed");
      const changed=(await rpc("list_published_managed_shops",{})).find(x=>x.shop_slug==="v11-operator-e2e");if(changed?.introduction!=="direct-published")fail("operator direct edit was not immediately public");
      console.log("Operator direct edit publishes without a partner request: PASS");

      const photoKey=await rpc("reserve_partner_therapist_photo_upload",{p_workspace_id:workspace,p_auth_user_id:user,p_content_type:"image/png"});
      if(typeof photoKey!=="string")fail("therapist photo reservation failed");
      const photoAsset=await rpc("attach_partner_therapist_photo",{p_workspace_id:workspace,p_auth_user_id:user,p_object_key:photoKey,p_sha256:"a".repeat(64),p_content_type:"image/png",p_byte_size:1,p_width:1,p_height:1});
      if(typeof photoAsset!=="string")fail("therapist photo attachment failed");
      const therapists=await rpc("create_partner_therapist_assignment",{p_workspace_id:workspace,p_auth_user_id:user,p_display_name:"隔離セラピスト",p_photo_asset_id:photoAsset,p_permission_policy_version:"fixture-rights-v1",p_permission_confirmed:true});
      const therapist=therapists[0];if(!therapist?.assignment_id||therapist.display_name!=="隔離セラピスト"||therapist.photo_asset_id!==photoAsset)fail("therapist rights-confirmed registration failed");
      const links=await rpc("create_partner_review_entry_link",{p_workspace_id:workspace,p_auth_user_id:user,p_therapist_assignment_id:therapist.assignment_id,p_channel:"line"});
      const link=links[0];if(!link?.public_handle||link.therapist_display_name!=="隔離セラピスト")fail("dedicated therapist review link failed");
      const selection=await json("/api/reviews/v2/therapists/",{method:"POST",headers:{"Content-Type":"application/json",Origin:origin,"X-ESKOMI-CSRF":"review-v2"},body:JSON.stringify({entryHandle:link.public_handle})});
      if(!selection?.ok||!Array.isArray(selection.therapists)||selection.therapists.length!==0)fail(`dedicated link unexpectedly offers a replaceable therapist selection: ${JSON.stringify(selection)}`);
      const profile=await rpc("get_public_therapist_profile_v11",{p_assignment_id:therapist.assignment_id,p_limit:20});if(profile.length!==1||profile[0].display_name!=="隔離セラピスト"||profile[0].photo_asset_id!==photoAsset)fail("public therapist identity/photo projection missing");
      const context=await json("/api/reviews/v2/context/",{method:"POST",headers:{"Content-Type":"application/json",Origin:origin,"X-ESKOMI-CSRF":"review-v2"},body:JSON.stringify({entryHandle:link.public_handle,therapistAssignmentId:null})});
      if(context?.context?.therapist_display_name!=="隔離セラピスト")fail("dedicated review context missing therapist");
      const retired=(await rpc("end_partner_therapist_assignment",{p_workspace_id:workspace,p_auth_user_id:user,p_assignment_id:therapist.assignment_id,p_expected_revision:therapist.revision}))[0];if(retired?.lifecycle_state!=="retired")fail("therapist retirement failed");
      const fallback=await json("/api/reviews/v2/context/",{method:"POST",headers:{"Content-Type":"application/json",Origin:origin,"X-ESKOMI-CSRF":"review-v2"},body:JSON.stringify({entryHandle:link.public_handle,therapistAssignmentId:null})});
      if(fallback?.context?.therapist_display_name!==null||fallback?.context?.therapist_unavailable!==true)fail("retired dedicated link did not fall back to store-only context");
      console.log("Therapist rights, dedicated link, name/photo projection, and retirement fallback: PASS");
    })().catch(e=>{console.error(e);process.exit(1)});
  '

docker run --rm --network "$network_name" \
  -e ESKOMI_E2E_ENTRY_HANDLE="$entry_handle" \
  node:24-bookworm-slim node -e '
    const body={entryHandle:process.env.ESKOMI_E2E_ENTRY_HANDLE,therapistAssignmentId:null};
    fetch("http://next:57000/api/reviews/v2/context/",{method:"POST",headers:{"Content-Type":"application/json","X-ESKOMI-CSRF":"review-v2","Origin":"http://next:57000"},body:JSON.stringify(body)})
      .then(async r=>{const json=await r.json();if(!r.ok||!json?.ok||typeof json.context?.entry_handle!=="string"||typeof json.replayCredential!=="string")throw new Error(`context status=${r.status} body=${JSON.stringify(json)}`);console.log("Next-to-PostgREST review context HTTP: PASS")})
      .catch(error=>{console.error(error);process.exit(1)});
  '

# This is deliberately HTTP-only: each request crosses the isolated Next to
# PostgREST boundary.  It proves a guest's submit/replay receipt, operator
# approval under the local fixture Basic Auth + CSRF guard, both public read
# surfaces, and the guest withdrawal that hides both projections again.
docker run --rm --network "$network_name" \
  -e ESKOMI_E2E_ENTRY_HANDLE="$entry_handle" -e ESKOMI_E2E_WIDGET_HANDLE="$widget_handle" \
  -e ESKOMI_E2E_DASHBOARD_USER="$dashboard_user" -e ESKOMI_E2E_DASHBOARD_PASSWORD="$dashboard_password" \
  -e ESKOMI_E2E_JWT="$service_role_jwt" -e ESKOMI_E2E_PRIMARY_WORKSPACE="$primary_workspace" -e ESKOMI_E2E_OTHER_WORKSPACE="$other_workspace" \
  node:24-bookworm-slim node -e '
    const base="http://next:57000";
    const entryHandle=process.env.ESKOMI_E2E_ENTRY_HANDLE;
    const widgetHandle=process.env.ESKOMI_E2E_WIDGET_HANDLE;
    const note="isolated HTTP lifecycle review";
    const origin=base;
    const basic=`Basic ${Buffer.from(`${process.env.ESKOMI_E2E_DASHBOARD_USER}:${process.env.ESKOMI_E2E_DASHBOARD_PASSWORD}`).toString("base64")}`;
    const fail=(message)=>{throw new Error(message)};
    const json=async(path,init,expected)=>{
      const response=await fetch(base+path,init); const body=await response.text(); let value;
      try { value=JSON.parse(body); } catch { value=null; }
      if(response.status!==expected) fail(`${path} expected ${expected}, got ${response.status}: ${body}`);
      return value;
    };
    const headers={"Content-Type":"application/json","X-ESKOMI-CSRF":"review-v2","Origin":origin};
    (async()=>{
      const exactOrigin=async()=>{for(const candidate of ["http://next:57000","http://localhost:57000","http://127.0.0.1:57000","http://0.0.0.0:57000"]){const r=await fetch(`${base}/api/dashboard/reviews/v11`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:basic,"X-ESKOMI-CSRF":"review-moderation","Origin":candidate},body:"{}"});if(r.status===400)return candidate;if(r.status!==403)fail(`unexpected dashboard origin probe ${candidate}: ${r.status}`);}fail("no exact dashboard origin accepted");};
      const dashboardOrigin=await exactOrigin();
      const context=await json("/api/reviews/v2/context/",{method:"POST",headers,body:JSON.stringify({entryHandle,therapistAssignmentId:null})},200);
      if(!context?.ok||typeof context.replayCredential!=="string") fail("customer context missing replay credential");
      const submitHeaders={...headers,"Idempotency-Key":"isolated-http-lifecycle-key","X-ESKOMI-Replay-Credential":context.replayCredential};
      const payload={entryHandle,displayName:"HTTP fixture",shopRating:5,commonComment:note,therapistRating:null};
      const submitted=await json("/api/reviews/v2/submit/",{method:"POST",headers:submitHeaders,body:JSON.stringify(payload)},201);
      if(!submitted?.ok||submitted.replayed!==false||typeof submitted.experienceId!=="string"||typeof submitted.receipt!=="string"||typeof submitted.benefitCode!=="string") fail("initial submission or benefit issuance failed");
      const replayed=await json("/api/reviews/v2/submit/",{method:"POST",headers:submitHeaders,body:JSON.stringify(payload)},200);
      if(!replayed?.ok||replayed.replayed!==true||replayed.experienceId!==submitted.experienceId||replayed.receipt!==submitted.receipt||replayed.benefitCode!==submitted.benefitCode) fail("same submission did not safely replay");
      console.log("Customer submit and same-payload replay: PASS");

      const otherContext=await json("/api/reviews/v2/context/",{method:"POST",headers,body:JSON.stringify({entryHandle,therapistAssignmentId:null})},200);
      const other=await json("/api/reviews/v2/submit/",{method:"POST",headers:{...headers,"Idempotency-Key":"isolated-other-review-key","X-ESKOMI-Replay-Credential":otherContext.replayCredential},body:JSON.stringify({...payload,commonComment:"isolated other-review fixture"})},201);
      if(!other?.ok||typeof other.experienceId!=="string") fail("other fixture review was not created");

      await json("/api/dashboard/reviews/v11",{headers:{Authorization:`Basic ${Buffer.from("wrong:wrong").toString("base64")}`}},401);
      await json("/api/dashboard/reviews/v11",{method:"POST",headers:{"Content-Type":"application/json",Authorization:basic,"Origin":dashboardOrigin},body:JSON.stringify({})},403);
      await json("/api/dashboard/reviews/v11",{method:"POST",headers:{"Content-Type":"application/json",Authorization:basic,"X-ESKOMI-CSRF":"review-moderation","Origin":dashboardOrigin.replace(/^http:/,"https:")},body:JSON.stringify({})},403);
      await json("/api/dashboard/reviews/v11",{method:"POST",headers:{"Content-Type":"application/json",Authorization:basic,"X-ESKOMI-CSRF":"review-moderation","Origin":"http://other.invalid:57000"},body:JSON.stringify({})},403);
      const queue=await json("/api/dashboard/reviews/v11",{headers:{Authorization:basic}},200);
      const review=queue?.reviews?.find((item)=>item.experience_id===submitted.experienceId&&item.comment===note);
      if(!review||!Number.isSafeInteger(review.moderation_revision)) fail("fixture review was absent from the authorized moderation queue");
      const moderation=await json("/api/dashboard/reviews/v11",{method:"POST",headers:{"Content-Type":"application/json",Authorization:basic,"X-ESKOMI-CSRF":"review-moderation","Origin":dashboardOrigin},body:JSON.stringify({action:"review",id:submitted.experienceId,decision:"approved",revision:review.moderation_revision,note:"isolated approval"})},200);
      if(!moderation?.ok) fail("operator approval response was not ok");
      console.log("Fixture dashboard Basic Auth + CSRF approval: PASS");

      const projection=await fetch("http://postgrest:3000/rpc/list_public_review_experience_publications",{method:"POST",headers:{Authorization:`Bearer ${process.env.ESKOMI_E2E_JWT}`,apikey:process.env.ESKOMI_E2E_JWT,"Content-Type":"application/json","Content-Profile":"api","Accept-Profile":"api"},body:JSON.stringify({p_shop_slug:"v11-replay-e2e",p_limit:20,p_offset:0})});
      const projectionBody=await projection.text();
      if(!projection.ok||!projectionBody.includes(note)) fail(`public reader projection missing review: ${projection.status}; body=${projectionBody}`);
      const reader=await fetch(`${base}/reviews/entry/${entryHandle}/`); const readerBody=await reader.text();
      if(reader.status!==200||!readerBody.includes(note)) fail(`public reader did not show approved review: ${reader.status}; body=${readerBody.slice(0,600)}`);
      const widget=await json(`/api/public/review-widget/${widgetHandle}`,{},200);
      if(!widget?.ok||widget.widget?.reviewCount!==1||!widget.widget?.reviews?.some((item)=>item.body===note)) fail("public widget did not show approved review");
      console.log("Public reader and widget show approved review: PASS");

      const editSession=await json("/api/reviews/v2/edit-session/",{method:"POST",headers,body:JSON.stringify({receipt:submitted.receipt})},200);
      if(!editSession?.ok||editSession.experienceId!==submitted.experienceId||typeof editSession.credential!=="string") fail("guest edit session unavailable");
      await json("/api/reviews/v2/edit/",{headers:{"X-ESKOMI-Edit-Credential":editSession.credential,"X-ESKOMI-Edit-Target":other.experienceId}},410);
      const codeHash=require("node:crypto").createHash("sha256").update(submitted.benefitCode).digest("hex");
      const redeem=async(workspace,user)=>{const r=await fetch("http://postgrest:3000/rpc/redeem_benefit_code",{method:"POST",headers:{Authorization:`Bearer ${process.env.ESKOMI_E2E_JWT}`,apikey:process.env.ESKOMI_E2E_JWT,"Content-Type":"application/json","Content-Profile":"api","Accept-Profile":"api"},body:JSON.stringify({p_workspace_id:workspace,p_auth_user_id:user,p_code_hash:codeHash})});if(!r.ok)fail(`redeem RPC ${r.status}: ${await r.text()}`);return r.json();};
      if((await redeem(process.env.ESKOMI_E2E_OTHER_WORKSPACE,"22222222-2222-4222-8222-222222222222"))!=="forbidden") fail("other shop redeemed the benefit");
      if((await redeem(process.env.ESKOMI_E2E_PRIMARY_WORKSPACE,"11111111-1111-4111-8111-111111111111"))!=="redeemed") fail("initial benefit redemption failed");
      if((await redeem(process.env.ESKOMI_E2E_PRIMARY_WORKSPACE,"11111111-1111-4111-8111-111111111111"))!=="already_used") fail("benefit double redemption was accepted");
      console.log("Benefit issue, shop-bound redemption, and double-redemption rejection: PASS");
      const withdrawn=await json("/api/reviews/v2/edit/",{method:"DELETE",headers:{...headers,"X-ESKOMI-Edit-Credential":editSession.credential,"X-ESKOMI-Edit-Target":submitted.experienceId},body:JSON.stringify({expectedRevision:1})},200);
      if(!withdrawn?.ok||withdrawn.state!=="withdrawn") fail("guest withdrawal failed");

      const hiddenReader=await fetch(`${base}/reviews/entry/${entryHandle}/`); const hiddenReaderBody=await hiddenReader.text();
      if(hiddenReader.status!==200||hiddenReaderBody.includes(note)) fail(`public reader still exposes withdrawn review: ${hiddenReader.status}`);
      const hiddenWidget=await json(`/api/public/review-widget/${widgetHandle}`,{},200);
      if(!hiddenWidget?.ok||hiddenWidget.widget?.reviewCount!==0||hiddenWidget.widget?.reviews?.some((item)=>item.body===note)) fail("public widget still exposes withdrawn review");
      console.log("Guest withdrawal hides reader and widget: PASS");

      const accessContext=async(eventKind,cookie)=>{const r=await fetch(`${base}/api/analytics/shop-access/context/?shopSlug=v11-access-e2e&eventKind=${eventKind}`,{headers:cookie?{Cookie:cookie}:{}});const body=await r.json();const setCookie=r.headers.get("set-cookie")?.split(";",1)[0];if(r.status!==200||typeof body?.context!=="string"||!setCookie)fail(`access context ${eventKind} failed`);return {context:body.context,cookie:setCookie};};
      const accessPost=async(eventKind,context,cookie)=>{const r=await fetch(`${base}/api/analytics/shop-access/`,{method:"POST",headers:{"Content-Type":"application/json","Origin":dashboardOrigin,Cookie:cookie},body:JSON.stringify({shopSlug:"v11-access-e2e",eventKind,context})});if(r.status!==204)fail(`access event ${eventKind} failed: ${r.status}`);};
      const view=await accessContext("shop_view"); await accessPost("shop_view",view.context,view.cookie); await accessPost("shop_view",view.context,view.cookie);
      const line=await accessContext("official_line_click",view.cookie); await accessPost("official_line_click",line.context,line.cookie);
      console.log("Analytics Next context GET and event POST: PASS");
    })().catch(error=>{console.error(error);process.exit(1)});
  '

access_counts="$(docker exec -i "$database_container" psql -X -q -A -t -v ON_ERROR_STOP=1 -U postgres -d "$database_name" -c "select shop_view_count||','||official_line_click_count from private.partner_shop_access_daily_v11 daily join app.shops shop on shop.id=daily.shop_id where shop.slug='v11-access-e2e' and daily.observed_on=(now() at time zone 'Asia/Tokyo')::date")"
test "$access_counts" = "1,1"
echo "Analytics Next HTTP dedupe view=1 line=1: PASS"

if [[ "${ESKOMI_E2E_API_ONLY:-0}" == "1" ]]; then
  echo "Eskomi v1.1 Docker-network Next-to-PostgREST API acceptance: PASS"
  exit 0
fi

docker run -d --rm --name "$browser_container" --network "$network_name" --network-alias browser \
  --entrypoint /usr/bin/google-chrome browserless/chrome:latest \
  --headless=new --no-sandbox --disable-gpu --proxy-server=direct:// --proxy-bypass-list='*' \
  --remote-debugging-address=0.0.0.0 --remote-debugging-port=9222 >/dev/null
browser_created=1
sleep 2
browser_logs="$(docker logs "$browser_container" 2>&1)"
cdp_path="$(sed -n 's@.*ws://127\.0\.0\.1:9222\(/devtools/browser/.*\)@\1@p' <<<"$browser_logs" | tail -n 1)"
test -n "$cdp_path"
docker run --rm --network "$network_name" --network-alias runner --mount "type=volume,src=$runtime_volume,dst=/app,readonly" -w /app \
  -e SUPABASE_URL="http://postgrest:3000" -e SUPABASE_SERVICE_ROLE_KEY="$service_role_jwt" \
  -e ESKOMI_E2E_ENTRY_HANDLE="$entry_handle" -e ESKOMI_E2E_NEXT_URL="http://next:57000" \
  -e ESKOMI_E2E_CDP_URL="ws://browser:9222${cdp_path}" \
  -e ESKOMI_E2E_BROWSER_PROXY_ORIGIN="http://runner" \
  node:24-bookworm-slim node scripts/check-eskomi-v11-replay-browser.mjs

echo "Eskomi v1.1 Docker-network HTTP/Chromium replay acceptance: PASS"
