import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const headlessRoot = process.cwd();
const repoRoot = join(headlessRoot, "..");
const sql = readFileSync(join(repoRoot, "supabase/tests/verify_review_native_db_contract.sql"), "utf8");
const config = readFileSync(join(repoRoot, "supabase/config.toml"), "utf8");
const projectId = config.match(/^project_id\s*=\s*"([^"]+)"\s*$/m)?.[1];

if (!projectId) {
  throw new Error("supabase/config.toml must define project_id.");
}

const database = `supabase_db_${projectId}`;
const containers = execFileSync("docker", ["ps", "--format", "{{.Names}}"], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

if (!containers.includes(database)) {
  throw new Error(`Local Supabase database ${database} is not running; run supabase start in this project first.`);
}

const psqlArgs = [
  "exec", "-i", database, "psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1",
  "-U", "postgres", "-d", "postgres",
];

function runSqlSync(input) {
  return execFileSync("docker", psqlArgs, {
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

function runSql(input) {
  return new Promise((resolve) => {
    const child = spawn("docker", psqlArgs, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() }));
    child.stdin.end(input);
  });
}

function submitSql({ wpShopId, body, rating, idempotencyHash, abuseHash }) {
  return `
set role service_role;
select review_id::text || '|' || created::text
from api.submit_review(
  ${wpShopId},
  $body$${body}$body$,
  ${rating}::smallint,
  'Parallel Contract Reviewer',
  'https://mens-esthe-kuchikomi.com/reviews/submit/',
  '${idempotencyHash}',
  '${abuseHash}',
  date_trunc('minute', now()),
  date_trunc('minute', now()) + interval '1 minute',
  4::smallint,
  null::smallint,
  5::smallint,
  '2026-09',
  'yes',
  'parallel@example.invalid',
  null::uuid
);
`;
}

function assertSingleCommittedSubmission(wpShopId, idempotencyHash, abuseHash) {
  const counts = runSqlSync(`
select concat_ws('|',
  count(distinct r.id),
  count(distinct d.review_id),
  count(distinct k.review_id),
  count(distinct a.key_hash),
  count(distinct c.review_id)
)
from app.shops s
left join app.reviews r on r.shop_id = s.id
left join private.review_submission_details d on d.review_id = r.id
left join private.review_idempotency_keys k
  on k.review_id = r.id and k.key_hash = '${idempotencyHash}'
left join private.review_abuse_rate_limits a on a.key_hash = '${abuseHash}'
left join private.partner_review_campaign_submissions c on c.review_id = r.id
where s.wp_post_id = ${wpShopId};
`);
  assert.equal(counts, "1|1|1|1|0", `parallel submit left an invalid state: ${counts}`);
}

async function verifyParallelIdempotency() {
  const base = 8400000000000000000n + (BigInt(`0x${randomBytes(4).toString("hex")}`) % 1000000000n);
  const sameWpShopId = base;
  const mismatchWpShopId = base + 1n;
  const sameIdempotencyHash = randomBytes(32).toString("hex");
  const sameAbuseHash = randomBytes(32).toString("hex");
  const mismatchIdempotencyHash = randomBytes(32).toString("hex");
  const mismatchAbuseHash = randomBytes(32).toString("hex");

  runSqlSync(`
insert into app.shops (wp_post_id, slug, canonical_path, name)
values
  (${sameWpShopId}, 'review-native-parallel-${sameWpShopId}', '/shops/review-native-parallel-${sameWpShopId}/', 'Parallel Same Payload Shop'),
  (${mismatchWpShopId}, 'review-native-parallel-${mismatchWpShopId}', '/shops/review-native-parallel-${mismatchWpShopId}/', 'Parallel Mismatch Shop');
`);

  try {
    const sameInput = {
      wpShopId: sameWpShopId,
      body: "Parallel identical payload must create exactly one native Review.",
      rating: 5,
      idempotencyHash: sameIdempotencyHash,
      abuseHash: sameAbuseHash,
    };
    const sameResults = await Promise.all([
      runSql(submitSql(sameInput)),
      runSql(submitSql(sameInput)),
    ]);
    assert.ok(sameResults.every(({ code }) => code === 0), JSON.stringify(sameResults));
    const sameRows = sameResults.map(({ stdout }) => stdout.split("\n").filter(Boolean).at(-1));
    assert.equal(new Set(sameRows.map((row) => row.split("|")[0])).size, 1);
    assert.deepEqual(sameRows.map((row) => row.split("|")[1]).sort(), ["false", "true"]);
    assertSingleCommittedSubmission(sameWpShopId, sameIdempotencyHash, sameAbuseHash);

    const mismatchBase = {
      wpShopId: mismatchWpShopId,
      body: "Parallel mismatch winner payload must remain the only native Review.",
      rating: 5,
      idempotencyHash: mismatchIdempotencyHash,
      abuseHash: mismatchAbuseHash,
    };
    const mismatchResults = await Promise.all([
      runSql(submitSql(mismatchBase)),
      runSql(submitSql({
        ...mismatchBase,
        body: "Parallel mismatch loser payload must be rejected without partial state.",
        rating: 4,
      })),
    ]);
    assert.equal(mismatchResults.filter(({ code }) => code === 0).length, 1, JSON.stringify(mismatchResults));
    const rejected = mismatchResults.find(({ code }) => code !== 0);
    assert.match(rejected?.stderr ?? "", /idempotency key payload mismatch/);
    assertSingleCommittedSubmission(mismatchWpShopId, mismatchIdempotencyHash, mismatchAbuseHash);
  } finally {
    runSqlSync(`
begin;
delete from private.partner_review_campaign_submissions
where review_id in (
  select r.id from app.reviews r join app.shops s on s.id = r.shop_id
  where s.wp_post_id in (${sameWpShopId}, ${mismatchWpShopId})
);
delete from private.review_moderation_events
where review_id in (
  select r.id from app.reviews r join app.shops s on s.id = r.shop_id
  where s.wp_post_id in (${sameWpShopId}, ${mismatchWpShopId})
);
delete from private.review_submission_details
where review_id in (
  select r.id from app.reviews r join app.shops s on s.id = r.shop_id
  where s.wp_post_id in (${sameWpShopId}, ${mismatchWpShopId})
);
delete from private.review_idempotency_keys
where key_hash in ('${sameIdempotencyHash}', '${mismatchIdempotencyHash}');
delete from private.review_abuse_rate_limits
where key_hash in ('${sameAbuseHash}', '${mismatchAbuseHash}');
delete from app.reviews
where shop_id in (
  select id from app.shops where wp_post_id in (${sameWpShopId}, ${mismatchWpShopId})
);
delete from app.shops where wp_post_id in (${sameWpShopId}, ${mismatchWpShopId});
commit;
`);
  }
}

runSqlSync(sql);
await verifyParallelIdempotency();

console.log("review native DB contract check passed");
