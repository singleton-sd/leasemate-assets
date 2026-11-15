import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { extractWorkflowStepRun } from "./workflow-yaml.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SNAPSHOT = join(ROOT, ".github/workflows/snapshot.yml");
const ARCHIVE = "leasemate-assets-0.1.0.tar.gz";

/**
 * @param {string} cwd
 * @param {string[]} args
 */
function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function snapshotYaml() {
  return readFileSync(SNAPSHOT, "utf8");
}

/**
 * @param {{ checksumBody?: string }} [opts]
 */
function setupArchives(opts = {}) {
  const root = mkdtempSync(join(tmpdir(), "snapshot-verify-"));
  const repo = join(root, "repo");
  const runnerTemp = join(root, "runner");
  const files = join(runnerTemp, "snapshot-archives");
  mkdirSync(repo);
  mkdirSync(files, { recursive: true });
  git(repo, ["init", "-b", "main"]);
  git(repo, ["config", "user.name", "test"]);
  git(repo, ["config", "user.email", "test@example.com"]);
  mkdirSync(join(repo, "config"));
  writeFileSync(join(repo, "config/product.json"), '{"id":"leasemate"}\n');
  git(repo, ["add", "config/product.json"]);
  git(repo, ["commit", "-m", "chore: seed"]);
  writeFileSync(join(files, ARCHIVE), "archive-bytes\n");
  const sum =
    opts.checksumBody ??
    execFileSync("sha256sum", [ARCHIVE], { cwd: files, encoding: "utf8" });
  writeFileSync(join(files, `${ARCHIVE}.sha256`), sum);
  return { root, repo, runnerTemp, files };
}

/**
 * @param {ReturnType<typeof setupArchives>} ctx
 */
function runVerifyArchives(ctx) {
  const script = extractWorkflowStepRun(
    snapshotYaml(),
    "Verify snapshot archives",
  );
  return spawnSync("bash", ["-c", script], {
    cwd: ctx.repo,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME ?? tmpdir(),
      TMPDIR: process.env.TMPDIR ?? tmpdir(),
      RUNNER_TEMP: ctx.runnerTemp,
      VERSION: "0.1.0",
      TAG: "0.1.0",
      GITHUB_OUTPUT: join(ctx.runnerTemp, "github-output"),
    },
  });
}

/**
 * @param {{
 *   existing?: Record<string, string>,
 * }} [opts]
 */
function setupUpload(opts = {}) {
  const root = mkdtempSync(join(tmpdir(), "snapshot-upload-"));
  const runnerTemp = join(root, "runner");
  const files = join(runnerTemp, "snapshot-archives");
  const dist = join(root, "work", "dist");
  const fakeRoot = join(root, "gh");
  const bin = join(root, "bin");
  mkdirSync(files, { recursive: true });
  mkdirSync(dist, { recursive: true });
  mkdirSync(join(fakeRoot, "assets"), { recursive: true });
  mkdirSync(bin);
  writeFileSync(join(files, ARCHIVE), "archive-bytes\n");
  writeFileSync(join(files, `${ARCHIVE}.sha256`), "checksum-bytes\n");
  writeFileSync(join(dist, "manifest.json"), '{"ok":true}\n');
  const existing = opts.existing ?? {};
  writeFileSync(join(fakeRoot, "names.json"), JSON.stringify(Object.keys(existing)));
  for (const [name, body] of Object.entries(existing)) {
    writeFileSync(join(fakeRoot, "assets", name), body);
  }
  writeFileSync(
    join(bin, "gh"),
    `#!/usr/bin/env node
const { copyFileSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { basename, join } = require("node:path");
const root = process.env.GH_FAKE_ROOT;
const logPath = join(root, "log.json");
const args = process.argv.slice(2);
const log = JSON.parse(readFileSync(logPath, "utf8"));
log.push(args);
writeFileSync(logPath, JSON.stringify(log));
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
if (args[0] !== "release") process.exit(1);
if (args[1] === "view") {
  const names = JSON.parse(readFileSync(join(root, "names.json"), "utf8"));
  process.stdout.write(names.map((n) => n + "\\n").join(""));
  process.exit(0);
}
if (args[1] === "download") {
  copyFileSync(join(root, "assets", flag("-p")), flag("-O"));
  process.exit(0);
}
if (args[1] === "upload") {
  mkdirSync(join(root, "uploads"), { recursive: true });
  for (const arg of args.slice(2)) {
    if (arg === "-R") break;
    if (arg.startsWith("-")) continue;
    if (!arg.includes("/") && !arg.includes("\\\\")) continue;
    copyFileSync(arg, join(root, "uploads", basename(arg)));
  }
  process.exit(0);
}
process.exit(1);
`,
  );
  chmodSync(join(bin, "gh"), 0o755);
  writeFileSync(join(fakeRoot, "log.json"), "[]");
  return { root, runnerTemp, files, work: join(root, "work"), fakeRoot, bin };
}

