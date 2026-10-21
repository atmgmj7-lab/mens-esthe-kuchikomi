#!/usr/bin/env node
/**
 * Generates a reviewable, manual SQL Editor packet for the *unrun* v1.1
 * migrations.  It intentionally has no network or database access: hashes
 * are calculated from the checked-in source files before the packet is made.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const migrationDirectory = join(repoRoot, "supabase", "migrations");
const outputDirectory = join(
  repoRoot,
  "headless/docs/technical/artifacts/2026-10-18-cloudflare-workers-local-qa/manual-sql-editor-v11-2026-10-21",
);
const projectRef = "goeagrxjsjcbbatpotbu";
const directoryAnchor = "20261020020548";
const directoryAnchorName = "eskomi_supabase_primary_public_directory";
// Read-only observed from this project's existing ledger on 2026-10-21.
// It intentionally is not substituted with the current local source-file hash.
const directoryAnchorSourceSha256 = "77520bc6a1e9b5aa5708e7e3848e517f6f6cb3bb7091bbb1380eb20eaaae95d2";
const initialVersions = [
  "20261017120000", "20261017121000", "20261017122000", "20261017123000", "20261017124000",
  "20261017130000", "20261017131000", "20261017132000", "20261017133000", "20261017134000",
  "20261017135000", "20261017140000", "20261017141000", "20261017142000", "20261017143000",
];
const stageVersions = [
  ["20261017144000", "20261017145000", "20261017146000", "20261017147000", "20261017148000", "20261017149000", "20261017150000"],
  ["20261017151000", "20261017152000", "20261017153000", "20261017154000", "20261017155000", "20261017156000", "20261017157000"],
  ["20261017158000", "20261017159000", "20261017160000", "20261017161000", "20261017162000", "20261017163000", "20261017164000"],
  ["20261017165000", "20261017166000", "20261017167000", "20261017168000", "20261017169000", "20261017170000", "20261017171000"],
  ["20261017172000", "20261017173000", "20261017174000", "20261017175000", "20261018100000", "20261020030000", "20261021000000"],
];

const migrationFiles = new Map();
for (const file of readdirSync(migrationDirectory).filter((entry) => entry.endsWith(".sql"))) {
  const match = /^(\d+)_([^.]+)\.sql$/u.exec(file);
  if (match) migrationFiles.set(match[1], { file, name: match[2] });
}

function sourceFor(version) {
  const metadata = migrationFiles.get(version);
  if (!metadata) throw new Error(`migration source missing: ${version}`);
  const source = readFileSync(join(migrationDirectory, metadata.file), "utf8");
  return { ...metadata, version, source, hash: createHash("sha256").update(source).digest("hex") };
}

const initial = initialVersions.map(sourceFor);
const stages = stageVersions.map((versions) => versions.map(sourceFor));
if (new Set(stages.flat().map((entry) => entry.version)).size !== 35) {
  throw new Error("expected exactly 35 unique remaining migration versions");
}

function literal(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function dollarQuote(source, seed) {
  let delimiter = `$eskomi_packet_${seed}$`;
  let suffix = 0;
  while (source.includes(delimiter)) delimiter = `$eskomi_packet_${seed}_${++suffix}$`;
  return `${delimiter}${source}${delimiter}`;
}

function manifestValues(entries) {
  return entries.map((entry) => `(${literal(entry.version)}, ${literal(entry.name)}, ${literal(entry.hash)})`).join(",\n      ");
}

function exactManifestGuard(entries, message) {
  return `
  if exists (
    select 1
    from (values
      ${manifestValues(entries)}
    ) as expected(version, name, source_sha256)
    left join supabase_migrations.schema_migrations as ledger
      on ledger.version = expected.version
    where ledger.version is null
       or ledger.name is distinct from expected.name
       or coalesce(encode(extensions.digest(ledger.statements[1], 'sha256'), 'hex'), '') <> expected.source_sha256
  ) then
    raise exception ${literal(message)};
  end if;`;
}

function stageSql(stageNumber, entries, previousVersion) {
  const stageId = String(stageNumber).padStart(2, "0");
  const allPrevious = [...initial, ...stages.slice(0, stageNumber - 1).flat()];
  const absentList = entries.map((entry) => literal(entry.version)).join(", ");
  const sourceStatements = entries.map((entry, index) => `
-- SOURCE ${entry.version}_${entry.name}.sql
-- SHA-256 ${entry.hash}
${entry.source}
insert into supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
values
  (${literal(entry.version)}, array[${dollarQuote(entry.source, `${stageId}_${index + 1}`)}], ${literal(entry.name)}, null, null, null);`).join("\n");
  const resultRows = entries.map((entry) => `(${literal(entry.version)}, ${literal(entry.name)}, ${literal(entry.hash)})`).join(", ");
  return `-- Eskomi v1.1 manual SQL Editor packet: stage ${stageId} of 05
-- Project ref: ${projectRef}
-- This file contains the checked-in source SQL unchanged plus an atomic source-ledger record.
-- Paste the ENTIRE file into Supabase SQL Editor and run it once. Do not run a later stage unless this one returns success.

begin;
select pg_advisory_xact_lock(hashtext('eskomi-v11-source-migrations-20261021'));

do $eskomi_preflight$
declare
  anchor_name text;
  anchor_source_sha256 text;
begin
  select name, encode(extensions.digest(statements[1], 'sha256'), 'hex')
    into anchor_name, anchor_source_sha256
  from supabase_migrations.schema_migrations
  where version = ${literal(directoryAnchor)};
  if anchor_name is distinct from ${literal(directoryAnchorName)}
     or anchor_source_sha256 is distinct from ${literal(directoryAnchorSourceSha256)} then
    raise exception 'required directory migration ${directoryAnchor} version/name/source hash does not match';
  end if;
${exactManifestGuard(allPrevious, "prior source ledger does not match this packet")}
  if exists (
    select 1 from supabase_migrations.schema_migrations
    where version in (${absentList})
  ) then
    raise exception 'stage ${stageId} is already partly or wholly recorded; stop and use 00-checkpoint.sql';
  end if;
end;
$eskomi_preflight$;
${sourceStatements}
commit;

select jsonb_build_object(
  'status', 'COMMITTED',
  'project_ref_expected', ${literal(projectRef)},
  'stage', ${literal(stageId)},
  'records', (
    select jsonb_agg(jsonb_build_object(
      'version', expected.version,
      'name', expected.name,
      'source_sha256', encode(extensions.digest(ledger.statements[1], 'sha256'), 'hex')
    ) order by expected.version)
    from (values ${resultRows}) as expected(version, name, source_sha256)
    join supabase_migrations.schema_migrations as ledger using (version)
  )
) as stage_result;
`;
}

function checkpointSql() {
  const all = [...initial, ...stages.flat()];
  return `-- Read-only checkpoint for the manual Eskomi v1.1 SQL Editor packet.
-- Expected before stage 01: initial_exact=15, remaining_recorded=0, directory_anchor=true.
with expected_initial(version, name, source_sha256) as (values
  ${manifestValues(initial)}
), expected_remaining(version, name, source_sha256) as (values
  ${manifestValues(stages.flat())}
)
select jsonb_build_object(
  'project_ref_expected', ${literal(projectRef)},
  'directory_anchor_exact', exists(
    select 1 from supabase_migrations.schema_migrations
    where version = ${literal(directoryAnchor)}
      and name = ${literal(directoryAnchorName)}
      and encode(extensions.digest(statements[1], 'sha256'), 'hex') = ${literal(directoryAnchorSourceSha256)}
  ),
  'initial_exact', (select count(*) from expected_initial e join supabase_migrations.schema_migrations l on l.version = e.version and l.name = e.name and encode(extensions.digest(l.statements[1], 'sha256'), 'hex') = e.source_sha256),
  'initial_expected', ${initial.length},
  'remaining_recorded', (select count(*) from expected_remaining e join supabase_migrations.schema_migrations l on l.version = e.version),
  'remaining_expected', ${stages.flat().length},
  'next_version_recorded', exists(select 1 from supabase_migrations.schema_migrations where version = '20261017144000')
) as checkpoint;
`;
}

function finalCheckSql() {
  const all = [...initial, ...stages.flat()];
  return `-- Read-only final verification for the manual Eskomi v1.1 SQL Editor packet.
with expected(version, name, source_sha256) as (values
  ${manifestValues(all)}
), comparison as (
  select e.version,
    l.version is not null as recorded,
    l.name is not distinct from e.name as name_matches,
    coalesce(encode(extensions.digest(l.statements[1], 'sha256'), 'hex'), '') = e.source_sha256 as source_matches
  from expected e
  left join supabase_migrations.schema_migrations l using (version)
)
select jsonb_build_object(
  'project_ref_expected', ${literal(projectRef)},
  'directory_anchor_exact', exists(
    select 1 from supabase_migrations.schema_migrations
    where version = ${literal(directoryAnchor)}
      and name = ${literal(directoryAnchorName)}
      and encode(extensions.digest(statements[1], 'sha256'), 'hex') = ${literal(directoryAnchorSourceSha256)}
  ),
  'packet_exact', (select count(*) from comparison where recorded and name_matches and source_matches),
  'packet_expected', ${all.length},
  'packet_mismatch_or_missing', (select count(*) from comparison where not (recorded and name_matches and source_matches)),
  'four_public_review_rpcs_present', (
    select count(*)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'api'
      and p.proname in (
        'list_public_shop_detail_reviews_v11',
        'get_public_shop_detail_review_summary_v11',
        'list_public_review_experience_publications_global',
        'count_public_review_experience_publications_global'
      )
  )
) as final_verification;
`;
}

function readme(files) {
  const rows = files.map(({ file, entries }) => `| ${file} | ${entries.map((entry) => `\`${entry.version}\``).join(" ～ ")} | ${entries.length} |`).join("\n");
  return `# Eskomi v1.1: Supabase SQL Editor 手動適用パケット

対象プロジェクトは **\`${projectRef}\`** です。このフォルダは、すでに正常記録された15件を再実行せず、残り35件だけを5段階で適用するためのものです。秘密値、顧客・店舗データ、キー、接続文字列は含みません。

> このパケットを作成した側は本番SQLを実行していません。実行者はSupabase SQL Editorを操作するユーザーです。

## 実行前（必須）

1. Supabase Dashboardで project ref が **\`${projectRef}\`** であることを確認します。
2. SQL Editorで \`00-checkpoint.sql\` を実行します。開始条件は、\`directory_anchor_exact=true\`、\`initial_exact=15\`、\`remaining_recorded=0\`、\`next_version_recorded=false\` です。
3. 一つでも異なる値なら、**このフォルダのstage SQLを実行しません**。結果を保存して作業を止めます。

## 実行順

各stageは、source SQL とその同一sourceのmigration ledger記録を一つの \`BEGIN ... COMMIT\` に入れています。stageのどこかで失敗するとCOMMITに到達せず、そのstageのSQLとledger挿入はまとめてロールバックされます。SQL Editorがエラーを表示したら後続stageを押さないため、後続が自動実行されることはありません。

| 順 | ファイル | source version範囲 | 件数 |
| ---: | --- | --- | ---: |
${rows}

各ファイルは **全文を1回だけ** 新規SQL queryへ貼り付けてRunします。成功したら出力JSONが \`status: COMMITTED\` で、\`records\` がそのstageの7件すべてを持つことを確認して、次のstageへ進みます。

## エラー時

1. **同じstageを直ちに再実行せず、後続stageも実行しません。**
2. エラー文と実行時刻を保存し、\`00-checkpoint.sql\` を実行します（読取のみ）。
3. checkpointの値とエラーを担当者へ渡します。中途半端なledger、手動のledger INSERT、versionの飛ばし、sourceの改変はしません。

stageがCOMMIT済みなら、そのstageを再実行すると二重実行防止guardが停止します。これは期待どおりの安全動作です。\`00-checkpoint.sql\`の \`remaining_recorded\` を確認して、次に必要な判断を行います。

## 完了確認

5段階がすべて成功した後、\`99-final-readonly-verification.sql\`を実行します。成功条件は \`packet_exact=50\`、\`packet_expected=50\`、\`packet_mismatch_or_missing=0\`、\`four_public_review_rpcs_present=4\` です。これはmigration/ledgerと4つのpublic review RPCの存在確認であり、mapping、runtime secret、Cloudflare deploy、DNS、Auth/Storage/Mailの実運用確認を意味しません。

## 生成根拠

\`headless/scripts/generate-eskomi-v11-sql-editor-packet.mjs\` が checked-in migration sourceからSHA-256を算出してこのフォルダを生成します。各stageのpreflightは、既存15件のversion/name/source SHA-256、読み取り確認済みdirectory基準migrationのversion/name/source SHA-256、当該stageの未記録を照合します。source SQLは変更せず、各sourceの直後に同じsource textをledgerへ記録するINSERTだけを付加しています。
`;
}

rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(outputDirectory, { recursive: true });
const files = [];
for (const [index, entries] of stages.entries()) {
  const file = `${String(index + 1).padStart(2, "0")}-stage-${String(index + 1).padStart(2, "0")}.sql`;
  writeFileSync(join(outputDirectory, file), stageSql(index + 1, entries, index === 0 ? initial.at(-1).version : stages[index - 1].at(-1).version));
  files.push({ file, entries });
}
writeFileSync(join(outputDirectory, "00-checkpoint.sql"), checkpointSql());
writeFileSync(join(outputDirectory, "99-final-readonly-verification.sql"), finalCheckSql());
writeFileSync(join(outputDirectory, "README.md"), readme(files));

const generated = ["00-checkpoint.sql", ...files.map((entry) => entry.file), "99-final-readonly-verification.sql", "README.md"];
const manifest = generated.map((file) => {
  const content = readFileSync(join(outputDirectory, file));
  return `${file}\t${content.length}\t${createHash("sha256").update(content).digest("hex")}`;
}).join("\n") + "\n";
writeFileSync(join(outputDirectory, "MANIFEST.tsv"), manifest);
console.log(`Generated ${generated.length} manual SQL Editor artifacts in ${outputDirectory}`);
for (const file of [...generated, "MANIFEST.tsv"]) {
  const content = readFileSync(join(outputDirectory, file));
  console.log(`${file}\t${content.length}\t${createHash("sha256").update(content).digest("hex")}`);
}
