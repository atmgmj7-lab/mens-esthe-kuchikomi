import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const runnerPath = fileURLToPath(new URL("./run-eskomi-v11-internal-partner-http-e2e.sh", import.meta.url));
const packagePath = fileURLToPath(new URL("../package.json", import.meta.url));
assert.equal(existsSync(runnerPath), true, "the internal partner HTTP runner must exist");
const script = readFileSync(runnerPath, "utf8");
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));

assert.match(script, /docker network create --internal/, "the partner fixture network must be internal-only");
assert.doesNotMatch(script, /(?:^|\s)-p\s|--publish|--network\s+host|docker\.sock|chmod\s/, "the runner must not publish ports, use host networking, mount Docker socket, or change permissions");
assert.match(script, /public\.ecr\.aws\/supabase\/gotrue:v2\.197\.0/, "the runner must use real GoTrue");
assert.match(script, /public\.ecr\.aws\/supabase\/storage-api:v1\.82\.1/, "the runner must use real Storage API");
assert.match(script, /public\.ecr\.aws\/supabase\/mailpit:v1\.31\.3/, "the runner must use local Mailpit");
assert.match(script, /\/api\/partner\/auth\/request-link/, "the test must exercise the normal Next login request endpoint");
assert.match(script, /\/api\/partner\/auth\/complete-link/, "the test must exercise the normal Next login completion endpoint");
assert.match(script, /\/api\/partner\/listing/, "the test must exercise the normal Next listing endpoint");
assert.match(script, /\/api\/dashboard\/managed-shops\//, "the test must exercise the normal Next canonical managed-shop dashboard review endpoint");
assert.match(script, /Canonical changes-requested reason must reach the Partner listing/, "the test must prove canonical changes-requested reason delivery through normal Next HTTP");
assert.match(script, /Canonical corrected resubmission must publish through the normal dashboard review/, "the test must prove canonical correction, resubmission, and re-approval through normal Next HTTP");
assert.match(script, /Canonical dashboard unlisting must remove the public shop route/, "the test must prove canonical unlisting removes the public projection through normal dashboard HTTP");
assert.match(script, /\/api\/partner\/therapists\/photo/, "the test must exercise normal Next therapist photo upload");
assert.match(script, /\/shops\/fixture-partner-store\//, "the test must observe the canonical public shop route after dashboard approval");
assert.match(script, /\/api\/therapists\/\$\{assignment\}\/photo\//, "the test must observe the public therapist photo proxy after normal upload and assignment");
assert.match(script, /\/api\/partner\/review-links/, "the test must exercise normal Next review-link issuance");
assert.match(script, /\/partner\/settings\/login-email\//, "the test must exercise the normal Next Partner login-email change endpoint");
assert.match(script, /Email-change confirmation must update the real GoTrue user/, "the test must prove real GoTrue email-change completion");
assert.match(script, /Old login email must be rejected after the confirmed change/, "the test must prove the old email cannot request a new Partner login link after confirmation");
assert.match(script, /SUPABASE_URL=http:\/\/127\.0\.0\.1:8000/, "Next must use its own loopback-only test adapter without weakening the application hostname validator");
assert.match(script, /SHOP_DIRECTORY_SOURCE=supabase/, "the disposable Next process must opt into the canonical public directory only for the public-projection observation");
assert.match(script, /ESKOMI_INTERNAL_PROXY_HOST=127\.0\.0\.1/, "the test adapter must bind only to the Next container loopback");
assert.match(script, /ESKOMI_E2E_APP_RUNTIME/, "the runner must select a Next or local Workers application runtime explicitly");
assert.match(script, /ESKOMI_E2E_WORKERS_ARTIFACT_ROOT/, "Workers mode must accept one explicit host-built artifact root instead of assuming the canonical source output");
assert.match(script, /\.eskomi-cloudflare-dynamic-builds\/run-\*/, "Workers artifact roots must be restricted to generated dynamic build directories");
assert.match(script, /wrangler dev --local --ip 0\.0\.0\.0 --port 57000/, "the Workers mode must expose only the internal fixture network port");
assert.match(script, /Unsupported ESKOMI_E2E_APP_RUNTIME/, "the runner must fail closed for an unknown runtime selector");
assert.equal(packageJson.scripts?.["qa:eskomi-v11-internal-partner-workers"], "npm run workers:build && ESKOMI_E2E_APP_RUNTIME=workers bash scripts/run-eskomi-v11-internal-partner-http-e2e.sh", "Workers fixture must prebuild on the host before joining the internal network");
assert.match(script, /\.open-next\/worker\.js/, "Workers mode must require the host-prebuilt Worker artifact in the disposable runtime volume");
assert.match(script, /ESKOMI_WORKERS_BUILD_ROOT/, "Workers mode must rewrite host-only build paths before Wrangler resolves the copied output");
assert.match(script, /find \.open-next -type f/, "Workers mode must rewrite only generated Worker artifacts in the disposable runtime volume");
assert.match(script, /src=\$workers_artifact_root,dst=\/artifact,readonly/, "Workers mode must copy an explicitly mounted read-only artifact into the disposable runtime volume");
assert.match(script, /--exclude=\.open-next/, "the runtime source copy must exclude any canonical Worker output before the explicit artifact is copied");
assert.match(script, /GOTRUE_URI_ALLOW_LIST=http:\/\/localhost:57000\/partner\/auth\/callback\//, "GoTrue must permit the exact normal callback URL");
assert.match(script, /API_EXTERNAL_URL=http:\/\/api:8000/, "GoTrue external URLs must use the disposable API gateway base, not an already-prefixed Auth path");
assert.match(script, /node scripts\/eskomi-v11-internal-prefix-proxy\.mjs/, "the disposable adapters must use the tested prefix proxy");
assert.match(script, /"\/verify":"http:\/\/auth:9999\/verify"/, "the gateway and loopback adapters must preserve GoTrue's verification path");
assert.match(script, /assert\.equal\(verificationUrl\.origin,'http:\/\/api:8000','real Mailpit link must be consumed through the disposable gateway'\)/, "the real Mailpit verification URL must be asserted as a gateway URL without exposing its token");
assert.match(script, /assert\.ok\(verified\.status >= 300 && verified\.status < 400,'magic link verification through the gateway must redirect'\)/, "the Mailpit verification request must prove that the gateway produces the normal redirect");
assert.match(script, /redirect lacks callback fragment session/, "a redirect without the callback session fragment must fail without logging its token value");
assert.match(script, /verification did not redirect; status=/, "a non-redirect verification response must expose only safe diagnostic shape");
assert.match(script, /foreign .*must be denied/i, "the test must prove a foreign partner is denied");
assert.ok(
  script.indexOf("Foreign partner access to the primary store asset must be denied") < script.indexOf("Canonical corrected resubmission must publish through the normal dashboard review"),
  "the public shop assertion must run after the Workers-compatible API, image, and ownership boundaries",
);
assert.ok(
  script.indexOf("Canonical corrected resubmission must publish through the normal dashboard review") < script.indexOf("Canonical dashboard unlisting must remove the public shop route"),
  "the unlisting assertion must prove removal only after the approved public projection was observed",
);
assert.match(script, /invalid image must be rejected/i, "the test must prove invalid image rejection");
assert.match(script, /oversized image must be rejected/i, "the test must prove oversized image rejection");
assert.match(script, /docker rm -f/, "created-only cleanup must remove fixture containers");
assert.doesNotMatch(script, /docker run -d --rm --name "\$next_container"/, "the application container must remain inspectable until created-only cleanup if Workers startup fails");
assert.match(script, /docker network rm/, "created-only cleanup must remove fixture network");
assert.match(script, /ESKOMI_E2E_PREPARED_RUNTIME_VOLUME/, "a prebuilt disposable runtime volume must still be explicitly marked and cleaned by the runner");
assert.match(script, /prepared runtime volume lacks its Worker artifact or QA scripts/, "Workers may reuse only an explicitly marked prepared volume containing the Worker artifact and QA scripts");
assert.match(script, /runtime_volume_owned=0/, "the runner must track ownership of a runtime volume separately from its availability");
assert.match(script, /ESKOMI_E2E_PRESERVE_FIXTURE/, "the runner must offer an explicit evidence-preservation mode before deleting fixture resources");
assert.match(script, /Starting local server/, "the Worker fixture readiness check must accept Wrangler's local-server startup message");
assert.match(script, /--exclude=\.eskomi-cloudflare-dynamic-builds/, "fixture preparation must not copy ignored derived Worker builds into its runtime volume");
assert.match(script, /ESKOMI_INTERNAL_PROXY_METRICS=1/, "the fixture must enable PostgREST-only aggregate metrics without logging request values");
assert.match(script, /measure-eskomi-v11-public-http\.mjs/, "the fixture must measure the four representative public routes after API metrics become available");
assert.match(script, /check-eskomi-v11-public-seo-http\.mjs/, "the fixture must verify canonical/title/body/robots/sitemap through real public HTTP");
assert.match(script, /PRIVATE_REVIEW_MUST_NOT_BE_PUBLIC/, "the fixture must seed a non-public review marker and verify it stays out of public HTTP");
assert.match(script, /unlisting removes public detail, listing, and sitemap/, "the fixture must verify unlisting removes all public discovery routes");
assert.match(script, /ESKOMI_E2E_METRICS_ARTIFACT_DIR/, "the runner must preserve optional public HTTP metric artifacts outside the fixture");
assert.match(script, /docker volume create "\$runtime_volume" >\/dev\/null; runtime_volume_owned=1/, "only a volume created by this runner may become cleanup-owned");
assert.match(script, /\[ "\$runtime_volume_owned" -eq 1 \] && docker volume rm/, "cleanup must remove only a runner-owned runtime volume");
assert.doesNotMatch(script, /runtime_volume_created/, "the obsolete availability flag must not be used as a cleanup ownership signal");
assert.match(script, /tar -C \/source --exclude=node_modules --exclude=\.next --exclude=\.open-next --exclude=\.eskomi-cloudflare-dynamic-builds --exclude=\.env --exclude=\.env\.\* --exclude=\.npmrc -cf - \./, "a runner-owned runtime volume must exclude generated Worker builds, dotenv, and npm configuration files from the source copy");

console.log("Eskomi v1.1 internal partner HTTP runner safety contract: PASS");
