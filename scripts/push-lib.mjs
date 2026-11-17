// v45.9 — منطق إرسال ملخصات الإغلاق (نقي وقابل للاختبار دون شبكة)
//  • recipients: من يستحق من رموز الأجهزة — الدور والفروع من بيانات المنشأة (org.users + members)، لا من الجهاز
//  • plan: لكل رمز ⇒ الأحداث الجديدة (غير المُرسلة سابقًا)، والتشغيل الأول يعتبر القائم «مُرسلًا» بلا إرسال (لا سيل)
export function myBranchesOf(org, ROLES, u) {
  const s = ((ROLES[u.role] || ROLES.cashier || {}).scope) || 'own';
  const brs = (org.branches || []);
  if (s === 'all') return brs;
  if (s === 'own') return brs.filter(b => b.id === u.branchId);
  return brs.filter(b => (u.allowedBranchIds || []).includes(b.id));
}
export function recipients(org, members, tokens, E) {
  const out = [];
  for (const t of tokens) {
    const email = String(t.email || '').toLowerCase(); if (!email || !t.token) continue;
    const m = members[email]; if (!m || m.active === false) continue;   // عضو موقوف ⇒ لا شيء
    const u = (org.users || []).find(x => String(x.email || '').toLowerCase() === email); if (!u) continue;
    const me = { ...u, role: m.role || u.role, branchId: m.branchId != null ? m.branchId : u.branchId, allowedBranchIds: Array.isArray(m.branchIds) && m.branchIds.length ? m.branchIds : (u.allowedBranchIds || []) };
    if (!E.closeAlertFor(org, me)) continue;
    out.push({ id: t.id, token: t.token, email, me, branches: myBranchesOf(org, E.ROLES, me) });
  }
  return out;
}
export function plan(org, ops, recips, sent, E, first) {
  const msgs = [], mark = new Set(sent);
  for (const r of recips) {
    const evs = E.closeAlertEvents(org, ops, r.me, r.branches);
    for (const e of evs) {
      const key = r.email + '|' + e.id;
      if (mark.has(key)) continue; mark.add(key);
      if (first) continue;
      msgs.push({ tokenId: r.id, token: r.token, key, title: e.title, body: e.body, tag: e.id });
    }
  }
  return { msgs, sent: [...mark].slice(-5000) };
}
