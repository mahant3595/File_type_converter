const results = {};
async function t(name, fn) {
  try { await fn(); results[name] = 'OK'; }
  catch (e) { results[name] = 'FAIL: ' + String(e).split('\n')[0].slice(0, 200); }
}
await t('ffmpeg', async () => {
  const { default: ff } = await import('ffmpeg-static');
  const { execFileSync } = await import('node:child_process');
  const out = execFileSync(ff, ['-version'], { encoding: 'utf8' });
  if (!out.includes('ffmpeg version')) throw new Error('bad version output');
});
await t('sharp-create+convert', async () => {
  const { default: sharp } = await import('sharp');
  const png = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#ff0000' } }).png().toBuffer();
  const jpg = await sharp(png).jpeg({ quality: 80 }).toBuffer();
  const meta = await sharp(jpg).metadata();
  if (meta.format !== 'jpeg' || meta.width !== 64) throw new Error('meta mismatch ' + meta.format);
  const webp = await sharp(png).webp().toBuffer();
  if ((await sharp(webp).metadata()).format !== 'webp') throw new Error('webp fail');
});
await t('sharp-formats', async () => {
  const { default: sharp } = await import('sharp');
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#00ff00' } }).png().toBuffer();
  for (const [name, fn] of [['tiff', s=>s.tiff()], ['gif', s=>s.gif()], ['avif', s=>s.avif()], ['heif', s=>s.heif({compression:'av1'})]]) {
    const out = await fn(sharp(png)) .toBuffer();
    if (!out.length) throw new Error(name + ' empty');
  }
  // svg input
  const svgBuf = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="blue"/></svg>');
  const fromSvg = await sharp(svgBuf).png().toBuffer();
  if ((await sharp(fromSvg).metadata()).width !== 10) throw new Error('svg input fail');
});
await t('canvas', async () => {
  const { createCanvas } = await import('canvas');
  const c = createCanvas(10, 10); const ctx = c.getContext('2d');
  ctx.fillStyle = '#123456'; ctx.fillRect(0,0,10,10);
  const buf = c.toBuffer('image/png'); if (!buf.length) throw new Error('empty');
});
await t('pdf-lib', async () => {
  const { PDFDocument } = await import('pdf-lib');
  const d = await PDFDocument.create(); d.addPage([200, 100]);
  const bytes = await d.save(); if (bytes.length < 100) throw new Error('tiny');
  const d2 = await PDFDocument.load(bytes); if (d2.getPageCount() !== 1) throw new Error('load fail');
});
await t('pdfjs-dist-render-via-canvas', async () => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { PDFDocument } = await import('pdf-lib');
  const d = await PDFDocument.create(); const p = d.addPage([300, 200]);
  p.drawText('Hello Nexora', { x: 20, y: 100, size: 18 });
  const pdfBytes = await d.save();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBytes), useSystemFonts: true }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 1.5 });
  const { createCanvas } = await import('canvas');
  const cvs = createCanvas(viewport.width, viewport.height);
  await page.render({ canvasContext: cvs.getContext('2d'), viewport }).promise;
  const png = cvs.toBuffer('image/png');
  const { default: sharp } = await import('sharp');
  const meta = await sharp(png).metadata();
  if (meta.width !== Math.floor(viewport.width)) throw new Error('render size mismatch');
  const text = (await page.getTextContent()).items.map(i => i.str).join(' ');
  if (!text.includes('Hello')) throw new Error('text extraction failed: ' + text);
});
await t('mammoth+docx', async () => {
  const { Document, Packer, Paragraph } = await import('docx');
  const doc = new Document({ sections: [{ children: [new Paragraph("Hello world from NEXORA")] }] });
  const buf = await Packer.toBuffer(doc);
  const mammoth = await import('mammoth');
  const { value } = await mammoth.extractRawText({ buffer: buf });
  if (!value.includes('Hello world')) throw new Error('mammoth read fail: ' + value);
});
await t('xlsx', async () => {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet([['name','qty'],['widget',5]]);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Data');
  const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const back = XLSX.read(out); const rows = XLSX.utils.sheet_to_json(back.Sheets['Data']);
  if (rows[0].qty !== 5) throw new Error('roundtrip fail ' + JSON.stringify(rows));
  // csv roundtrip
  const csv = XLSX.utils.sheet_to_csv(ws);
  const wb2 = XLSX.read(csv, { type: 'string' });
  if (XLSX.utils.sheet_to_json(wb2.Sheets.Sheet1).length !== 1) throw new Error('csv read fail');
});
await t('adm-zip+tar', async () => {
  const { default: AdmZip } = await import('adm-zip');
  const z = new AdmZip(); z.addFile('a/hello.txt', Buffer.from('hi there'));
  const zb = z.toBuffer();
  const z2 = new AdmZip(zb); const e = z2.getEntries()[0];
  if (e.getData().toString() !== 'hi there') throw new Error('zip roundtrip fail');
  const tar = await import('tar');
  if (typeof tar.create !== 'function') throw new Error('tar api');
});
await t('file-type', async () => {
  const { fileTypeFromBuffer } = await import('file-type');
  const { default: sharp } = await import('sharp');
  const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#fff' } }).png().toBuffer();
  const ft = await fileTypeFromBuffer(png);
  if (ft.ext !== 'png') throw new Error('got ' + JSON.stringify(ft));
});
await t('client-zip', async () => {
  const { makeZip, downloadZip } = await import('client-zip');
  if (typeof makeZip !== 'function' || typeof downloadZip !== 'function') throw new Error('no zip api');
});
console.log(JSON.stringify(results, null, 2));
const failed = Object.entries(results).filter(([,v]) => v !== 'OK');
process.exit(failed.length ? 1 : 0);
