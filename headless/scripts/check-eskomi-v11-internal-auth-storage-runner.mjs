import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const runnerPath = fileURLToPath(new URL("./run-eskomi-v11-internal-auth-storage-e2e.sh", import.meta.url));

assert.equal(existsSync(runnerPath), true, "the internal Auth/Storage runner must exist");

const script = readFileSync(runnerPath, "utf8");

assert.match(script, /docker network create --internal/, "the fixture network must be internal-only");
assert.doesNotMatch(script, /(?:^|\s)-p\s|--publish|--network\s+host|docker\.sock|chmod\s/, "the runner must not publish ports, use host networking, mount the Docker socket, or change permissions");
assert.match(script, /public\.ecr\.aws\/supabase\/gotrue:v2\.197\.0/, "the runner must use the pinned local official GoTrue image");
assert.match(script, /public\.ecr\.aws\/supabase\/storage-api:v1\.82\.1/, "the runner must use the pinned local official Storage image");
assert.match(script, /public\.ecr\.aws\/supabase\/mailpit:v1\.31\.3/, "the runner must use local Mailpit");
assert.match(script, /\n  postgres:17 >\/dev\/null/, "the fixture must use the portable official PostgreSQL image already proven by the existing isolated runner");
assert.match(script, /create role supabase_auth_admin/, "the fresh fixture database must provide the dedicated GoTrue role");
assert.match(script, /create role supabase_storage_admin/, "the fresh fixture database must provide the dedicated Storage role");
assert.match(script, /grant usage on schema storage to anon, authenticated, service_role/, "the fixture Storage API must allow its role-scoped request to reach the isolated storage schema");
assert.match(script, /create schema auth authorization supabase_auth_admin/, "the fresh fixture database must provide GoTrue's auth schema before image-owned migrations");
assert.match(script, /postgres:\/\/supabase_auth_admin:\$\{postgres_password\}@postgres:5432\/postgres\?sslmode=disable&options=-csearch_path=auth/, "GoTrue's DB connection must set the auth schema search path for unqualified user queries");
assert.match(script, /GOTRUE_SMTP_HOST=mailpit/, "GoTrue must send only to Mailpit");
assert.match(script, /GOTRUE_MAILER_TEMPLATES_CONFIRMATION_CONTENT=Your fixture verification code is \{\{ \.Token \}\}/, "the signup confirmation email must contain the configured OTP code");
assert.match(script, /http:\/\/auth:9999\/otp/, "the client must request an actual email OTP from GoTrue");
assert.match(script, /http:\/\/auth:9999\/verify/, "the client must verify the Mailpit-captured OTP with GoTrue");
assert.match(script, /http:\/\/auth:9999\/user/, "the client must prove the verified session resolves to its Auth user");
assert.match(script, /consumed GoTrue OTP must not issue another session/, "the runner must reject a reused OTP");
assert.match(script, /consumed confirmation link must not issue another access token/, "the runner must reject a reused confirmation link");
assert.match(script, /iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAY/, "the Storage fixture must use a decoder-valid PNG rather than a signature-only byte sequence");
assert.match(script, /fixture PNG width must be 1px/, "the fixture must assert its PNG dimensions");
assert.match(script, /http:\/\/storage:5000\/object\//, "the client must store and retrieve an object through Storage HTTP");
assert.match(script, /docker run --rm -i --network "\$network_name"[\s\S]*node:24-bookworm-slim node - <<'NODE'/, "the internal test client must receive and execute its heredoc program");
assert.match(script, /test "\$services_ready" -eq 1/, "the runner must stop when Auth, Storage, or Mailpit is not ready");
assert.match(script, /Fixture runner failed near line \$1/, "the runner must print a non-secret failure location for fixture diagnosis");
assert.match(script, /fixture_failure_diagnostics "\$LINENO"/, "the runner must retain GoTrue startup diagnostics when the real client fails");
assert.doesNotMatch(script, /docker run -d --rm --name "\$auth_container"/, "GoTrue must remain inspectable until created-only cleanup if startup fails");
assert.doesNotMatch(script, /docker run -d --rm --name "\$storage_container"/, "Storage must remain inspectable until created-only cleanup if startup fails");
assert.match(script, /docker rm -f/, "cleanup must remove only fixture containers");
assert.match(script, /docker network rm/, "cleanup must remove the fixture network");

console.log("Eskomi v1.1 internal Auth/Storage runner safety contract: PASS");
