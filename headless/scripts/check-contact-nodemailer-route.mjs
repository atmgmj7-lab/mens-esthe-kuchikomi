import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const routePath = resolve(root, "app/api/contact/route.ts");
const source = readFileSync(routePath, "utf8");

class TestNextResponse extends Response {
  static json(value, init = {}) {
    return new TestNextResponse(JSON.stringify(value), {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
  }
}

function loadTypeScript(path, dependencies) {
  const output = ts.transpileModule(source, {
    fileName: path,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", output)((specifier) => {
    if (specifier in dependencies) return dependencies[specifier];
    throw new Error(`Unexpected dependency in ${path}: ${specifier}`);
  }, loaded, loaded.exports);
  return loaded.exports;
}

const calls = [];
const nodemailer = {
  createTransport(configuration) {
    calls.push(["createTransport", configuration]);
    return {
      async sendMail(message) {
        calls.push(["sendMail", message]);
        return { messageId: "fixture-message" };
      },
    };
  },
};
const module = loadTypeScript("app/api/contact/route.ts", {
  nodemailer: { __esModule: true, default: nodemailer },
  "next/server": { NextResponse: TestNextResponse },
  "@/lib/contact-rate-limit": { checkRateLimit: () => ({ allowed: true, retryAfterSec: 0 }) },
  "@/lib/contact-validation": {
    validateContactPayload: () => ({ ok: true, data: { type: "other", name: "Fixture", email: "reply@example.test" } }),
    buildContactEmailText: () => "fixture contact body",
  },
});

const keys = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "CONTACT_FROM_EMAIL", "CONTACT_TO_EMAIL", "CONTACT_FORM_DRY_RUN"];
const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
try {
  Object.assign(process.env, {
    SMTP_HOST: "smtp.fixture.test",
    SMTP_PORT: "587",
    SMTP_USER: "fixture-user",
    SMTP_PASS: "fixture-pass",
    CONTACT_FROM_EMAIL: "from@example.test",
    CONTACT_TO_EMAIL: "to@example.test",
    CONTACT_FORM_DRY_RUN: "false",
  });
  const response = await module.POST({
    headers: new Headers({ "x-forwarded-for": "203.0.113.1" }),
    json: async () => ({ type: "other" }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [
    ["createTransport", {
      host: "smtp.fixture.test",
      port: 587,
      secure: false,
      auth: { user: "fixture-user", pass: "fixture-pass" },
    }],
    ["sendMail", {
      from: "from@example.test",
      to: "to@example.test",
      replyTo: "reply@example.test",
      subject: "【Eskomi】お問い合わせ: other（Fixture）",
      text: "fixture contact body",
    }],
  ]);
} finally {
  for (const key of keys) {
    if (previous[key] === undefined) delete process.env[key];
    else process.env[key] = previous[key];
  }
}

console.log("Nodemailer contact-route mock contract: PASS");
