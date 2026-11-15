import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  parseWorkflowConcurrency,
  pendingRuns,
} from "./pages-publish-concurrency.mjs";
import releaseIt from "../.release-it.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = join(ROOT, ".github/workflows/pages.yml");
const SNAPSHOT = join(ROOT, ".github/workflows/snapshot.yml");
const RELEASE = join(ROOT, ".github/workflows/release.yml");

const BOT_URL = "https://example.invalid/users/singleton-release[bot]";

/**
 * @param {string} yaml
 * @returns {Record<string, string>}
 */
function jobBlocks(yaml) {
  const after = yaml.split(/\njobs:\n/)[1];
  if (!after) throw new Error("workflow has no jobs:");
  /** @type {Record<string, string>} */
  const jobs = {};
  for (const block of after.split(/\n(?=  [a-zA-Z0-9_-]+:)/)) {
    const name = block.match(/^  ([a-zA-Z0-9_-]+):/)?.[1];
    if (name) jobs[name] = block;
  }
  return jobs;
}

/**
 * @param {string} job
 * @returns {string[]}
 */
function stepUses(job) {
  return [...job.matchAll(/^\s+- uses: (\S+)/gm)].map((match) => match[1]);
}

test("pages.yml and snapshot.yml share pages-publish with queue: max", async () => {
  const pages = parseWorkflowConcurrency(await readFile(PAGES, "utf8"));
  const snapshot = parseWorkflowConcurrency(await readFile(SNAPSHOT, "utf8"));
  assert.equal(pages.group, "pages-publish");
  assert.equal(snapshot.group, "pages-publish");
  assert.equal(pages.queue, "max");
  assert.equal(snapshot.queue, "max");
  assert.equal(pages.cancelInProgress, false);
  assert.equal(snapshot.cancelInProgress, false);
});

test("active Pages + pending snapshot + later Pages retains the snapshot", async () => {
  const pages = parseWorkflowConcurrency(await readFile(PAGES, "utf8"));
  const sequence = ["pages-active", "snapshot-0.1.0", "pages-later"];
  const retained = pendingRuns(pages, sequence[0], sequence.slice(1));
  assert.deepEqual(retained, ["snapshot-0.1.0", "pages-later"]);

  const dropped = pendingRuns(
    { queue: "single" },
    sequence[0],
    sequence.slice(1),
  );
  assert.deepEqual(dropped, ["pages-later"]);
});

test("snapshot.yml never deploys a tagged dist to Pages root", async () => {
  const yaml = await readFile(SNAPSHOT, "utf8");
  assert.match(yaml, /workflow_dispatch:/);
  assert.match(
    yaml,
    /target-folder:\s+releases\/\$\{\{\s*needs\.build\.outputs\.version\s*\}\}/,
  );
  assert.doesNotMatch(yaml, /name:\s+Refresh latest catalog/);
  const deploys = [
    ...yaml.matchAll(
      /uses:\s+JamesIves\/github-pages-deploy-action[\s\S]*?(?=\n      - |\n*$)/g,
    ),
  ];
  assert.ok(deploys.length >= 1, "expected a Pages deploy step");
  for (const deploy of deploys) {
    assert.match(
      deploy[0],
      /target-folder:/,
      "tagged snapshot must set target-folder (not site root)",
    );
  }
});

