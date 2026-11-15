/**
 * GitHub Actions concurrency pending-run policy for the shared
 * `pages-publish` group (pages.yml + snapshot.yml).
 *
 * Default `queue: single` keeps one pending run and replaces it when another
 * arrives. `queue: max` retains pending runs (up to 100) so a snapshot is
 * not dropped while Pages is in progress.
 */

/** @typedef {"single" | "max"} ConcurrencyQueue */

/**
 * @param {string} raw
 * @returns {ConcurrencyQueue}
 */
function parseQueue(raw) {
  switch (raw) {
    case "single":
    case "max":
      return raw;
    default:
      throw new Error(`unsupported concurrency.queue: ${raw}`);
  }
}

/**
 * @param {string} yaml
 * @returns {{ group: string, queue: ConcurrencyQueue, cancelInProgress: boolean }}
 */
export function parseWorkflowConcurrency(yaml) {
  const block = yaml.match(/^concurrency:\n((?:[ \t]+.+\n)+)/m);
  if (!block) throw new Error("workflow is missing a concurrency block");
  const body = block[1]
    .split("\n")
    .filter((line) => !/^[ \t]*#/.test(line))
    .join("\n");
  const group = body.match(/^[ \t]*group:\s+(\S+)\s*$/m)?.[1];
  if (!group) throw new Error("concurrency.group is missing");
  const queueRaw = body.match(/^[ \t]*queue:\s+(\S+)\s*$/m)?.[1] ?? "single";
  return {
    group,
    queue: parseQueue(queueRaw),
    cancelInProgress: /^[ \t]*cancel-in-progress:\s*true\s*$/m.test(body),
  };
}

/**
 * Pending runs after `arrivals` join a group that already has `inProgress`.
 *
 * @param {{ queue: ConcurrencyQueue }} policy
 * @param {string} inProgress
 * @param {string[]} arrivals
 * @returns {string[]}
 */
export function pendingRuns(policy, inProgress, arrivals) {
  void inProgress;
  switch (policy.queue) {
    case "single":
      return arrivals.length ? [arrivals[arrivals.length - 1]] : [];
    case "max":
      return [...arrivals];
    default: {
      const _never = /** @type {never} */ (policy.queue);
      throw new Error(`unsupported concurrency queue: ${_never}`);
    }
  }
}
