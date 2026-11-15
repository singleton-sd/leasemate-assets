import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  inspectGitTag,
  planGitHubRelease,
  planNpmPublish,
  planReleaseResume,
} from "./release-resume.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts/release-resume.mjs");

const VERSION = "0.1.1";
const PREPARE_SHA = "abc123prepare";
const RELEASE_MESSAGE = `chore(release): v${VERSION} [skip ci]`;

/**
 * @param {string} cwd
 * @param {string[]} args
 * @returns {string}
 */
function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

/**
 * @returns {string}
 */
function initRepo() {
  const cwd = mkdtempSync(join(tmpdir(), "release-resume-"));
  git(cwd, ["init", "-b", "main"]);
  git(cwd, ["config", "user.name", "singleton-release[bot]"]);
  git(cwd, ["config", "user.email", "356768209+singleton-release[bot]@users.noreply.github.com"]);
  git(cwd, ["config", "commit.gpgsign", "false"]);
  writeFileSync(join(cwd, "package.json"), '{"version":"0.1.0"}\n');
  git(cwd, ["add", "package.json"]);
  git(cwd, ["commit", "--no-verify", "-m", "chore: prepare"]);
  return cwd;
}

test("planReleaseResume creates when the tag is absent", () => {
  assert.equal(
    planReleaseResume(VERSION, PREPARE_SHA, { tagExists: false }),
    "create",
  );
});

test("planReleaseResume resumes a matching annotated tag", () => {
  assert.equal(
    planReleaseResume(VERSION, PREPARE_SHA, {
      tagExists: true,
      objectType: "tag",
      tagMessage: `v${VERSION}`,
      commitMessage: RELEASE_MESSAGE,
      parentSha: PREPARE_SHA,
    }),
    "resume",
  );
});

test("planReleaseResume refuses a lightweight or mismatched tag", () => {
  assert.throws(
    () =>
      planReleaseResume(VERSION, PREPARE_SHA, {
        tagExists: true,
        objectType: "commit",
        tagMessage: VERSION,
        commitMessage: RELEASE_MESSAGE,
        parentSha: PREPARE_SHA,
      }),
    /not annotated/,
  );
  assert.throws(
    () =>
      planReleaseResume(VERSION, PREPARE_SHA, {
        tagExists: true,
        objectType: "tag",
        tagMessage: `v${VERSION}`,
        commitMessage: RELEASE_MESSAGE,
        parentSha: "someone-else",
      }),
    /not based on prepare SHA/,
  );
});

test("planNpmPublish and planGitHubRelease skip completed work", () => {
  assert.equal(planNpmPublish(false), "publish");
  assert.equal(planNpmPublish(true), "skip");
  assert.equal(planGitHubRelease(false), "create");
  assert.equal(planGitHubRelease(true), "skip");
});

test("rerun after a successful push resumes without replacing the tag", () => {
  const cwd = initRepo();
  try {
    const prepareSha = git(cwd, ["rev-parse", "HEAD"]);
    writeFileSync(join(cwd, "package.json"), '{"version":"0.1.1"}\n');
    git(cwd, ["add", "package.json"]);
    git(cwd, ["commit", "--no-verify", "-m", RELEASE_MESSAGE]);
    git(cwd, ["tag", "-a", VERSION, "-m", `v${VERSION}`]);
    const tagSha = git(cwd, ["rev-parse", `refs/tags/${VERSION}`]);

    const first = spawnSync(
      process.execPath,
      [SCRIPT, "plan", VERSION, prepareSha],
      { cwd, encoding: "utf8" },
    );
    assert.equal(first.status, 0, first.stderr);
    assert.equal(first.stdout.trim(), "resume");

    const second = spawnSync(
      process.execPath,
      [SCRIPT, "plan", VERSION, prepareSha],
      { cwd, encoding: "utf8" },
    );
    assert.equal(second.status, 0, second.stderr);
    assert.equal(second.stdout.trim(), "resume");
    assert.equal(git(cwd, ["rev-parse", `refs/tags/${VERSION}`]), tagSha);
    assert.equal(inspectGitTag(VERSION, cwd).objectType, "tag");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("chore(release) tag must be an ancestor of main and is not force-moved", () => {
  const cwd = initRepo();
  try {
    const prepareSha = git(cwd, ["rev-parse", "HEAD"]);
    writeFileSync(join(cwd, "package.json"), '{"version":"0.1.1"}\n');
    git(cwd, ["add", "package.json"]);
    git(cwd, ["commit", "--no-verify", "-m", RELEASE_MESSAGE]);
    git(cwd, ["tag", "-a", VERSION, "-m", `v${VERSION}`]);
    const tagCommit = git(cwd, ["rev-parse", `${VERSION}^{commit}`]);
    const tagSha = git(cwd, ["rev-parse", `refs/tags/${VERSION}`]);
    assert.equal(git(cwd, ["log", "-1", "--format=%s", tagCommit]), RELEASE_MESSAGE);
    const ancestor = spawnSync(
      "git",
      ["merge-base", "--is-ancestor", tagCommit, "main"],
      { cwd },
    );
    assert.equal(ancestor.status, 0);
    assert.equal(git(cwd, ["rev-parse", `${tagCommit}^`]), prepareSha);
    const second = spawnSync(
      process.execPath,
      [SCRIPT, "plan", VERSION, prepareSha],
      { cwd, encoding: "utf8" },
    );
    assert.equal(second.status, 0, second.stderr);
    assert.equal(second.stdout.trim(), "resume");
    assert.equal(git(cwd, ["rev-parse", `refs/tags/${VERSION}`]), tagSha);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("CLI plan is create when the tag was never pushed", () => {
  const cwd = initRepo();
  try {
    const prepareSha = git(cwd, ["rev-parse", "HEAD"]);
    const result = spawnSync(
      process.execPath,
      [SCRIPT, "plan", VERSION, prepareSha],
      { cwd, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "create");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
