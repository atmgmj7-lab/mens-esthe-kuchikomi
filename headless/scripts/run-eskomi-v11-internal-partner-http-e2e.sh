#!/usr/bin/env bash
set -euo pipefail

fixture_failure_diagnostics() {
  echo "Partner HTTP fixture failed near line $1" >&2
  if [ "${next_created:-0}" -eq 1 ] && docker container inspect "${next_container:-}" >/dev/null 2>&1; then docker logs --tail 30 "$next_container" >&2 || true; fi
  if [ "${auth_created:-0}" -eq 1 ] && docker container inspect "${auth_container:-}" >/dev/null 2>&1; then docker logs --tail 20 "$auth_container" >&2 || true; fi
}
trap 'fixture_failure_diagnostics "$LINENO"' ERR

# Disposable end-to-end proof.  All application traffic stays on this one
# internal network: no host port, host network, socket mount, or production URL.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
headless_root="$repo_root/headless"
suffix="${RANDOM}-${RANDOM}"
network_name="eskomi-v11-partner-http-${suffix}"
database_container="eskomi-v11-partner-db-${suffix}"
auth_container="eskomi-v11-partner-auth-${suffix}"
storage_container="eskomi-v11-partner-storage-${suffix}"
mailpit_container="eskomi-v11-partner-mailpit-${suffix}"
postgrest_container="eskomi-v11-partner-rest-${suffix}"
proxy_container="eskomi-v11-partner-api-${suffix}"
next_container="eskomi-v11-partner-next-${suffix}"
runtime_volume="${ESKOMI_E2E_RUNTIME_VOLUME:-eskomi-v11-partner-runtime-${suffix}}"
database_created=0; auth_created=0; storage_created=0; mailpit_created=0; postgrest_created=0; proxy_created=0; next_created=0; network_created=0; runtime_volume_owned=0
postgres_password="$(openssl rand -hex 32)"
jwt_secret="$(openssl rand -hex 32)"
dashboard_user="fixture-operator-${suffix}"
dashboard_password="$(openssl rand -hex 24)"

cleanup() {
  [ "$next_created" -eq 1 ] && docker rm -f "$next_container" >/dev/null 2>&1 || true
  [ "$proxy_created" -eq 1 ] && docker rm -f "$proxy_container" >/dev/null 2>&1 || true
  [ "$storage_created" -eq 1 ] && docker rm -f "$storage_container" >/dev/null 2>&1 || true
  [ "$auth_created" -eq 1 ] && docker rm -f "$auth_container" >/dev/null 2>&1 || true
  [ "$postgrest_created" -eq 1 ] && docker rm -f "$postgrest_container" >/dev/null 2>&1 || true
  [ "$mailpit_created" -eq 1 ] && docker rm -f "$mailpit_container" >/dev/null 2>&1 || true
  [ "$database_created" -eq 1 ] && docker rm -f "$database_container" >/dev/null 2>&1 || true
  [ "$network_created" -eq 1 ] && docker network rm "$network_name" >/dev/null 2>&1 || true
  [ "$runtime_volume_owned" -eq 1 ] && docker volume rm "$runtime_volume" >/dev/null 2>&1 || true
}
trap cleanup EXIT
for resource in "$network_name" "$database_container" "$auth_container" "$storage_container" "$mailpit_container" "$postgrest_container" "$proxy_container" "$next_container"; do
  if docker network inspect "$resource" >/dev/null 2>&1 || docker container inspect "$resource" >/dev/null 2>&1; then echo "Refusing existing fixture resource: $resource" >&2; exit 1; fi
done
make_jwt() { JWT_SECRET="$jwt_secret" JWT_ROLE="$1" node -e 'const c=require("node:crypto"),b=x=>Buffer.from(JSON.stringify(x)).toString("base64url"),h=b({alg:"HS256",typ:"JWT"}),p=b({role:process.env.JWT_ROLE,iss:"supabase",aud:"authenticated",exp:Math.floor(Date.now()/1000)+900});process.stdout.write(`${h}.${p}.${c.createHmac("sha256",process.env.JWT_SECRET).update(`${h}.${p}`).digest("base64url")}`)'; }
anon_key="$(make_jwt anon)"; service_key="$(make_jwt service_role)"

