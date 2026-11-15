/**
 * Pull a named `run: |` script out of a GitHub Actions workflow.
 * @param {string} yaml
 * @param {string} stepName
 */
export function extractWorkflowStepRun(yaml, stepName) {
  const lines = yaml.split("\n");
  const start = lines.findIndex((line) =>
    new RegExp(`^\\s+- name:\\s+${escapeRegExp(stepName)}\\s*$`).test(line),
  );
  if (start < 0) throw new Error(`missing step ${stepName}`);
  const stepIndent = lines[start].search(/\S/);
  let runAt = -1;
  for (let i = start + 1; i < lines.length; i++) {
    if (new RegExp(`^ {${stepIndent}}- `).test(lines[i])) break;
    if (/^\s+run:\s*\|\s*$/.test(lines[i])) {
      runAt = i;
      break;
    }
  }
  if (runAt < 0) throw new Error(`missing run | block for ${stepName}`);
  const runIndent = lines[runAt].search(/\S/);
  /** @type {string[]} */
  const content = [];
  let base = null;
  for (let i = runAt + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") {
      if (base !== null) content.push("");
      continue;
    }
    const indent = line.search(/\S/);
    if (indent <= runIndent) break;
    if (base === null) base = indent;
    content.push(line.slice(base));
  }
  return `${content.join("\n")}\n`;
}

/**
 * @param {string} value
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
