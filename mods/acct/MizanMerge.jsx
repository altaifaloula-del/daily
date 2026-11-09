/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useMemo } from 'react';
import { Upload, Check, BarChart3, AlertTriangle, Trash2, ClipboardCheck, FileText, TrendingUp, Landmark, Scale, Lock } from 'lucide-react';
import { MZ_FIXED, MZ_KIND_AR, MZ_SUGGEST, ROLES, lockedThru, mizanPlan, money, mzNewCode, mzR2, nowISO, periodLocked, rolePost, sum, uid } from '../../App.jsx';

export function MizanMerge({ org, ops, me, commit, commitOrg, say, A }) {
  const cfg = org.mizanCfg || {};
  const canPost = rolePost(me?.role);
  const [pkg, setPkg] = useState(null);
  const [map, setMap] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirmUndo, setConfirmUndo] = useState('');
  const [unlockWhy, setUnlockWhy] = useState('');
  const [withSales, setWithSales] = useState(true);   // v28.5: استيراد المبيعات الربعية (للأرباع بلا إغلاقات يومية فقط)   // v28.3: سبب الفتح المؤقت للأشهر المقفلة أثناء الدمج
  const canUnlock = !!ROLES[me?.role]?.admin;        // نفس صلاحية الفتح الاستثنائي في شاشة الإقفال
  const batches = cfg.batches || [];
  const loadFile = (f) => {
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const p = JSON.parse(String(rd.result || ''));
        if (p.format !== 'mizan-export' || !Array.isArray(p.invoices) || !Array.isArray(p.accounts)) return say('الملف ليس حزمة تصدير من «ميزان المحاسبي»', 'no');
        const m = {};
        (p.accounts || []).forEach(a => { if (!MZ_FIXED[a.code]) m[a.code] = (cfg.lastMap || {})[a.code] || MZ_SUGGEST[a.code] || '__new'; });
        setMap(m); setPkg(p);
      } catch (e) { say('تعذّرت قراءة الملف: ' + (e.message || e), 'no'); }
    };
    rd.readAsText(f);
  };
  const plan = useMemo(() => pkg ? mizanPlan(org, ops, pkg, map, withSales) : null, [org, ops, pkg, map, withSales]);
  const accOpts = useMemo(() => A.accounts.slice().sort((a, b) => a.code.localeCompare(b.code)), [A]);
  const enable = async (on) => {
    await commitOrg(d => ({ ...d, mizanCfg: { ...(d.mizanCfg || {}), enabled: on } }),
      { actionType: 'update', targetType: 'tax_settings', targetId: 'mizanCfg', need: 'post', title: on ? 'تفعيل دمج بيانات ميزان' : 'إيقاف دمج بيانات ميزان', details: '' });
  };
  const doImport = async (viaUnlock) => {
    if (!plan || busy) return;
    // v28.3: الأشهر المقفلة — إما فتحها يدويًا من شاشة الإقفال، أو فتح مؤقت موثّق بسبب يعاد بعده القفل تلقائيًا
    const prevLock = lockedThru(org);
    const tmpUnlock = !!(viaUnlock && plan.lockedMonths.length);
    if (plan.lockedMonths.length && !tmpUnlock) return say('أشهر مقفلة محاسبيًا: ' + plan.lockedMonths.join('، ') + ' — افتحها أولًا', 'no');
    if (tmpUnlock && !canUnlock) return say('الفتح المؤقت للأشهر المقفلة لمسؤول النظام فقط', 'no');
    if (tmpUnlock && !unlockWhy.trim()) return say('اكتب سبب الفتح المؤقت — إلزامي للتوثيق', 'no');
    if (plan.missing.length) return say('حسابات مربوطة بأكواد غير موجودة: ' + plan.missing.join('، '), 'no');
    if (plan.noSup) return say('سجلات بلا مورد مطابق — راجع الحزمة', 'no');
    setBusy(true);
    try {
      const rec = { batch: pkg.batch, at: nowISO(), by: me?.name || '', counts: { suppliers: plan.newSups.length, accounts: plan.newAccs.length, invoices: plan.invoices.length, payments: plan.payments.length, journals: plan.journals.length }, map };
      const okOrg = await commitOrg(d => {
        const haveS = new Set((d.suppliers || []).map(s => s.id)); const haveA = new Set((d.customAccounts || []).map(a => String(a.code)));
        const pl = d.periodLocks || {};
        const plNext = tmpUnlock ? { periodLocks: { ...pl, lockedThrough: '', log: [{ id: uid('pl'), at: nowISO(), by: me?.name || '', action: 'unlock', month: 'فتح مؤقت لدمج ميزان', reason: unlockWhy.trim() }, ...(pl.log || [])].slice(0, 60) } } : {};
        return { ...d, ...plNext,
          suppliers: [...(d.suppliers || []), ...plan.newSups.filter(s => !haveS.has(s.id))],
          customAccounts: [...(d.customAccounts || []), ...plan.newAccs.filter(a => !haveA.has(a.code))],
          mizanCfg: { ...(d.mizanCfg || {}), enabled: true, lastMap: map, batches: [...((d.mizanCfg || {}).batches || []).filter(b => b.batch !== rec.batch), rec] } };
      }, { actionType: 'create', targetType: 'tax_settings', targetId: pkg.batch, need: 'post', title: 'دمج ميزان — الموردون والحسابات', details: plan.newSups.length + ' مورد · ' + plan.newAccs.length + ' حساب' });
      if (okOrg === false) { setBusy(false); return; }
      // v28.4: الحافظ يعيد تطبيق الدالة عند تعارض الكتابة (حتى 3 مرات) — لا نضيف سجلًا موجودًا بمعرّفه أبدًا
      const addNew = (arr, add) => { const have = new Set((arr || []).map(x => x.id)); return [...add.filter(x => !have.has(x.id)), ...(arr || [])]; };
      const ok = await commit(d => ({ ...d,
        invoices: addNew(d.invoices, plan.invoices),
        closingInvPays: addNew(d.closingInvPays, plan.payments),
        journalManual: addNew(d.journalManual, plan.journals) }),
        { actionType: 'create', targetType: 'journal_entry', targetId: pkg.batch, need: 'post', title: 'دمج ميزان — الفواتير والسدادات وقيود البنوك',
          details: plan.invoices.length + ' فاتورة · ' + plan.payments.length + ' سداد · ' + plan.journals.length + ' قيد' });
      if (ok) { say('تم الدمج ✓ — ' + plan.invoices.length + ' فاتورة و' + plan.payments.length + ' سدادًا و' + plan.journals.length + ' قيدًا' + (tmpUnlock ? ' — وأُعيد القفل حتى ' + prevLock : '')); setPkg(null); setUnlockWhy(''); }
    } finally {
      // v28.3: إعادة القفل كما كان دائمًا — نجح الدمج أو فشل
      if (tmpUnlock && prevLock) {
        await commitOrg(d => { const pl = d.periodLocks || {}; return { ...d, periodLocks: { ...pl, lockedThrough: prevLock, log: [{ id: uid('pl'), at: nowISO(), by: me?.name || '', action: 'lock', month: prevLock, reason: 'إعادة القفل تلقائيًا بعد دمج ميزان' }, ...(pl.log || [])].slice(0, 60) } }; },
          { actionType: 'update', targetType: 'period_lock', targetId: 'periodLocks', need: 'edit', title: 'إعادة قفل الفترات بعد دمج ميزان', details: 'حتى ' + prevLock });
      }
      setBusy(false);
    }
  };
  const undo = async (batch) => {
    // v28.3: الإلغاء يحذف قيودًا — يحترم الإقفال الشهري (يُفتح من المحاسبة ← الإقفال عند الحاجة)
    const bDates = [...(ops.invoices || []), ...(ops.closingInvPays || []), ...(ops.journalManual || [])].filter(x => x.mizanBatch === batch).map(x => x.date);
    const lk = [...new Set(bDates.filter(d => periodLocked(org, d)).map(d => d.slice(0, 7)))].sort();
    if (lk.length) return say('لا يُلغى: الدفعة تشمل أشهرًا مقفلة (' + lk.join('، ') + ') — افتحها من المحاسبة ← الإقفال أولًا', 'no');
    if (confirmUndo !== batch) { setConfirmUndo(batch); return; }
    setConfirmUndo('');
    const ok = await commit(d => ({ ...d,
      invoices: (d.invoices || []).filter(x => x.mizanBatch !== batch),
      closingInvPays: (d.closingInvPays || []).filter(x => x.mizanBatch !== batch),
      journalManual: (d.journalManual || []).filter(x => x.mizanBatch !== batch) }),
      { actionType: 'delete', targetType: 'journal_entry', targetId: batch, need: 'edit', title: 'إلغاء دفعة دمج ميزان', details: batch });
    if (ok) {
      await commitOrg(d => ({ ...d, mizanCfg: { ...(d.mizanCfg || {}), batches: ((d.mizanCfg || {}).batches || []).map(b => b.batch === batch ? { ...b, undoneAt: nowISO(), undoneBy: me?.name || '' } : b) } }),
        { actionType: 'update', targetType: 'tax_settings', targetId: batch, need: 'edit', title: 'تعليم دفعة ميزان كملغاة', details: batch });
      say('أُلغيت سجلات الدفعة ✓ (الموردون والحسابات المضافة باقية بلا حركة)');
    }
  };
  // v28.4: كشف وإزالة النسخ المكررة من سجلات ميزان (نتيجة إعادة محاولة الحفظ في v28.2/v28.3) — يُبقي نسخة واحدة لكل معرّف
  const dupCount = (arr) => { const seen = new Set(); let n = 0, amt = 0; (arr || []).forEach(x => { if (!x || !x.mizanBatch) return; if (seen.has(x.id)) { n++; amt += Number(x.amount) || 0; } else seen.add(x.id); }); return { n, amt: mzR2(amt) }; };
  const dups = { inv: dupCount(ops.invoices), pay: dupCount(ops.closingInvPays), jr: dupCount(ops.journalManual) };
  const dupTotal = dups.inv.n + dups.pay.n + dups.jr.n;
  const dedupe = async () => {
    if (!canUnlock) return say('إزالة المكرر لمسؤول النظام فقط', 'no');
    const uniq = (arr) => { const seen = new Set(); return (arr || []).filter(x => { if (!x || !x.mizanBatch) return true; if (seen.has(x.id)) return false; seen.add(x.id); return true; }); };
    const ok = await commit(d => ({ ...d, invoices: uniq(d.invoices), closingInvPays: uniq(d.closingInvPays), journalManual: uniq(d.journalManual) }),
      { actionType: 'delete', targetType: 'journal_entry', targetId: 'mizan-dedupe', need: 'edit', title: 'إزالة النسخ المكررة من دمج ميزان',
        details: dups.inv.n + ' فاتورة · ' + dups.pay.n + ' سداد · ' + dups.jr.n + ' قيد (نسخ مطابقة بنفس المعرّف — تصحيح خطأ حفظ)' });
    if (ok) say('أُزيلت النسخ المكررة ✓ — بقيت نسخة واحدة من كل سجل');
  };
  // أرصدة البنوك المربوطة الآن مقابل كشوف الحزمة المستوردة
  const live = batches.filter(b => !b.undoneAt);
  const bankNow = (code) => { const a = A.accounts.find(x => x.code === code); return a ? mzR2((a.debit || 0) - (a.credit || 0)) : null; };

  if (!canPost) return <div className="card"><div className="empty">دمج بيانات ميزان متاح لمن يملك صلاحية الترحيل فقط.</div></div>;
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card">
        <div className="card-h">
          <div className="card-t"><Upload size={15} color="var(--brass)" />استيراد البيانات التاريخية — حزمة «ميزان المحاسبي» (النموذج الأولي)</div>
          {cfg.enabled ? <span className="badge b-mint">مفعّل</span> : <span className="badge b-dim">غير مفعّل</span>}
        </div>
        <div className="note" style={{ lineHeight: 1.9 }}>
          يستورد من حزمة <b>mizan-export</b>: الموردين، وفواتير المشتريات بحسابها وضريبتها الفعلية، وسداد الموردين من كشوف البنك مع تخصيصه على الفواتير، وقيود مطابقة البنوك الشهرية والأرصدة الافتتاحية للبنوك.
          <br />المبيعات <b>لا</b> تُستورد — مصدرها الإغلاقات اليومية. لا يتغيّر شيء قبل ضغط «دمج».
        </div>
        <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {!cfg.enabled && <button className="btn sm pri" onClick={() => enable(true)}><Check size={14} />تفعيل الدمج</button>}
          {cfg.enabled && <label className="btn sm pri" style={{ cursor: 'pointer' }}><Upload size={14} />اختيار ملف الحزمة (JSON)
            <input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={e => { loadFile(e.target.files && e.target.files[0]); e.target.value = ''; }} /></label>}
          {cfg.enabled && !live.length && <button className="btn sm gh" onClick={() => enable(false)}>إيقاف</button>}
        </div>
      </div>

      {/* v28.7: تشخيص — من أين تأتي القيود؟ لكشف أي تضخّم في الأرقام بمصدره */}
      {(() => {
        const g = {}; (A.entries || []).forEach(e => { const k = e.src || 'غير محدد'; const o = g[k] || (g[k] = { n: 0, dr: 0, from: '9999', to: '' }); o.n++; o.dr += e.debit || 0; if ((e.date || '') < o.from) o.from = e.date || ''; if ((e.date || '') > o.to) o.to = e.date || ''; });
        const rows = Object.entries(g).sort((a, b) => b[1].dr - a[1].dr);
        const mz = (arr) => { const a = (arr || []).filter(x => x && x.mizanBatch); return a.length + ' (' + new Set(a.map(x => x.id)).size + ' فريد)'; };
        const revT = sum(A.accounts.filter(a => a.kind === 'rev'), a => (a.credit || 0) - (a.debit || 0));
        const expT = sum(A.accounts.filter(a => a.kind === 'exp'), a => (a.debit || 0) - (a.credit || 0));
        return <div className="card">
          <div className="card-t" style={{ marginBottom: 8 }}><BarChart3 size={15} color="var(--brass)" />تشخيص: مصادر القيود في المنصة (كل الفترات)</div>
          <table className="tb"><thead><tr><th>المصدر</th><th style={{ textAlign: 'end' }}>عدد القيود</th><th style={{ textAlign: 'end' }}>إجمالي المدين</th><th>من</th><th>إلى</th></tr></thead>
            <tbody>{rows.map(([k, o]) => <tr key={k}><td>{k}</td><td className="n">{o.n}</td><td className="n">{money(o.dr)}</td><td>{o.from}</td><td>{o.to}</td></tr>)}</tbody></table>
          <div className="hint" style={{ marginTop: 8 }}>
            سجلات ميزان المخزّنة: فواتير {mz(ops.invoices)} · سدادات {mz(ops.closingInvPays)} · قيود {mz(ops.journalManual)}
            {' '}· الإيرادات {money(revT)} · المصروفات {money(expT)} · الصافي {money(revT - expT)}
          </div>
        </div>;
      })()}

      {dupTotal > 0 && (
        <div className="card" style={{ borderColor: '#D9544D' }}>
          <div className="card-t" style={{ marginBottom: 8, color: '#D9544D' }}><AlertTriangle size={15} />سجلات مكررة من الدمج — الأرقام مضاعفة</div>
          <div className="note" style={{ lineHeight: 1.9 }}>
            حُفظت بعض سجلات ميزان أكثر من مرة بنفس المعرّف (إعادة محاولة الحفظ عند تعارض الكتابة): {dups.inv.n} فاتورة ({money(dups.inv.amt)}) · {dups.pay.n} سداد ({money(dups.pay.amt)}) · {dups.jr.n} قيد.
            <br />الإزالة تُبقي نسخة واحدة من كل سجل ولا تمسّ أي بيانات أخرى، وتُسجَّل في سجل التدقيق.
          </div>
          <div className="row" style={{ marginTop: 10 }}>{canUnlock ? <button className="btn pri" onClick={dedupe}><Trash2 size={14} />إزالة النسخ المكررة</button> : <span className="hint">لمسؤول النظام فقط</span>}</div>
        </div>
      )}

      {live.length > 0 && (
        <div className="card">
          <div className="card-t" style={{ marginBottom: 8 }}><ClipboardCheck size={15} color="var(--brass)" />الدفعات المدموجة</div>
          <table className="tb"><thead><tr><th>الدفعة</th><th>التاريخ</th><th>بواسطة</th><th>فواتير</th><th>سدادات</th><th>قيود</th><th></th></tr></thead>
            <tbody>{live.map(b => (
              <tr key={b.batch}><td>{b.batch}</td><td>{(b.at || '').slice(0, 10)}</td><td>{b.by}</td><td className="n">{b.counts?.invoices}</td><td className="n">{b.counts?.payments}</td><td className="n">{b.counts?.journals}</td>
                <td><button className={'btn sm ' + (confirmUndo === b.batch ? 'pri' : 'gh')} onClick={() => undo(b.batch)}><Trash2 size={13} />{confirmUndo === b.batch ? 'تأكيد الإلغاء' : 'إلغاء الدفعة'}</button></td></tr>))}</tbody></table>
          {(() => { const lm = live[live.length - 1].map || {}; const banks = [['519192', '111104'], ['534779', '111105'], ['534886', '111106']];
            return <div style={{ marginTop: 10 }}><div className="lbl">أرصدة البنوك المربوطة الآن (كل الحركات في المنصة)</div>
              <table className="tb"><thead><tr><th>حساب الراجحي</th><th>الحساب في الدليل</th><th style={{ textAlign: 'end' }}>الرصيد الدفتري الآن</th></tr></thead>
                <tbody>{banks.map(([m, c]) => { const code = lm[c] && lm[c] !== '__new' ? lm[c] : mzNewCode(c); const v = bankNow(code);
                  return <tr key={m}><td>463608015{m}</td><td>{code} — {(A.accounts.find(a => a.code === code) || {}).name || '—'}</td><td className="n">{v == null ? '—' : money(v)}</td></tr>; })}</tbody></table>
              <div className="hint">رصيد الكشف في 31/10/2026: 13,846.87 · 35,478.83 · 5,471.32 — يتطابق ما لم تُرحَّل حركات أخرى على نفس الحساب بعد الربط.</div></div>; })()}
        </div>
      )}

      {pkg && plan && (
        <>
          <div className="card">
            <div className="card-t" style={{ marginBottom: 8 }}><FileText size={15} color="var(--brass)" />محتوى الحزمة — {pkg.company || ''} · {pkg.period?.from} إلى {pkg.period?.to}</div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <span className="badge b-sky">{pkg.suppliers.length} مورد ({plan.newSups.length} جديد · {plan.supByVat} بالرقم الضريبي · {plan.supByName} بالاسم)</span>
              <span className="badge b-sky">{plan.invoices.length} فاتورة جديدة{plan.dup.inv ? ' · ' + plan.dup.inv + ' مستوردة سابقًا' : ''}</span>
              <span className="badge b-sky">{plan.payments.length} سداد{plan.dup.pay ? ' · ' + plan.dup.pay + ' سابق' : ''}</span>
              <span className="badge b-sky">{plan.journals.length - plan.salesJr.length} قيد بنك{plan.dup.jr ? ' · ' + plan.dup.jr + ' سابق' : ''}</span>
              {plan.salesJr.length > 0 && <span className="badge b-mint">{plan.salesJr.length} قيد مبيعات ربعية</span>}
              <span className="badge b-brass">إجمالي الفواتير {money(pkg.totals?.invoices)} · الضريبة {money(pkg.totals?.vat)}</span>
            </div>
            {pkg.note && <div className="hint" style={{ marginTop: 8 }}>{pkg.note}</div>}
            {plan.lockedMonths.length > 0 && <div className="note" style={{ marginTop: 8, borderColor: '#D9544D' }}>
              أشهر مقفلة محاسبيًا: {plan.lockedMonths.join('، ')} (مقفل حتى {lockedThru(org)}).
              {canUnlock ? <div style={{ marginTop: 8 }}>
                يمكن الدمج بفتح مؤقت موثّق: تُفتح الأشهر، يتم الدمج، ثم يُعاد القفل حتى {lockedThru(org)} تلقائيًا — ويُسجَّل الفتح وإعادة القفل في سجل الإقفال والتدقيق.
                <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <input className="inp" style={{ flex: 1, minWidth: 260 }} placeholder="سبب الفتح المؤقت (إلزامي)" value={unlockWhy} onChange={e => setUnlockWhy(e.target.value)} />
                </div></div> : <div style={{ marginTop: 6 }}>الفتح المؤقت لمسؤول النظام فقط — أو افتحها من المحاسبة ← الإقفال.</div>}
            </div>}
          </div>

          {plan.salesAll.length > 0 && (
            <div className="card">
              <div className="card-h">
                <div className="card-t"><TrendingUp size={15} color="var(--brass)" />المبيعات الربعية الإجمالية (من ملفات المصدر)</div>
                <label className="row" style={{ gap: 6, cursor: 'pointer' }}><input type="checkbox" checked={withSales} onChange={e => setWithSales(e.target.checked)} />استيراد المبيعات</label>
              </div>
              <div className="hint" style={{ marginBottom: 8 }}>قيد لكل بند: مدين المتحصلات الوسيط (111901) / دائن المبيعات وضريبة المخرجات. يتعادل الوسيط مع متحصلات البنوك والباقي يمثّل النقدي وغير المحصّل. أي ربع فيه إغلاقات يومية يُستبعد تلقائيًا حتى لا تتكرر المبيعات.</div>
              <table className="tb"><thead><tr><th>التاريخ</th><th>البيان</th><th style={{ textAlign: 'end' }}>قبل الضريبة</th><th style={{ textAlign: 'end' }}>الضريبة</th><th>الحالة</th></tr></thead>
                <tbody>{plan.salesAll.map(x => {
                  const done = (ops.journalManual || []).some(j => j.mizanId === x.mid);
                  return <tr key={x.mid}><td>{x.date}</td><td>{x.desc}{x.note ? <span className="badge b-amber" style={{ marginInlineStart: 6 }}>{x.note}</span> : null}</td><td className="n">{money(x.net)}</td><td className="n">{money(x.vat)}</td>
                    <td>{done ? <span className="badge b-dim">مستورد سابقًا</span> : x.closings ? <span className="badge b-rose">مستبعد — {x.closings} إغلاق في الربع</span> : withSales ? <span className="badge b-mint">سيُستورد</span> : <span className="badge b-dim">غير محدد</span>}</td></tr>; })}</tbody></table>
            </div>
          )}

          <div className="card">
            <div className="card-t" style={{ marginBottom: 6 }}><Landmark size={15} color="var(--brass)" />ربط الحسابات — اختر لكل حساب في ميزان مقابله في الدليل</div>
            <div className="hint" style={{ marginBottom: 8 }}>
              «حساب جديد» يُنشئ حسابًا مخصّصًا برمز MZ-… (آمن، لا يمسّ أي رصيد قائم). اربط بحساب قائم فقط إذا كان هو نفسه فعلًا.
              <b> تنبيه:</b> 111901 هو متحصلات الشبكة والتطبيقات في البنك؛ إن ربطت بنك الراجحي ببنك فرع تُرحَّل إليه مبيعات الشبكة من الإغلاقات فاربط 111901 بوسيط الشبكة تحت التسوية لذلك البنك وإلا تكررت المبيعات في البنك.
            </div>
            <div style={{ maxHeight: 420, overflow: 'auto' }}>
              <table className="tb"><thead><tr><th>حساب ميزان</th><th>النوع</th><th>المقابل في المنصة</th></tr></thead>
                <tbody>{pkg.accounts.map(a => (
                  <tr key={a.code}><td>{a.code} — {a.name}</td><td>{MZ_KIND_AR[a.kind] || a.kind}</td>
                    <td>{MZ_FIXED[a.code] ? <span>{MZ_FIXED[a.code]} — {(A.accounts.find(x => x.code === MZ_FIXED[a.code]) || {}).name} <span className="badge b-dim">ثابت</span></span> :
                      <select className="sel" value={map[a.code] || '__new'} onChange={e => setMap(m => ({ ...m, [a.code]: e.target.value }))}>
                        <option value="__new">حساب جديد {mzNewCode(a.code)} — {a.name}</option>
                        {accOpts.filter(x => x.kind === a.kind && x.code !== mzNewCode(a.code)).map(x => <option key={x.code} value={x.code}>{x.code} — {x.name}</option>)}
                      </select>}
                    </td></tr>))}</tbody></table>
            </div>
          </div>

          <div className="card">
            <div className="card-t" style={{ marginBottom: 8 }}><Scale size={15} color="var(--brass)" />فحص البنوك قبل الحفظ — أثر الحزمة على كل بنك = رصيد الكشف</div>
            <table className="tb"><thead><tr><th>الحساب</th><th>يُرحَّل إلى</th><th style={{ textAlign: 'end' }}>أثر الحزمة</th><th style={{ textAlign: 'end' }}>رصيد الكشف</th><th></th></tr></thead>
              <tbody>{plan.bankCheck.map(b => {
                const okB = plan.dup.jr === 0 && plan.dup.pay === 0 ? Math.abs(b.pkgNet - b.close) < 0.01 : null;
                return <tr key={b.mid}><td>{b.name}</td><td>{b.code}</td><td className="n">{money(b.pkgNet)}</td><td className="n">{money(b.close)}</td>
                  <td>{okB === null ? <span className="badge b-dim">دفعة جزئية</span> : okB ? <span className="badge b-mint">مطابق ✓</span> : <span className="badge b-rose">لا يطابق</span>}</td></tr>; })}</tbody></table>
            <div className="row" style={{ gap: 8, marginTop: 12 }}>
              {plan.lockedMonths.length === 0
                ? <button className="btn pri" disabled={busy || plan.missing.length > 0 || (plan.invoices.length + plan.payments.length + plan.journals.length) === 0} onClick={() => doImport(false)}>
                    <Check size={15} />{busy ? 'جارٍ الدمج…' : 'دمج'}</button>
                : <button className="btn pri" disabled={busy || !canUnlock || !unlockWhy.trim() || plan.missing.length > 0 || (plan.invoices.length + plan.payments.length + plan.journals.length) === 0} onClick={() => doImport(true)}>
                    <Lock size={15} />{busy ? 'جارٍ الدمج…' : 'فتح مؤقت ← دمج ← إعادة القفل'}</button>}
              <button className="btn gh" onClick={() => setPkg(null)}>إلغاء</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
