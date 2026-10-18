import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const runnerPath = fileURLToPath(new URL("./run-eskomi-v11-internal-partner-http-e2e.sh", import.meta.url));
assert.equal(existsSync(runnerPath), true, "the internal partner HTTP runner must exist");
const script = readFileSync(runnerPath, "utf8");

assert.match(script, /docker network create --internal/, "the partner fixture network must be internal-only");
assert.doesNotMatch(script, /(?:^|\s)-p\s|--publish|--network\s+host|docker\.sock|chmod\s/, "the runner must not publish ports, use host networking, mount Docker socket, or change permissions");
assert.match(script, /public\.ecr\.aws\/supabase\/gotrue:v2\.197\.0/, "the runner must use real GoTrue");
assert.match(script, /public\.ecr\.aws\/supabase\/storage-api:v1\.82\.1/, "the runner must use real Storage API");
assert.match(script, /public\.ecr\.aws\/supabase\/mailpit:v1\.31\.3/, "the runner must use local Mailpit");
assert.match(script, /\/api\/partner\/auth\/request-link/, "the test must exercise the normal Next login request endpoint");
assert.match(script, /\/api\/partner\/auth\/complete-link/, "the test must exercise the normal Next login completion endpoint");
assert.match(script, /\/api\/partner\/listing/, "the test must exercise the normal Next listing endpoint");
assert.match(script, /\/api\/dashboard\/partner-listing-revisions/, "the test must exercise the normal Next dashboard review endpoint");
assert.match(script, /\/api\/partner\/therapists\/photo/, "the test must exercise normal Next therapist photo upload");
assert.match(script, /\/api\/partner\/review-links/, "the test must exercise normal Next review-link issuance");
assert.match(script, /SUPABASE_URL=http:\/\/127\.0\.0\.1:8000/, "Next must use its own loopback-only test adapter without weakening the application hostname validator");
assert.match(script, /listen\(8000,"127\.0\.0\.1"\)/, "the test adapter must bind only to the Next container loopback");
assert.match(script, /foreign .*must be denied/i, "the test must prove a foreign partner is denied");
assert.match(script, /invalid image must be rejected/i, "the test must prove invalid image rejection");
assert.match(script, /oversized image must be rejected/i, "the test must prove oversized image rejection");
assert.match(script, /docker rm -f/, "created-only cleanup must remove fixture containers");
assert.match(script, /docker network rm/, "created-only cleanup must remove fixture network");
assert.match(script, /ESKOMI_E2E_PREPARED_RUNTIME_VOLUME/, "a prebuilt disposable runtime volume must still be explicitly marked and cleaned by the runner");
assert.match(script, /runtime_volume_owned=0/, "the runner must track ownership of a runtime volume separately from its availability");
assert.match(script, /docker volume create "\$runtime_volume" >\/dev\/null; runtime_volume_owned=1/, "only a volume created by this runner may become cleanup-owned");
assert.match(script, /\[ "\$runtime_volume_owned" -eq 1 \] && docker volume rm/, "cleanup must remove only a runner-owned runtime volume");
assert.doesNotMatch(script, /runtime_volume_created/, "the obsolete availability flag must not be used as a cleanup ownership signal");

console.log("Eskomi v1.1 internal partner HTTP runner safety contract: PASS");
