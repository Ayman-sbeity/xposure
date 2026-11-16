// Image uploads and CSV export helpers.

export type ImageInfo = { mime: 'image/jpeg' | 'image/png' | 'image/webp'; ext: 'jpg' | 'png' | 'webp'; width: number; height: number };

/**
 * Identify an image from its bytes (never from the file name) and read its size.
 * Only JPEG, PNG and WebP are accepted: no SVG, which could carry scripts.
 */
export function inspectImage(buf: Buffer): ImageInfo | null {
  if (buf.length < 32) return null;
  // PNG
  if (buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(4) === 0x0d0a1a0a && buf.toString('ascii', 12, 16) === 'IHDR') {
    return { mime: 'image/png', ext: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // WebP
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buf.toString('ascii', 12, 16);
    if (chunk === 'VP8 ') return { mime: 'image/webp', ext: 'webp', width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const b = buf.subarray(21, 25);
      return { mime: 'image/webp', ext: 'webp', width: 1 + (((b[1] & 0x3f) << 8) | b[0]), height: 1 + (((b[3] & 0x0f) << 10) | (b[2] << 2) | ((b[1] & 0xc0) >> 6)) };
    }
    if (chunk === 'VP8X') return { mime: 'image/webp', ext: 'webp', width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    return null;
  }
  // JPEG: walk the segments to the frame header.
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = buf[i + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0xff) {
        i += marker === 0xff ? 1 : 2;
        continue;
      }
      const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isFrame) return { mime: 'image/jpeg', ext: 'jpg', height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

/**
 * CSV that opens correctly in Excel (UTF-8 with BOM, so Arabic shows properly) and cannot run
 * formulas: cells starting with = + - @ are prefixed with an apostrophe.
 */
export function toCsv(rows: Record<string, unknown>[], columns: [key: string, label: string][]): string {
  const cell = (value: unknown) => {
    let text = value === null || value === undefined ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [columns.map(([, label]) => cell(label)).join(','), ...rows.map((row) => columns.map(([key]) => cell(row[key])).join(','))];
  return `﻿${lines.join('\r\n')}\r\n`;
}