test("pages.yml and snapshot.yml mint the App token only in publish", async () => {
  for (const file of [PAGES, SNAPSHOT]) {
    const yaml = await readFile(file, "utf8");
    assert.match(yaml, /^permissions:\n  contents: read\s*$/m);
    const jobs = jobBlocks(yaml);
    assert.ok(jobs.build, `${file} missing build job`);
    assert.ok(jobs.publish, `${file} missing publish job`);
    assert.match(jobs.build, /pnpm install/);
    assert.doesNotMatch(jobs.build, /create-github-app-token/);
    assert.doesNotMatch(jobs.build, /github\.token/);
    assert.match(jobs.publish, /create-github-app-token/);
    assert.match(
      jobs.publish,
      /token: \$\{\{ steps\.app-token\.outputs\.token \}\}/,
    );
    assert.doesNotMatch(jobs.publish, /pnpm install/);
    assert.doesNotMatch(jobs.publish, /node scripts\//);
    assert.doesNotMatch(jobs.publish, /github\.token/);
    assert.doesNotMatch(jobs.publish, /GITHUB_TOKEN/);
    assert.equal(
      stepUses(jobs.publish)[0]?.split("@")[0],
      "actions/checkout",
      `${file} publish must checkout first so JamesIves has a git directory`,
    );
    assert.match(jobs.publish, /persist-credentials:\s*false/);
  }
});

test("snapshot.yml passes the archive to gh via env, not interpolation", async () => {
  const yaml = await readFile(SNAPSHOT, "utf8");
  const jobs = jobBlocks(yaml);
  assert.match(
    jobs.publish,
    /ARCHIVE: \$\{\{ needs\.build\.outputs\.archive \}\}/,
  );
  assert.match(
    jobs.publish,
    /GH_TOKEN: \$\{\{ steps\.app-token\.outputs\.token \}\}/,
  );
  assert.match(
    jobs.publish,
    /GH_REPO: \$\{\{ github\.repository \}\}/,
  );
  assert.match(jobs.publish, /-R "\$GH_REPO"/);
  assert.match(jobs.publish, /sha256sum --check --strict "\$ARCHIVE\.sha256"/);
  assert.doesNotMatch(jobs.publish, /steps\.pkg\.outputs\.archive/);
});

test("release.yml splits prepare from publish and never embeds the token in origin", async () => {
  const yaml = await readFile(RELEASE, "utf8");
  const header = yaml.split(/\njobs:\n/)[0] ?? "";
  assert.match(yaml, /^  contents: read/m);
  assert.doesNotMatch(header, /id-token:/);
  const jobs = jobBlocks(yaml);
  assert.match(jobs.prepare, /pnpm install/);
  assert.doesNotMatch(jobs.prepare, /create-github-app-token/);
  assert.doesNotMatch(jobs.prepare, /RELEASE_APP_PRIVATE_KEY/);
  assert.doesNotMatch(jobs.prepare, /id-token:/);
  assert.match(jobs.publish, /create-github-app-token/);
  assert.match(jobs.publish, /id-token: write/);
  assert.doesNotMatch(jobs.publish, /pnpm install/);
  assert.doesNotMatch(jobs.publish, /pnpm (validate|test|build|release)/);
  assert.doesNotMatch(yaml, /x-access-token:\$\{/);
  assert.match(
    yaml,
    /http\.https:\/\/github\.com\/\.extraheader=AUTHORIZATION: basic/,
  );
  assert.match(yaml, /::add-mask::/);
  assert.match(jobs.publish, /GH_TOKEN: \$\{\{ steps\.app-token\.outputs\.token \}\}/);
  assert.doesNotMatch(jobs.publish, /GITHUB_TOKEN: \$\{\{ steps\.app-token/);
  assert.doesNotMatch(jobs.publish, /github\.token/);
  assert.doesNotMatch(jobs.publish, /GH_API_TOKEN/);
  assert.match(
    jobs.publish,
    /git tag -a "\$\{VERSION\}" -m "v\$\{VERSION\}"/,
  );
  assert.doesNotMatch(jobs.publish, /git tag "\$\{VERSION\}"/);
  assert.match(jobs.publish, /"refs\/tags\/\$\{VERSION\}"/);
  assert.doesNotMatch(jobs.publish, /--follow-tags/);
  assert.match(
    jobs.publish,
    /gh release create "\$\{VERSION\}"/,
    "GitHub Release tag must match the unprefixed git tag",
  );
  assert.doesNotMatch(jobs.publish, /gh release create "v\$\{VERSION\}"/);
  assert.match(jobs.prepare, /echo "sha=\$\(git rev-parse HEAD\)"/);
  assert.match(
    jobs.publish,
    /ref: \$\{\{ needs\.prepare\.outputs\.sha \}\}/,
  );
  assert.doesNotMatch(jobs.publish, /git checkout -B main origin\/main/);
  assert.match(jobs.publish, /356768209\+singleton-release\[bot\]@users\.noreply\.github\.com/);
  const npmIdx = jobs.publish.indexOf("npm publish");
  const releaseIdx = jobs.publish.indexOf("gh release create");
  assert.ok(npmIdx >= 0 && releaseIdx > npmIdx, "npm publish before gh release create");
  assert.match(jobs.prepare, /awk '\/\^## \//);
});

test("release-it commits and pushes with --no-verify", () => {
  assert.ok(releaseIt.git.commitArgs.includes("--no-verify"));
  assert.ok(releaseIt.git.pushArgs.includes("--no-verify"));
  assert.ok(releaseIt.git.pushArgs.includes("--follow-tags"));
  assert.ok(releaseIt.git.pushArgs.includes("--atomic"));
  assert.equal(releaseIt.git.tagAnnotation, "v${version}");
});

test("every publish job has a checkout or GH_REPO", async () => {
  for (const file of [PAGES, SNAPSHOT, RELEASE]) {
    const yaml = await readFile(file, "utf8");
    const jobs = jobBlocks(yaml);
    const hasCheckout = /actions\/checkout@/.test(jobs.publish);
    const hasGhRepo = /GH_REPO: \$\{\{ github\.repository \}\}/.test(
      jobs.publish,
    );
    assert.ok(
      hasCheckout || hasGhRepo,
      `${file} publish needs actions/checkout or GH_REPO`,
    );
  }
});

test("curl globbing would break singleton-release[bot] lookups", () => {
  const globOn = spawnSync(
    "curl",
    ["--silent", "--show-error", "--head", "--max-time", "2", BOT_URL],
    { encoding: "utf8" },
  );
  assert.equal(globOn.status, 3, globOn.stderr);
  assert.match(globOn.stderr, /bad range|glob/i);

  const globOff = spawnSync(
    "curl",
    [
      "--globoff",
      "--silent",
      "--show-error",
      "--head",
      "--max-time",
      "2",
      BOT_URL,
    ],
    { encoding: "utf8" },
  );
  assert.notEqual(globOff.status, 3, globOff.stderr);
});
