import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  archiveNames,
  assertSnapshotAbsent,
  parseReleaseTag,
  snapshotPath,
} from "./release-snapshot.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "release-snapshot.mjs");

/**
 * @param {string[]} args
 */
function runCliProcess(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
}

test("parseReleaseTag accepts unprefixed and v-prefixed stable tags", () => {
  assert.deepEqual(parseReleaseTag("0.1.0"), { tag: "0.1.0", raw: "0.1.0" });
  assert.deepEqual(parseReleaseTag("v1.2.3"), { tag: "1.2.3", raw: "v1.2.3" });
});

test("parseReleaseTag rejects non-stable tags", () => {
  assert.throws(() => parseReleaseTag("main"), /Unsupported release tag/);
  assert.throws(() => parseReleaseTag("1.2.3-rc.1"), /Unsupported release tag/);
  assert.throws(() => parseReleaseTag(""), /Unsupported release tag/);
});

test("snapshotPath is releases/<unprefixed-tag>/", () => {
  assert.equal(snapshotPath("v0.1.0"), "releases/0.1.0");
  assert.equal(snapshotPath("0.1.0"), "releases/0.1.0");
});

test("assertSnapshotAbsent refuses HTTP 200", () => {
  assert.throws(
    () => assertSnapshotAbsent(200, "0.1.0"),
    /Version snapshot already exists: releases\/0.1.0/,
  );
});

test("assertSnapshotAbsent accepts HTTP 404", () => {
  assert.doesNotThrow(() => assertSnapshotAbsent(404, "0.1.0"));
});

test("assertSnapshotAbsent fails closed on unexpected status", () => {
  assert.throws(
    () => assertSnapshotAbsent(500, "0.1.0"),
    /Unable to verify version snapshot \(HTTP 500\)/,
  );
});

test("archiveNames uses product id and unprefixed tag", () => {
  assert.deepEqual(archiveNames("leasemate", "v0.1.0"), {
    archive: "leasemate-assets-0.1.0.tar.gz",
    sha256: "leasemate-assets-0.1.0.tar.gz.sha256",
  });
});

test("CLI parse writes the unprefixed version", () => {
  const result = runCliProcess(["parse", "v1.2.3"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "1.2.3\n");
});

test("CLI parse rejects invalid tags", () => {
  const result = runCliProcess(["parse", "1.2.3-rc.1"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unsupported release tag/);
});

test("CLI assert-absent exits 0 for HTTP 404", () => {
  const result = runCliProcess(["assert-absent", "404", "0.1.0"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "");
});

test("CLI assert-absent exits 1 when the snapshot already exists", () => {
  const result = runCliProcess(["assert-absent", "200", "0.1.0"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Version snapshot already exists: releases\/0.1.0/);
});

test("CLI archive-name writes the tarball filename", () => {
  const result = runCliProcess(["archive-name", "leasemate", "v0.1.0"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "leasemate-assets-0.1.0.tar.gz\n");
});

test("CLI unknown command exits 1", () => {
  const result = runCliProcess(["nope"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unknown command: nope/);
});

test("CLI missing command exits 1", () => {
  const result = runCliProcess([]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /missing command/);
});
