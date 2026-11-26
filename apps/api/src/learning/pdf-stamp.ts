import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * The standard PDF fonts only cover Latin-1, so other characters (e.g. Devanagari names)
 * are replaced rather than failing the download; the user ID always identifies the copy.
 */
export function latin1(text: string): string {
  return text.normalize('NFC').replace(/[^\x20-\x7E\xA0-\xFF]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Forensic stamp for a downloaded lesson PDF: a footer line on every page and a faint
 * diagonal mark across it, both naming the learner. Not removable by just printing,
 * and a leaked copy shows whose it was.
 */
export async function stampPdf(bytes: Uint8Array, stamp: { name: string; userRef: string; date: string; site: string }): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const name = latin1(stamp.name);
  const footer = latin1(`${stamp.site} · Downloaded by ${name ? `${name} · ` : ''}ID ${stamp.userRef} · ${stamp.date} · For personal study only`);
  const mark = latin1(`${name || 'ID'} ${stamp.userRef}`);

  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    const footerSize = Math.max(6, Math.min(8, width / 80));
    page.drawText(footer, {
      x: 18,
      y: 10,
      size: footerSize,
      font,
      color: rgb(0.35, 0.3, 0.42),
      maxWidth: width - 36,
    });
    const markSize = Math.max(18, Math.min(42, width / 14));
    const markWidth = font.widthOfTextAtSize(mark, markSize);
    // Centre the rotated line on the page.
    const angle = Math.atan2(height, width);
    page.drawText(mark, {
      x: width / 2 - (Math.cos(angle) * markWidth) / 2,
      y: height / 2 - (Math.sin(angle) * markWidth) / 2,
      size: markSize,
      font,
      color: rgb(0.42, 0.32, 0.64),
      opacity: 0.12,
      rotate: degrees((angle * 180) / Math.PI),
    });
  }
  doc.setProducer('GIFS e-LMS');
  doc.setSubject(`Licensed copy for user ${stamp.userRef}`);
  return doc.save();
}
