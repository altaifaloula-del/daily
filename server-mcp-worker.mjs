/* v53.9 — عامل معزول لحسابات موصل Claude (MCP).
 * يحمّل بيانات المنشأة ويشغّل محرك المحاسبة بحد ذاكرة مستقل (resourceLimits من الخادم):
 * إن نفدت الذاكرة أو علق الحساب يُنهى العامل وحده، ويبقى الخادم (الفوترة الإلكترونية والذكاء الاصطناعي) يعمل.
 * لا يكتب شيئًا: القراءة فقط بحساب الخدمة، والمقترحات تُحفظ في الخادم الرئيسي بعد عودة النتيجة. */
import { parentPort } from 'node:worker_threads';
import { saTokenSource } from './server-billing.js';
import { loadPlatformData, runTool, proposeTool } from './server-mcp.js';

let E = null; const cache = new Map(); const toks = new Map();
const TTL = 10 * 60000;   // التجهيز مكلف على المعالج البطيء — البيانات تُحدَّث كل 10 دقائق على الأكثر (data_as_of في الرد)

const getter = (t) => {
  if (!toks.has(t.id)) toks.set(t.id, saTokenSource(t.sa));
  return async (url) => {
    const r = await fetch(url, { headers: { authorization: 'Bearer ' + await toks.get(t.id)() } });
    const j = await r.json().catch(() => ({})); return { ok: r.ok, status: r.status, j };
  };
};
const dataOf = (t) => {
  const c = cache.get(t.id); if (c && c.exp > Date.now()) return c.p;
  cache.clear();   // منشأة واحدة في الذاكرة في كل مرة
  const base = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(t.dataProject || t.projectId) + '/databases/(default)/documents';
  const p = loadPlatformData(base, getter(t));
  cache.set(t.id, { p, exp: Date.now() + TTL }); p.catch(() => cache.delete(t.id)); return p;
};

parentPort.on('message', async ({ id, t, op, name, args }) => {
  try {
    if (!E) E = await import('./dist-engine/engine.mjs');
    const D = await dataOf(t);
    const result = op === 'propose' ? proposeTool(E, D, name, args) : runTool(E, D, name, args);
    parentPort.postMessage({ id, ok: true, result, ver: E.APP_VER || '' });
  } catch (e) {
    parentPort.postMessage({ id, ok: false, error: (e && e.message) || 'تعذّر التنفيذ', code: e && e.code });
  }
});
