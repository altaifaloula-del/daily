/* v46.6 — سندات القبض والصرف والمقاصّة: على عميل/مورد (مع التوزيع على الفواتير المفتوحة)، أو أي حساب في الدليل، أو موظف (سلفة أو عهدة).
   الجهة التي هي عميل ومورد معًا: مقاصّة بين ذممها. ترقيم RV/PV/OV، طباعة A4 بالتفقيط، وتصدير Excel. */
import React, { useMemo, useState } from 'react';
import { deptOn, deptList, DEPT_SHARED } from '../../App.jsx';
import { cvLive, cvNeedsAppr, cvApprOpenFrom, cvApprove, jeOwner, canApproveJe } from '../../App.jsx';   // v56.32 اعتماد سندات الصرف (T9)   // v56.28 E4: قسم سند الصرف على حساب مصروف (توصية المجلس)
import { Receipt, Plus, Printer, Download, Check, Scale, X } from 'lucide-react';
import { DocLink, CV_KIND, cvNextNo, projList, partyOpenDocs, applyCashVoucher, cashVoucherHtml, buildAccounting, buildPartners, branchBanks, Field, Modal, LOCK_MSG, makeXlsx, money, nowISO, periodLocked, printA4, today, uid } from '../../App.jsx';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const PT = { cust: 'عميل', sup: 'مورد', acc: 'حساب من الدليل', emp: 'موظف' };

