/**
 * v51.2 — المرحلة 07 / S3: التحقق من هوية العضو لكل المنشآت (خادم واحد، مشروع Firebase لكل منشأة).
 * 1) يُقرأ مشروع الرمز (aud) ⇒ تُختار المنشأة من السجل. مشروع غير مسجَّل ⇒ رفض (لا يُجرَّب بمفتاح الطيف إلا إذا لم يُضبط مشروع الطيف — السلوك القديم).
 * 2) Google تتحقق من الرمز **بمفتاح تلك المنشأة نفسها** — رمز مشروع آخر يُرفض.
 * 3) يجب أن يطابق مشروع الرمز مشروع المنشأة، ثم تُقرأ العضوية النشطة من قاعدة **تلك المنشأة** برمز المستخدم نفسه.
 * لا يُقبل معرّف منشأة من ترويسة أو جسم الطلب أبدًا.
 */
export function tokenProject(idToken) {
  try {
    const p = JSON.parse(Buffer.from(String(idToken).split('.')[1], 'base64url').toString('utf8'));
    return typeof p.aud === 'string' && /^[a-z0-9-]{4,40}$/.test(p.aud) ? p.aud : '';
  } catch { return ''; }
}

/** المنشأة المسؤولة عن رمز ما — قبل التحقق منه (التحقق يتم بمفتاحها بعد ذلك) */
export function tenantForToken(T, idToken) {
  const aud = tokenProject(idToken);
  if (!aud) return null;
  const t = T.byProject(aud);
  if (t) return t;
  return T.def.projectId ? null : T.def;   // الطيف بلا FIREBASE_PROJECT_ID: مفتاحه هو الحَكَم كما كان
}

export function createVerifier({ T, fetchImpl = fetch, headers = (x) => x || {}, ttlMs = 120000, now = Date.now }) {
  const cache = new Map();
  return async function verifyMember(idToken) {
    const hit = cache.get(idToken);
    if (hit && hit.exp > now()) return hit.user;
    const t = tenantForToken(T, idToken);
    if (!t || !t.apiKey) return null;

    const r = await fetchImpl('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(t.apiKey), {
      method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify({ idToken })
    });
    if (!r.ok) {
      const why = ((await r.json().catch(() => ({}))).error || {}).message || r.status;
      if (why !== 'INVALID_ID_TOKEN') console.error('firebase lookup failed:', t.id, why);
      return null;
    }
    const u = ((await r.json()).users || [])[0];
    const email = String((u && u.email) || '').toLowerCase();
    if (!email || u.disabled) return null;

    const project = tokenProject(idToken);
    if (!project || (t.projectId && project !== t.projectId)) return null;

    const docUrl = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(project)
      + '/databases/(default)/documents/members/' + encodeURIComponent(email);
    const m = await fetchImpl(docUrl, { headers: { authorization: 'Bearer ' + idToken } });
    if (!m.ok) return null;
    const fields = ((await m.json()) || {}).fields || {};
    if (!(fields.active && fields.active.booleanValue === true)) return null;

    const user = { email, role: (fields.role && fields.role.stringValue) || '', tenant: t.id };
    cache.set(idToken, { user, exp: now() + ttlMs });
    if (cache.size > 1000) cache.delete(cache.keys().next().value);
    return user;
  };
}
