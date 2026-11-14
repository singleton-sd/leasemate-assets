import assert from "node:assert/strict";
import { test } from "node:test";
import {
  archiveNames,
  assertSnapshotAbsent,
  parseReleaseTag,
  snapshotPath,
} from "./release-snapshot.mjs";

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
