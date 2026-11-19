/* v50.0 — المرحلة 05: مكوّن الجدول الموحد للتقارير — فرز، إخفاء أعمدة، بحث، فلاتر محفوظة، تتبع (Drill-down)،
   وشريط مخرجات موحد (طباعة بالقالب الموحد · Excel منسق بصيغ · CSV) مع اختيار اللغة والاتجاه والورق. */
import React, { useMemo, useState } from 'react';
import { Printer, Download, FileText, Search, Eye, ChevronDown } from 'lucide-react';
import { rptFmt, rptFlat, rptTotals, printReport, makeRptXlsx, rptCsv, rptDownload, RPT_TEMPLATES } from '../../App.jsx';

const LS = 'mz-rpt:';
const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(LS + k) || 'null'); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) { /* التخزين غير متاح */ } };
const isNum = (c) => ['money', 'qty', 'int', 'pct'].includes(c.type);

/** spec: مواصفة التقرير الموحدة. onRow(row): تتبع السطر إلى مصدره (اختياري) */
export function RptTable({ org, spec, onRow, me, extraTools }) {
  const key = (spec.id || 'rpt') + ':' + ((me && me.id) || '');
  const saved = lsGet(key) || {};
  const [sort, setSort] = useState(saved.sort || null);           // { key, dir: 1|-1 }
  const [hide, setHide] = useState(saved.hide || []);
  const [q, setQ] = useState('');
  const [opt, setOpt] = useState({ lang: saved.lang || 'ar', orientation: saved.orientation || spec.orientation || 'portrait', paper: saved.paper || spec.paper || 'A4' });
  const [colsOpen, setColsOpen] = useState(false);
  const [views, setViews] = useState(saved.views || []);
  const persist = (patch) => lsSet(key, { sort, hide, views, ...opt, ...patch });
  const cols = (spec.columns || []).filter(c => !hide.includes(c.key));
  // البحث والفرز على صفوف البيانات؛ المجموعات تبقى بترتيبها (الفرز داخل كل مجموعة)
  const filt = (rows) => { let r = rows; if (q) { const s = q.trim(); r = r.filter(x => (spec.columns || []).some(c => String(x[c.key] ?? '').includes(s))); }
    if (sort) { const c = (spec.columns || []).find(x => x.key === sort.key); r = [...r].sort((a, b) => { const va = a[sort.key], vb = b[sort.key]; return (c && isNum(c) ? (Number(va) || 0) - (Number(vb) || 0) : String(va ?? '').localeCompare(String(vb ?? ''), 'ar')) * sort.dir; }); }
    return r; };
  const view = useMemo(() => ({ ...spec, ...opt, columns: cols, rows: spec.groups ? undefined : filt(spec.rows || []), groups: spec.groups ? spec.groups.map(g => ({ ...g, rows: filt(g.rows || []) })).filter(g => g.rows.length) : undefined }),
    [spec, opt, hide, sort, q]);   // eslint-disable-line
  const flat = rptFlat(view), T = rptTotals(view);
  const clickSort = (c) => { const n = !sort || sort.key !== c.key ? { key: c.key, dir: 1 } : sort.dir === 1 ? { key: c.key, dir: -1 } : null; setSort(n); persist({ sort: n }); };
  const toggleCol = (k) => { const n = hide.includes(k) ? hide.filter(x => x !== k) : [...hide, k]; if (n.length >= (spec.columns || []).length) return; setHide(n); persist({ hide: n }); };
  const setO = (p) => { const n = { ...opt, ...p }; setOpt(n); lsSet(key, { sort, hide, views, ...n }); };
  const saveView = () => { const name = (window.prompt('اسم العرض المحفوظ (الفرز والأعمدة والبحث):') || '').trim(); if (!name) return; const n = [...views.filter(v => v.name !== name), { name, sort, hide, q }]; setViews(n); persist({ views: n }); };
  const useView = (v) => { setSort(v.sort || null); setHide(v.hide || []); setQ(v.q || ''); persist({ sort: v.sort || null, hide: v.hide || [] }); };
  const fileName = (ext) => String(spec.title || 'تقرير').replace(/[\\/:*?"<>|]/g, ' ') + (spec.sub ? ' ' + String(spec.sub).replace(/[\\/:*?"<>|]/g, ' ') : '') + '.' + ext;
  return (
    <div data-rpttable={spec.id || ''}>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }} data-noprint>
        <div className="row" style={{ gap: 4, alignItems: 'center' }}><Search size={13} /><input className="inp" style={{ width: 170 }} aria-label="بحث في التقرير" placeholder="بحث…" value={q} onChange={e => setQ(e.target.value)} /></div>
        <div style={{ position: 'relative' }}>
          <button className="btn sm gh" onClick={() => setColsOpen(x => !x)} data-rptcols><Eye size={13} />الأعمدة{hide.length ? ' (' + hide.length + ' مخفي)' : ''}</button>
          {colsOpen && <div className="card" style={{ position: 'absolute', zIndex: 20, top: '110%', insetInlineStart: 0, minWidth: 180, padding: 8 }}>
            {(spec.columns || []).map(c => <label key={c.key} className="row" style={{ gap: 5, fontSize: 12, padding: '2px 0' }}><input type="checkbox" aria-label={'عمود ' + c.label} checked={!hide.includes(c.key)} onChange={() => toggleCol(c.key)} />{c.label}</label>)}
          </div>}
        </div>
        {views.length > 0 && <select className="sel" style={{ width: 'auto' }} aria-label="العروض المحفوظة" value="" onChange={e => { const v = views.find(x => x.name === e.target.value); if (v) useView(v); }}><option value="">العروض المحفوظة…</option>{views.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}</select>}
        <button className="btn sm gh" onClick={saveView} data-rptsave>حفظ العرض</button>
        <span style={{ flex: 1 }} />
        {extraTools}
        <select className="sel" style={{ width: 'auto' }} aria-label="لغة التقرير" value={opt.lang} onChange={e => setO({ lang: e.target.value })}><option value="ar">عربي</option><option value="en">English</option></select>
        <select className="sel" style={{ width: 'auto' }} aria-label="اتجاه الورق" value={opt.orientation} onChange={e => setO({ orientation: e.target.value })}><option value="portrait">طولي</option><option value="landscape">عرضي</option></select>
        <select className="sel" style={{ width: 'auto' }} aria-label="حجم الورق" value={opt.paper} onChange={e => setO({ paper: e.target.value })}><option>A4</option><option>A3</option><option>Letter</option></select>
        <button className="btn sm" onClick={() => printReport(org, view)} data-rptprint><Printer size={13} />طباعة</button>
        <button className="btn sm" onClick={() => rptDownload(makeRptXlsx(org, view), fileName('xlsx'))} data-rptxlsx><Download size={13} />Excel</button>
        <button className="btn sm gh" onClick={() => rptDownload(new Blob([rptCsv(view)], { type: 'text/csv;charset=utf-8' }), fileName('csv'))} data-rptcsv><FileText size={13} />CSV</button>
      </div>
      <div className="tw"><table className="tb" data-rptgrid>
        <thead><tr>{cols.map(c => <th key={c.key} style={{ cursor: 'pointer', textAlign: isNum(c) ? 'end' : undefined, whiteSpace: 'nowrap' }} onClick={() => clickSort(c)} aria-sort={sort && sort.key === c.key ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}>
          {opt.lang === 'en' && c.en ? c.en : c.label}{sort && sort.key === c.key ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}</th>)}</tr></thead>
        <tbody>
          {flat.map((r, i) => r._k === 'head' ? <tr key={'h' + i} style={{ background: 'rgba(200,162,74,.07)' }}><td colSpan={cols.length}><b>{r._label}</b></td></tr>
            : r._k === 'sub' ? <tr key={'s' + i} style={{ fontWeight: 700 }}><td>{r._label}</td>{cols.slice(1).map(c => <td key={c.key} className="num" style={{ textAlign: 'end' }}>{c.total === 'sum' ? rptFmt(r[c.key], c) : ''}</td>)}</tr>
            : <tr key={'r' + i} style={{ fontWeight: r._bold ? 700 : undefined, cursor: onRow && r._drill !== false ? 'pointer' : undefined }} onClick={onRow && r._drill !== false ? () => onRow(r) : undefined} data-rptrow>
              {cols.map((c, k) => <td key={c.key} className={isNum(c) ? 'num' : undefined} style={{ textAlign: isNum(c) ? 'end' : undefined, color: isNum(c) && Number(r[c.key]) < 0 ? 'var(--rose)' : undefined, paddingInlineStart: k === 0 && r._level ? 8 + r._level * 14 : undefined }}>{rptFmt(r[c.key], c)}</td>)}</tr>)}
          {!flat.length && <tr><td colSpan={cols.length}><div className="empty">لا بيانات مطابقة.</div></td></tr>}
          {Object.keys(T).length > 0 && flat.length > 0 && <tr style={{ fontWeight: 800, background: 'rgba(200,162,74,.06)' }} data-rpttot><td>{spec.totalLabel || (opt.lang === 'en' ? 'Total' : 'الإجمالي')}</td>{cols.slice(1).map(c => <td key={c.key} className="num" style={{ textAlign: 'end' }}>{c.total === 'sum' ? rptFmt(T[c.key], c) : ''}</td>)}</tr>}
        </tbody></table></div>
      <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 6 }} data-noprint>القالب: {(RPT_TEMPLATES[spec.template] || RPT_TEMPLATES.list).ar} · اضغط رأس العمود للفرز{onRow ? ' · واضغط السطر لفتح مصدره' : ''}.</div>
    </div>);
}
