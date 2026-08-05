/**
 * خادم المنصة — Express
 *  • /api/store/:key   تخزين مشترك يقرأ ويكتب في data/store.json
 *  • /api/ai/analyze   وسيط آمن لتحليل المدير المالي الذكي (المفتاح لا يصل المتصفح)
 *  • يخدم ملفات dist في وضع الإنتاج
 */
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8787;
const DATA_DIR = path.join(__dirname, 'data');
const STORE = path.join(DATA_DIR, 'store.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(STORE)) fs.writeFileSync(STORE, '{}');

const readStore = () => { try { return JSON.parse(fs.readFileSync(STORE, 'utf8')); } catch { return {}; } };
let writing = Promise.resolve();
const writeStore = (obj) => {
  writing = writing.then(() => fs.promises.writeFile(STORE, JSON.stringify(obj)));
  return writing;
};

const app = express();
app.use(express.json({ limit: '25mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, at: new Date().toISOString() }));

app.get('/api/store/:key', (req, res) => {
  const store = readStore();
  res.json({ key: req.params.key, value: store[req.params.key] ?? null });
});

app.put('/api/store/:key', async (req, res) => {
  const store = readStore();
  store[req.params.key] = req.body?.value ?? null;
  await writeStore(store);
  res.json({ ok: true, key: req.params.key });
});

app.delete('/api/store/:key', async (req, res) => {
  const store = readStore();
  delete store[req.params.key];
  await writeStore(store);
  res.json({ ok: true });
});

/* ---- المدير المالي الذكي ---- */
app.post('/api/ai/analyze', async (req, res) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(501).json({ error: 'ANTHROPIC_API_KEY غير مضبوط في ملف .env' });
  const digest = req.body?.digest;
  if (!digest) return res.status(400).json({ error: 'لا توجد بيانات للتحليل' });

  const prompt = `أنت مدير مالي (CFO) لمجموعة مطاعم سعودية. حلّل البيانات التالية وأجب بالعربية الفصحى المهنية.

البيانات: ${JSON.stringify(digest)}

أعد كائن JSON فقط دون أي نص أو علامات markdown، بهذا الشكل تماماً:
{
 "الملخص_التنفيذي": "فقرة من 3 جمل عن الوضع المالي العام",
 "اتجاهات_المبيعات_والمصروفات": "فقرة تحليلية",
 "توصيات_خفض_التكلفة": ["توصية عملية 1","توصية 2","توصية 3"],
 "مخاطر_النقدية": ["مخاطرة 1","مخاطرة 2"],
 "تقييم_الفروع": [{"الفرع":"الاسم","الدرجة":85,"الحالة":"ممتاز","التعليق":"جملة واحدة"}]
}
الحالة يجب أن تكون واحدة من: ممتاز، جيد جداً، متوسط، تحت الملاحظة.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'claude-sonnet-4-5',
        max_tokens: 1400,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: data?.error?.message || 'فشل الاتصال بمزود الذكاء الاصطناعي' });
    const txt = (data.content || []).filter(x => x.type === 'text').map(x => x.text).join('\n');
    const clean = txt.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean.slice(clean.indexOf('{'), clean.lastIndexOf('}') + 1));
    res.json({ result });
  } catch (e) {
    res.status(500).json({ error: 'تعذّر تحليل الاستجابة: ' + e.message });
  }
});

/* ---- ملفات الإنتاج ---- */
const dist = path.join(__dirname, 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(PORT, () => console.log(`✅ خادم المنصة يعمل على http://localhost:${PORT}`));
