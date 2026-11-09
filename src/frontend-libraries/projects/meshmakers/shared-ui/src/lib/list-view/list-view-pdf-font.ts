import {pdf} from '@progress/kendo-drawing';

/** Font family the PDF export renders with (AB#8630); the list view's PDF styles name it first. */
export const PDF_EXPORT_FONT_FAMILY = 'DejaVu Sans';

let fontLoading: Promise<boolean> | null = null;

/**
 * Makes the PDF export embed DejaVu Sans (regular and bold, Latin subset) instead of the standard
 * PDF fonts, which have no glyphs for umlauts or ß (AB#8630).
 *
 * - The font data is a separate module loaded with a dynamic `import()` on the first PDF export,
 *   so it is not part of the start-up bundle.
 * - `pdf.defineFont` maps "DejaVu Sans" — and with it Kendo's `sans-serif`, `Arial` and
 *   `Helvetica` aliases — to the embedded TrueType files (blob URLs, no request to a server).
 * - The same bytes are registered as a document font (`FontFace`), so the browser lays out the
 *   export with the metrics of the font the PDF prints with.
 *
 * Runs once; later calls return the same promise. Resolves `false` (never rejects) when the font
 * cannot be loaded; the export then falls back to the standard fonts.
 */
export function loadPdfExportFont(): Promise<boolean> {
  fontLoading ??= import('./list-view-pdf-font-data')
    .then(async (data) => {
      const regular = base64ToBytes(data.DEJAVU_SANS_TTF_BASE64);
      const bold = base64ToBytes(data.DEJAVU_SANS_BOLD_TTF_BASE64);
      pdf.defineFont({
        [PDF_EXPORT_FONT_FAMILY]: fontUrl(regular),
        [`${PDF_EXPORT_FONT_FAMILY}|Bold`]: fontUrl(bold)
      });
      await registerDocumentFont(regular, 'normal');
      await registerDocumentFont(bold, 'bold');
      return true;
    })
    .catch((error: unknown) => {
      console.warn('[mm-list-view] PDF font could not be loaded; the PDF uses the standard fonts:', error);
      fontLoading = null;
      return false;
    });
  return fontLoading;
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Blob URL of a font file. Never revoked on purpose: Kendo keeps the URL in its font mapping and
 * reads it on every later PDF export of the page; the two URLs (about 70 KB) live as long as the page.
 */
function fontUrl(bytes: Uint8Array<ArrayBuffer>): string {
  return URL.createObjectURL(new Blob([bytes], {type: 'font/ttf'}));
}

async function registerDocumentFont(bytes: Uint8Array<ArrayBuffer>, weight: string): Promise<void> {
  if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) {
    return;
  }
  try {
    const face = new FontFace(PDF_EXPORT_FONT_FAMILY, bytes.buffer, {weight, style: 'normal'});
    document.fonts.add(await face.load());
  } catch {
    // Layout then uses the next font of the stack; the PDF still embeds DejaVu Sans.
  }
}
