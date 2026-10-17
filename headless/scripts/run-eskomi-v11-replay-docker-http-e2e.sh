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
database_name="${ESKOMI_PG17_DATABASE:-eskomi_verify}"
jwt_secret="e2e-only-local-postgrest-jwt-secret-012345678901234567890123456789"
replay_key="${ESKOMI_REVIEW_REPLAY_KEY:-MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=}"
dashboard_user="${ESKOMI_E2E_DASHBOARD_USER:-isolated-review-operator}"
dashboard_password="${ESKOMI_E2E_DASHBOARD_PASSWORD:-isolated-review-operator-password}"
access_context_secret="isolated-access-context-secret-0123456789"
primary_partner_user="11111111-1111-4111-8111-111111111111"
other_partner_user="22222222-2222-4222-8222-222222222222"

cleanup() {
  docker rm -f "$browser_container" "$next_container" "$postgrest_container" "$database_container" >/dev/null 2>&1 || true
  docker network rm "$network_name" >/dev/null 2>&1 || true
}
trap cleanup EXIT

service_role_jwt="$(node -e 'const c=require("node:crypto");const b=(x)=>Buffer.from(JSON.stringify(x)).toString("base64url");const h=b({alg:"HS256",typ:"JWT"});const p=b({role:"service_role"});process.stdout.write(h+"."+p+"."+c.createHmac("sha256",process.argv[1]).update(h+"."+p).digest("base64url"));' "$jwt_secret")"

docker network create --internal "$network_name" >/dev/null
docker run -d --rm --name "$database_container" --network "$network_name" --network-alias postgres \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB="$database_name" postgres:17 >/dev/null
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
revoke all on function api.eskomi_e2e_replay_counts(text), api.eskomi_e2e_expire_replay(text) from public, anon, authenticated;
grant execute on function api.eskomi_e2e_replay_counts(text), api.eskomi_e2e_expire_replay(text) to service_role;
notify pgrst, 'reload schema';
SQL

docker run -d --rm --name "$postgrest_container" --network "$network_name" --network-alias postgrest \
  -e PGRST_DB_URI="postgres://authenticator:fixture-authenticator-password@postgres:5432/$database_name" \
  -e PGRST_DB_SCHEMAS=api -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET="$jwt_secret" \
  postgrest/postgrest:v16.4 >/dev/null
for _ in $(seq 1 30); do docker logs "$postgrest_container" 2>&1 | grep -q 'API server listening' && break; sleep 1; done
docker logs "$postgrest_container" 2>&1 | grep -q 'API server listening'

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
  --mount "type=bind,src=$headless_root,dst=/app" -w /app \
  -e SUPABASE_URL="http://postgrest:3000" -e SUPABASE_SERVICE_ROLE_KEY="$service_role_jwt" -e ESKOMI_E2E_RAW_POSTGREST=1 -e ESKOMI_REVIEW_REPLAY_KEY="$replay_key" \
  -e DASHBOARD_BASIC_AUTH_USER="$dashboard_user" -e DASHBOARD_BASIC_AUTH_PASSWORD="$dashboard_password" -e ESKOMI_ACCESS_CONTEXT_SECRET="$access_context_secret" \
  node:24-bookworm-slim sh -c 'npm run dev -- --hostname 0.0.0.0 --port 57000' >/dev/null
for _ in $(seq 1 90); do docker logs "$next_container" 2>&1 | grep -Eq 'Ready|started server' && break; sleep 1; done
docker logs "$next_container" 2>&1 | grep -Eq 'Ready|started server'

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
sleep 2
cdp_path="$(docker logs "$browser_container" 2>&1 | sed -n 's@.*ws://127\.0\.0\.1:9222\(/devtools/browser/.*\)@\1@p' | tail -n 1)"
test -n "$cdp_path"
docker run --rm --network "$network_name" --network-alias runner --mount "type=bind,src=$headless_root,dst=/app,readonly" -w /app \
  -e SUPABASE_URL="http://postgrest:3000" -e SUPABASE_SERVICE_ROLE_KEY="$service_role_jwt" \
  -e ESKOMI_E2E_ENTRY_HANDLE="$entry_handle" -e ESKOMI_E2E_NEXT_URL="http://next:57000" \
  -e ESKOMI_E2E_CDP_URL="ws://browser:9222${cdp_path}" \
  -e ESKOMI_E2E_BROWSER_PROXY_ORIGIN="http://runner" \
  node:24-bookworm-slim node scripts/check-eskomi-v11-replay-browser.mjs

echo "Eskomi v1.1 Docker-network HTTP/Chromium replay acceptance: PASS"
