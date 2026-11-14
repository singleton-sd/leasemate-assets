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
