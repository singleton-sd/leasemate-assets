import assert from "node:assert/strict";
import { test } from "node:test";
import { selectApprovedOrGenerated } from "./build.mjs";
import { pngSize } from "./png-size.mjs";

/** 1×1 opaque black PNG */
const PNG_1X1 = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a4944415478da63000000020001e221bc330000000049454e44ae426082",
  "hex",
);

test("pngSize reads IHDR dimensions", () => {
  assert.deepEqual(pngSize(PNG_1X1), { width: 1, height: 1 });
});

test("selectApprovedOrGenerated rejects a wrong-size approved PNG", () => {
  const generated = Buffer.from("generated-placeholder");
  assert.throws(
    () =>
      selectApprovedOrGenerated({
        generated,
        approved: PNG_1X1,
        width: 840,
        height: 240,
        file: "leasemate-lockup-dark.png",
      }),
    /approved PNG is 1×1, expected 840×240/,
  );
});

test("selectApprovedOrGenerated keeps a matching approved PNG", () => {
  const generated = Buffer.from("generated-different");
  const { out, source } = selectApprovedOrGenerated({
    generated,
    approved: PNG_1X1,
    width: 1,
    height: 1,
    file: "tiny.png",
  });
  assert.equal(source, "approved");
  assert.equal(out, PNG_1X1);
});