export function CashVouchers({ org, ops, me, commit, say }) {
  const [kind, setKind] = useState(''); const [q, setQ] = useState('');
  const [f, setF] = useState(null);
  const P = useMemo(() => buildPartners(org, ops), [org, ops]);
  const bal = (key) => { const p = P.find(x => x.key === key); return p ? r2(p.txns.reduce((a, t) => a + (t.debit || 0) - (t.credit || 0), 0)) : 0; };
  const accs = useMemo(() => buildAccounting(org, {}).accounts.map(a => ({ code: String(a.code), name: a.name, kind: a.kind })).sort((x, y) => x.code.localeCompare(y.code)), [org]);
  // v56.28 (توصية المجلس): القسم لسند الصرف على حساب مصروف فقط، بصلاحية الترحيل، ويُثبَّت لحظة الإنشاء (التصحيح بقيد يدوي معتمد)
  const deptOk = !!(f && deptOn(org) && f.kind === 'pv' && f.pt === 'acc' && f.acc && (accs.find(a => a.code === f.acc) || {}).kind === 'exp');
  const ACC = useMemo(() => buildAccounting(org, ops), [org, ops]);
  const cashBal = (code) => r2(ACC.entries.reduce((t, e) => t + (e.lines || []).reduce((s, l) => s + (String(l.code) === String(code) ? (l.debit || 0) - (l.credit || 0) : 0), 0), 0));   // v47.3 رصيد الحساب النقدي قبل التحويل
  const funds = [{ code: '1101', name: 'الخزينة (نقدًا)' }, { code: '1201', name: 'البنك التجميعي' }, ...branchBanks(org).map(b => ({ code: b.code, name: b.name }))];
  const fname = (c) => (funds.find(x => x.code === c) || {}).name || c;
  const list = (ops.cashVouchers || []).filter(v => (!kind || v.kind === kind) && (!q || [v.no, (v.party || {}).name, v.supName, v.custName, v.note].some(x => String(x || '').includes(q))))
    .sort((a, b) => String(b.date + b.at).localeCompare(String(a.date + a.at)));
  const parties = (t) => t === 'sup' ? P.filter(p => p.type === 'supplier') : t === 'cust' ? P.filter(p => p.type === 'customer') : t === 'emp' ? P.filter(p => p.type === 'employee') : [];
  const linked = P.filter(p => p.type === 'supplier' && p.linkKey && P.some(c => c.key === p.linkKey));

  const open = (k) => setF({ kind: k, date: today(), amount: '', fund: '1101', pm: 'cash', ref: '', note: '', pt: k === 'rv' ? 'cust' : 'sup', key: '', acc: '', empPurpose: 'custody', alloc: {}, supKey: '', custKey: '' });
  const party = f && f.kind !== 'ov' ? (f.pt === 'acc' ? (f.acc ? { t: 'acc', acc: f.acc, name: (accs.find(a => a.code === f.acc) || {}).name || f.acc } : null) : (f.key ? { t: f.pt, key: f.key, name: (P.find(p => p.key === f.key) || {}).name || '' } : null)) : null;
  const docs = f && party && ((f.kind === 'pv' && party.t === 'sup') || (f.kind === 'rv' && party.t === 'cust')) ? partyOpenDocs(org, ops, party) : [];
  const allocSum = r2(Object.values((f && f.alloc) || {}).reduce((a, x) => a + (Number(x) || 0), 0));
  const autoAlloc = () => { let left = r2(f.amount); const al = {}; docs.forEach(d => { if (left <= 0) return; const a = Math.min(left, d.rem); al[d.id] = String(r2(a)); left = r2(left - a); }); setF(x => ({ ...x, alloc: al })); };

  const print = (v) => printA4(org, CV_KIND[v.kind].ar + ' — ' + v.no, '', cashVoucherHtml(org, v));
  const xlsx = () => { const rows = [['رقم السند', 'النوع', 'التاريخ', 'الجهة', 'نوع الجهة', 'المبلغ', 'الحساب', 'طريقة الدفع', 'المرجع', 'البيان', 'أعدّه'], ...list.map(v => [v.no, CV_KIND[v.kind].ar, v.date, v.kind === 'tv' ? fname(v.fund) + ' ← ' + fname(v.toFund) : v.kind === 'ov' ? v.supName + ' / ' + v.custName : (v.party || {}).name, v.kind === 'tv' ? 'تحويل بين الحسابات' : v.kind === 'ov' ? 'مقاصّة' : PT[(v.party || {}).t] || '', v.amount, v.kind === 'tv' ? v.fund + ' ← ' + v.toFund : v.fund || '', v.pm || '', v.ref || '', v.note || '', v.by || ''])];
    try { const blob = makeXlsx([{ name: 'سندات القبض والصرف', rows }]); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'سندات_القبض_والصرف.xlsx'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 4000); } catch (e) { console.warn(e); } };

  const save = async () => {
    const a = r2(f.amount);
    if (!(a > 0)) return say('أدخل المبلغ', 'no');
    if (periodLocked(org, f.date)) return say(LOCK_MSG(f.date), 'no');
    const st0 = f.kind === 'pv' ? cvApprOpenFrom(org) : ''; if (st0 && String(f.date) < st0) return say('تاريخ السند يسبق بداية اعتماد سندات الصرف (' + st0 + ')', 'no');   // v56.32
    let v = { id: uid('cv'), kind: f.kind, date: f.date, amount: a, note: String(f.note || '').trim(), by: me.name, at: nowISO(), ...(f.projectId && f.kind !== 'tv' ? { projectId: f.projectId } : {}), ...(deptOk && f.deptId ? { deptId: f.deptId } : {}) };   // v47.4 المشروع
    if (f.kind === 'tv') {   // v47.3 تحويل بين حسابين نقديين
      if (!f.fund || !f.toFund || f.fund === f.toFund) return say('اختر حسابين مختلفين للتحويل', 'no');
      v = { ...v, fund: f.fund, toFund: f.toFund, ...(String(f.ref || '').trim() ? { ref: String(f.ref).trim() } : {}) };
    } else if (f.kind === 'ov') {
      const s = P.find(p => p.key === f.supKey), c = P.find(p => p.key === f.custKey);
      if (!s || !c) return say('اختر المورد والعميل', 'no');
      const owe = -bal(s.key), due = bal(c.key);   // علينا للمورد (دائن) · لنا على العميل (مدين)
      if (a > Math.min(owe, due) + 0.004) return say('المقاصّة لا تتجاوز أقل الرصيدين: علينا للمورد ' + money(Math.max(0, owe)) + ' · لنا على العميل ' + money(Math.max(0, due)), 'no');
      v = { ...v, supKey: s.key, custKey: c.key, supName: s.name, custName: c.name };
    } else {
      if (!party) return say('اختر ' + (f.pt === 'acc' ? 'الحساب' : 'الجهة'), 'no');
      if (f.pm === 'cheque' && !String(f.ref || '').trim()) return say('أدخل رقم الشيك', 'no');
      const alloc = docs.map(d => ({ id: d.id, no: d.no, amount: r2(f.alloc[d.id]) })).filter(x => x.amount > 0);
      const over = alloc.find(x => x.amount > (docs.find(d => d.id === x.id) || {}).rem + 0.004);
      if (over) return say('المبلغ الموزَّع على ' + over.no + ' أكبر من المتبقي', 'no');
      if (r2(alloc.reduce((s2, x) => s2 + x.amount, 0)) > a + 0.004) return say('مجموع التوزيع أكبر من مبلغ السند', 'no');
      v = { ...v, fund: f.pm === 'cash' ? '1101' : (f.fund && f.fund !== '1101' ? f.fund : '1201'), pm: f.pm, ...(String(f.ref || '').trim() ? { ref: String(f.ref).trim() } : {}), party, ...(alloc.length ? { alloc } : {}), ...(party.t === 'emp' && f.kind === 'pv' ? { empPurpose: f.empPurpose } : {}) };
    }
    if (cvNeedsAppr(org, v)) v = jeOwner(me) ? { ...v, status: 'posted', approvedBy: me.name, approvedAt: nowISO(), selfPosted: true } : { ...v, status: 'pending', byId: me.id || '' };   // v56.32 T9
    let no = '';
    const ok = await commit(d => { no = cvNextNo(d, f.kind); return applyCashVoucher(d, { ...v, no }, me); },
      { actionType: 'create', targetType: 'cash_voucher', targetId: v.id, need: 'post', title: 'أصدر ' + CV_KIND[f.kind].ar, details: money(a) + (v.deptId ? ' · القسم: ' + ((deptList(org, true).find(d => d.id === v.deptId) || {}).name || (v.deptId === DEPT_SHARED ? 'مشترك' : v.deptId)) : '') + ' · ' + (f.kind === 'ov' ? v.supName + ' / ' + v.custName : f.kind === 'tv' ? fname(v.fund) + ' ← ' + fname(v.toFund) : party.name) });
    if (ok === false) return;
    setF(null);
    if (v.status === 'pending') return say('أُرسل ' + CV_KIND[f.kind].ar + ' ' + no + ' للاعتماد — لا أثر له قبل اعتماده');
    say('صدر ' + CV_KIND[f.kind].ar + ' ' + no + ' ✓');
    const made = { ...v, no }; setTimeout(() => print(made), 50);
  };

  // v56.32 T9: اعتماد/رفض/سحب سند الصرف المعلّق — من «معلّق» فقط وعلى أحدث نسخة، وخارج فترة مقفلة
  const decideCv = async (v, act) => {
    const mine = v.byId ? v.byId === me.id : v.by === me.name;
    if (act === 'wd' ? !mine : !canApproveJe(me, v)) return say(act === 'wd' ? 'يسحب السندَ منشئه فقط' : 'لا يعتمد السند من أنشأه — يعتمده المحاسب أو الإدارة المالية أو المالك', 'no');
    if (act === 'ok' && periodLocked(org, v.date)) return say(LOCK_MSG(v.date), 'no');
    const r = act === 'no' ? window.prompt('سبب الرفض:', '') : ''; if (act === 'no' && r === null) return;
    let err = '';
    const ok = await commit(d => { if (act === 'ok') { const x = cvApprove(d, v.id, me); if (x.err) { err = x.err; return d; } return x.next; }
      const cur0 = (d.cashVouchers || []).find(x => x.id === v.id); if (!cur0 || cur0.status !== 'pending') { err = 'تغيّرت حالة السند قبل الحفظ — حدّث الشاشة'; return d; }
      return { ...d, cashVouchers: (d.cashVouchers || []).map(x => x.id === v.id ? { ...x, status: act === 'wd' ? 'withdrawn' : 'rejected', [act === 'wd' ? 'withdrawnBy' : 'rejectedBy']: me.name, [act === 'wd' ? 'withdrawnAt' : 'rejectedAt']: nowISO(), ...(r ? { rejectReason: r } : {}) } : x) }; },
      { actionType: act === 'ok' ? 'approve' : 'update', targetType: 'cash_voucher', targetId: v.id, need: 'post', title: act === 'ok' ? 'اعتمد سند صرف' : act === 'wd' ? 'سحب سند صرف معلّقًا' : 'رفض سند صرف', details: v.no + ' · ' + money(v.amount) + ' · المنشئ ' + v.by });
    if (err) return say(err, 'no'); if (ok === false) return;
    say(act === 'ok' ? 'اعتُمد السند ' + v.no + ' ✓' : act === 'wd' ? 'سُحب السند' : 'رُفض السند');
  };

  return (
    <div className="card" data-cashvouchers>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <div className="card-t" style={{ margin: 0, flex: '1 1 160px' }}><Receipt size={15} color="var(--brass)" />سندات القبض والصرف والتحويل</div>
        <button className="btn sm pri" data-newcv="rv" onClick={() => open('rv')}><Plus size={14} />سند قبض</button>
        <button className="btn sm pri" data-newcv="pv" onClick={() => open('pv')}><Plus size={14} />سند صرف</button>
        <button className="btn sm" data-newcv="ov" onClick={() => open('ov')}><Scale size={14} />سند مقاصّة</button>
        <button className="btn sm" data-newcv="tv" onClick={() => setF({ kind: 'tv', date: today(), amount: '', fund: '1101', toFund: '1201', ref: '', note: '' })}><Receipt size={14} />سند تحويل</button>
        <button className="btn sm gh" onClick={xlsx}><Download size={13} />Excel</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginBottom: 10 }}>
        <Field label="النوع"><select className="sel" aria-label="نوع السند المالي" value={kind} onChange={e => setKind(e.target.value)}><option value="">الكل</option>{Object.entries(CV_KIND).map(([k, x]) => <option key={k} value={k}>{x.ar}</option>)}</select></Field>
        <Field label="بحث"><input className="inp" placeholder="رقم السند أو الجهة" value={q} onChange={e => setQ(e.target.value)} /></Field>
      </div>
      <div className="tw">
        <table className="tb" data-cvlist>
          <thead><tr><th>رقم السند</th><th>النوع</th><th>التاريخ</th><th>الجهة</th><th style={{ textAlign: 'end' }}>المبلغ</th><th /></tr></thead>
          <tbody>
            {list.map(v => (
              <tr key={v.id}>
                <td className="num" style={{ fontWeight: 700, fontSize: 11.5 }}><DocLink to={{ cv: v.id }} title="استعراض السند">{v.no}</DocLink></td>
                <td><span className={'badge ' + (v.kind === 'rv' ? 'b-mint' : v.kind === 'pv' ? 'b-rose' : v.kind === 'tv' ? 'b-sky' : 'b-amber')}>{CV_KIND[v.kind].ar}</span></td>
                <td className="num" style={{ fontSize: 11.5 }}>{v.date}</td>
                <td style={{ fontSize: 12 }}>{v.kind === 'tv' ? fname(v.fund) + ' ← ' + fname(v.toFund) : v.kind === 'ov' ? v.supName + ' ⇄ ' + v.custName : (v.party || {}).name}<div style={{ fontSize: 10, color: 'var(--faint)' }}>{v.kind === 'tv' ? 'تحويل بين الحسابات' : v.kind === 'ov' ? 'مقاصّة' : PT[(v.party || {}).t]}{(v.alloc || []).length ? ' · ' + v.alloc.map(x => x.no).join('، ') : ''}</div></td>
                <td className="num" style={{ textAlign: 'end', fontWeight: 700 }}>{money(v.amount)}</td>
                <td>{cvLive(v) && <button className="btn sm gh" data-cvprint onClick={() => print(v)}><Printer size={13} />طباعة</button>}
                  {v.status === 'pending' && <div className="row" style={{ gap: 4, marginTop: 4, flexWrap: 'wrap' }} data-cv-pending><span className="badge b-amber">بانتظار الاعتماد</span>
                    {canApproveJe(me, v) && <><button className="btn sm" data-cv-ok onClick={() => decideCv(v, 'ok')}><Check size={12} />اعتماد</button><button className="btn sm gh" data-cv-no onClick={() => decideCv(v, 'no')}><X size={12} />رفض</button></>}
                    {(v.byId ? v.byId === me.id : v.by === me.name) && <button className="btn sm gh" data-cv-wd onClick={() => decideCv(v, 'wd')}>سحب</button>}</div>}
                  {v.status === 'rejected' && <span className="badge b-rose" title={v.rejectReason || ''}>مرفوض</span>}
                  {v.status === 'withdrawn' && <span className="badge b-dim">مسحوب</span>}
                  {v.selfPosted && <span className="badge b-sky" data-cv-self>رحّله المالك بنفسه</span>}</td>
              </tr>))}
            {!list.length && <tr><td colSpan={6}><div className="empty">لا سندات بعد</div></td></tr>}
          </tbody>
        </table>
      </div>

      {f && (
        <Modal title={CV_KIND[f.kind].ar + ' جديد'} icon={Receipt} onClose={() => setF(null)} wide
          foot={<><button className="btn gh" onClick={() => setF(null)}>إلغاء</button><button className="btn pri" data-cvsave onClick={save}><Check size={14} />حفظ وطباعة</button></>}>
          {f.kind === 'tv' ? <>
            <div className="note" style={{ marginBottom: 8 }}>تحويل بين الخزينة والبنوك (إيداع نقدية، سحب، تحويل بين بنكين). لا أثر له على الإيرادات أو المصروفات.</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
              <Field label="من حساب"><select className="sel" aria-label="من حساب" value={f.fund} onChange={e => setF(x => ({ ...x, fund: e.target.value }))}>{funds.map(x => <option key={x.code} value={x.code}>{x.name}</option>)}</select>
                <div className="hint">الرصيد الدفتري: <b className="num">{money(cashBal(f.fund))}</b>{r2(f.amount) > cashBal(f.fund) + 0.004 && <span data-tv-warn style={{ color: 'var(--rose)' }}> · المبلغ أكبر من الرصيد الدفتري</span>}</div></Field>
              <Field label="إلى حساب"><select className="sel" aria-label="إلى حساب" value={f.toFund} onChange={e => setF(x => ({ ...x, toFund: e.target.value }))}>{funds.map(x => <option key={x.code} value={x.code}>{x.name}</option>)}</select></Field>
              <Field label="مرجع (إيصال إيداع/تحويل)"><input className="inp" aria-label="مرجع السند" value={f.ref} onChange={e => setF(x => ({ ...x, ref: e.target.value }))} /></Field>
            </div>
          </> : f.kind === 'ov' ? <>
            <div className="note" style={{ marginBottom: 8 }}>المقاصّة تُسوّي ما لنا على العميل بما علينا للمورد نفسه (مدين ذمم الموردين / دائن ذمم العملاء).</div>
            {linked.length > 0 && <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>{linked.map(s => <button key={s.key} className={'btn sm' + (f.supKey === s.key ? ' pri' : ' gh')} data-ovpair onClick={() => setF(x => ({ ...x, supKey: s.key, custKey: s.linkKey }))}>{s.name} (مورد ⇄ عميل)</button>)}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
              <Field label="المورد"><select className="sel" aria-label="مورد المقاصّة" value={f.supKey} onChange={e => setF(x => ({ ...x, supKey: e.target.value }))}><option value="">— اختر —</option>{parties('sup').map(p => <option key={p.key} value={p.key}>{p.name}</option>)}</select>
                {f.supKey && <div className="hint">علينا له: <b className="num">{money(Math.max(0, -bal(f.supKey)))}</b></div>}</Field>
              <Field label="العميل"><select className="sel" aria-label="عميل المقاصّة" value={f.custKey} onChange={e => setF(x => ({ ...x, custKey: e.target.value }))}><option value="">— اختر —</option>{parties('cust').map(p => <option key={p.key} value={p.key}>{p.name}</option>)}</select>
                {f.custKey && <div className="hint">لنا عليه: <b className="num">{money(Math.max(0, bal(f.custKey)))}</b></div>}</Field>
            </div>
          </> : <>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>{Object.entries(PT).map(([k, t]) => <button key={k} className={'btn sm' + (f.pt === k ? ' pri' : ' gh')} data-cvpt={k} onClick={() => setF(x => ({ ...x, pt: k, key: '', acc: '', alloc: {} }))}>{t}</button>)}</div>
            {f.pt === 'acc'
              ? <Field label="الحساب"><select className="sel" aria-label="حساب السند" value={f.acc} onChange={e => setF(x => ({ ...x, acc: e.target.value }))}><option value="">— اختر الحساب —</option>{accs.map(a => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select></Field>
              : <Field label={PT[f.pt]}><select className="sel" aria-label="جهة السند" value={f.key} onChange={e => setF(x => ({ ...x, key: e.target.value, alloc: {} }))}><option value="">— اختر —</option>{parties(f.pt).map(p => <option key={p.key} value={p.key}>{p.name}</option>)}</select>
                {f.key && <div className="hint">الرصيد: <b className="num">{money(Math.abs(bal(f.key)))}</b> {bal(f.key) > 0 ? '(لنا)' : bal(f.key) < 0 ? '(علينا)' : ''}</div>}</Field>}
            {f.pt === 'emp' && f.kind === 'pv' && <div className="row" style={{ gap: 6, margin: '6px 0' }}>{[['custody', 'عهدة'], ['advance', 'سلفة تُستقطع من الراتب']].map(([k, t]) => <button key={k} className={'btn sm' + (f.empPurpose === k ? ' pri' : ' gh')} data-emppurpose={k} onClick={() => setF(x => ({ ...x, empPurpose: k }))}>{t}</button>)}</div>}
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>{[['cash', 'نقدًا'], ['bank', 'تحويل بنكي'], ['cheque', 'شيك']].map(([k, t]) => <button key={k} className={'btn sm' + (f.pm === k ? ' pri' : ' gh')} data-cvpm={k} onClick={() => setF(x => ({ ...x, pm: k, fund: k === 'cash' ? '1101' : (x.fund === '1101' ? '1201' : x.fund) }))}>{t}</button>)}</div>
          </>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
            <Field label="المبلغ"><input className="inp n" inputMode="decimal" aria-label="مبلغ السند" value={f.amount} onChange={e => setF(x => ({ ...x, amount: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
            <Field label="التاريخ"><input type="date" className="inp" value={f.date} onChange={e => setF(x => ({ ...x, date: e.target.value }))} /></Field>
            {f.kind !== 'ov' && f.kind !== 'tv' && f.pm !== 'cash' && <Field label={f.kind === 'rv' ? 'إلى حساب' : 'من حساب'}><select className="sel" aria-label="حساب الصندوق أو البنك" value={f.fund} onChange={e => setF(x => ({ ...x, fund: e.target.value }))}>{funds.filter(x => x.code !== '1101').map(x => <option key={x.code} value={x.code}>{x.name}</option>)}</select></Field>}
            {f.kind !== 'ov' && f.kind !== 'tv' && f.pm !== 'cash' && <Field label={f.pm === 'cheque' ? 'رقم الشيك *' : 'مرجع التحويل'}><input className="inp" aria-label="مرجع السند" value={f.ref} onChange={e => setF(x => ({ ...x, ref: e.target.value }))} /></Field>}
          </div>
          <Field label="البيان"><input className="inp" aria-label="بيان السند" value={f.note} onChange={e => setF(x => ({ ...x, note: e.target.value }))} /></Field>
          {deptOk && <Field label="القسم (اختياري)"><select className="sel" aria-label="قسم سند الصرف" data-cv-dept value={f.deptId || ''} onChange={e => setF(x => ({ ...x, deptId: e.target.value }))}><option value="">بلا قسم</option>{deptList(org).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}<option value={DEPT_SHARED}>مشترك</option></select></Field>}
          {f.kind !== 'tv' && f.kind !== 'ov' && projList(org).length > 0 && <Field label="المشروع (اختياري)"><select className="sel" aria-label="مشروع السند" value={f.projectId || ''} onChange={e => setF(x => ({ ...x, projectId: e.target.value }))}><option value="">—</option>{projList(org).map(p => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select></Field>}
          {docs.length > 0 && <div style={{ marginTop: 8 }} data-cvalloc>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span className="lbl">التوزيع على الفواتير المفتوحة (والباقي على الحساب)</span><button className="btn sm gh" onClick={autoAlloc} data-cvauto>توزيع تلقائي (الأقدم أولًا)</button></div>
            {docs.map(d => <div key={d.id} className="row" style={{ gap: 8, marginBottom: 4, alignItems: 'center', fontSize: 12 }}>
              <span style={{ flex: 1 }}>{d.no} · {d.date} · المتبقي <b className="num">{money(d.rem)}</b></span>
              <input className="inp n" style={{ width: 110 }} inputMode="decimal" aria-label={'توزيع ' + d.no} value={f.alloc[d.id] || ''} onChange={e => setF(x => ({ ...x, alloc: { ...x.alloc, [d.id]: e.target.value.replace(/[^\d.]/g, '') } }))} />
            </div>)}
            <div className="hint">الموزَّع <b className="num">{money(allocSum)}</b> · على الحساب <b className="num">{money(Math.max(0, r2(f.amount) - allocSum))}</b></div>
          </div>}
        </Modal>
      )}
    </div>);
}