if docker volume inspect "$runtime_volume" >/dev/null 2>&1; then
  if [ "${ESKOMI_E2E_PREPARED_RUNTIME_VOLUME:-}" != "1" ]; then echo "Refusing existing fixture volume" >&2; exit 1; fi
else
  docker volume create "$runtime_volume" >/dev/null; runtime_volume_owned=1
  docker run --rm --mount "type=bind,src=$headless_root,dst=/source,readonly" --mount "type=volume,src=$runtime_volume,dst=/app" node:24-bookworm-slim sh -ceu 'tar -C /source --exclude=node_modules --exclude=.next --exclude=.env --exclude=.env.* --exclude=.npmrc -cf - . | tar -C /app -xf -; cd /app; npm ci --ignore-scripts' >/dev/null
fi

docker network create --internal "$network_name" >/dev/null; network_created=1
docker run -d --rm --name "$database_container" --network "$network_name" --network-alias postgres -e POSTGRES_PASSWORD="$postgres_password" postgres:17 >/dev/null; database_created=1
for _ in $(seq 1 45); do docker exec "$database_container" pg_isready -U postgres -d postgres >/dev/null 2>&1 && break; sleep 1; done
docker exec "$database_container" pg_isready -U postgres -d postgres >/dev/null
docker exec -i "$database_container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres <<SQL
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create role authenticator login password '$postgres_password'; create role supabase_auth_admin login superuser password '$postgres_password'; create role supabase_storage_admin login superuser password '$postgres_password';
grant anon,authenticated,service_role to authenticator; create schema auth authorization supabase_auth_admin; create schema extensions; create extension pgcrypto with schema extensions; create schema api;
SQL

docker run -d --rm --name "$mailpit_container" --network "$network_name" --network-alias mailpit public.ecr.aws/supabase/mailpit:v1.31.3 >/dev/null; mailpit_created=1
docker run -d --name "$auth_container" --network "$network_name" --network-alias auth \
  -e GOTRUE_API_HOST=0.0.0.0 -e GOTRUE_API_PORT=9999 -e API_EXTERNAL_URL=http://api:8000 -e GOTRUE_DB_DRIVER=postgres -e "GOTRUE_DB_DATABASE_URL=postgres://supabase_auth_admin:${postgres_password}@postgres:5432/postgres?sslmode=disable&options=-csearch_path=auth" \
  -e GOTRUE_SITE_URL=http://localhost:57000 -e GOTRUE_URI_ALLOW_LIST=http://localhost:57000/partner/auth/callback/ -e GOTRUE_DISABLE_SIGNUP=false -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true -e GOTRUE_MAILER_AUTOCONFIRM=false -e GOTRUE_JWT_SECRET="$jwt_secret" -e GOTRUE_JWT_AUD=authenticated -e GOTRUE_SMTP_HOST=mailpit -e GOTRUE_SMTP_PORT=1025 -e GOTRUE_SMTP_ADMIN_EMAIL=fixture@example.invalid \
  public.ecr.aws/supabase/gotrue:v2.197.0 >/dev/null; auth_created=1
