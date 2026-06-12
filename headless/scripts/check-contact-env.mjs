#!/usr/bin/env node

/**
 * お問い合わせフォーム用 SMTP 環境変数チェック CLI
 * Usage: node scripts/check-contact-env.mjs
 *    or: npm run contact:check-env
 *
 * .env → .env.local の順で読み込み（後者が前者を上書き）。
 * 読み込み前から process.env に存在した値は上書きしない。
 * 未設定があれば exit 1。CONTACT_FORM_DRY_RUN=true のみの場合は WARN だが exit 0。
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const REQUIRED_VARS = [
  { key: "SMTP_HOST", label: "SMTP ホスト" },
  { key: "SMTP_PORT", label: "SMTP ポート" },
  { key: "SMTP_USER", label: "SMTP ユーザー" },
  { key: "SMTP_PASS", label: "SMTP パスワード" },
  { key: "CONTACT_FROM_EMAIL", label: "送信元メールアドレス" },
  { key: "CONTACT_TO_EMAIL", label: "宛先メールアドレス" }
];

/** @type {Set<string>} */
const preExistingEnvKeys = new Set(
  Object.entries(process.env)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key)
);

/**
 * @param {string} filename
 */
function loadEnvFile(filename) {
  const envPath = resolve(ROOT, filename);
  if (!existsSync(envPath)) {
    return;
  }
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (preExistingEnvKeys.has(key)) {
      continue;
    }
    process.env[key] = value;
  }
}

function loadDotEnv() {
  loadEnvFile(".env");
  loadEnvFile(".env.local");
}

function isSet(key) {
  const value = process.env[key];
  return value !== undefined && value !== "";
}

function isPlaceholder(value) {
  const lower = value.toLowerCase();
  return (
    lower.includes("example.com") ||
    lower.includes("change-me") ||
    lower.includes("your-smtp") ||
    lower === "smtp.example.com"
  );
}

function printRow(label, status, detail = "") {
  const icon = status === "OK" ? "✓" : status === "WARN" ? "!" : "✗";
  const line = detail ? `${label}: ${detail}` : label;
  console.log(`  ${icon} ${line}`);
}

function main() {
  loadDotEnv();

  console.log("\nEscomi Headless – お問い合わせ SMTP 環境変数チェック\n");

  let failures = 0;
  let warnings = 0;

  console.log("── 必須環境変数 ──");
  for (const { key, label } of REQUIRED_VARS) {
    if (!isSet(key)) {
      printRow(key, "FAIL", `${label} が未設定です`);
      failures += 1;
      continue;
    }
    const value = process.env[key];
    if (key !== "SMTP_PASS" && isPlaceholder(value)) {
      printRow(key, "WARN", `${label} がプレースホルダのままです（${value}）`);
      warnings += 1;
    } else {
      const display =
        key === "SMTP_PASS" ? "（設定済み・値は非表示）" : value;
      printRow(key, "OK", display);
    }
  }

  console.log("\n── 本番向けオプション ──");
  const dryRun = process.env.CONTACT_FORM_DRY_RUN === "true";
  if (dryRun) {
    printRow(
      "CONTACT_FORM_DRY_RUN",
      "WARN",
      "true のため実メールは送信されません（本番では false または未設定にしてください）"
    );
    warnings += 1;
  } else {
    printRow("CONTACT_FORM_DRY_RUN", "OK", "未設定または false（本番送信可能）");
  }

  console.log("\n── 結果 ──");
  if (failures === 0 && warnings === 0) {
    console.log("  SMTP 環境変数は本番送信の準備ができています。");
  } else if (failures === 0) {
    console.log(`  警告: ${warnings} 件。未設定はありません（exit 0）。`);
    console.log("  本番切替前にプレースホルダと DRY_RUN を見直してください。");
  } else {
    console.log(`  失敗: ${failures} / 警告: ${warnings}`);
    console.log(
      "  .env.example を参照し、headless/.env または .env.local に SMTP 一式を設定してください。"
    );
    console.log(
      "  ローカル検証のみなら CONTACT_FORM_DRY_RUN=true でも可ですが、SMTP は本番前に必須です。"
    );
  }

  process.exit(failures > 0 ? 1 : 0);
}

main();
