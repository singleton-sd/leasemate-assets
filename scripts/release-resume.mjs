/**
 * Resume a release publish job after a successful git push.
 * Never force-replaces an existing tag.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * @typedef {{
 *   tagExists: boolean,
 *   objectType?: string,
 *   tagMessage?: string,
 *   commitMessage?: string,
 *   parentSha?: string,
 * }} TagInspection
 */

/**
 * @param {string} version
 * @param {string} prepareSha
 * @param {TagInspection} inspection
 * @returns {"create" | "resume"}
 */
export function planReleaseResume(version, prepareSha, inspection) {
  if (!inspection.tagExists) return "create";
  if (inspection.objectType !== "tag") {
    throw new Error(`existing tag ${version} is not annotated`);
  }
  if (inspection.tagMessage !== `v${version}`) {
    throw new Error(
      `existing tag ${version} annotation is ${JSON.stringify(inspection.tagMessage)}`,
    );
  }
  if (inspection.commitMessage !== `chore(release): v${version} [skip ci]`) {
    throw new Error(`existing tag ${version} does not point at the release commit`);
  }
  if (inspection.parentSha !== prepareSha) {
    throw new Error(
      `existing tag ${version} is not based on prepare SHA ${prepareSha}`,
    );
  }
  return "resume";
}

/**
 * @param {boolean} versionExists
 * @returns {"publish" | "skip"}
 */
export function planNpmPublish(versionExists) {
  return versionExists ? "skip" : "publish";
}

/**
 * @param {boolean} releaseExists
 * @returns {"create" | "skip"}
 */
export function planGitHubRelease(releaseExists) {
  return releaseExists ? "skip" : "create";
}

/**
 * @param {string[]} args
 * @param {string} cwd
 * @returns {string}
 */
function git(args, cwd) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      (result.stderr || result.stdout || `git ${args.join(" ")} failed`).trim(),
    );
  }
  return (result.stdout ?? "").trim();
}

/**
 * @param {string} version
 * @param {string} [cwd]
 * @returns {TagInspection}
 */
export function inspectGitTag(version, cwd = process.cwd()) {
  const listed = spawnSync("git", ["tag", "-l", version], {
    cwd,
    encoding: "utf8",
  });
  if (listed.status !== 0 || listed.stdout.trim() !== version) {
    return { tagExists: false };
  }
  const objectType = git(["cat-file", "-t", version], cwd);
  const tagMessage = git(
    ["for-each-ref", "--format=%(contents:subject)", `refs/tags/${version}`],
    cwd,
  );
  const commitSha = git(["rev-parse", `${version}^{commit}`], cwd);
  const commitMessage = git(["log", "-1", "--format=%s", commitSha], cwd);
  const parentSha = git(["rev-parse", `${commitSha}^`], cwd);
  return {
    tagExists: true,
    objectType,
    tagMessage,
    commitMessage,
    parentSha,
  };
}

function usage() {
  console.error(
    "usage: node scripts/release-resume.mjs plan <version> <prepareSha>",
  );
}

/**
 * @param {string[]} argv
 * @param {string} [cwd]
 */
export function runCli(argv, cwd = process.cwd()) {
  const [, , cmd, version, prepareSha] = argv;
  switch (cmd) {
    case "plan": {
      if (!version || !prepareSha) {
        usage();
        throw new Error("plan requires <version> <prepareSha>");
      }
      const plan = planReleaseResume(
        version,
        prepareSha,
        inspectGitTag(version, cwd),
      );
      process.stdout.write(`${plan}\n`);
      return;
    }
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
