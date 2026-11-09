/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useMemo } from 'react';
import { Settings, ArrowUp, ArrowDown, Stamp, Plus, Eye, Trash2, FileText, Printer, Download } from 'lucide-react';
import { Field, RB_KIND_AR, RB_PM_AR, RB_SOURCES, _xe, branchEntityId, buildAccounting, countedClosing, entityById, entityList, isoD, makeXlsx, money, multiEntityOn, printA4, rolePost, sum } from '../../App.jsx';

export function ReportBuilder({ org, ops, me, myBranches, scoped, commitOrg, say, theme }) {
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const [cfg, setCfg] = useState({ source: 'closings', from: '', to: '', branch: '', entity: '', groupBy: 'none', cols: RB_SOURCES.closings.dflt.slice(), sortBy: '', sortDir: 'desc' });
  const [tplName, setTplName] = useState('');
  const S = RB_SOURCES[cfg.source];
  const set = (patch) => setCfg(c => ({ ...c, ...patch }));
  const setSource = (src) => setCfg(c => ({ ...c, source: src, groupBy: 'none', cols: RB_SOURCES[src].dflt.slice(), sortBy: '' }));
  const toggleCol = (k) => setCfg(c => ({ ...c, cols: c.cols.includes(k) ? c.cols.filter(x => x !== k) : [...c.cols, k] }));
  const canManage = rolePost(me?.role);  // v15.11: منع «عرض فقط» (مراجع) من حفظ/حذف قوالب التقارير

  const A = useMemo(() => buildAccounting(org, ops), [org, ops]);
  const counted = useMemo(() => (scoped.closings || []).filter(countedClosing), [scoped]);
  const inP = (d) => (!cfg.from || d >= cfg.from) && (!cfg.to || d <= cfg.to);
  const brOk = (bid) => !cfg.branch ? true : cfg.branch === 'central' ? !bid : bid === cfg.branch;
  const brName = (bid) => (myBranches.find(b => b.id === bid) || {}).name || (bid ? '—' : 'المركز الرئيسي');
  const rbEntMap = {}; (org.branches || []).forEach(b => rbEntMap[b.id] = branchEntityId(b));
  const entOk = (bid) => !cfg.entity ? true : rbEntMap[bid] === cfg.entity;
  const rbMulti = multiEntityOn(org);

  const records = useMemo(() => {
    if (cfg.source === 'closings') {
      return counted.filter(c => inP(c.date || '') && brOk(c.branchId) && entOk(c.branchId)).map(c => ({
        date: c.date, branch: c.branchName || brName(c.branchId),
        rev: r2(c.totalRevenue), exp: r2(c.totalExpenses), net: r2((c.totalRevenue || 0) - (c.totalExpenses || 0)),
        cash: r2(c.cashSales), card: r2(c.cardSales), delivery: r2(sum(c.deliverySales || [], s => s.amount || 0)),
        variance: r2(c.variance), count: 1
      }));
    }
    if (cfg.source === 'expenses') {
      const out = [];
      counted.filter(c => inP(c.date || '') && brOk(c.branchId) && entOk(c.branchId)).forEach(c => (c.expenses || []).forEach(e => {
        if (!((e.amount || 0) > 0)) return;
        out.push({ date: c.date, branch: c.branchName || brName(c.branchId), category: e.categoryName || 'مصروف', beneficiary: e.beneficiaryName || '—', method: RB_PM_AR[e.paymentMethod] || e.paymentMethod || '—', amount: r2(e.amount), count: 1 });
      }));
      return out;
    }
    const acc = {}; A.accounts.forEach(a => acc[a.code] = { code: a.code, name: a.name, kind: a.kind, d: 0, c: 0 });
    A.entries.forEach(e => { if (!inP(e.date || '')) return; if (!brOk(e.branchId)) return; if (!entOk(e.branchId)) return; e.lines.forEach(l => { const x = acc[l.code]; if (x) { x.d += l.debit; x.c += l.credit; } }); });
    return Object.values(acc).map(a => ({ code: a.code, name: a.name, kind: RB_KIND_AR[a.kind] || a.kind, debit: r2(a.d), credit: r2(a.c), balance: r2((a.kind === 'asset' || a.kind === 'exp') ? a.d - a.c : a.c - a.d) }))
      .filter(x => Math.abs(x.debit) > 0.004 || Math.abs(x.credit) > 0.004);
  }, [cfg.source, cfg.from, cfg.to, cfg.branch, cfg.entity, counted, A]);

  const grouped = useMemo(() => {
    if (cfg.groupBy === 'none') return records;
    const keyOf = (r) => cfg.groupBy === 'branch' ? r.branch : cfg.groupBy === 'month' ? (r.date || '').slice(0, 7) : cfg.groupBy === 'day' ? r.date : cfg.groupBy === 'category' ? r.category : cfg.groupBy === 'kind' ? r.kind : '';
    const numCols = S.cols.filter(c => c.num).map(c => c.k);
    const map = {};
    records.forEach(r => { const k = keyOf(r) || '—'; const g = map[k] || (map[k] = { __group: k }); numCols.forEach(nc => { g[nc] = r2((g[nc] || 0) + (r[nc] || 0)); }); });
    return Object.values(map);
  }, [records, cfg.groupBy]);

  const isGroup = cfg.groupBy !== 'none';
  const visCols = isGroup
    ? [{ k: '__group', ar: (S.groups.find(g => g[0] === cfg.groupBy) || [])[1] || 'المجموعة', num: false }, ...S.cols.filter(c => c.num && cfg.cols.includes(c.k))]
    : S.cols.filter(c => cfg.cols.includes(c.k));

  const rows = useMemo(() => {
    const arr = grouped.slice();
    if (cfg.sortBy) {
      const col = visCols.find(c => c.k === cfg.sortBy);
      const numeric = col && col.num;
      arr.sort((a, b) => numeric ? (cfg.sortDir === 'asc' ? 1 : -1) * ((a[cfg.sortBy] || 0) - (b[cfg.sortBy] || 0)) : (cfg.sortDir === 'asc' ? 1 : -1) * String(a[cfg.sortBy] == null ? '' : a[cfg.sortBy]).localeCompare(String(b[cfg.sortBy] == null ? '' : b[cfg.sortBy]), 'ar'));
    }
    return arr;
  }, [grouped, cfg.sortBy, cfg.sortDir, cfg.cols.join(','), cfg.groupBy]);

  const totals = {}; visCols.forEach(c => { if (c.num) totals[c.k] = r2(sum(rows, r => r[c.k] || 0)); });

  const preset = (kind) => {
    const d = new Date(), y = d.getFullYear(), m = d.getMonth(), iso = (dt) => isoD(dt);
    if (kind === 'month') set({ from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) });
    else if (kind === 'quarter') { const qs = Math.floor(m / 3) * 3; set({ from: iso(new Date(y, qs, 1)), to: iso(new Date(y, qs + 3, 0)) }); }
    else if (kind === 'year') set({ from: y + '-01-01', to: y + '-12-31' });
    else if (kind === 'lastyear') set({ from: (y - 1) + '-01-01', to: (y - 1) + '-12-31' });
    else set({ from: '', to: '' });
  };

  const templates = org.reportTemplates || [];
  const saveTpl = async () => {
    const nm = tplName.trim(); if (!nm) return say('أدخل اسمًا للقالب', 'no');
    const id = 'rt' + Date.now().toString(36);
    await commitOrg(d => ({ ...d, reportTemplates: [...(d.reportTemplates || []).filter(t => t.name !== nm), { id, name: nm, cfg: { ...cfg } }] }), { actionType: 'create', targetType: 'report_template', targetId: id, need: 'post', title: 'حفظ قالب تقرير', details: nm });
    setTplName(''); say('حُفظ القالب «' + nm + '»', 'ok');
  };
  const loadTpl = (t) => setCfg({ source: 'closings', from: '', to: '', branch: '', entity: '', groupBy: 'none', cols: [], sortBy: '', sortDir: 'desc', ...t.cfg, cols: (t.cfg.cols || []).slice() });
  const delTpl = async (t) => { await commitOrg(d => ({ ...d, reportTemplates: (d.reportTemplates || []).filter(x => x.id !== t.id) }), { actionType: 'delete', targetType: 'report_template', targetId: t.id, need: 'post', title: 'حذف قالب تقرير', details: t.name }); };

  const dlBlob = (name, blob) => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1500); };
  const csvCell = (v) => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const matrix = () => {
    const head = visCols.map(c => c.ar);
    const body = rows.map(r => visCols.map(c => c.num ? (r[c.k] || 0) : (r[c.k] != null ? r[c.k] : '')));
    const tot = visCols.map((c, i) => i === 0 ? 'الإجمالي' : (c.num ? totals[c.k] : ''));
    return { head, body, tot };
  };
  const subLine = () => S.ar + ((cfg.from || cfg.to) ? ' · ' + (cfg.from || 'البداية') + ' → ' + (cfg.to || 'النهاية') : ' · كل المدة') + (cfg.entity ? ' · ' + entityById(org, cfg.entity).name : '') + (cfg.branch ? ' · ' + (cfg.branch === 'central' ? 'المركز الرئيسي' : brName(cfg.branch)) : ' · كل الفروع') + (isGroup ? ' · ' + visCols[0].ar : '');
  const exportCsv = () => { const { head, body, tot } = matrix(); dlBlob('تقرير_مخصص.csv', new Blob(['﻿' + [head, ...body, tot].map(r => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })); };
  const exportXlsx = () => { try { const { head, body, tot } = matrix(); dlBlob('تقرير_مخصص.xlsx', makeXlsx([{ name: S.ar.slice(0, 28), rows: [head, ...body, tot] }])); } catch (e) { say('تعذّر توليد Excel', 'no'); } };
  const printRep = () => {
    if (!visCols.length) return say('اختر عمودًا واحدًا على الأقل', 'no');
    const { head, body, tot } = matrix();
    const th = head.map(h => `<th>${_xe(h)}</th>`).join('');
    const trs = body.map(r => '<tr>' + r.map((v, i) => `<td class="${visCols[i].num ? 'n' : ''}">${visCols[i].num ? money(v) : _xe(v)}</td>`).join('') + '</tr>').join('');
    const trTot = '<tr class="tot">' + tot.map((v, i) => `<td class="${visCols[i].num ? 'n' : ''}">${visCols[i].num ? money(v) : _xe(v)}</td>`).join('') + '</tr>';
    printA4(org, 'تقرير مخصّص — ' + S.ar, subLine(), `<table><thead><tr>${th}</tr></thead><tbody>${trs}${trTot}</tbody></table>`) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
  };

  const branchOpts = [{ v: '', ar: 'كل الفروع' }, { v: 'central', ar: 'المركز الرئيسي' }, ...myBranches.map(b => ({ v: b.id, ar: b.name }))];

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 17 }}>منشئ التقارير المخصّصة</h2>
          <div style={{ fontSize: 12, color: 'var(--dim)' }}>ابنِ تقريرك بنفسك — اختر المصدر والفترة والأعمدة والتجميع، ثم اطبع أو صدّر</div>
        </div>
      </div>

      <div className="card">
        <div className="card-t" style={{ marginBottom: 10 }}><Settings size={15} color="var(--brass)" />إعداد التقرير</div>

        <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 6 }}>مصدر البيانات</div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {Object.entries(RB_SOURCES).map(([k, v]) => <button key={k} className={'btn sm' + (cfg.source === k ? ' pri' : ' gh')} onClick={() => setSource(k)}>{v.ar}</button>)}
        </div>

        <div className="grid g3" style={{ gap: 10, marginBottom: 12 }}>
          <Field label="من تاريخ"><input className="inp" type="date" value={cfg.from} onChange={e => set({ from: e.target.value })} /></Field>
          <Field label="إلى تاريخ"><input className="inp" type="date" value={cfg.to} onChange={e => set({ to: e.target.value })} /></Field>
          <Field label="الفرع"><select className="inp" value={cfg.branch} onChange={e => set({ branch: e.target.value })}>{branchOpts.map(o => <option key={o.v} value={o.v}>{o.ar}</option>)}</select></Field>
          {rbMulti && <Field label="المنشأة"><select className="inp" value={cfg.entity} onChange={e => set({ entity: e.target.value })}><option value="">كل المنشآت</option>{entityList(org).map(en => <option key={en.id} value={en.id}>{en.name}</option>)}</select></Field>}
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {[['month', 'هذا الشهر'], ['quarter', 'هذا الربع'], ['year', 'هذه السنة'], ['lastyear', 'السنة الماضية'], ['all', 'كل المدة']].map(pz => <button key={pz[0]} className="btn sm gh" onClick={() => preset(pz[0])}>{pz[1]}</button>)}
        </div>

        <div className="grid g2" style={{ gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 6 }}>التجميع</div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {S.groups.map(g => <button key={g[0]} className={'btn sm' + (cfg.groupBy === g[0] ? ' pri' : ' gh')} onClick={() => set({ groupBy: g[0] })}>{g[1]}</button>)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 6 }}>الفرز</div>
            <div className="row" style={{ gap: 8 }}>
              <select className="inp" style={{ flex: 1 }} value={cfg.sortBy} onChange={e => set({ sortBy: e.target.value })}>
                <option value="">— بلا فرز —</option>
                {visCols.map(c => <option key={c.k} value={c.k}>{c.ar}</option>)}
              </select>
              <button className="btn sm gh" onClick={() => set({ sortDir: cfg.sortDir === 'asc' ? 'desc' : 'asc' })} title="اتجاه الفرز">{cfg.sortDir === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}</button>
            </div>
          </div>
        </div>

        <div style={{ fontSize: 11, color: 'var(--dim)', margin: '12px 0 6px' }}>الأعمدة {isGroup && <span>(عند التجميع تُجمَع الأعمدة الرقمية المختارة)</span>}</div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {S.cols.map(c => <button key={c.k} className={'btn sm' + (cfg.cols.includes(c.k) ? ' pri' : ' gh')} onClick={() => toggleCol(c.k)}>{cfg.cols.includes(c.k) ? '✓ ' : ''}{c.ar}</button>)}
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <div className="card-t"><Stamp size={15} color="var(--brass)" />قوالب محفوظة</div>
          {canManage && <div className="row" style={{ gap: 8 }}>
            <input className="inp" style={{ width: 180 }} placeholder="اسم القالب" value={tplName} onChange={e => setTplName(e.target.value)} />
            <button className="btn sm pri" onClick={saveTpl}><Plus size={14} />حفظ الإعداد الحالي</button>
          </div>}
        </div>
        {templates.length ? (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {templates.map(t => (
              <div key={t.id} className="row" style={{ gap: 4, alignItems: 'center', background: 'var(--acc-soft)', border: '1px solid var(--frame-o)', borderRadius: 8, padding: '4px 6px 4px 10px' }}>
                <button className="btn sm gh" onClick={() => loadTpl(t)}><Eye size={13} />{t.name}</button>
                {canManage && <button className="btn sm gh" onClick={() => delTpl(t)} title="حذف"><Trash2 size={12} /></button>}
              </div>
            ))}
          </div>
        ) : <div className="empty" style={{ padding: '14px 10px' }}>لا قوالب محفوظة بعد — اضبط تقريرًا واحفظه لإعادة استخدامه لاحقًا.</div>}
      </div>

      <div className="card">
        <div className="card-h">
          <div className="card-t"><FileText size={15} color="var(--brass)" />النتيجة — {rows.length} سطرًا</div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn sm" onClick={printRep}><Printer size={13} />طباعة</button>
            <button className="btn sm" onClick={exportXlsx}><Download size={13} />Excel</button>
            <button className="btn sm" onClick={exportCsv}><Download size={13} />CSV</button>
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 8 }}>{subLine()}</div>
        {!visCols.length ? <div className="empty">اختر عمودًا واحدًا على الأقل لعرض التقرير.</div>
          : !rows.length ? <div className="empty">لا بيانات مطابقة للمرشّحات الحالية.</div>
            : (
              <div className="tw">
                <table className="tb">
                  <thead><tr>{visCols.map(c => <th key={c.k} style={c.num ? { textAlign: 'end' } : null}>{c.ar}</th>)}</tr></thead>
                  <tbody>
                    {rows.slice(0, 500).map((r, i) => (
                      <tr key={i}>{visCols.map(c => <td key={c.k} className={c.num ? 'num' : ''} style={c.num ? { textAlign: 'end' } : null}>{c.num ? money(r[c.k] || 0) : (r[c.k] != null ? r[c.k] : '—')}</td>)}</tr>
                    ))}
                    <tr style={{ fontWeight: 900, background: 'rgba(200,162,74,.05)' }}>
                      {visCols.map((c, i) => <td key={c.k} className={c.num ? 'num' : ''} style={c.num ? { textAlign: 'end' } : null}>{i === 0 ? 'الإجمالي' : (c.num ? money(totals[c.k] || 0) : '')}</td>)}
                    </tr>
                  </tbody>
                </table>
                {rows.length > 500 && <div className="note" style={{ marginTop: 8 }}>عُرض أول 500 سطر — صدّر إلى Excel/CSV لكامل البيانات (الإجمالي أعلاه يشمل كل الأسطر).</div>}
              </div>
            )}
      </div>

      <div className="note">💡 كل الأرقام مشتقّة من بياناتك المعتمدة مباشرةً. «أرصدة الحسابات» تتأثر بالفترة والفرع كميزان مراجعة مصغّر؛ احفظ إعداداتك كقالب لتكرّر التقرير بضغطة.</div>
    </div>
  );
}
