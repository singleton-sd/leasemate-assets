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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = join(ROOT, ".github/workflows/pages.yml");
const SNAPSHOT = join(ROOT, ".github/workflows/snapshot.yml");
const RELEASE = join(ROOT, ".github/workflows/release.yml");

const BOT_URL = "https://example.invalid/users/singleton-release[bot]";

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
    /target-folder:\s+releases\/\$\{\{\s*steps\.pkg\.outputs\.version\s*\}\}/,
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

test("release.yml bot lookup disables curl globbing for [bot]", async () => {
  const yaml = await readFile(RELEASE, "utf8");
  assert.match(yaml, /curl[^\n]*--globoff/);
  assert.match(yaml, /\$\{APP_SLUG\}\[bot\]/);

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
