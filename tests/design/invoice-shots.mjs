// v56.0 — لقطة الفاتورة المطبوعة فعليًا (PNG + PDF من Chromium) بقوالب المنشأة الثلاثة وبلون فرع.
import { chromium } from 'playwright'; import fs from 'node:fs'; import path from 'node:path';
import { buildEngine } from '../build-engine.mjs';
const out = path.resolve(process.argv[2] || 'invoices'); fs.mkdirSync(out, { recursive: true });
const E = await buildEngine();
const logo = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60"><circle cx="30" cy="30" r="28" fill="#0B6E4F"/><path d="M18 38 L30 16 L42 38 Z" fill="#F2C14E"/></svg>').toString('base64');
const org = { company: { name: 'مطاعم الواحة', taxNumber: '300000000000003', commercialReg: '1010123456', address: 'الرياض — حي العليا' },
  branches: [{ id: 'b1', name: 'العليا' }, { id: 'b2', name: 'النخيل', brandColor: '#8A1C3B' }],
  branding: { nameAr: 'مطاعم الواحة', nameEn: 'Oasis Restaurants', logo, colors: { primary: '#0B6E4F', accent: '#C08A2E', heading: '#073B2A', text: '#1A1A1A' }, phone: '0112345678', footer: 'مطاعم الواحة — شكرًا لزيارتكم' } };
const inv = (x) => ({ id: 'si1', kind: 'invoice', type: 'standard', no: 'INV-2026-00041', date: '2026-04-02', time: '13:20', branchId: 'b1', icv: 41, hash: 'b'.repeat(64),
  buyer: { name: 'شركة النور للتموين', vat: '311111111111113', address: 'جدة' },
  lines: [{ desc: 'وجبة كبسة لحم', qty: 10, price: 45, net: 450, vatRate: 15, vat: 67.5 }, { desc: 'مشروبات', qty: 10, price: 8, net: 80, vatRate: 15, vat: 12 }],
  net: 530, vat: 79.5, total: 609.5, ...x });
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 900, height: 1100 } });
for (const [name, o, x] of [['classic', 'classic', {}], ['modern', 'modern', {}], ['compact', 'compact', {}], ['modern-branch-b2', 'modern', { branchId: 'b2' }]]) {
  const html = E.salesInvoiceHtml({ ...org, branding: { ...org.branding, invoiceTpl: o } }, inv(x));
  await p.setContent(html); await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(out, 'invoice-' + name + '.png'), fullPage: true });
  await p.emulateMedia({ media: 'print' }); fs.writeFileSync(path.join(out, 'invoice-' + name + '.pdf'), await p.pdf({ format: 'A4', printBackground: true })); await p.emulateMedia({ media: 'screen' });
}
await b.close(); console.log('ok', fs.readdirSync(out).join(' '));
