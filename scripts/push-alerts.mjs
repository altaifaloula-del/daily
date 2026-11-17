// v45.9 — ملخصات الإغلاق إلى الجوال والمنصة مغلقة (يُشغَّل من GitHub Actions كل 10 دقائق بحساب الخدمة الموجود)
// يقرأ Firestore (قراءة فقط) ⇒ يحسب الملخصات بمحرك المنصة نفسه لكل مستلم حسب دوره وفروعه ⇒ يرسل عبر Firebase Cloud Messaging.
// ما أُرسل يُحفظ في ملف حالة (ذاكرة Actions) فلا يتكرر. لا بيانات في السجل — أعداد فقط.
import fs from 'node:fs';
import { GoogleAuth } from 'google-auth-library';
import { decodeFields, assemble, composeLogical } from './backup-lib.mjs';
import { recipients, plan } from './push-lib.mjs';
import { buildEngine } from '../tests/build-engine.mjs';

const pid = process.env.PROJECT_ID, stateFile = process.env.STATE_FILE || 'push-state.json';
if (!pid) { console.error('::error::معرّف المشروع غير مضبوط'); process.exit(1); }
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/datastore', 'https://www.googleapis.com/auth/firebase.messaging'] });
const client = await auth.getClient();
const root = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(pid)}/databases/(default)/documents`;
const readCol = async (c) => { const out = {}; let token = '';
  do { const r = await client.request({ url: root + '/' + c + '?pageSize=300' + (token ? '&pageToken=' + encodeURIComponent(token) : '') });
    (r.data.documents || []).forEach(d => { out[d.name.split('/').pop()] = decodeFields(d.fields || {}); }); token = r.data.nextPageToken || ''; } while (token);
  return out; };

const tokensRaw = await readCol('pushTokens');
const tokens = Object.entries(tokensRaw).map(([id, t]) => ({ id, ...t }));
if (!tokens.length) { console.log('لا أجهزة مسجّلة — لا شيء للإرسال'); process.exit(0); }
const A = assemble(await readCol('platform'));
if (A.errors.length) { console.error('::error::مستندات تالفة'); process.exit(1); }
const { org, ops } = composeLogical(A.values);
const E = await buildEngine();
if (!org || !E.closeAlertsCfg(org).on) { console.log('ملخصات الإغلاق غير مفعّلة في المنصة'); process.exit(0); }
const members = await readCol('members');

let st = null; try { st = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { }
const first = !st || !Array.isArray(st.sent);
const R = recipients(org, members, tokens, E);
const P = plan(org, ops, R, first ? [] : st.sent, E, first);

let ok = 0, bad = 0, gone = 0;
const fcm = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(pid)}/messages:send`;
for (const m of P.msgs) {
  try {
    await client.request({ url: fcm, method: 'POST', data: { message: { token: m.token,
      webpush: { headers: { Urgency: 'high', TTL: '86400' }, data: { title: m.title, body: m.body, tag: m.tag } } } } });
    ok++;
  } catch (e) {
    const code = e?.response?.data?.error?.details?.find?.(d => d.errorCode)?.errorCode || e?.response?.status;
    if (code === 'UNREGISTERED' || code === 404) gone++;
    else { bad++; if (e?.response?.status === 403) console.error('::error::حساب الخدمة لا يملك صلاحية الإرسال — فعّل «Firebase Cloud Messaging API (V1)» وامنحه دور «Firebase Cloud Messaging API Admin»'); }
  }
}
fs.writeFileSync(stateFile, JSON.stringify({ at: new Date().toISOString(), sent: P.sent }));
console.log((first ? 'تشغيل أول: سُجّل القائم دون إرسال · ' : '') + 'مستلمون ' + R.length + ' · أُرسل ' + ok + ' · فشل ' + bad + ' · أجهزة منتهية ' + gone);
if (bad && !ok) process.exit(1);