/**
 * @param {ReturnType<typeof setupUpload>} ctx
 */
function runUpload(ctx) {
  const script = extractWorkflowStepRun(
    snapshotYaml(),
    "Attach archive, checksum, and manifest to the GitHub Release",
  );
  return spawnSync("bash", ["-c", script], {
    cwd: ctx.work,
    encoding: "utf8",
    env: {
      PATH: `${ctx.bin}:${process.env.PATH}`,
      HOME: process.env.HOME ?? tmpdir(),
      TMPDIR: process.env.TMPDIR ?? tmpdir(),
      RUNNER_TEMP: ctx.runnerTemp,
      GH_FAKE_ROOT: ctx.fakeRoot,
      GH_REPO: "singleton-sd/leasemate-assets",
      GH_TOKEN: "test",
      RELEASE_TAG: "0.1.0",
      ARCHIVE,
    },
  });
}

test("Verify snapshot archives accepts a checksum bound to the archive", () => {
  const ctx = setupArchives();
  try {
    const result = runVerifyArchives(ctx);
    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
    assert.match(
      readFileSync(join(ctx.runnerTemp, "github-output"), "utf8"),
      new RegExp(`archive=${ARCHIVE}`),
    );
  } finally {
    rmSync(ctx.root, { recursive: true, force: true });
  }
});

test("Verify snapshot archives rejects a checksum record for another file", () => {
  const nullSum = execFileSync("sha256sum", ["/dev/null"], { encoding: "utf8" });
  const ctx = setupArchives({ checksumBody: nullSum });
  try {
    const result = runVerifyArchives(ctx);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /names '\/dev\/null'/);
  } finally {
    rmSync(ctx.root, { recursive: true, force: true });
  }
});

test("snapshot upload sends only missing assets on a partial retry", () => {
  const ctx = setupUpload({
    existing: { [ARCHIVE]: "archive-bytes\n" },
  });
  try {
    const result = runUpload(ctx);
    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
    const log = JSON.parse(readFileSync(join(ctx.fakeRoot, "log.json"), "utf8"));
    const upload = log.find((args) => args[1] === "upload");
    assert.ok(upload, "expected gh release upload");
    const uploaded = upload.filter((arg) => arg.endsWith(".sha256") || arg.endsWith("manifest.json"));
    assert.equal(uploaded.length, 2);
    assert.ok(!upload.some((arg) => arg.endsWith(ARCHIVE) && !arg.endsWith(".sha256")));
    assert.match(result.stdout, /skipping upload/);
  } finally {
    rmSync(ctx.root, { recursive: true, force: true });
  }
});

test("snapshot upload skips every asset when a Pages rerun finds identical files", () => {
  const ctx = setupUpload({
    existing: {
      [ARCHIVE]: "archive-bytes\n",
      [`${ARCHIVE}.sha256`]: "checksum-bytes\n",
      "manifest.json": '{"ok":true}\n',
    },
  });
  try {
    const result = runUpload(ctx);
    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
    const log = JSON.parse(readFileSync(join(ctx.fakeRoot, "log.json"), "utf8"));
    assert.ok(!log.some((args) => args[1] === "upload"));
    assert.match(result.stdout, /All snapshot assets already on the GitHub Release/);
  } finally {
    rmSync(ctx.root, { recursive: true, force: true });
  }
});

test("snapshot upload fails when an existing asset does not match", () => {
  const ctx = setupUpload({
    existing: { [ARCHIVE]: "other-bytes\n" },
  });
  try {
    const result = runUpload(ctx);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /differs from the verified local file/);
  } finally {
    rmSync(ctx.root, { recursive: true, force: true });
  }
});
