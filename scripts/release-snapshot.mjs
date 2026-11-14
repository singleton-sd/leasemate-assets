/**
 * Helpers for immutable /releases/<tag>/ snapshots (product-assets-recipe).
 * The Pages snapshot is published from `release: published`, not tag push:
 * the release commit message contains `[skip ci]`.
 */
import { fileURLToPath } from "node:url";

const TAG_RE = /^v?((0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*))$/;

/**
 * @param {string} tag
 * @returns {{ tag: string, raw: string }}
 */
export function parseReleaseTag(tag) {
  const raw = String(tag ?? "").trim();
  const match = raw.match(TAG_RE);
  if (!match) {
    throw new Error(`Unsupported release tag: ${tag}`);
  }
  return { tag: match[1], raw };
}

/**
 * @param {string} tag
 */
export function snapshotPath(tag) {
  return `releases/${parseReleaseTag(tag).tag}`;
}

/**
 * @param {string} assetId
 * @param {string} tag
 */
export function archiveNames(assetId, tag) {
  const { tag: version } = parseReleaseTag(tag);
  const archive = `${assetId}-assets-${version}.tar.gz`;
  return { archive, sha256: `${archive}.sha256` };
}

/**
 * Refuse to overwrite an existing gh-pages snapshot (HTTP 200 from Contents API).
 * @param {number} httpStatus
 * @param {string} tag
 */
export function assertSnapshotAbsent(httpStatus, tag) {
  const path = snapshotPath(tag);
  if (httpStatus === 200) {
    throw new Error(`Version snapshot already exists: ${path}`);
  }
  if (httpStatus !== 404) {
    throw new Error(`Unable to verify version snapshot (HTTP ${httpStatus}).`);
  }
}

function usage() {
  console.error(
    "usage: node scripts/release-snapshot.mjs parse <tag>\n" +
      "       node scripts/release-snapshot.mjs assert-absent <httpStatus> <tag>\n" +
      "       node scripts/release-snapshot.mjs archive-name <assetId> <tag>",
  );
}

/**
 * @param {string[]} argv
 */
export function runCli(argv) {
  const [, , cmd, ...rest] = argv;
  switch (cmd) {
    case "parse":
      process.stdout.write(`${parseReleaseTag(rest[0]).tag}\n`);
      return;
    case "assert-absent":
      assertSnapshotAbsent(Number(rest[0]), rest[1]);
      return;
    case "archive-name":
      process.stdout.write(`${archiveNames(rest[0], rest[1]).archive}\n`);
      return;
    default:
      usage();
      throw new Error(cmd ? `unknown command: ${cmd}` : "missing command");
  }
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  try {
    runCli(process.argv);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
