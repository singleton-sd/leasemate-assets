import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { extractWorkflowStepRun } from "./workflow-yaml.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RELEASE = join(ROOT, ".github/workflows/release.yml");

const PKG_HEAD = `{
  "name": "@singleton-sd/leasemate-assets",
  "version": "0.1.0"
}
`;

const PKG_PREPARED = `{
  "name": "@singleton-sd/leasemate-assets",
  "version": "0.1.1"
}
`;

const CHANGELOG_HEAD = `# Changelog

## 0.1.0 (2026-01-01)

* start
`;

const CHANGELOG_PREPARED = `# Changelog

## 0.1.1 (2026-01-02)

* bump

## 0.1.0 (2026-01-01)

* start
`;

const NOTES = `## 0.1.1 (2026-01-02)

* bump

`;

const TARBALL = "singleton-sd-leasemate-assets-0.1.1.tgz";

/**
 * @param {string} cwd
 * @param {string[]} args
 */
function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

/**
 * @param {string} filesDir
 * @param {string} tarball
 * @param {string} packageJson
 */
function packTarball(filesDir, tarball, packageJson) {
  const staging = join(filesDir, ".pack");
  mkdirSync(join(staging, "package"), { recursive: true });
  writeFileSync(join(staging, "package", "package.json"), packageJson);
  execFileSync("tar", [
    "-czf",
    join(filesDir, tarball),
    "-C",
    staging,
    "package/package.json",
  ]);
  rmSync(staging, { recursive: true, force: true });
}

/**
 * @param {{ changelogAtSha?: boolean }} [opts]
 */
function setupGood(opts = {}) {
  const changelogAtSha = opts.changelogAtSha !== false;
  const root = mkdtempSync(join(tmpdir(), "publish-verify-"));
  const repo = join(root, "repo");
  const runnerTemp = join(root, "runner");
  const files = join(runnerTemp, "release-files");
  mkdirSync(repo);
  mkdirSync(files, { recursive: true });
  git(repo, ["init", "-b", "main"]);
  git(repo, ["config", "user.name", "test"]);
  git(repo, ["config", "user.email", "test@example.com"]);
  writeFileSync(join(repo, "package.json"), PKG_HEAD);
  const added = ["package.json"];
  if (changelogAtSha) {
    writeFileSync(join(repo, "CHANGELOG.md"), CHANGELOG_HEAD);
    added.push("CHANGELOG.md");
  }
  git(repo, ["add", ...added]);
  git(repo, ["commit", "-m", "chore: seed"]);
  const sha = git(repo, ["rev-parse", "HEAD"]);
  git(repo, ["update-ref", "refs/remotes/origin/main", sha]);

  writeFileSync(join(files, "package.json"), PKG_PREPARED);
  writeFileSync(join(files, "CHANGELOG.md"), CHANGELOG_PREPARED);
  writeFileSync(join(files, "release-notes.md"), NOTES);
  packTarball(files, TARBALL, PKG_PREPARED);

  return { root, repo, runnerTemp, files, sha };
}

/**
 * @param {ReturnType<typeof setupGood>} ctx
 * @param {Record<string, string>} env
 */
function runVerify(ctx, env = {}) {
  const yaml = readFileSync(RELEASE, "utf8");
  const script = extractWorkflowStepRun(yaml, "Verify prepared release");
  return spawnSync("bash", ["-c", script], {
    cwd: ctx.repo,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME ?? rootHome(),
      TMPDIR: process.env.TMPDIR ?? tmpdir(),
      RUNNER_TEMP: ctx.runnerTemp,
      VERSION: "0.1.1",
      PACKAGE: "@singleton-sd/leasemate-assets",
      TARBALL,
      PREPARED_SHA: ctx.sha,
      RECOVER: "false",
      EVENT_NAME: "push",
      RECOVER_VERSION: "",
      RECOVER_SHA: "",
      DEFAULT_BRANCH: "main",
      ...env,
    },
  });
}

function rootHome() {
  return process.env.HOME || tmpdir();
}

/**
 * @param {(ctx: ReturnType<typeof setupGood>) => void} fn
 * @param {{ changelogAtSha?: boolean }} [opts]
 */
function withRelease(fn, opts) {
  const ctx = setupGood(opts);
  try {
    fn(ctx);
  } finally {
    rmSync(ctx.root, { recursive: true, force: true });
  }
}

test("Verify prepared release accepts a well-formed artifact", () => {
  withRelease((ctx) => {
    const result = runVerify(ctx);
    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
    const notes = readFileSync(
      join(ctx.runnerTemp, "github-release-notes.md"),
      "utf8",
    );
    assert.equal(notes, NOTES);
  });
});

