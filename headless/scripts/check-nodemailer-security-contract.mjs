#!/usr/bin/env node

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import nodemailer from "nodemailer";

const require = createRequire(import.meta.url);
const MINIMUM_SAFE_VERSION = "9.0.3";
const appPackage = require("../package.json");
const packageLock = require("../package-lock.json");
const { version: installedVersion } = require("nodemailer/package.json");
const declaredVersion = appPackage.dependencies.nodemailer;
const lockedDeclaredVersion = packageLock.packages[""].dependencies.nodemailer;
const lockedInstalledVersion = packageLock.packages["node_modules/nodemailer"].version;

function compareVersions(left, right) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);

  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

assert.match(declaredVersion, /^\d+\.\d+\.\d+$/, "nodemailer must use an exact version");
assert.equal(
  lockedDeclaredVersion,
  declaredVersion,
  "package-lock root dependency must match package.json"
);
assert.equal(
  lockedInstalledVersion,
  declaredVersion,
  "package-lock installed version must match package.json"
);
assert.equal(
  installedVersion,
  declaredVersion,
  "node_modules version must match package.json and package-lock.json"
);

assert.ok(
  compareVersions(installedVersion, MINIMUM_SAFE_VERSION) >= 0,
  `nodemailer ${installedVersion} is vulnerable; install ${MINIMUM_SAFE_VERSION} or newer`
);

const transporter = nodemailer.createTransport({
  jsonTransport: true,
  disableFileAccess: true,
  disableUrlAccess: true
});

const info = await transporter.sendMail({
  from: "sender@example.com",
  to: "recipient@example.com",
  replyTo: "visitor@example.com",
  subject: "Nodemailer security contract",
  text: "This message must stay inside the local JSON transport."
});

assert.ok(info.messageId, "sendMail must return a message id");
assert.ok(info.message, "JSON transport must return the generated message without SMTP access");

console.log(`nodemailer security contract passed (${installedVersion})`);
