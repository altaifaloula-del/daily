/* v38.5 — صيانة النظام: حالة الخدمات، فحوص سلامة البيانات الآلية، وسجل أخطاء الأجهزة المركزي
   • الفحوص تعمل تلقائيًا عند فتح الشاشة على بيانات المنصّة نفسها (بلا تعديل) وتعرض لكل خلل مكانه وطريقة علاجه.
   • سجل الأخطاء: كل خطأ يقع على أي جهاز (بعد الدخول) يصل هنا مجمّعًا حسب نوعه — بلا بيانات تشغيل. */
import React, { useState, useEffect, useMemo } from 'react';
import { cloud, KEYS, brKey } from '../../storage';
import { ShieldCheck, RefreshCw, Trash2, AlertTriangle, Check, Server, Bug, Activity, HardDrive } from 'lucide-react';
import { recipeRaw, APP_CV, APP_VER, CloudHealth, ERRLOG_KEY, MAIN_WH, ROLES, SIG_BADGE, SIG_NAME, buildAccounting, loadRelease, loadSignoffs, sigVerify, branchBanks, cashForecast, complianceItems, entityList, vatStatus, countedClosing, isoD, money, purKey, q3, qrFs, snapAll, stockByWh, today, whName, whOf } from '../../App.jsx';

const ST = { ok: ['b-mint', 'سليم'], warn: ['b-amber', 'تنبيه'], bad: ['b-rose', 'خلل'] };
const daysAgo = (d) => { const x = new Date(); x.setDate(x.getDate() - d); return isoD(x); };
const serverBase = () => { const E = import.meta.env || {}; try { return E.VITE_AI_ENDPOINT ? new URL(E.VITE_AI_ENDPOINT).origin : ''; } catch { return ''; } };

