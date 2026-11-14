const IEND = Buffer.from([
  0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

/**
 * Read width/height from a PNG IHDR chunk (no decoder dependency).
 * @param {Buffer} buf
 * @returns {{ width: number, height: number }}
 */
export function pngSize(buf) {
  if (
    buf.length < 24 ||
    buf[0] !== 0x89 ||
    buf.toString("ascii", 1, 4) !== "PNG"
  ) {
    throw new Error("not a PNG");
  }
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

/** True when the buffer has a PNG signature, IDAT, and a trailing IEND. */
export function isCompletePng(buf) {
  try {
    pngSize(buf);
  } catch {
    return false;
  }
  if (!buf.includes(Buffer.from("IDAT"))) return false;
  if (buf.length < IEND.length) return false;
  return buf.subarray(-IEND.length).equals(IEND);
}
