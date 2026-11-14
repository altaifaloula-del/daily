/* v40.6 — «مطابقة تسويات الشبكة» بالأجهزة: كشف البنك مقابل مبيعات الشبكة في الإغلاقات
   المحرك في النواة (cardStmtLines/cardRecon). الكشف يُقرأ في الجهاز ولا يُحفظ؛ يُحفظ ملخص المطابقة المعتمد فقط. */
import React, { useMemo, useState } from 'react';
import { CreditCard, Upload, Info, Download, Check, Lock, ChevronDown, AlertTriangle } from 'lucide-react';
import { CRS_ST, capOK, cardSettlePlan } from '../../App.jsx';   // v41.3
import { Kpi, ROLES, CR_TYPE, cardRecon, cardStmtLines, detectStmtMap, makeXlsx, money, nowISO, parseCsvGrid, parseMt940, parseXlsxGrid, roleEdit, today, uid } from '../../App.jsx';

const addD = (d, k) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + k); return x.toISOString().slice(0, 10); };
const mEnd = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
const pc = (v) => (v == null ? '—' : v + '%');

async function readStmt(f) {
  if (/\.xlsx$/i.test(f.name)) {
    const sheets = await parseXlsxGrid(await f.arrayBuffer(), { all: true }); let best = null;
    sheets.forEach(sh => { const m = detectStmtMap(sh.grid); if (!m) return; const L = cardStmtLines(sh.grid, m); if (!best || L.length > best.L.length) best = { sheet: sh.name, L }; });
    return best || { sheet: '', L: [] };
  }
  const txt = await f.text(); const mt = parseMt940(txt);
  const grid = mt ? [['التاريخ', 'البيان', 'مدين', 'دائن', 'المرجع'], ...mt.lines.map(l => [l.date, l.desc, l.amount < 0 ? -l.amount : '', l.amount > 0 ? l.amount : '', l.ref])] : parseCsvGrid(txt);
  const m = detectStmtMap(grid); return { sheet: mt ? 'MT940' : 'CSV', L: m ? cardStmtLines(grid, m) : [] };
}

