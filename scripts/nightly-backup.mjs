// v41.8 — النسخ الاحتياطي الليلي خارج الأجهزة (يُشغَّل من GitHub Actions بحساب الخدمة الموجود FIREBASE_SERVICE_ACCOUNT)
// يقرأ كل مجموعات Firestore عبر REST (قراءة فقط) ⇒ يعيد تجميع المستندات المقسّمة ⇒ يفحص النسخة المنطقية بمحرك المنصة
// (توازن الدفاتر) ⇒ يشفّرها بـ BACKUP_KEY ⇒ ملف .enc يُحفظ أداةً في Actions. أي خلل ⇒ خروج بخطأ (تنبيه بالبريد من GitHub).
import fs from 'node:fs';
import path from 'node:path';
import { GoogleAuth } from 'google-auth-library';
import { decodeFields, assemble, composeLogical, encrypt, decrypt } from './backup-lib.mjs';
import { buildEngine } from '../tests/build-engine.mjs';

const pid = process.env.PROJECT_ID, pass = process.env.BACKUP_KEY, outDir = process.env.OUT_DIR || 'backup';
if (!pid) { console.error('::error::معرّف المشروع غير مضبوط (VITE_FIREBASE_PROJECT_ID)'); process.exit(1); }
if (!pass || pass.length < 12) { console.error('::error::أضف سرّ المستودع BACKUP_KEY (12 حرفًا على الأقل) من GitHub ← Settings ← Secrets — بدونه لا تُحفظ نسخة غير مشفّرة'); process.exit(1); }

const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/datastore'] });
const client = await auth.getClient();
const root = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(pid)}/databases/(default)/documents`;
const fail = (e, what) => { const st = e?.response?.status; console.error('::error::' + what + ' (' + (st || '?') + '): ' + JSON.stringify(e?.response?.data?.error?.message || e?.message || e));
  if (st === 403) console.error('امنح حساب الخدمة دور «Cloud Datastore Viewer» (قراءة فقط) من Google Cloud ← IAM.'); process.exit(1); };

const cols = (await client.request({ url: root + ':listCollectionIds', method: 'POST', data: { pageSize: 300 } }).catch(e => fail(e, 'تعذّرت قراءة المجموعات'))).data.collectionIds || [];
const all = {};
for (const c of cols) {
  all[c] = {}; let token = '';
  do {
    const r = await client.request({ url: root + '/' + encodeURIComponent(c) + '?pageSize=300' + (token ? '&pageToken=' + encodeURIComponent(token) : '') }).catch(e => fail(e, 'تعذّرت قراءة ' + c));
    (r.data.documents || []).forEach(d => { all[c][d.name.split('/').pop()] = decodeFields(d.fields || {}); });
    token = r.data.nextPageToken || '';
  } while (token);
}
const plat = all.platform || {};
const A = assemble(plat);
if (A.errors.length) { console.error('::error::مستندات تالفة: ' + A.errors.map(e => e.id + ' — ' + e.err).join('، ')); process.exit(1); }
const logical = composeLogical(A.values, { collections: Object.fromEntries(Object.entries(all).map(([k, v]) => [k, Object.keys(v).length])) });
const E = await buildEngine(); const V = E.verifyBackup(logical);
if (!V.ok) { console.error('::error::النسخة لم تجتز الفحص: ' + V.err); process.exit(1); }
if (!V.balanced) { console.error('::error::الدفاتر في النسخة غير متوازنة — راجع «صيانة النظام» فورًا'); process.exit(1); }

const day = new Date().toISOString().slice(0, 10);
const { platform: _p, ...others } = all;   // الأجزاء الخام مجمّعة في platform (لا تكرار للحجم)
const payload = Buffer.from(JSON.stringify({ logical, platform: A.values, raw: others }), 'utf8');
const enc = encrypt(payload, pass);
if (decrypt(enc, pass).length !== payload.length) { console.error('::error::تعذّر التحقق من فك التشفير'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });
// v51.2 (S3): نسخة كل منشأة باسمها؛ الطيف باسمه القديم نفسه
const tid = /^[a-z0-9][a-z0-9-]{1,21}$/.test(process.env.TENANT_ID || '') && process.env.TENANT_ID !== 'default' ? process.env.TENANT_ID : '';
fs.writeFileSync(path.join(outDir, (tid ? 'mithqal-' + tid + '-backup-' : 'mizan-backup-') + day + '.enc'), enc);
const summary = { day, bytes: payload.length, encBytes: enc.length, collections: logical.meta.collections, counts: V.counts, balanced: V.balanced };
fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));   // أعداد فقط — بلا بيانات
console.log('✓ نسخة ' + day + ' · ' + Math.round(enc.length / 1024) + ' KB مشفّرة · ' + V.counts.closings + ' إغلاق · ' + V.counts.entries + ' قيد · الدفاتر متوازنة');
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### النسخة الليلية ${day} ✓\n\n| البند | العدد |\n|---|---|\n` + Object.entries(V.counts).map(([k, v]) => `| ${k} | ${v} |`).join('\n') + `\n\nالحجم المشفّر: ${Math.round(enc.length / 1024)} KB · الدفاتر متوازنة\n`);