/** فحوص سلامة البيانات — دالة نقية على org/ops (تُختبر آليًا) */
export function integrityChecks(org, ops, ctl) {
  const out = []; const add = (id, st, title, detail, items, fix) => out.push({ id, st, title, detail, items: items || [], fix: fix || '' });
  const brIds = new Set((org.branches || []).map(b => b.id));
  const brName = (id) => ((org.branches || []).find(b => b.id === id) || {}).name || id;
  // 1) توازن القيود
  let A = null;
  try {
    A = buildAccounting(org, ops);
    const diff = Math.round((A.totalDebit - A.totalCredit) * 100) / 100;
    const bad = A.entries.filter(e => !e.balanced);
    add('tb', A.balanced ? 'ok' : 'bad', 'توازن القيود وميزان المراجعة', A.balanced ? 'المدين = الدائن في ' + A.entries.length + ' قيدًا' : 'فرق ' + money(diff) + ' · ' + bad.length + ' قيد غير متوازن',
      bad.slice(0, 5).map(e => (e.date || '') + ' — ' + (e.title || e.id)), 'افتح القيد من «المحاسبة ← القيود اليومية» وصحّح سطوره');
    if ((A.unknownCodes || []).length) add('codes', 'warn', 'حسابات غير معرّفة في الدليل', A.unknownCodes.length + ' رمز', A.unknownCodes.slice(0, 8), 'أضِفها إلى دليل الحسابات أو صحّح القيود التي تستخدمها');
  } catch (e) { add('tb', 'bad', 'توازن القيود وميزان المراجعة', 'تعذّر بناء القيود: ' + String(e.message || e).slice(0, 120), [], 'أبلغ الدعم الفني بهذه الرسالة'); }
  // 2) إغلاقات عالقة
  const stuck = (ops.closings || []).filter(c => c.status === 'submitted' && (c.date || '') < daysAgo(2));
  add('closings', stuck.length ? 'warn' : 'ok', 'إغلاقات بانتظار التدقيق أكثر من يومين', stuck.length ? stuck.length + ' إغلاق' : 'لا شيء', stuck.slice(0, 5).map(c => (c.branchName || brName(c.branchId)) + ' · ' + c.date), 'اعتمدها أو أعدها للتصحيح من «التدقيق والاعتماد»');
  // 3) أرصدة مخزون سالبة
  try {
    const SB = stockByWh(org, ops); const items = org.items || []; const neg = [];
    Object.entries(SB.byWh || {}).forEach(([w, m]) => Object.entries(m).forEach(([id, q]) => { if (q < -0.0005) neg.push(whName(org, w) + ' · ' + ((items.find(x => x.id === id) || {}).name || id) + ' (' + q3(q) + ')'); }));
    add('stock', neg.length ? 'bad' : 'ok', 'أرصدة مخزون سالبة', neg.length ? neg.length + ' صنف' : 'لا أرصدة سالبة', neg.slice(0, 6), 'صرف أو هدر سُجّل قبل الوارد — سجّل الوارد الناقص أو اعتمد جردًا للمستودع');
  } catch { }
  // 4) فواتير موردين مكررة
  const seen = new Map(), dups = [];
  (ops.invoices || []).forEach(i => { const k = purKey(i); if (!k) return; if (seen.has(k)) dups.push((i.supplierName || '') + ' · رقم ' + i.invoiceNo); else seen.set(k, i); });
  add('dupinv', dups.length ? 'bad' : 'ok', 'فواتير موردين مكررة (نفس المورد والرقم)', dups.length ? dups.length + ' فاتورة' : 'لا تكرار', dups.slice(0, 5), 'احذف النسخة المكررة من «المشتريات ← فواتير الموردين» بعد التأكد');
  // 5) سجلات يتيمة (فرع محذوف)
  const orph = [];
  [['closings', 'إغلاق'], ['whMoves', 'حركة مستودع'], ['attendanceEvents', 'حضور'], ['posOrders', 'فاتورة نقطة بيع'], ['transfers', 'توريد']].forEach(([c, ar]) => {
    const n = (ops[c] || []).filter(x => x.branchId && !brIds.has(x.branchId)).length; if (n) orph.push(n + ' ' + ar);
  });
  const emps = (org.employees || []).filter(e => e.status !== 'terminated' && e.branchId && !brIds.has(e.branchId)).length; if (emps) orph.push(emps + ' موظف');
  add('orphans', orph.length ? 'warn' : 'ok', 'سجلات مرتبطة بفرع غير موجود', orph.length ? orph.join('، ') : 'لا شيء', [], 'أعد تفعيل الفرع أو انقل السجلات لفرع قائم');
  // 6) وصفات بمكوّنات محذوفة
  const itemIds = new Set((org.items || []).map(i => i.id));
  // v40.7: يشمل التحضيرات — مرجع لصنف أو تحضيرة محذوفة، أو وصفة دائرية، في المنتجات والتحضيرات
  const brokenRec = [...(org.products || []), ...(org.preps || [])].filter(p => { const R = recipeRaw(org, p.parts); return (p.parts || []).some(pt => pt.itemId && !itemIds.has(pt.itemId)) || R.cycle || R.missing.length > 0 || Object.keys(R.raw).some(id => !itemIds.has(id)); });
  add('recipes', brokenRec.length ? 'warn' : 'ok', 'وصفات بمكوّن محذوف (صنف أو تحضيرة) أو دائرية', brokenRec.length ? brokenRec.length + ' منتج' : 'كل المكوّنات موجودة', brokenRec.slice(0, 5).map(p => p.name), 'عدّل الوصفة من «المخزون ← الوصفات والتكلفة» — التكلفة النظرية ناقصة حتى تصحيحها');
  // 7) طلبات معلّقة قديمة
  const old = daysAgo(3), pend = [];
  const w = (ops.wasteRequests || []).filter(r => r.status === 'pending' && (r.date || '') < old).length; if (w) pend.push(w + ' هدر');
  const cs = (ops.countSessions || []).filter(s => (s.status === 'submitted' || s.status === 'recount') && (s.date || '') < old).length; if (cs) pend.push(cs + ' جرد');
  const po = (ops.purchaseOrders || []).filter(p => p.status === 'pending' && String(p.date || p.at || '').slice(0, 10) < old).length; if (po) pend.push(po + ' أمر شراء');
  const tr = (ops.transfers || []).filter(t => t.status === 'pending' && (t.date || '') < old).length; if (tr) pend.push(tr + ' توريد نقدي');
  add('pending', pend.length ? 'warn' : 'ok', 'طلبات بانتظار القرار أكثر من 3 أيام', pend.length ? pend.join('، ') : 'لا شيء', [], 'تظهر في إشعارات المعتمدين — اعتمدها أو ارفضها');
  // 8) فروع بلا إغلاق حديث
  const lastBy = {}; (ops.closings || []).filter(countedClosing).forEach(c => { if (!lastBy[c.branchId] || c.date > lastBy[c.branchId]) lastBy[c.branchId] = c.date; });
  const silent = (org.branches || []).filter(b => b.isActive !== false && lastBy[b.id] && lastBy[b.id] < daysAgo(3)).map(b => b.name + ' (آخر إغلاق ' + lastBy[b.id] + ')');
  add('silent', silent.length ? 'warn' : 'ok', 'فروع توقفت إغلاقاتها أكثر من 3 أيام', silent.length ? silent.length + ' فرع' : 'كل الفروع تُغلق بانتظام', silent.slice(0, 6), 'تأكد من تشغيل الفرع أو إدخال إغلاقاته المتأخرة');
  // 15) v40.0 — الاعتمادات الموقّعة: معتمد بلا توقيع موثّق (بعد بدء التوقيع) أو عُدّلت أرقامه بعد اعتماده
  if (ctl && ctl.sigs) {
    const bad = [], legacy = [];
    const scan = (kind, list, label) => (list || []).forEach(x => { const v = sigVerify(kind, x, ctl.sigs, ctl.cutover);
      if (v.st === 'tampered' || v.st === 'unsigned') bad.push(label(x) + ' — ' + SIG_BADGE[v.st][1] + (v.stage ? ' (' + (SIG_NAME[v.stage] || v.stage) + ')' : ''));
      else if (v.st === 'legacy') legacy.push(x.id); });
    const brN = (id) => ((org.branches || []).find(b => b.id === id) || {}).name || '';
    scan('closing', ops.closings, x => 'إغلاق ' + brN(x.branchId) + ' ' + x.date);
    scan('waste', ops.wasteRequests, x => 'هدر ' + (x.date || '') + ' ' + money(x.value || 0));
    scan('count', ops.countSessions, x => 'جرد ' + (x.date || ''));
    scan('po', ops.purchaseOrders, x => 'أمر شراء ' + (x.poNo || x.id));
    add('signoffs', bad.length ? 'bad' : 'ok', 'الاعتمادات الموقّعة (هوية + بصمة الأرقام)', bad.length ? bad.length + ' اعتماد بلا توقيع موثّق أو عُدّل بعد اعتماده' : 'كل الاعتمادات منذ ' + (ctl.cutover || 'بدء التوقيع') + ' موقّعة ومطابقة' + (legacy.length ? ' · ' + legacy.length + ' اعتماد أقدم من بدء التوقيع' : ''),
      bad.slice(0, 8), bad.length ? 'اعتماد غير موثّق يعني تعديلًا خارج الواجهة أو من نسخة قديمة، وتغيّر البصمة يعني تعديل أرقام بعد الاعتماد — راجع السجل وأعد التدقيق' : '');
  }
  // 9–12) v38.9 — الالتزامات النظامية والسيولة (ضمن المراجعة والرقابة)
  if (A) {
    const td = today(), cfg = org.cashflowCfg || {};
    // 9) ضريبة القيمة المضافة: التسجيل، والإقرارات المتأخرة، والفترة المنتهية غير المقفلة
    try {
      const V = vatStatus(org, ops, A, td, cfg);
      const taxNo = entityList(org).some(e => String(e.taxNumber || '').trim());
      if (!V.on) add('vat', taxNo ? 'bad' : 'ok', 'ضريبة القيمة المضافة', taxNo ? 'للمنشأة رقم ضريبي والضريبة غير مفعّلة — المبيعات تُسجَّل بلا ضريبة مخرجات' : 'المنشأة غير مسجلة ضريبيًا', [], taxNo ? 'فعّلها من «المحاسبة ← الضريبة» بتاريخ التسجيل الفعلي' : '');
      else {
        const late = V.unpaid.filter(u => u.due < td), soon = V.unpaid.filter(u => u.due >= td);
        const ended = V.end && V.end < td;
        const st = late.length ? 'bad' : (ended || !V.months) ? 'warn' : 'ok';
        const det = late.length ? late.length + ' إقرار تجاوز موعد السداد' : ended ? 'فترة انتهت ولم تُقفل' : !V.months ? 'دورية الإقرار غير محددة' : 'الإقرارات منتظمة' + (soon.length ? ' · ' + soon.length + ' بانتظار السداد' : '');
        add('vat', st, 'ضريبة القيمة المضافة — الإقرار والسداد', det,
          [...late.map(u => u.from + ' ← ' + u.to + ': ' + money(u.rem) + ' (استحق ' + u.due + ')'), ...soon.map(u => u.from + ' ← ' + u.to + ': ' + money(u.rem) + ' يستحق ' + u.due), ...(ended ? ['الفترة ' + V.start + ' ← ' + V.end + ' — تُقدَّم وتُسدَّد قبل ' + V.due] : [])],
          late.length ? 'سدّد من «المحاسبة ← الضريبة» — غرامة التأخير 5% عن كل شهر أو جزء منه' : ended ? 'أقفل الفترة من «المحاسبة ← الضريبة»' : !V.months ? 'حدّد الدورية من «التدفق النقدي ← الإعداد» أو أقفل أول فترة' : '');
      }
    } catch { }
    // 10) التأمينات الاجتماعية: رصيد 2202 بعد موعد التحويل (15 من الشهر التالي)
    try {
      const bal = Math.round(-((A.accounts.find(a => a.code === '2202') || {}).balance || 0) * 100) / 100;
      const lm = [...new Set((ops.ledgerEntries || []).filter(x => x.kind === 'salary_payout').map(x => x.month))].sort().pop();
      const due = lm ? (() => { const [y, m] = lm.split('-').map(Number); return new Date(Date.UTC(y, m, 15)).toISOString().slice(0, 10); })() : '';
      if ((org.gosiCfg || {}).enabled || bal > 0.004) add('gosi', bal > 0.004 && due && due < td ? 'bad' : 'ok', 'التأمينات الاجتماعية المستحقة', bal > 0.004 ? money(bal) + (due ? (due < td ? ' — تجاوزت موعد ' + due : ' — تُحوَّل قبل ' + due) : '') : 'لا رصيد مستحق', [], bal > 0.004 && due < td ? 'حوّلها للتأمينات وسجّل السداد بقيد من 2202' : '');
    } catch { }
    // 11) الزكاة: موعد الإقرار والسداد (120 يومًا من نهاية السنة المالية)
    try {
      const fy = cfg.fyEnd || ((org.yearEnd || {}).closeDate ? String(org.yearEnd.closeDate).slice(5, 10) : '');
      if (/^\d\d-\d\d$/.test(fy)) {
        const y = Number(td.slice(0, 4)); const cand = [y - 1, y].map(x => x + '-' + fy).filter(x => x < td).sort().pop();
        if (cand) { const d = new Date(cand + 'T12:00:00'); d.setDate(d.getDate() + 120); const due = isoD(d);
          const has = (cfg.sched || []).some(s => s.kind === 'zakat' && s.date >= cand);
          const left = Math.round((Date.parse(due) - Date.parse(td)) / 864e5);
          add('zakat', has || left < 0 ? 'ok' : left <= 30 ? 'bad' : 'warn', 'الزكاة — السنة المنتهية ' + cand, has ? 'مجدولة في التدفق النقدي' : left < 0 ? 'انقضى موعد ' + due + ' — تحقق من تقديم الإقرار' : 'الإقرار والسداد قبل ' + due + ' (متبقٍّ ' + left + ' يومًا)', [], has ? '' : 'احسبها من «المحاسبة ← الزكاة» وأضفها التزامًا مجدولًا في «التدفق النقدي ← الإعداد»'); }
      } else add('zakat', 'warn', 'الزكاة — نهاية السنة المالية', 'غير محددة — لا يمكن تتبّع موعد الإقرار', [], 'حدّدها من «التدفق النقدي ← الإعداد» أو بإقفال السنة من المحاسبة');
    } catch { }
    // 13) v39.1 — الوثائق الرسمية وعقود الإيجار: منتهية أو فات موعد إشعار المؤجر
    try {
      const C = complianceItems(org, ops, { A, today: td }).items.filter(x => x.cat === 'doc' || x.cat === 'lease');
      const bad = C.filter(x => x.sev === 'bad'), warn = C.filter(x => x.sev === 'warn' && x.cat === 'doc');
      if ((org.documents || []).length) add('docs', bad.length ? 'bad' : warn.length ? 'warn' : 'ok', 'الوثائق الرسمية وعقود الإيجار', bad.length ? bad.length + ' بند عاجل' : warn.length ? warn.length + ' وثيقة تنتهي قريبًا' : 'كل الوثائق سارية',
        [...bad, ...warn].slice(0, 6).map(x => x.title + ' — ' + x.sub), bad.length || warn.length ? 'جدّدها وحدّث تاريخها في «المستندات والأرشيف ← مركز المستندات»' : '');
      else add('docs', 'warn', 'الوثائق الرسمية', 'لا وثائق مسجّلة — السجل التجاري والرخص وعقود الإيجار بلا تتبّع لانتهائها', [], 'سجّلها في «مركز المستندات» بتواريخ انتهائها');
    } catch { }
    // 14) v39.1 — التسوية البنكية: كل بنك بحركة يحتاج مذكرة تسوية عن الشهر المنتهي
    try {
      const pm = (() => { const d = new Date(td + 'T12:00:00'); d.setDate(0); return isoD(d); })();
      const accs = ['1201', ...branchBanks(org).map(b => b.code)];
      const late = accs.filter(code => A.entries.some(e => (e.date || '') <= pm && (e.date || '') > daysAgo(120) && e.lines.some(l => l.code === code)))
        .filter(code => !(ops.bankRecs || []).some(r => (r.acc || '1201') === code && (r.date || '') >= pm));
      add('bankrec', late.length ? 'warn' : 'ok', 'التسوية البنكية الشهرية', late.length ? late.length + ' بنك بلا تسوية حتى ' + pm : 'البنوك مسوّاة حتى ' + pm,
        late.map(c => c === '1201' ? 'البنك التجميعي (1201)' : ((branchBanks(org).find(b => b.code === c) || {}).name || c)), late.length ? 'ارفع كشف الشهر في «المحاسبة ← التسوية البنكية» واحفظ مذكرة التسوية' : '');
    } catch { }
    // 12) السيولة: عجز متوقع خلال 13 أسبوعًا
    try {
      const C = cashForecast(org, ops, { A, today: td });
      const w = C.weeks.find(x => x.bal < -0.004), wl = C.weeks.find(x => x.balLo < -0.004);
      add('cash', w && w.k < 4 ? 'bad' : (w || wl) ? 'warn' : 'ok', 'السيولة — التدفق النقدي المتوقع', w ? 'عجز متوقع في الأسبوع ' + (w.k + 1) + ' (' + money(w.bal) + ')' : wl ? 'عجز في الحالة المتحفظة بالأسبوع ' + (wl.k + 1) : 'لا عجز متوقع خلال 13 أسبوعًا · أدنى رصيد ' + money(C.min.v),
        C.notes.filter(n => n.sev === 'bad').map(n => n.msg).slice(0, 4), (w || wl) ? 'راجع «التقارير ← التدفق النقدي» ودبّر السيولة مبكرًا' : '');
    } catch { }
  }
  return out;
}

