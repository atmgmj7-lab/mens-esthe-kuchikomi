#!/usr/bin/env bash
set -euo pipefail

fixture_failure_diagnostics() {
  echo "Fixture runner failed near line $1" >&2
  if [ "${auth_created:-0}" -eq 1 ] && docker container inspect "${auth_container:-}" >/dev/null 2>&1; then
    docker logs --tail 20 "$auth_container" >&2 || true
  fi
}
trap 'fixture_failure_diagnostics "$LINENO"' ERR

# Disposable proof for real GoTrue email OTP and Storage object bytes. Every
# process joins one Docker-internal network; nothing is published to the host.
suffix="${RANDOM}-${RANDOM}"
network_name="eskomi-v11-auth-storage-${suffix}"
database_container="eskomi-v11-auth-storage-db-${suffix}"
postgrest_container="eskomi-v11-auth-storage-rest-${suffix}"
auth_container="eskomi-v11-auth-storage-auth-${suffix}"
storage_container="eskomi-v11-auth-storage-storage-${suffix}"
mailpit_container="eskomi-v11-auth-storage-mailpit-${suffix}"
database_created=0
postgrest_created=0
auth_created=0
storage_created=0
mailpit_created=0
network_created=0
postgres_password="$(openssl rand -hex 32)"
jwt_secret="$(openssl rand -hex 32)"

cleanup() {
  [ "$storage_created" -eq 1 ] && docker rm -f "$storage_container" >/dev/null 2>&1 || true
  [ "$auth_created" -eq 1 ] && docker rm -f "$auth_container" >/dev/null 2>&1 || true
  [ "$postgrest_created" -eq 1 ] && docker rm -f "$postgrest_container" >/dev/null 2>&1 || true
  [ "$mailpit_created" -eq 1 ] && docker rm -f "$mailpit_container" >/dev/null 2>&1 || true
  [ "$database_created" -eq 1 ] && docker rm -f "$database_container" >/dev/null 2>&1 || true
  [ "$network_created" -eq 1 ] && docker network rm "$network_name" >/dev/null 2>&1 || true
}

for resource in "$network_name" "$database_container" "$postgrest_container" "$auth_container" "$storage_container" "$mailpit_container"; do
  if docker network inspect "$resource" >/dev/null 2>&1 || docker container inspect "$resource" >/dev/null 2>&1; then
    echo "Refusing existing Docker resource: $resource" >&2
    exit 1
  fi
done
trap cleanup EXIT

