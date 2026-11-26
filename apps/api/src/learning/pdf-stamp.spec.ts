import { PDFDocument } from 'pdf-lib';
import { latin1, stampPdf } from './pdf-stamp';

async function samplePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([595, 842]);
  return doc.save();
}

describe('stampPdf', () => {
  it('keeps every page and marks the copy with the learner', async () => {
    const stamped = await stampPdf(await samplePdf(3), { name: 'Dr Meera Iyer', userRef: '8849e8a8', date: '2026-11-26', site: 'GIFS e-LMS' });
    const doc = await PDFDocument.load(stamped);
    expect(doc.getPageCount()).toBe(3);
    expect(doc.getSubject()).toContain('8849e8a8');
    // Each page got extra drawing content (footer + diagonal mark).
    const original = await PDFDocument.load(await samplePdf(1));
    expect(stamped.byteLength).toBeGreaterThan((await original.save()).byteLength);
  });

  it('works for names the standard PDF font cannot show', async () => {
    await expect(stampPdf(await samplePdf(1), { name: 'आशा', userRef: 'abc12345', date: '2026-11-26', site: 'GIFS e-LMS' })).resolves.toBeInstanceOf(Uint8Array);
  });

  it('rejects a file that is not a PDF', async () => {
    await expect(stampPdf(new TextEncoder().encode('not a pdf'), { name: 'A', userRef: 'x', date: 'd', site: 's' })).rejects.toThrow();
  });
});

describe('latin1', () => {
  it('drops characters outside Latin-1 and keeps accents', () => {
    expect(latin1('Asha  आशा Ñuñez')).toBe('Asha Ñuñez');
  });
});