/** تجميع سجلات الأخطاء حسب نوعها */
export function groupErrors(rows) {
  const G = {};
  rows.forEach(r => { const g = G[r.sig] = G[r.sig] || { sig: r.sig, msg: r.msg, where: r.where, stack: r.stack, n: 0, first: r.at, last: r.at, users: new Set(), branches: new Set(), vers: new Set(), devices: new Set(), ids: [] };
    g.n++; g.ids.push(r.id); if (r.at < g.first) g.first = r.at; if (r.at > g.last) g.last = r.at;
    if (r.email) g.users.add(r.email); if (r.branchId) g.branches.add(r.branchId); if (r.v) g.vers.add(r.v); if (r.device) g.devices.add(r.device); });
  return Object.values(G).map(g => ({ ...g, users: [...g.users], branches: [...g.branches], vers: [...g.vers], devices: [...g.devices] })).sort((a, b) => b.last.localeCompare(a.last));
}

export function SystemMaintenance({ org, ops, me, commit, say }) {
  // v40.0: التوقيعات وتاريخ بدء التوقيع من Firestore (القواعد تحدد ما يُقرأ)
  const [ctl, setCtl] = useState(null);
  const [rel, setRel] = useState(null);
  const [legacyN, setLegacyN] = useState(null);
  useEffect(() => { let dead = false; (async () => { const r = await loadRelease(); const sg = await loadSignoffs(me, (org.branches || []).map(b => b.id), true);
    if (!dead) { setRel(r); if (sg) setCtl({ sigs: sg, cutover: (r && r.cutover) || '' }); }
    try { const pu = await cloud.get(KEYS.pulse, { presence: {}, audit: [] }); if (!dead) setLegacyN(((pu || {}).audit || []).length); } catch { } })(); return () => { dead = true; }; }, [me, org.branches]);
  const checks = useMemo(() => integrityChecks(org, ops, ctl), [org, ops, ctl]);
  const isAdm = !!(ROLES[me && me.role] || {}).admin;
  const migrate = async () => {
    if (!window.confirm('ترحيل سجل التدقيق القديم (' + legacyN + ' إدخال) إلى السجل المحصّن موسومًا «قديم — هوية غير موثّقة»، ثم تفريغه من مستند النبض. متابعة؟')) return;
    setBusy(true);
    try {
      const F = await qrFs(); if (!F) { setBusy(false); return say('قاعدة البيانات السحابية غير مفعّلة', 'no'); }
      const pu = (await cloud.get(KEYS.pulse, { presence: {}, audit: [] })) || { presence: {}, audit: [] };
      const list = pu.audit || []; const s2 = (v, n) => String(v == null ? '' : v).slice(0, n);
      for (let i = 0; i < list.length; i += 400) { const b = F.writeBatch(F.db);
        list.slice(i, i + 400).forEach(e => b.set(F.doc(F.collection(F.db, 'audit_log')), { at: F.serverTimestamp(), email: 'legacy', role: s2(e.userRole, 40), userName: s2(e.userName, 120), title: s2(e.title || e.actionType || 'عملية', 200),
          details: s2((e.branchName ? e.branchName + ' · ' : '') + (e.details || ''), 1000), actionType: s2(e.actionType, 40), targetType: s2(e.targetType, 40), targetId: s2(e.targetId, 300), cv: APP_CV, legacy: true, origAt: s2(e.timestamp || (e.at ? new Date(e.at).toISOString() : ''), 40) }));
        await b.commit(); }
      for (let i = 0; i < 4; i++) { const cur = (await cloud.get(KEYS.pulse, { presence: {}, audit: [] })) || {}; if ((await cloud.setIfUnchanged(KEYS.pulse, { ...cur, audit: [] })) === 'ok') break; }
      setLegacyN(0); say('رُحّل ' + list.length + ' إدخال إلى السجل المحصّن وفُرّغ النبض ✓');
    } catch (e) { say('تعذّر الترحيل: ' + (/permission/i.test(String(e && e.message)) ? 'للمدير فقط' : 'تحقق من الاتصال'), 'no'); }
    setBusy(false);
  };
  const [srv, setSrv] = useState(null);
  const [errs, setErrs] = useState(null);
  const [open, setOpen] = useState(null);
  const [snapOk, setSnapOk] = useState(null);
  const [showDocs, setShowDocs] = useState(false);
  const [busy, setBusy] = useState(false);
  const local = (() => { try { return JSON.parse(localStorage.getItem(ERRLOG_KEY) || '[]'); } catch { return []; } })();
  const brName = (id) => ((org.branches || []).find(b => b.id === id) || {}).name || id;
  const syncErrs = [[KEYS.core, 'المستند المركزي'], [KEYS.org, 'الإعدادات'], ...(org.branches || []).map(b => [brKey(b.id), 'فرع ' + b.name])].map(([k, l]) => ({ l, e: cloud.readErr(k) })).filter(x => x.e);

  const pingServer = async () => {
    const base = serverBase(); if (!base) return setSrv({ st: 'warn', t: 'رابط الخادم غير مضبوط في إعدادات النشر' });
    setSrv({ st: 'run', t: 'جارٍ الفحص…' }); const t0 = Date.now();
    try { const r = await fetch(base + '/api/health', { cache: 'no-store' }); const ms = Date.now() - t0;
      setSrv(r.ok ? { st: ms > 8000 ? 'warn' : 'ok', t: (ms > 8000 ? 'يعمل لكنه كان نائمًا — ' : 'يعمل — ') + (ms / 1000).toFixed(1) + ' ث' } : { st: 'bad', t: 'يرد بخطأ HTTP ' + r.status }); }
    catch { setSrv({ st: 'bad', t: 'لا يستجيب' }); }
  };
  const loadErrors = async () => {
    setErrs({ loading: true });
    try {
      const F = await qrFs(); if (!F) return setErrs({ err: 'قاعدة البيانات السحابية غير مفعّلة' });
      const q = F.query(F.collection(F.db, 'client_errors'), F.orderBy('at', 'desc'), F.limit(500));
      const s = await F.getDocs(q);
      const rows = s.docs.map(d => { const x = d.data(); return { id: d.id, ...x, at: x.at && x.at.toDate ? x.at.toDate().toISOString() : String(x.at || '') }; });
      setErrs({ rows, groups: groupErrors(rows) });
    } catch (e) { setErrs({ err: /permission/i.test(String(e && e.message)) ? 'قراءة السجل لمسؤول النظام فقط' : 'تعذّر تحميل السجل' }); }
  };
  const delGroup = async (g) => {
    if (!window.confirm('حذف ' + g.n + ' سجل لهذا الخطأ؟ (بعد إصلاحه أو التأكد أنه غير مهم)')) return;
    setBusy(true);
    try { const F = await qrFs(); for (let i = 0; i < g.ids.length; i += 400) { const b = F.writeBatch(F.db); g.ids.slice(i, i + 400).forEach(id => b.delete(F.doc(F.db, 'client_errors', id))); await b.commit(); } say('حُذفت السجلات ✓'); await loadErrors(); }
    catch { say('تعذّر الحذف', 'no'); }
    setBusy(false);
  };
  useEffect(() => { pingServer(); loadErrors(); snapAll().then(a => setSnapOk(a.some(x => x.key === 'day-' + today()))).catch(() => setSnapOk(false)); }, []);   // eslint-disable-line

  const bad = checks.filter(c => c.st === 'bad').length, warn = checks.filter(c => c.st === 'warn').length;
  const errN = errs && errs.groups ? errs.groups.filter(g => g.last >= daysAgo(7)).length : null;
  const svc = [
    { k: 'الإصدار', st: 'ok', t: APP_VER },
    { k: 'خادم المنصّة (التحليل الذكي والفوترة)', st: srv ? srv.st : 'run', t: srv ? srv.t : '…', act: <button className="btn sm gh" onClick={pingServer}><RefreshCw size={12} /></button> },
    { k: 'المزامنة مع قاعدة البيانات', st: syncErrs.length ? 'bad' : 'ok', t: syncErrs.length ? syncErrs.length + ' مستند يتعذّر قراءته: ' + syncErrs.map(x => x.l).join('، ') : 'كل المستندات تُقرأ' },
    { k: 'اللقطة اليومية (هذا الجهاز)', st: snapOk == null ? 'run' : snapOk ? 'ok' : 'warn', t: snapOk == null ? '…' : snapOk ? 'محفوظة اليوم' : 'لم تُحفظ اليوم بعد' },
    { k: 'أخطاء الأجهزة (آخر 7 أيام)', st: errN == null ? 'run' : errN ? 'warn' : 'ok', t: errN == null ? '…' : errN ? errN + ' نوع خطأ' : 'لا أخطاء' }
  ];
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="grid g4">
        {[['خلل', bad, '#D9544D'], ['تنبيه', warn, '#E0A458'], ['فحص سليم', checks.length - bad - warn, '#4FB286'], ['أنواع أخطاء الأجهزة (7 أيام)', errN == null ? '…' : errN, '#5B93C4']].map(([l, v, c]) => (
          <div key={l} className="kpi" style={{ borderInlineStartColor: c }}><div className="kpi-l">{l}</div><div className="kpi-v num">{v}</div></div>))}
      </div>

      {/* v40.0 — أساس الرقابة: الإصدار الإلزامي وسجل التدقيق */}
      <div className="card">
        <div className="card-h"><div className="card-t"><ShieldCheck size={15} color="var(--brass)" />أساس الرقابة</div></div>
        <div className="mt-list">
          <div className={'mt-row ' + (rel && rel.minCv ? 'ok' : 'warn')}><span className={'mt-dot ' + (rel && rel.minCv ? 'ok' : 'warn')} /><span className="mt-k">التحديث الإجباري</span>
            <span className="mt-t">{rel == null ? 'غير متاح (ليس وضع Firestore)' : rel.minCv ? 'الحد الأدنى v' + Math.floor(rel.minCv / 10000) + '.' + Math.floor(rel.minCv % 10000 / 100) + (rel.minCv % 100 ? '.' + (rel.minCv % 100) : '') + ' · هذا الجهاز ' + APP_VER + ' — الأجهزة الأقدم لا تحفظ' : 'لم يُفعَّل بعد — يُفعَّل تلقائيًا عند دخول المدير بهذا الإصدار'}</span></div>
          <div className={'mt-row ' + (rel && rel.cutover ? 'ok' : 'warn')}><span className={'mt-dot ' + (rel && rel.cutover ? 'ok' : 'warn')} /><span className="mt-k">بدء التوقيع الموثّق</span>
            <span className="mt-t">{rel && rel.cutover ? 'منذ ' + rel.cutover + ' — كل اعتماد بعده يحمل توقيعًا ببصمة الأرقام' : '—'}</span></div>
          <div className={'mt-row ' + (rel == null || legacyN ? 'warn' : 'ok')}><span className={'mt-dot ' + (rel == null || legacyN ? 'warn' : 'ok')} /><span className="mt-k">سجل التدقيق</span>
            <span className="mt-t">{rel == null ? 'غير متاح (ليس وضع Firestore) — السجل محلي غير محصّن' : legacyN ? legacyN + ' إدخال في السجل القديم (قابل للعبث ومقروء للفروع) — رحّله' : 'محصّن: لا يُعدَّل ولا يُحذف، ولا يقرؤه موظفو الفروع'}</span>
            {legacyN > 0 && isAdm && <button className="btn sm pri" disabled={busy} onClick={migrate}>ترحيل وتفريغ</button>}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-h"><div className="card-t"><Server size={15} color="var(--brass)" />حالة الخدمات</div></div>
        <div className="mt-list">{svc.map(s => <div key={s.k} className={'mt-row ' + s.st}><span className={'mt-dot ' + s.st} /><span className="mt-k">{s.k}</span><span className="mt-t">{s.t}</span>{s.act || null}</div>)}</div>
      </div>

      <div className="card">
        <div className="card-h"><div className="card-t"><ShieldCheck size={15} color="var(--brass)" />فحوص سلامة البيانات</div>
          <span className={'badge ' + (bad ? 'b-rose' : warn ? 'b-amber' : 'b-mint')}>{bad ? bad + ' خلل' : warn ? warn + ' تنبيه' : 'كل الفحوص سليمة'}</span></div>
        <div className="mt-list">{checks.map(c => (
          <div key={c.id} className={'mt-check ' + c.st}>
            <button type="button" className="mt-ch" onClick={() => setOpen(open === c.id ? null : c.id)}>
              <span className={'badge ' + ST[c.st][0]}>{ST[c.st][1]}</span><b>{c.title}</b><span className="mt-t">{c.detail}</span>
            </button>
            {open === c.id && c.st !== 'ok' && <div className="mt-det">
              {c.items.length > 0 && <ul>{c.items.map((x, i) => <li key={i}>{x}</li>)}</ul>}
              {c.fix && <div className="note">العلاج: {c.fix}</div>}
            </div>}
          </div>))}</div>
        <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <button className="btn sm" onClick={() => setShowDocs(v => !v)}><HardDrive size={13} />{showDocs ? 'إخفاء' : 'فحص مستندات قاعدة البيانات وأحجامها'}</button>
        </div>
      </div>
      {showDocs && <CloudHealth org={org} say={say} commit={commit} me={me} auto />}

      <div className="card">
        <div className="card-h"><div className="card-t"><Bug size={15} color="var(--brass)" />سجل أخطاء الأجهزة</div>
          <button className="btn sm gh" disabled={errs && errs.loading} onClick={loadErrors}><RefreshCw size={12} />تحديث</button></div>
        {!errs || errs.loading ? <div className="empty">جارٍ التحميل…</div> : errs.err ? <div className="note">{errs.err}</div>
          : !errs.groups.length ? <div className="empty">لا أخطاء مسجّلة من أي جهاز ✓</div> : <div className="mt-list">{errs.groups.map(g => (
            <div key={g.sig} className="mt-err">
              <div className="mt-err-h"><b className="mt-msg" dir="ltr">{g.msg}</b><span className="badge b-amber num">×{g.n}</span></div>
              <small>{g.where ? 'في: ' + g.where + ' · ' : ''}آخر مرة <span className="dt">{g.last.slice(0, 16).replace('T', ' ')}</span> · {g.users.length} مستخدم{g.branches.length ? ' · ' + g.branches.map(brName).join('، ') : ''} · {g.vers.join('، ')}</small>
              <details><summary>التفاصيل التقنية</summary><pre dir="ltr">{(g.stack || '').slice(0, 1500)}</pre><small dir="ltr">{g.devices.join(' | ')}</small></details>
              <div className="row" style={{ gap: 6, marginTop: 4 }}><button className="btn sm gh" disabled={busy} onClick={() => delGroup(g)}><Trash2 size={12} />حذف بعد المعالجة</button></div>
            </div>))}</div>}
        <div className="note" style={{ marginTop: 8 }}>تصل هنا أخطاء كل الأجهزة بعد تسجيل الدخول — مجمّعة حسب نوعها، بلا أي بيانات مالية. أخطاء الشبكة المؤقتة لا تُسجَّل. أرسل نوع الخطأ للدعم الفني لإصلاحه.</div>
        {local.length > 0 && <details style={{ marginTop: 8 }}><summary style={{ cursor: 'pointer', fontSize: 12.5 }}>أخطاء هذا الجهاز ({local.length})</summary>
          <div className="mt-list" style={{ marginTop: 6 }}>{local.slice(0, 10).map((x, i) => <div key={i} className="mt-err"><b dir="ltr" className="mt-msg">{x.msg}</b><small>{(x.at || '').slice(0, 16).replace('T', ' ')} · {x.where} · {x.v}</small></div>)}</div></details>}
      </div>
    </div>);
}