export function CardRecon({ org, ops, me, commit, commitOrg, say }) {
  const central = (ROLES[me?.role] || {}).scope === 'all';
  const pm = addD(today().slice(0, 7) + '-01', -1).slice(0, 7);
  const [month, setMonth] = useState(pm);
  const [files, setFiles] = useState([]);   // [{name, sheet, L}]
  const [tol, setTol] = useState('0.5');
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);
  const lines = useMemo(() => files.flatMap(f => f.L), [files]);
  const M = useMemo(() => lines.length ? cardRecon(org, ops, lines, { from: month + '-01', to: mEnd(month), tol: Number(tol) }) : null, [org, ops, lines, month, tol]);
  if (!central) return <div className="card"><div className="empty"><Lock size={16} /> مطابقة الشبكة للإدارة المالية المركزية — تجمع إغلاقات كل الفروع.</div></div>;
  const canEdit = roleEdit(me?.role);
  const pick = async (e) => { const fs = [...(e.target.files || [])]; e.target.value = ''; if (!fs.length) return; setBusy(true);
    try { const got = []; for (const f of fs) { const r = await readStmt(f); got.push({ name: f.name, ...r }); }
      setFiles(x => [...x.filter(a => !got.some(g => g.name === a.name)), ...got]);
      const n = got.reduce((s, g) => s + g.L.length, 0); say(n ? 'قُرئ ' + got.length + ' كشف — ' + n + ' حركة شبكة ✓' : 'لم تُعرف حركات شبكة في الملف — تأكد أنه كشف الحساب بأعمدة التاريخ والدائن والمدين', n ? undefined : 'no');
    } catch { say('تعذّرت قراءة الملف — ارفعه xlsx أو CSV أو MT940', 'no'); } setBusy(false); };
  const assign = async (tid, branchId) => { const ok = await commitOrg(d => ({ ...d, cardTerminals: [...(d.cardTerminals || []).filter(x => x.tid !== tid), ...(branchId ? [{ tid, branchId }] : [])] }),
    { actionType: 'update', targetType: 'settings', targetId: 'cardTerminals', need: 'edit', title: 'إسناد جهاز شبكة لفرع', details: '…' + tid + ' ← ' + (((org.branches || []).find(b => b.id === branchId) || {}).name || 'بلا فرع') });
    if (ok !== false) say('أُسند الجهاز ✓'); };
  const saveRec = async () => { if (!M) return;
    const rec = { id: uid('crr'), from: M.from, to: M.to, by: me.name, at: nowISO(), files: files.map(f => f.name), tol: M.tol, tot: M.tot,
      branches: M.branches.map(b => ({ id: b.id, name: b.name, exp: b.exp, bank: b.bank, diff: b.diff, pct: b.pct, ok: b.ok, lag: b.lag, madaFee: b.mada.fee, madaEff: b.mada.eff, vmFee: b.vm.fee, devFee: b.devFee })), unmapped: M.unmapped };
    const ok = await commit(d => ({ ...d, cardRecons: [rec, ...(d.cardRecons || [])].slice(0, 60) }), { actionType: 'create', targetType: 'bank_rec', targetId: rec.id, need: 'post', title: 'اعتمد مطابقة تسويات الشبكة', details: M.from + ' — ' + M.to + ' · الفرق ' + money(M.tot.diff) });
    if (ok !== false) say('حُفظت المطابقة ✓'); };
  const exportX = () => { if (!M) return; try {
    const s1 = [['الفرع', 'الشبكة في الإغلاقات', 'المودَع (إجمالي)', 'الفرق', 'الفرق %', 'فارق التوقيت (يوم)', 'إجمالي مدى', 'عمولة مدى', 'نسبتها الفعلية %', 'صافي فيزا/ماستر/أمكس', 'عمولتها التقديرية', 'رسوم الأجهزة'],
      ...M.branches.map(b => [b.name, b.exp, b.bank, b.diff, b.pct ?? '', b.lag, b.mada.gross, b.mada.fee, b.mada.eff ?? '', b.vm.net, b.vm.fee, b.devFee])];
    const s2 = [['الفرع', 'التاريخ', 'الإغلاقات', 'المودَع', 'الفرق', 'الفرق التراكمي'], ...M.branches.flatMap(b => b.days.map(x => [b.name, x.date, x.exp, x.bank, x.diff, x.cum]))];
    const s3 = [['الجهاز', 'الفرع', 'إجمالي مدى', 'عمولة مدى', 'النسبة %', 'صافي فيزا/ماستر/أمكس', 'رسوم الجهاز', 'عدد الحركات'], ...M.terminals.map(t => [t.tid, ((org.branches || []).find(b => b.id === t.branchId) || {}).name || 'غير مسند', t.madaGross, t.madaFee, t.eff ?? '', t.vmNet, t.devFee, t.n])];
    const blob = makeXlsx([{ name: 'المطابقة', rows: s1 }, { name: 'يوميًا', rows: s2 }, { name: 'الأجهزة', rows: s3 }]); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'مطابقة_الشبكة_' + month + '.xlsx'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1500); } catch { say('تعذّر توليد Excel', 'no'); } };
  const brOpts = (org.branches || []);
  // v41.3 — التسوية التلقائية لوسيط الشبكة (الأيام المعتمد إغلاقها فقط)
  const SP = M ? cardSettlePlan(org, ops, lines, { lags: Object.fromEntries(M.branches.map(b => [b.id, b.lag])) }) : null;
  const canPost = capOK(me?.role, 'post') && !!commit;
  const postSettle = async () => { if (!SP || !SP.ready.length) return; const now = nowISO();
    const recs = SP.ready.map(r => ({ id: uid('jm'), date: r.date, ref: r.ref, src: 'cardSettle', title: 'تسوية وسيط الشبكة آليًا — ' + r.branch + ' — إيداع ' + r.date + ' (مبيعات ' + r.biz + ')', opening: false, by: me?.name || '', createdAt: now, lines: r.lines }));
    const ok = await commit(d => { const have = new Set((d.journalManual || []).map(j => j.ref).filter(Boolean)); const add = recs.filter(x => !have.has(x.ref)); return add.length ? { ...d, journalManual: [...add, ...(d.journalManual || [])] } : d; },
      { actionType: 'create', targetType: 'journal_entry', targetId: 'cardSettle', need: 'post', title: 'رحّل التسوية التلقائية لوسيط الشبكة', details: recs.length + ' قيد · ' + money(recs.reduce((a, r) => a + r.lines.reduce((x, l) => x + l.debit, 0), 0)) });
    if (ok !== false) say('رُحّل ' + recs.length + ' قيد تسوية ✓ — الوسيط يُقفل بما أودعه البنك، والعمولات وضريبتها في حساباتها'); };
  const saved = (ops.cardRecons || []).slice(0, 6);
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div><h2 style={{ fontSize: 17 }}>مطابقة تسويات الشبكة</h2><div style={{ fontSize: 12, color: 'var(--dim)' }}>مبيعات الشبكة في الإغلاقات مقابل ما أودعه البنك فعلًا — لكل جهاز وفرع ويوم، مع العمولات</div></div>
        <div className="rp-seg">{M && <button className="btn sm" onClick={exportX}><Download size={13} />Excel</button>}{M && commit && <button className="btn sm pri" onClick={saveRec}><Check size={13} />اعتماد المطابقة</button>}</div>
      </div>
      <div className="card"><div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <label className="btn pri" style={{ flex: '0 0 auto' }}><Upload size={14} />{busy ? 'جارٍ القراءة…' : 'رفع كشف الحساب'}<input type="file" multiple accept=".xlsx,.csv,.txt,.sta,.mt940" style={{ display: 'none' }} onChange={pick} /></label>
        <input className="inp" type="month" style={{ flex: '0 0 auto', width: 150 }} value={month} onChange={e => e.target.value && setMonth(e.target.value)} aria-label="الشهر" />
        <label className="pp-lead">حد التطابق <input className="inp n" inputMode="decimal" value={tol} onChange={e => setTol(e.target.value.replace(/[^\d.]/g, '').slice(0, 4))} />%</label>
        {files.map(f => <span key={f.name} className="badge b-dim" title={f.sheet}>{f.name} · {f.L.length} <button type="button" className="cr-x" aria-label={'إزالة ' + f.name} onClick={() => setFiles(x => x.filter(a => a.name !== f.name))}>×</button></span>)}
      </div><div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 6 }}>ارفع كشوف كل الحسابات التي تودَع فيها الشبكة معًا (Excel أو CSV أو MT940). الكشف يُقرأ على جهازك ولا يُرفع للسحابة — يُحفظ ملخص المطابقة فقط عند اعتمادها.</div></div>
      {!M ? <div className="card"><div className="empty">ارفع كشف الحساب للشهر لتبدأ المطابقة.{saved.length ? '' : ''}</div></div> : <>
        {M.notes.length > 0 && <div className="cf-notes">{M.notes.map((n, i) => <div key={i} className="cf-note warn"><span className="badge b-amber">تنبيه</span><span>{n}</span></div>)}</div>}
        <div className="grid g4">
          <Kpi label="الشبكة في الإغلاقات" value={money(M.tot.exp)} sub={M.from + ' — ' + M.to} icon={CreditCard} color="#5B93C4" />
          <Kpi label="المودَع (بإجماليه)" value={money(M.tot.bank)} sub={M.lines + ' حركة · الكشف حتى ' + M.maxDate} icon={CreditCard} color="#4FB286" />
          <Kpi label="الفرق" value={money(M.tot.diff)} sub={M.tot.diff > 0 ? 'الإغلاقات أعلى من المودَع' : M.tot.diff < 0 ? 'المودَع أعلى من الإغلاقات' : 'متطابق'} icon={AlertTriangle} color={Math.abs(M.tot.diff) < 1 ? '#4FB286' : '#D9544D'} />
          <Kpi label="عمولات ورسوم الشبكة" value={money(M.tot.madaFee + M.tot.vmFee + M.tot.devFee)} sub={'مدى ' + money(M.tot.madaFee) + ' · بطاقات ' + money(M.tot.vmFee) + ' · أجهزة ' + money(M.tot.devFee) + ' — منها ضريبة مدخلات ' + money(M.tot.feeVat)} icon={CreditCard} color="#E0A458" />
        </div>
        {M.branches.map(b => <div key={b.id} className="card cr-br">
          <div className="cr-h"><b>{b.name}</b><span className={'badge ' + (b.noTid ? 'b-dim' : b.ok ? 'b-mint' : 'b-rose')}>{b.noTid ? 'لا جهاز مسند' : b.ok ? 'متطابق' : 'فرق ' + pc(b.pct)}</span>{b.lag ? <span className="badge b-dim">الإيداع بعد {b.lag === 1 ? 'يوم' : 'يومين'}</span> : null}</div>
          <div className="pf-grid">
            <div className="pf-c"><small>الشبكة في الإغلاقات</small><b className="num">{money(b.exp)}</b></div>
            <div className="pf-c"><small>المودَع بإجماليه</small><b className="num">{money(b.bank)}</b><span>مدى {money(b.mada.gross)} · بطاقات {money(b.vm.gross)}</span></div>
            <div className={'pf-c' + (b.ok ? '' : ' over')}><small>الفرق</small><b className="num">{money(b.diff)}</b><span>{pc(b.pct)}</span></div>
            <div className={'pf-c' + (b.mada.expEff != null && b.mada.eff != null && b.mada.eff > b.mada.expEff + 0.01 ? ' over' : '')}><small>عمولة مدى الفعلية</small><b className="num">{pc(b.mada.eff)}</b><span>{b.mada.expEff != null ? 'العقد ' + b.mada.expEff + '% شاملة الضريبة' : 'نسبة العقد غير مُدخلة'} · {money(b.mada.fee)}</span></div>
            <div className="pf-c"><small>عمولة البطاقات (تقديرية)</small><b className="num">{money(b.vm.fee)}</b><span>صافي {money(b.vm.net)}{b.vm.miss.length ? ' · بلا نسبة: ' + b.vm.miss.map(k => CR_TYPE[k]).join('، ') : ''}</span></div>
            {b.devFee > 0 && <div className="pf-c over"><small>رسوم أجهزة (شهرية/ضعف استخدام)</small><b className="num">{money(b.devFee)}</b></div>}
          </div>
          {b.days.length > 0 && <><button type="button" className="cf-wh" onClick={() => setOpen(open === b.id ? null : b.id)} aria-expanded={open === b.id}><span className="card-t" style={{ fontSize: 12.5 }}>يومًا بيوم</span><ChevronDown size={14} className="cf-chev" /></button>
            {open === b.id && <div className="pf-days">{b.days.map(x => <div key={x.date} className={'pf-day' + (Math.abs(x.diff) >= 1 ? ' neg' : '')}>
              <span className="pf-a"><b className="dt">{x.date}</b><small>الإغلاقات {money(x.exp)} · المودَع {money(x.bank)}</small></span>
              <span className="pf-b"><small>التراكمي {money(x.cum)}</small><b className="num" dir="ltr">{money(x.diff)}</b></span></div>)}</div>}</>}
        </div>)}
        {SP && SP.rows.length > 0 && <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
            <div className="card-t">التسوية التلقائية للوسيط ({SP.ready.length} جاهز من {SP.rows.length})</div>
            {canPost && SP.ready.length > 0 && <button className="btn sm pri" onClick={postSettle}><Check size={13} />ترحيل القيود الجاهزة ({SP.ready.length})</button>}</div>
          <div className="tbl-wrap"><table className="tb tb-fp"><thead><tr><th>الفرع</th><th>الإيداع</th><th>المبيعات</th><th>الإجمالي المُسوّى</th><th>العمولة</th><th>الضريبة</th><th>للبنك</th><th>الحالة</th></tr></thead>
            <tbody>{SP.rows.map(r => <tr key={r.ref}><td>{r.branch}</td><td className="num">{r.date}</td><td className="num">{r.biz}</td><td className="num">{r.clrOn ? money(r.gross) : '—'}</td><td className="num">{money(r.feeEx + r.devEx)}</td><td className="num">{money(r.vat)}</td><td className="num">{r.clrOn ? money(r.net) : '−' + money(r.fee + r.dev)}</td>
              <td><span className={'badge ' + CRS_ST[r.status][0]}>{CRS_ST[r.status][1]}</span>{r.noRate.length ? <small style={{ display: 'block', color: 'var(--amber)' }}>بلا نسبة: {r.noRate.map(k => CR_TYPE[k]).join('، ')}</small> : null}</td></tr>)}</tbody></table></div>
          <div className="note" style={{ marginTop: 8 }}>لكل فرع ويوم إيداع قيد واحد: {(org.posClearing || {}).enabled ? <>من حـ/البنك (ما أُودع فعلًا) + حـ/عمولات الشبكة (بلا ضريبة) + حـ/رسوم الأجهزة + حـ/ضريبة المدخلات ⇐ إلى حـ/وسيط الشبكة (الإجمالي المُسوّى)</> : <>«وسيط الشبكة» غير مفعّل — الشبكة قُيّدت في البنك بإجماليها، فيُقيَّد من حـ/العمولات وضريبتها ⇐ إلى حـ/البنك</>}.
            لا يُرحَّل يوم إغلاقه غير معتمد أو غير موجود أو فترته مقفلة، ولا يتكرر المُرحّل. ضريبة العمولة مدخلات قابلة للاسترداد بفاتورة البنك الضريبية. ما يبقى في الوسيط بعدها = مبيعات شبكة لم يُودعها البنك بعد أو فرق يستحق المراجعة.</div>
        </div>}
        <div className="card"><div className="card-t" style={{ marginBottom: 6 }}>الأجهزة في الكشف ({M.terminals.length}) — أسند كل جهاز لفرعه مرة واحدة</div>
          <div className="me-list">{M.terminals.map(t => <div key={t.tid} className="me-row">
            <span className="me-a"><b className="num">…{t.tid}</b><small>مدى {money(t.madaGross)} · عمولة {money(t.madaFee)} ({pc(t.eff)}) · بطاقات صافي {money(t.vmNet)}{t.devFee ? ' · رسوم جهاز ' + money(t.devFee) : ''}</small><small>{t.n} حركة · {t.first} — {t.last}</small></span>
            <span className="me-b">{canEdit && commitOrg ? <select className="inp sel" aria-label={'فرع الجهاز ' + t.tid} value={t.branchId} onChange={e => assign(t.tid, e.target.value)}><option value="">— غير مسند —</option>{brOpts.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
              : <small>{(brOpts.find(b => b.id === t.branchId) || {}).name || 'غير مسند'}</small>}</span></div>)}</div></div>
      </>}
      {saved.length > 0 && <div className="card"><div className="card-t" style={{ marginBottom: 6 }}>المطابقات المعتمدة</div>
        <div className="me-list">{saved.map(r => <div key={r.id} className="me-row"><span className="me-a"><b>{r.from} — {r.to}</b><small>{r.by} · {String(r.at).slice(0, 16).replace('T', ' ')} · {(r.files || []).length} كشف</small></span>
          <span className="me-b"><b className="num" dir="ltr">{money(r.tot.diff)}</b><small>{r.branches.filter(b => !b.ok).length ? r.branches.filter(b => !b.ok).length + ' فرع بفرق' : 'كل الفروع متطابقة'}</small></span></div>)}</div></div>}
      <div className="note"><Info size={13} style={{ verticalAlign: -2 }} /> <b>كيف تُطابَق؟</b> من نص كل حركة يُقرأ رقم الجهاز (آخر 4 أرقام) ونوع البطاقة. دفعة مدى تُودَع بإجماليها وعمولتها قيد مستقل؛ وفيزا وماستركارد وأمريكان إكسبريس تُودَع صافية،
        فيُعاد إجماليها بنسب العقد في «إعدادات الربحية» (العمولة + ضريبتها {M ? M.vat : 15}%). رسوم «ضعف الاستخدام» الشهرية رسوم أجهزة لا عمولة مبيعات. فارق توقيت الإيداع (0–2 يوم) يُستنتج لكل فرع بأقل فرق يومي.
        الفرق التراكمي يتأرجح بالتوقيت ثم يعود قرب الصفر؛ فرق ثابت أو متزايد = إيداع ناقص أو مبيعات شبكة مسجّلة خطأ أو جهاز من بنك آخر لم يُرفع كشفه. ضريبة العمولات مدخلات قابلة للاسترداد بفاتورة البنك الضريبية.</div>
    </div>);
}
