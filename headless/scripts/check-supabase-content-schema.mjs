import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const headlessRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = join(headlessRoot, "..");

function requiredFile(path, label) {
  assert.ok(existsSync(path), `${label} must exist: ${path}`);
  return readFileSync(path, "utf8");
}

const config = requiredFile(join(repoRoot, "supabase/config.toml"), "Supabase config");
assert.match(
  config,
  /\[api\][\s\S]*?schemas\s*=\s*\[\s*"api"\s*\]/,
  "Data API must expose only the api schema"
);

const migrationsDir = join(repoRoot, "supabase/migrations");
assert.ok(existsSync(migrationsDir), "Supabase migrations directory must exist");
const migrationFiles = readdirSync(migrationsDir).filter((file) =>
  file.endsWith("_seo_safe_content_core.sql")
);
assert.equal(migrationFiles.length, 1, "Exactly one SEO-safe content migration must exist");

const sql = requiredFile(join(migrationsDir, migrationFiles[0]), "SEO-safe content migration");
const allMigrationSql = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => requiredFile(join(migrationsDir, file), `Supabase migration ${file}`))
  .join("\n");
const appTables = [
  "areas",
  "shops",
  "shop_areas",
  "shop_prices",
  "shop_business_hours",
  "shop_images",
  "sources",
  "shop_source_links",
  "contents",
  "content_revisions",
  "reviews"
];
const privateTables = ["import_batches", "import_records"];

for (const table of appTables) {
  assert.match(sql, new RegExp(`create table app\\.${table}\\b`, "i"), `Missing app.${table}`);
  assert.match(
    sql,
    new RegExp(`alter table app\\.${table} enable row level security`, "i"),
    `RLS must be enabled on app.${table}`
  );
}

for (const table of privateTables) {
  assert.match(
    sql,
    new RegExp(`create table private\\.${table}\\b`, "i"),
    `Missing private.${table}`
  );
  assert.match(
    sql,
    new RegExp(`alter table private\\.${table} enable row level security`, "i"),
    `RLS must be enabled on private.${table}`
  );
}

const apiViews = [
  "published_areas",
  "published_shops",
  "published_shop_areas",
  "published_shop_prices",
  "published_shop_business_hours",
  "published_shop_images",
  "published_shop_sources",
  "published_contents",
  "published_reviews"
];

for (const view of apiViews) {
  assert.match(
    sql,
    new RegExp(`create (?:or replace )?view api\\.${view}\\s+with \\(security_invoker\\s*=\\s*true\\)`, "i"),
    `api.${view} must be a security_invoker view`
  );
}

assert.match(sql, /wp_post_id\s+bigint/i, "WordPress post IDs must be preserved");
assert.match(sql, /canonical_path\s+text\s+not null/i, "Current canonical paths must be preserved");
assert.match(sql, /source_url\s+text\s+not null/i, "Source URLs must be stored");
assert.match(sql, /verified_at\s+timestamptz/i, "Verification timestamps must be stored");
assert.match(sql, /moderation_status\s+text\s+not null/i, "Review moderation status is required");
assert.match(sql, /publication_status\s+text\s+not null/i, "Review publication status is required");
assert.match(sql, /revoke all on schema private from public/i, "private schema must be revoked from public");
assert.match(
  sql,
  /grant select on all tables in schema api to anon, authenticated/i,
  "Public roles may only receive SELECT on API views"
);
assert.doesNotMatch(
  sql,
  /grant\s+(?:insert|update|delete|all)[^;]*\s+to\s+(?:anon|authenticated)/i,
  "Browser roles must not receive write privileges"
);

function policyDefinition(name) {
  const match = sql.match(new RegExp(`create policy ${name}[\\s\\S]*?;`, "i"));
  assert.ok(match, `Missing policy ${name}`);
  return match[0];
}

const contentsPolicy = policyDefinition("contents_public_read");
assert.match(
  contentsPolicy,
  /exists\s*\(\s*select 1 from app\.shops/i,
  "Published shop content must require a published shop"
);
assert.match(
  contentsPolicy,
  /exists\s*\(\s*select 1 from app\.areas/i,
  "Published area content must require a published area"
);

const reviewsPolicy = policyDefinition("reviews_public_read");
assert.match(
  reviewsPolicy,
  /exists\s*\(\s*select 1 from app\.shops/i,
  "Published reviews must require a published shop"
);

const sourceForeignKeyIndexes = [
  ["content_revisions", "source_id"],
  ["contents", "source_id"],
  ["shop_source_links", "source_id"]
];

for (const [table, column] of sourceForeignKeyIndexes) {
  assert.match(
    allMigrationSql,
    new RegExp(`create index [^;]+ on app\\.${table} \\(\\s*${column}\\s*\\)`, "i"),
    `Foreign key app.${table}.${column} must have a covering index`
  );
}

console.log("Supabase content schema contract passed.");