make_jwt() {
  JWT_SECRET="$jwt_secret" JWT_ROLE="$1" node -e '
    const crypto=require("node:crypto");
    const encode=(value)=>Buffer.from(JSON.stringify(value)).toString("base64url");
    const header=encode({alg:"HS256",typ:"JWT"});
    const payload=encode({role:process.env.JWT_ROLE,iss:"supabase",aud:"authenticated",iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+900});
    const signature=crypto.createHmac("sha256",process.env.JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
    process.stdout.write(`${header}.${payload}.${signature}`);
  '
}

anon_key="$(make_jwt anon)"
service_key="$(make_jwt service_role)"

docker network create --internal "$network_name" >/dev/null
network_created=1

docker run -d --rm --name "$database_container" --network "$network_name" --network-alias postgres \
  -e POSTGRES_PASSWORD="$postgres_password" \
  postgres:17 >/dev/null
database_created=1
for _ in $(seq 1 45); do
  if docker exec "$database_container" pg_isready -U postgres -d postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$database_container" pg_isready -U postgres -d postgres >/dev/null
docker exec -i "$database_container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres <<SQL
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role authenticator login password '${postgres_password}';
create role supabase_auth_admin login superuser password '${postgres_password}';
create role supabase_storage_admin login superuser password '${postgres_password}';
create schema auth authorization supabase_auth_admin;
grant anon, authenticated, service_role to authenticator;
SQL

docker run -d --rm --name "$mailpit_container" --network "$network_name" --network-alias mailpit \
  public.ecr.aws/supabase/mailpit:v1.31.3 >/dev/null
mailpit_created=1

docker run -d --rm --name "$postgrest_container" --network "$network_name" --network-alias postgrest \
  -e PGRST_DB_URI="postgres://authenticator:${postgres_password}@postgres:5432/postgres" \
  -e PGRST_DB_SCHEMAS="public,storage" \
  -e PGRST_DB_ANON_ROLE=anon \
  -e PGRST_JWT_SECRET="$jwt_secret" \
  public.ecr.aws/supabase/postgrest:v16.4 >/dev/null
postgrest_created=1

docker run -d --name "$auth_container" --network "$network_name" --network-alias auth \
  -e GOTRUE_API_HOST=0.0.0.0 \
  -e GOTRUE_API_PORT=9999 \
  -e API_EXTERNAL_URL=http://auth:9999 \
  -e GOTRUE_DB_DRIVER=postgres \
  -e GOTRUE_DB_DATABASE_URL="postgres://supabase_auth_admin:${postgres_password}@postgres:5432/postgres?sslmode=disable&options=-csearch_path=auth" \
  -e GOTRUE_SITE_URL=http://client \
  -e GOTRUE_URI_ALLOW_LIST=http://client \
  -e GOTRUE_DISABLE_SIGNUP=false \
  -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true \
  -e GOTRUE_MAILER_AUTOCONFIRM=false \
  -e GOTRUE_MAILER_OTP_EXP=3600 \
  -e GOTRUE_MAILER_OTP_LENGTH=6 \
  -e 'GOTRUE_MAILER_TEMPLATES_CONFIRMATION_CONTENT=Your fixture verification code is {{ .Token }}' \
  -e GOTRUE_JWT_SECRET="$jwt_secret" \
  -e GOTRUE_JWT_EXP=900 \
  -e GOTRUE_JWT_AUD=authenticated \
  -e GOTRUE_SMTP_HOST=mailpit \
  -e GOTRUE_SMTP_PORT=1025 \
  -e GOTRUE_SMTP_ADMIN_EMAIL=fixture@example.invalid \
  -e GOTRUE_SMTP_SENDER_NAME=EskomiFixture \
  public.ecr.aws/supabase/gotrue:v2.197.0 >/dev/null
auth_created=1

docker run -d --name "$storage_container" --network "$network_name" --network-alias storage \
  -e ANON_KEY="$anon_key" \
  -e SERVICE_KEY="$service_key" \
  -e PGRST_JWT_SECRET="$jwt_secret" \
  -e DATABASE_URL="postgres://supabase_storage_admin:${postgres_password}@postgres:5432/postgres" \
  -e POSTGREST_URL=http://postgrest:3000 \
  -e FILE_SIZE_LIMIT=52428800 \
  -e STORAGE_BACKEND=file \
  -e FILE_STORAGE_BACKEND_PATH=/var/lib/storage \
  -e TENANT_ID=stub \
  -e REGION=local \
  -e GLOBAL_S3_BUCKET=stub \
  -e ENABLE_IMAGE_TRANSFORMATION=false \
  public.ecr.aws/supabase/storage-api:v1.82.1 >/dev/null
storage_created=1

# Storage API creates and owns its schema during startup; its service-role JWT
# then needs schema/table access for the fixture's real bucket/object calls.
for _ in $(seq 1 30); do
  if docker exec "$database_container" psql -X -q -t -U postgres -d postgres -c "select 1 from pg_namespace where nspname='storage'" | rg -q 1; then break; fi
  sleep 1
done
docker exec -i "$database_container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
grant usage on schema storage to anon, authenticated, service_role;
grant all privileges on all tables in schema storage to anon, authenticated, service_role;
grant all privileges on all sequences in schema storage to anon, authenticated, service_role;
SQL

services_ready=0
for _ in $(seq 1 45); do
  if docker run --rm --network "$network_name" node:24-bookworm-slim node -e 'Promise.all([fetch("http://auth:9999/health"),fetch("http://storage:5000/status"),fetch("http://mailpit:8025/api/v1/messages")]).then((responses)=>{if(responses.every((response)=>response.ok))process.exit(0);process.exit(1)}).catch(()=>process.exit(1))' >/dev/null 2>&1; then
    services_ready=1
    break
  fi
  sleep 1
done
if [ "$services_ready" -ne 1 ]; then
  echo "Fixture services did not become ready" >&2
  docker inspect --format '{{.Name}} {{.State.Status}} {{.State.ExitCode}}' "$auth_container" "$storage_container" "$mailpit_container" >&2
  docker logs --tail 20 "$auth_container" >&2 || true
  docker logs --tail 20 "$storage_container" >&2 || true
  exit 1
fi
test "$services_ready" -eq 1

docker run --rm -i --network "$network_name" \
  -e ANON_KEY="$anon_key" \
  -e SERVICE_KEY="$service_key" \
  node:24-bookworm-slim node - <<'NODE'
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const anonHeaders = { apikey: process.env.ANON_KEY, "Content-Type": "application/json" };
const serviceHeaders = { apikey: process.env.SERVICE_KEY, Authorization: `Bearer ${process.env.SERVICE_KEY}` };
const email = `otp-${crypto.randomUUID()}@fixture.invalid`;
const bucket = "fixture-images";
const objectKey = "otp-proof.png";
const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);

