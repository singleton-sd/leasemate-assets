import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { syncLegacySvg } from "./sync-legacy-svg.mjs";

const MAP = [["src/from.svg", "svg/to.svg"]];

async function withFixture(run) {
  const root = await mkdtemp(join(tmpdir(), "leasemate-sync-"));
  await mkdir(join(root, "src"), { recursive: true });
  await mkdir(join(root, "svg"), { recursive: true });
  await writeFile(join(root, "src/from.svg"), "<svg>master</svg>\n");
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("checkOnly reports missing destinations without writing", async () => {
  await withFixture(async (root) => {
    const mismatches = await syncLegacySvg({
      checkOnly: true,
      root,
      map: MAP,
    });
    assert.deepEqual(mismatches, ["svg/to.svg"]);
    await assert.rejects(readFile(join(root, "svg/to.svg")));
  });
});

test("checkOnly reports stale destinations without writing", async () => {
  await withFixture(async (root) => {
    await writeFile(join(root, "svg/to.svg"), "<svg>stale</svg>\n");
    const mismatches = await syncLegacySvg({
      checkOnly: true,
      root,
      map: MAP,
    });
    assert.deepEqual(mismatches, ["svg/to.svg"]);
    assert.equal(await readFile(join(root, "svg/to.svg"), "utf8"), "<svg>stale</svg>\n");
  });
});

test("write mode creates and repairs byte-identical copies", async () => {
  await withFixture(async (root) => {
    const created = await syncLegacySvg({ root, map: MAP });
    assert.deepEqual(created, []);
    assert.equal(
      await readFile(join(root, "svg/to.svg"), "utf8"),
      "<svg>master</svg>\n",
    );

    await writeFile(join(root, "svg/to.svg"), "<svg>stale</svg>\n");
    const repaired = await syncLegacySvg({ root, map: MAP });
    assert.deepEqual(repaired, []);
    assert.equal(
      await readFile(join(root, "svg/to.svg"), "utf8"),
      "<svg>master</svg>\n",
    );
  });
});
