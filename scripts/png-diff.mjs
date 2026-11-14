import sharp from "sharp";

/**
 * Pixel-compare two PNG buffers after decoding to 8-bit RGBA.
 * A pixel counts as different when any RGB channel exceeds `channelThreshold`.
 *
 * @param {Buffer} a
 * @param {Buffer} b
 * @param {{ channelThreshold?: number }} [opts]
 * @returns {Promise<{ width: number, height: number, pixels: number, differing: number, percent: number, meanAbs: number }>}
 */
export async function diffPngBuffers(a, b, { channelThreshold = 16 } = {}) {
  const [left, right] = await Promise.all([
    sharp(a).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  if (
    left.info.width !== right.info.width ||
    left.info.height !== right.info.height
  ) {
    throw new Error(
      `size mismatch: ${left.info.width}×${left.info.height} vs ${right.info.width}×${right.info.height}`,
    );
  }
  const { width, height, channels } = left.info;
  const da = left.data;
  const db = right.data;
  if (da.length !== db.length) {
    throw new Error("decoded buffer length mismatch");
  }
  const pixels = width * height;
  let differing = 0;
  let sumAbs = 0;
  for (let i = 0; i < da.length; i += channels) {
    let maxCh = 0;
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(da[i + c] - db[i + c]);
      sumAbs += d;
      if (d > maxCh) maxCh = d;
    }
    if (maxCh > channelThreshold) differing += 1;
  }
  return {
    width,
    height,
    pixels,
    differing,
    percent: (differing / pixels) * 100,
    meanAbs: sumAbs / (pixels * 3),
  };
}

/**
 * @param {{ percent: number, meanAbs: number, file?: string }} diff
 * @param {{ maxPercent: number, maxMeanAbs: number }} limits
 */
export function assertPngWithinTolerance(diff, { maxPercent, maxMeanAbs }) {
  if (diff.percent > maxPercent || diff.meanAbs > maxMeanAbs) {
    const label = diff.file ? `${diff.file}: ` : "";
    throw new Error(
      `${label}pixel diff ${diff.percent.toFixed(2)}% (mean ${diff.meanAbs.toFixed(2)}) exceeds ${maxPercent}% / mean ${maxMeanAbs}`,
    );
  }
}