async function expectOk(response, label) {
  if (!response.ok) throw new Error(`${label}: ${response.status} ${await response.text()}`);
  return response;
}

async function waitForMail() {
  for (let attempt = 0; attempt < 45; attempt += 1) {
    const listed = await expectOk(await fetch("http://mailpit:8025/api/v1/messages"), "listing Mailpit messages");
    const body = await listed.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const message = messages.find((candidate) => JSON.stringify(candidate).includes(email));
    if (message) {
      const id = message.ID || message.id;
      assert.equal(typeof id, "string", "Mailpit message id must be present");
      const fetched = await expectOk(await fetch(`http://mailpit:8025/api/v1/message/${id}`), "reading Mailpit OTP message");
      const detail = await fetched.json();
      const values = [detail.Text, detail.HTML].filter((value) => typeof value === "string");
      const content = values.flatMap((value) => [value, Buffer.from(value, "base64").toString("utf8")]).join("\n");
      const code = content.match(/\b\d{6}\b/)?.[0];
      if (typeof code === "string") return { kind: "otp", token: code };
      const match = content.match(/https?:\/\/[^\s"'<>]+\/verify\?[^\s"'<>]+/);
      if (!match) throw new Error(`Mailpit message has neither OTP nor confirmation link; fields=${Object.keys(detail).sort().join(",")}`);
      return { kind: "confirmation", url: match[0].replaceAll("&amp;", "&") };
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Mailpit did not capture the GoTrue OTP email");
}

(async () => {
  const otpResponse = await expectOk(await fetch("http://auth:9999/otp", { method: "POST", headers: anonHeaders, body: JSON.stringify({ email, create_user: true }) }), "requesting GoTrue email OTP");
  assert.equal(otpResponse.status, 200, "GoTrue email OTP request must succeed");
  const delivery = await waitForMail();
  if (delivery.kind === "otp") {
    const verified = await expectOk(await fetch("http://auth:9999/verify", { method: "POST", headers: anonHeaders, body: JSON.stringify({ type: "email", email, token: delivery.token }) }), "verifying Mailpit-captured GoTrue OTP");
    const session = await verified.json();
    assert.equal(typeof session.access_token, "string", "verified OTP must issue a real Auth session token");
  } else {
    const confirmed = await fetch(delivery.url, { redirect: "manual" });
    assert.ok(confirmed.status >= 300 && confirmed.status < 400, `consuming Mailpit confirmation link must redirect, got ${confirmed.status}`);
  }

  await expectOk(await fetch("http://storage:5000/bucket", { method: "POST", headers: { ...serviceHeaders, "Content-Type": "application/json" }, body: JSON.stringify({ id: bucket, name: bucket, public: false }) }), "creating fixture Storage bucket");
  await expectOk(await fetch(`http://storage:5000/object/${bucket}/${objectKey}`, { method: "POST", headers: { ...serviceHeaders, "Content-Type": "image/png", "x-upsert": "false" }, body: bytes }), "writing fixture image through Storage");
  const fetched = await expectOk(await fetch(`http://storage:5000/object/${bucket}/${objectKey}`, { headers: serviceHeaders }), "reading fixture image through Storage");
  assert.deepEqual(Buffer.from(await fetched.arrayBuffer()), bytes, "Storage retrieval must return exactly the uploaded fixture bytes");

  console.log("GoTrue email OTP via Mailpit capture and verification: PASS");
  console.log("Storage fixture image write and byte-for-byte retrieval: PASS");
})().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
NODE

echo "Eskomi v1.1 internal Auth/Storage fixture: PASS"
