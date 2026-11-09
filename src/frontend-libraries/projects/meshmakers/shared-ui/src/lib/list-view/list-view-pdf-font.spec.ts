import { DEJAVU_SANS_BOLD_TTF_BASE64, DEJAVU_SANS_TTF_BASE64 } from './list-view-pdf-font-data';
import { loadPdfExportFont } from './list-view-pdf-font';

function bytesOf(base64: string): DataView {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new DataView(bytes.buffer);
}

function tableOffset(font: DataView, tag: string): number | null {
  const tables = font.getUint16(4);
  for (let i = 0; i < tables; i++) {
    const record = 12 + i * 16;
    const name = String.fromCharCode(...[0, 1, 2, 3].map((k) => font.getUint8(record + k)));
    if (name === tag) {
      return font.getUint32(record + 8);
    }
  }
  return null;
}

/** Code points the font maps to a glyph other than .notdef (cmap format 4, Unicode BMP). */
function hasGlyph(font: DataView, codePoint: number): boolean {
  const cmap = tableOffset(font, 'cmap');
  if (cmap === null) {
    return false;
  }
  const count = font.getUint16(cmap + 2);
  for (let i = 0; i < count; i++) {
    const subtable = cmap + font.getUint32(cmap + 4 + i * 8 + 4);
    if (font.getUint16(subtable) !== 4) {
      continue;
    }
    const segments = font.getUint16(subtable + 6) / 2;
    const ends = subtable + 14;
    const starts = ends + segments * 2 + 2;
    const deltas = starts + segments * 2;
    const ranges = deltas + segments * 2;
    for (let s = 0; s < segments; s++) {
      const end = font.getUint16(ends + s * 2);
      const start = font.getUint16(starts + s * 2);
      if (codePoint < start || codePoint > end) {
        continue;
      }
      const delta = font.getInt16(deltas + s * 2);
      const range = font.getUint16(ranges + s * 2);
      if (range === 0) {
        return ((codePoint + delta) & 0xffff) !== 0;
      }
      const glyph = font.getUint16(ranges + s * 2 + range + (codePoint - start) * 2);
      return glyph !== 0;
    }
  }
  return false;
}

describe('PDF export font (AB#8630)', () => {
  const required = 'AaZz09 ÄÖÜäöüß àáâãåçèéêëìíîïñòóôõøùúûýÿ ČčŠšŽžŁłŐőŰű €°µ²³–—„“”‚‘’…•×÷';

  for (const [name, base64] of [['DejaVu Sans', DEJAVU_SANS_TTF_BASE64], ['DejaVu Sans Bold', DEJAVU_SANS_BOLD_TTF_BASE64]]) {
    it(`${name} is a TrueType font with glyphs for umlauts, ß and common Latin characters`, () => {
      const font = bytesOf(base64);
      expect(font.getUint32(0)).toBe(0x00010000);
      for (const tag of ['cmap', 'glyf', 'loca', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'post']) {
        expect(tableOffset(font, tag), tag).not.toBeNull();
      }
      const missing = [...required].filter((ch) => ch !== ' ' && !hasGlyph(font, ch.codePointAt(0) ?? 0));
      expect(missing).toEqual([]);
    });
  }

  it('loads the font once and hands Kendo a TrueType URL per weight', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL');

    const first = loadPdfExportFont();
    const second = loadPdfExportFont();

    expect(second).toBe(first);
    await expect(first).resolves.toBe(true);
    const blobs = createObjectURL.mock.calls.map(([blob]) => blob as Blob);
    expect(blobs.map((blob) => blob.type)).toEqual(['font/ttf', 'font/ttf']);
    expect(blobs.map((blob) => blob.size)).toEqual([
      bytesOf(DEJAVU_SANS_TTF_BASE64).byteLength,
      bytesOf(DEJAVU_SANS_BOLD_TTF_BASE64).byteLength
    ]);
  });
});