test("Verify prepared release rejects a bad semver or +build version", () => {
  withRelease((ctx) => {
    const bad = runVerify(ctx, { VERSION: "1.0" });
    assert.notEqual(bad.status, 0);
    assert.match(bad.stderr, /not SemVer/);

    const build = runVerify(ctx, { VERSION: "0.1.1+build.1" });
    assert.notEqual(build.status, 0);
    assert.match(build.stderr, /\+build metadata/);
  });
});

test("Verify prepared release rejects a wrong tarball name", () => {
  withRelease((ctx) => {
    const result = runVerify(ctx, { TARBALL: "evil-0.1.1.tgz" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Tarball 'evil-0\.1\.1\.tgz'/);
  });
});

test("Verify prepared release rejects a wrong package name", () => {
  withRelease((ctx) => {
    const result = runVerify(ctx, { PACKAGE: "@evil/pkg" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /package name/);
  });
});

test("Verify prepared release rejects an extra key or duplicate version key", () => {
  withRelease((ctx) => {
    const extra = `{
  "name": "@singleton-sd/leasemate-assets",
  "version": "0.1.1",
  "foo": true
}
`;
    writeFileSync(join(ctx.files, "package.json"), extra);
    packTarball(ctx.files, TARBALL, extra);
    const extraResult = runVerify(ctx);
    assert.notEqual(extraResult.status, 0);
    assert.match(extraResult.stderr, /more than the version line/);
  });

  withRelease((ctx) => {
    const dup = `{
  "name": "@singleton-sd/leasemate-assets",
  "version": "0.1.1",
  "version": "0.1.1"
}
`;
    writeFileSync(join(ctx.files, "package.json"), dup);
    packTarball(ctx.files, TARBALL, dup);
    const dupResult = runVerify(ctx);
    assert.notEqual(dupResult.status, 0);
    assert.match(dupResult.stderr, /exactly one version line/);
  });
});

test("Verify prepared release rejects a changed CHANGELOG title", () => {
  withRelease((ctx) => {
    writeFileSync(
      join(ctx.files, "CHANGELOG.md"),
      CHANGELOG_PREPARED.replace("# Changelog", "# History"),
    );
    const result = runVerify(ctx);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /title must be byte-identical/);
  });
});

test("Verify prepared release rejects a missing CHANGELOG at the sha", () => {
  withRelease(
    (ctx) => {
      const result = runVerify(ctx);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /CHANGELOG\.md is missing/);
    },
    { changelogAtSha: false },
  );
});

test("Verify prepared release rejects a non-prepend CHANGELOG edit", () => {
  withRelease((ctx) => {
    writeFileSync(
      join(ctx.files, "CHANGELOG.md"),
      CHANGELOG_PREPARED.replace("* start", "* started"),
    );
    const result = runVerify(ctx);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /only new lines at the top/);
  });
});

test("Verify prepared release rejects a symlink or extra artifact file", () => {
  withRelease((ctx) => {
    symlinkSync("package.json", join(ctx.files, "link"));
    const link = runVerify(ctx);
    assert.notEqual(link.status, 0);
    assert.match(link.stderr, /Unexpected artifact contents/);
  });

  withRelease((ctx) => {
    writeFileSync(join(ctx.files, "extra.txt"), "nope\n");
    const extra = runVerify(ctx);
    assert.notEqual(extra.status, 0);
    assert.match(extra.stderr, /Unexpected artifact contents/);
  });
});

test("Verify prepared release rejects a release-notes mismatch", () => {
  withRelease((ctx) => {
    writeFileSync(join(ctx.files, "release-notes.md"), "wrong notes\n");
    const result = runVerify(ctx);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /release-notes\.md does not match/);
  });
});

test("Verify prepared release rejects a tag that is not an ancestor of main", () => {
  withRelease((ctx) => {
    writeFileSync(join(ctx.repo, "package.json"), PKG_PREPARED);
    writeFileSync(join(ctx.repo, "CHANGELOG.md"), CHANGELOG_PREPARED);
    git(ctx.repo, ["add", "package.json", "CHANGELOG.md"]);
    git(ctx.repo, ["commit", "-m", "chore(release): v0.1.1 [skip ci]"]);
    git(ctx.repo, ["tag", "-a", "0.1.1", "-m", "v0.1.1"]);
    const result = runVerify(ctx, {
      RECOVER: "true",
      EVENT_NAME: "workflow_dispatch",
      RECOVER_VERSION: "0.1.1",
      RECOVER_SHA: ctx.sha,
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /is not on main/);
  });
});