docker run -d --rm --name "$postgrest_container" --network "$network_name" --network-alias postgrest -e "PGRST_DB_URI=postgres://authenticator:${postgres_password}@postgres:5432/postgres" -e PGRST_DB_SCHEMAS=api -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET="$jwt_secret" postgrest/postgrest:v16.4 >/dev/null; postgrest_created=1
docker run -d --name "$storage_container" --network "$network_name" --network-alias storage -e ANON_KEY="$anon_key" -e SERVICE_KEY="$service_key" -e PGRST_JWT_SECRET="$jwt_secret" -e "DATABASE_URL=postgres://supabase_storage_admin:${postgres_password}@postgres:5432/postgres" -e POSTGREST_URL=http://postgrest:3000 -e STORAGE_BACKEND=file -e FILE_STORAGE_BACKEND_PATH=/var/lib/storage -e TENANT_ID=stub -e REGION=local -e GLOBAL_S3_BUCKET=stub -e ENABLE_IMAGE_TRANSFORMATION=false public.ecr.aws/supabase/storage-api:v1.82.1 >/dev/null; storage_created=1
for _ in $(seq 1 45); do docker run --rm --network "$network_name" node:24-bookworm-slim node -e 'Promise.all([fetch("http://auth:9999/health"),fetch("http://storage:5000/status")]).then(x=>process.exit(x.every(r=>r.ok)?0:1)).catch(()=>process.exit(1))' >/dev/null 2>&1 && break; sleep 1; done
docker run --rm --network "$network_name" node:24-bookworm-slim node -e 'Promise.all([fetch("http://auth:9999/health"),fetch("http://storage:5000/status")]).then(x=>process.exit(x.every(r=>r.ok)?0:1))'
for migration in "$repo_root"/supabase/migrations/*.sql; do docker exec -i "$database_container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres < "$migration"; done
docker exec -i "$database_container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
grant usage on schema storage to anon,authenticated,service_role; grant all privileges on all tables in schema storage to anon,authenticated,service_role; grant all privileges on all sequences in schema storage to anon,authenticated,service_role; notify pgrst,'reload schema';
SQL

# This small disposable router is only an internal path-prefix adapter.  It
# forwards to real GoTrue, PostgREST, Storage, and the GoTrue verification
# redirect; it is not an Auth or Storage mock.  `/verify` remains part of the
# upstream path so GoTrue receives its token query unchanged.
docker run -d --rm --name "$proxy_container" --network "$network_name" --network-alias api --mount "type=volume,src=$runtime_volume,dst=/app,readonly" -w /app -e 'ESKOMI_INTERNAL_PROXY_ROUTES={"/auth/v1":"http://auth:9999","/rest/v1":"http://postgrest:3000","/storage/v1":"http://storage:5000","/verify":"http://auth:9999/verify"}' node:24-bookworm-slim node scripts/eskomi-v11-internal-prefix-proxy.mjs >/dev/null; proxy_created=1

users="$(docker run --rm -i --network "$network_name" -e SERVICE_KEY="$service_key" node:24-bookworm-slim node - <<'NODE'
const crypto=require('node:crypto'); const h={apikey:process.env.SERVICE_KEY,Authorization:`Bearer ${process.env.SERVICE_KEY}`,'Content-Type':'application/json'};
(async()=>{const make=async(label)=>{const r=await fetch('http://auth:9999/admin/users',{method:'POST',headers:h,body:JSON.stringify({email:`${label}-${crypto.randomUUID()}@fixture.invalid`,email_confirm:true})});if(!r.ok)throw new Error(await r.text());return (await r.json()).id};process.stdout.write(`${await make('partner')},${await make('other')}`)})().catch(e=>{console.error(e.message);process.exit(1)});
NODE
)"
IFS=, read -r primary_user other_user <<< "$users"
docker exec -i "$database_container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres <<SQL
insert into app.areas(slug,name,is_published,published_at) values('fixture-area','Fixture area',true,now());
do \$\$ declare v_shop uuid; v_workspace uuid; payload jsonb:=jsonb_build_object('shop_name','Fixture original','area_slug','fixture-area','area_name','Fixture area','official_url','https://example.test/original','introduction','original','address',null,'business_hours',null,'phone',null,'line_url',null,'booking_url',null,'basic_price',null,'price_90',null,'banner_asset_id',null,'gallery_asset_ids','[]'::jsonb); begin
  perform private.create_canonical_managed_shop('fixture-partner-store',payload,'fixture'); select id into v_shop from app.shops where slug='fixture-partner-store'; update app.shops set publication_status='published',published_at=now() where id=v_shop; update private.managed_shops set publication_state='published' where app_shop_id=v_shop; select workspace_id into v_workspace from private.provision_partner_workspace_for_app_shop(v_shop,'provisioning'); update private.partner_workspaces set state='active_partner' where id=v_workspace; insert into private.partner_memberships(workspace_id,auth_user_id,role,status,accepted_at) values(v_workspace,'$primary_user','owner','active',now());
  perform private.create_canonical_managed_shop('fixture-other-store',payload||jsonb_build_object('shop_name','Other fixture'),'fixture'); select id into v_shop from app.shops where slug='fixture-other-store'; update app.shops set publication_status='published',published_at=now() where id=v_shop; update private.managed_shops set publication_state='published' where app_shop_id=v_shop; select workspace_id into v_workspace from private.provision_partner_workspace_for_app_shop(v_shop,'provisioning'); update private.partner_workspaces set state='active_partner' where id=v_workspace; insert into private.partner_memberships(workspace_id,auth_user_id,role,status,accepted_at) values(v_workspace,'$other_user','owner','active',now());
end \$\$;
SQL

docker run -d --rm --name "$next_container" --network "$network_name" --network-alias next --mount "type=volume,src=$runtime_volume,dst=/app" -w /app \
  -e SUPABASE_URL=http://127.0.0.1:8000 -e SUPABASE_AUTH_PUBLISHABLE_KEY="$anon_key" -e SUPABASE_SERVICE_ROLE_KEY="$service_key" -e SHOP_DIRECTORY_SOURCE=supabase -e PARTNER_AUTH_REDIRECT_ORIGIN=http://localhost:57000 -e DASHBOARD_BASIC_AUTH_USER="$dashboard_user" -e DASHBOARD_BASIC_AUTH_PASSWORD="$dashboard_password" -e ESKOMI_INTERNAL_PROXY_HOST=127.0.0.1 -e 'ESKOMI_INTERNAL_PROXY_ROUTES={"/auth/v1":"http://api:8000/auth/v1","/rest/v1":"http://api:8000/rest/v1","/storage/v1":"http://api:8000/storage/v1","/verify":"http://auth:9999/verify"}' \
  node:24-bookworm-slim sh -ceu 'node scripts/eskomi-v11-internal-prefix-proxy.mjs & exec npm run dev -- --hostname 0.0.0.0 --port 57000' >/dev/null; next_created=1
for _ in $(seq 1 90); do next_logs="$(docker logs "$next_container" 2>&1)"; grep -Eq 'Ready|started server' <<<"$next_logs" && break; sleep 1; done
grep -Eq 'Ready|started server' <<<"$next_logs"

docker run --rm -i --network "$network_name" -e PRIMARY_EMAIL="$(docker exec "$database_container" psql -X -q -A -t -U postgres -d postgres -c "select email from auth.users where id='$primary_user'")" -e OTHER_EMAIL="$(docker exec "$database_container" psql -X -q -A -t -U postgres -d postgres -c "select email from auth.users where id='$other_user'")" -e PRIMARY_MANAGED_SHOP_ID="$(docker exec "$database_container" psql -X -q -A -t -U postgres -d postgres -c "select id from private.managed_shops where shop_slug='fixture-partner-store'")" -e DASHBOARD_USER="$dashboard_user" -e DASHBOARD_PASSWORD="$dashboard_password" node:24-bookworm-slim node - <<'NODE'
const assert=require('node:assert/strict'); const base='http://next:57000',origin=base,loginOrigin='http://localhost:57000'; const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWNgZGIGAAAOAAeCcsnOAAAAAElFTkSuQmCC','base64');
const jar={}; const add=(r)=>{for(const x of r.headers.getSetCookie?.()||[]){const m=/^([^=]+)=([^;]*)/.exec(x);if(m)jar[m[1]]=m[2]}}; const cookies=()=>Object.entries(jar).map(([k,v])=>`${k}=${v}`).join('; '); const req=async(path,init={},expect)=>{const r=await fetch(base+path,{...init,headers:{...init.headers,Cookie:cookies()}});add(r);const t=await r.text();let j;try{j=JSON.parse(t)}catch{}if(expect!==undefined)assert.equal(r.status,expect,`${path}: ${t}`);return {r,j,t}};
const basic=`Basic ${Buffer.from(`${process.env.DASHBOARD_USER}:${process.env.DASHBOARD_PASSWORD}`).toString('base64')}`;
async function mailLink(email){for(let i=0;i<50;i++){const l=await fetch('http://mailpit:8025/api/v1/messages');const m=(await l.json()).messages.find(x=>JSON.stringify(x).includes(email));if(m){const d=await (await fetch(`http://mailpit:8025/api/v1/message/${m.ID||m.id}`)).json();const s=[d.Text,d.HTML].filter(x=>typeof x==='string').flatMap(x=>[x,Buffer.from(x,'base64').toString('utf8')]).join('\n');const u=s.match(/https?:\/\/[^\s"'<>]+\/verify\?[^\s"'<>]+/)?.[0];if(u)return u.replaceAll('&amp;','&')}await new Promise(x=>setTimeout(x,200))}throw Error('missing Mailpit magic link')}
async function login(email){
 Object.keys(jar).forEach(k=>delete jar[k]);
 await req('/api/partner/auth/request-link/',{method:'POST',headers:{Origin:loginOrigin,'Content-Type':'application/json'},body:JSON.stringify({email,returnTo:'/partner/listing/'})},202);
 const link=await mailLink(email),verificationUrl=new URL(link);
 assert.equal(verificationUrl.origin,'http://api:8000','real Mailpit link must be consumed through the disposable gateway');
 assert.equal(verificationUrl.pathname,'/verify','real Mailpit link must use the GoTrue verification path');
 const verified=await fetch(link,{redirect:'manual'});
 const loc=verified.headers.get('location');
 if(!loc){const text=await verified.text();let keys='non-json';try{const value=JSON.parse(text);keys=value&&typeof value==='object'?Object.keys(value).sort().join(','):'json-scalar'}catch{}throw new Error(`magic link verification did not redirect; status=${verified.status} contentType=${verified.headers.get('content-type')||'none'} responseKeys=${keys}`)}
 assert.ok(verified.status >= 300 && verified.status < 400,'magic link verification through the gateway must redirect');
 const callback=new URL(loc,base);
 assert.equal(callback.origin,loginOrigin,'magic link must redirect to the normal callback origin');
 assert.equal(callback.pathname,'/partner/auth/callback/','magic link must redirect to the normal callback path');
 const token=new URLSearchParams(callback.hash.slice(1)).get('access_token');
 if(!token)throw new Error(`magic link redirect lacks callback fragment session; status=${verified.status} path=${callback.pathname} queryKeys=${[...callback.searchParams.keys()].sort().join(',')} fragmentKeys=${[...new URLSearchParams(callback.hash.slice(1)).keys()].sort().join(',')}`);
 const state=decodeURIComponent(jar.eskomi_partner_login_state||'');assert.ok(state,'normal login request must set state cookie');
 const done=await req('/api/partner/auth/complete-link/',{method:'POST',headers:{Origin:loginOrigin,'Content-Type':'application/json'},body:JSON.stringify({state,accessToken:token})},200);
 assert.equal(done.j.ok,true);assert.ok(jar.eskomi_partner_access_token,'completion must set partner session cookie')
}
(async()=>{
 await login(process.env.PRIMARY_EMAIL); const first=await req('/api/partner/listing/'); assert.equal(first.r.status,200); const revision=first.j.listing.current_revision,store=first.j.listing.store_id; assert.equal(first.j.listing.revision.shop_name,'Fixture original');
 const csrf={Origin:origin,'Content-Type':'application/json','X-ESKOMI-CSRF':'partner-mutation-v1'}; await req('/api/partner/listing/',{method:'PATCH',headers:csrf,body:JSON.stringify({expectedRevision:revision,shopName:'Fixture revised',areaSlug:'fixture-area',websiteUrl:'https://example.test/revised',introduction:'revised',bannerAssetId:null})},200); const saved=await req('/api/partner/listing/',{},200); const submittedRevision=saved.j.listing.current_revision; assert.ok(submittedRevision>revision,'saving a listing draft must advance its revision before submission'); assert.equal(saved.j.listing.revision.shop_name,'Fixture revised'); await req('/api/partner/listing/',{method:'POST',headers:csrf,body:JSON.stringify({expectedRevision:submittedRevision})},200);
 const managedShopId=process.env.PRIMARY_MANAGED_SHOP_ID; assert.match(managedShopId,/^[0-9a-f-]{36}$/i,'fixture must provide the canonical managed-shop identity to the normal dashboard approval route'); await req('/api/dashboard/managed-shops/',{method:'POST',headers:{Authorization:basic,Origin:origin,'Content-Type':'application/json','X-ESKOMI-CSRF':'managed-shop-write'},body:JSON.stringify({action:'review',managedShopId,expectedRevision:submittedRevision,decision:'approved',note:'fixture approval'})},200);
 const reflected=await req('/api/partner/listing/',{},200);assert.equal(reflected.j.listing.revision.shop_name,'Fixture revised'); assert.equal(reflected.j.listing.latest_review.decision,'approved'); const publicListing=await fetch(`${base}/shops/fixture-partner-store/`);const publicListingHtml=await publicListing.text();assert.equal(publicListing.status,200,publicListingHtml);assert.match(publicListingHtml,/Fixture revised/);assert.match(publicListingHtml,/revised/);console.log('Next login, canonical draft, dashboard approval, and public shop route: PASS');
 const bad=new FormData();bad.append('photo',new Blob([Buffer.from('not-an-image')],{type:'text/plain'}),'bad.txt');await req('/api/partner/therapists/photo/',{method:'POST',headers:{Origin:origin,'X-ESKOMI-CSRF':'partner-mutation-v1'},body:bad},400); console.log('Invalid image must be rejected: PASS');
 const large=new FormData();large.append('photo',new Blob([Buffer.alloc(5*1024*1024+1)],{type:'image/png'}),'large.png');await req('/api/partner/therapists/photo/',{method:'POST',headers:{Origin:origin,'X-ESKOMI-CSRF':'partner-mutation-v1'},body:large},400); console.log('Oversized image must be rejected: PASS');
 const good=new FormData();good.append('photo',new Blob([png],{type:'image/png'}),'therapist.png');const up=await req('/api/partner/therapists/photo/',{method:'POST',headers:{Origin:origin,'X-ESKOMI-CSRF':'partner-mutation-v1'},body:good},200);assert.ok(up.j.assetId);const created=await req('/api/partner/therapists/',{method:'POST',headers:csrf,body:JSON.stringify({displayName:'Fixture therapist',photoAssetId:up.j.assetId,permissionPolicyVersion:'fixture-v1',permissionConfirmed:true})},200);const assignment=created.j.therapist.assignment_id;const publicPhoto=await fetch(`${base}/api/therapists/${assignment}/photo/`);const publicPhotoBytes=Buffer.from(await publicPhoto.arrayBuffer());assert.equal(publicPhoto.status,200);assert.match(publicPhoto.headers.get('content-type')||'',/^image\/jpeg/i);assert.ok(publicPhotoBytes.length>2&&publicPhotoBytes[0]===0xff&&publicPhotoBytes[1]===0xd8,'the public therapist proxy must return the stored re-encoded JPEG');const therapistProfile=await fetch(`${base}/therapists/${assignment}/`);const therapistProfileHtml=await therapistProfile.text();assert.equal(therapistProfile.status,200,therapistProfileHtml);assert.match(therapistProfileHtml,/Fixture therapist/);assert.match(therapistProfileHtml,new RegExp(`/api/therapists/${assignment}/photo/`));const link=await req('/api/partner/review-links/',{method:'POST',headers:csrf,body:JSON.stringify({therapistAssignmentId:assignment,channel:'line'})},200);assert.match(link.j.link.reviewUrl,/^https:\/\/mens-esthe-kuchikomi\.com\/r\//);console.log('Next therapist image save, public photo proxy, profile, assignment, and individual review link: PASS');
 await login(process.env.OTHER_EMAIL);const foreign=await req('/api/partner/listing/');assert.equal(foreign.r.status,200);assert.notEqual(foreign.j.listing.store_id,store);const denied=await req('/api/partner/therapists/',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-ESKOMI-CSRF':'partner-mutation-v1'},body:JSON.stringify({displayName:'Cross store',photoAssetId:up.j.assetId,permissionPolicyVersion:'fixture-v1',permissionConfirmed:true})},403);assert.equal(denied.j.ok,false);console.log('Foreign partner access to the primary store asset must be denied: PASS');
})().catch(e=>{console.error(e.stack||e.message);process.exit(1)});
NODE

# This assertion observes the fixture database only after the normal Next HTTP
# flow has completed; it is not counted as the UI/API execution path.
published="$(docker exec "$database_container" psql -X -q -A -t -U postgres -d postgres -c "select publication_status||':'||name from app.shops where slug='fixture-partner-store'")"
test "$published" = "published:Fixture revised"
echo "Canonical public projection after dashboard approval: PASS"
echo "Eskomi v1.1 internal partner HTTP fixture: PASS"
