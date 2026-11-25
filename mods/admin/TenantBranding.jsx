/* v56.0 — «الهوية التجارية للمنشأة» (أمر التصميم v56.0، القسم الرابع)
   هوية المنشأة مستقلة عن هوية المنصة MUKTASAB: تُطبَّق في مساحتها من الإطار وفي تقاريرها ومستنداتها فقط.
   الحفظ عبر commitOrg (مستند المنشأة — يكتبه مسؤول النظام وحده على الخادم) مع قيد في سجل التدقيق. */
import React, { useState, useMemo, useRef } from 'react';
import { Palette, Check, RotateCcw, Upload, X, Eye, Lock } from 'lucide-react';
import { Field, BrandSymbol, tbNorm, tenantBrand, TB_NEUTRAL, TB_TPL_INV, TB_TPL_RPT, TB_PAPER, TB_IMG_MAX, rptHtml, nowISO } from '../../App.jsx';

const TPL_AR = { classic: 'كلاسيكي', modern: 'حديث', compact: 'مضغوط', standard: 'قياسي', minimal: 'بسيط', boxed: 'مؤطر' };
const COLOR_AR = { primary: 'اللون الأساسي', accent: 'اللون المميز', heading: 'لون العناوين', text: 'لون النصوص' };

/** شعار من ملف: PNG/WebP/SVG تحتفظ بالشفافية؛ الصور الكبيرة تُصغَّر إلى 600px PNG؛ لا يُقبل ما يتجاوز الحد */
export function logoFromFile(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) return reject(new Error('type'));
    const rd = new FileReader();
    rd.onerror = reject;
    rd.onload = () => {
      const url = String(rd.result);
      if (file.type === 'image/svg+xml') return url.length <= TB_IMG_MAX ? resolve(url) : reject(new Error('size'));
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const sc = Math.min(1, 600 / Math.max(img.width, img.height));
        const cv = document.createElement('canvas'); cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        const out = cv.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.9);
        return out.length <= TB_IMG_MAX ? resolve(out) : reject(new Error('size'));
      };
      img.src = url;
    };
    rd.readAsDataURL(file);
  });
}

function LogoPick({ label, value, onChange, say, id }) {
  const inp = useRef();
  const pick = async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    try { onChange(await logoFromFile(f)); }
    catch (err) { say(err.message === 'size' ? 'الشعار أكبر من الحد المسموح (~300KB بعد الضغط) — استعمل صورة أصغر' : 'يُقبل PNG أو JPG أو WebP أو SVG فقط', 'no'); }
  };
  return (
    <Field label={label}>
      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
        <div className="tb-logo-box" data-tb-logo={id}>{value ? <img src={value} alt="" /> : <span>—</span>}</div>
        <input ref={inp} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style={{ display: 'none' }} onChange={pick} aria-label={label} data-tb-file={id} />
        <button type="button" className="btn sm" onClick={() => inp.current && inp.current.click()}><Upload size={13} />رفع</button>
        {value && <button type="button" className="btn sm gh" onClick={() => onChange('')} aria-label={'إزالة ' + label}><X size={13} /></button>}
      </div>
    </Field>);
}

const SAMPLE = (lang) => ({ id: 'tb-preview', title: lang === 'en' ? 'Income Statement' : 'قائمة الدخل', sub: lang === 'en' ? 'Period 2026-01-01 → 2026-03-31' : 'الفترة 2026-01-01 ← 2026-03-31', lang, template: 'statement',
  columns: [{ key: 'name', label: 'البند', en: 'Line' }, { key: 'amt', label: 'المبلغ', en: 'Amount', type: 'money', total: 'sum' }],
  rows: [{ name: lang === 'en' ? 'Revenue' : 'الإيرادات', amt: 125000 }, { name: lang === 'en' ? 'Cost of sales' : 'تكلفة المبيعات', amt: -48200 }, { name: lang === 'en' ? 'Operating expenses' : 'المصروفات التشغيلية', amt: -31750 }],
  totalLabel: lang === 'en' ? 'Net profit' : 'صافي الربح', signatures: lang === 'en' ? ['Prepared by', 'Approved by'] : ['أعدّه', 'اعتمده'], meta: { user: '—', at: '2026-04-01T09:00:00Z' } });

export function TenantBranding({ org, me, commitOrg, say }) {
  const canEdit = me && me.role === 'system_admin';   // الخادم يفرض الشرط نفسه (مستند المنشأة لمسؤول النظام فقط)
  const [f, setF] = useState(() => tbNorm(org.branding));
  const [lang, setLang] = useState('ar'); const [prev, setPrev] = useState(true);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const setC = (k, v) => setF(x => ({ ...x, colors: { ...x.colors, [k]: v } }));
  const setP = (k, v) => setF(x => ({ ...x, print: { ...x.print, [k]: v } }));
  const draftOrg = useMemo(() => ({ ...org, branding: tbNorm(f) }), [org, f]);
  const B = tenantBrand(draftOrg, { lang });
  const html = useMemo(() => prev ? rptHtml(draftOrg, SAMPLE(lang)) : '', [draftOrg, lang, prev]);
  const dirty = JSON.stringify(tbNorm(f)) !== JSON.stringify(tbNorm(org.branding));

  const save = async () => {
    const clean = { ...tbNorm(f), updatedAt: nowISO(), updatedBy: (me && me.name) || '' };
    const ok = await commitOrg(d => ({ ...d, branding: clean }), { actionType: 'update', targetType: 'tenant_branding', targetId: 'branding',
      title: 'حدّث الهوية التجارية للمنشأة', details: [clean.nameAr, clean.nameEn].filter(Boolean).join(' / ') + ' · ألوان ' + Object.values(clean.colors).join(' ') + (clean.logo ? ' · شعار' : '') });
    if (ok) say('حُفظت هوية المنشأة — تظهر في مساحتها من الواجهة وفي التقارير والمستندات ✓');
  };
  const reset = async () => {
    if (!window.confirm('استعادة الإعدادات الافتراضية لهوية المنشأة؟ تُحذف الشعارات والألوان المخصصة وتعود المستندات لبيانات الشركة الأساسية.')) return;
    const ok = await commitOrg(d => { const { branding, ...rest } = d; return rest; }, { actionType: 'delete', targetType: 'tenant_branding', targetId: 'branding', title: 'استعاد الإعدادات الافتراضية لهوية المنشأة', details: '—' });
    if (ok) { setF(tbNorm(null)); say('عادت هوية المنشأة إلى الإعدادات الافتراضية'); }
  };

  return (
    <div className="card" data-tenant-branding>
      <div className="card-t" style={{ marginBottom: 6 }}><Palette size={15} color="var(--brass)" />الهوية التجارية للمنشأة</div>
      <div className="note" style={{ marginBottom: 12 }}>
        هوية منشأتك تظهر في مساحتها من الواجهة وفي تقاريرك وفواتيرك ومستنداتك. <b>هوية المنصة (MUKTASAB) ثابتة ولا تتغير من هنا</b>
        <span className="tb-platform" title="هوية المنصة الثابتة"><span style={{ width: 18, height: 18, display: 'inline-block' }}><BrandSymbol /></span> MUKTASAB</span>
      </div>
      {!canEdit && <div className="note" data-tb-readonly style={{ marginBottom: 10 }}><Lock size={13} /> للعرض فقط — يعدّل الهوية مسؤول النظام.</div>}
      <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="grid g2">
          <Field label="اسم المنشأة بالعربية"><input className="inp" value={f.nameAr} onChange={e => set('nameAr', e.target.value)} placeholder={(org.company || {}).name || ''} data-tb="nameAr" /></Field>
          <Field label="اسم المنشأة بالإنجليزية"><input className="inp" dir="ltr" value={f.nameEn} onChange={e => set('nameEn', e.target.value)} data-tb="nameEn" /></Field>
        </div>
        <div className="grid g3">
          <LogoPick id="logo" label="الشعار الأساسي" value={f.logo} onChange={v => set('logo', v)} say={say} />
          <LogoPick id="logoAlt" label="الشعار البديل (للخلفيات الداكنة)" value={f.logoAlt} onChange={v => set('logoAlt', v)} say={say} />
          <LogoPick id="logoDoc" label="شعار المستندات" value={f.logoDoc} onChange={v => set('logoDoc', v)} say={say} />
        </div>
        <div className="grid g4">
          {Object.keys(COLOR_AR).map(k => <Field key={k} label={COLOR_AR[k]}><div className="row" style={{ gap: 6 }}>
            <input type="color" value={f.colors[k] || TB_NEUTRAL[k]} onChange={e => setC(k, e.target.value.toUpperCase())} aria-label={COLOR_AR[k]} data-tb-color={k} style={{ width: 42, height: 36, padding: 2 }} />
            <input className="inp n" value={f.colors[k] || ''} placeholder={TB_NEUTRAL[k]} onChange={e => setC(k, e.target.value)} style={{ flex: 1 }} /></div></Field>)}
        </div>
        <div className="grid g3">
          <Field label="الهاتف"><input className="inp n" value={f.phone} onChange={e => set('phone', e.target.value)} placeholder={(org.company || {}).phone || ''} /></Field>
          <Field label="البريد"><input className="inp" dir="ltr" value={f.email} onChange={e => set('email', e.target.value)} placeholder={(org.company || {}).email || ''} /></Field>
          <Field label="الموقع الإلكتروني"><input className="inp" dir="ltr" value={f.website} onChange={e => set('website', e.target.value)} /></Field>
        </div>
        <div className="grid g2">
          <Field label="العنوان (عربي)"><input className="inp" value={f.address} onChange={e => set('address', e.target.value)} placeholder={(org.company || {}).address || ''} /></Field>
          <Field label="العنوان (إنجليزي)"><input className="inp" dir="ltr" value={f.addressEn} onChange={e => set('addressEn', e.target.value)} /></Field>
        </div>
        <Field label="ترويسة المستندات (سطر إضافي تحت الاسم)"><input className="inp" value={f.header} onChange={e => set('header', e.target.value)} data-tb="header" /></Field>
        <div className="grid g2">
          <Field label="تذييل المستندات (عربي)"><input className="inp" value={f.footer} onChange={e => set('footer', e.target.value)} data-tb="footer" /></Field>
          <Field label="تذييل المستندات (إنجليزي)"><input className="inp" dir="ltr" value={f.footerEn} onChange={e => set('footerEn', e.target.value)} /></Field>
        </div>
        <div className="grid g4">
          <Field label="قالب الفواتير"><select className="sel" value={f.invoiceTpl} onChange={e => set('invoiceTpl', e.target.value)}>{TB_TPL_INV.map(t => <option key={t} value={t}>{TPL_AR[t]}</option>)}</select></Field>
          <Field label="قالب التقارير"><select className="sel" value={f.reportTpl} onChange={e => set('reportTpl', e.target.value)} data-tb="reportTpl">{TB_TPL_RPT.map(t => <option key={t} value={t}>{TPL_AR[t]}</option>)}</select></Field>
          <Field label="حجم الورق"><select className="sel" value={f.print.paper} onChange={e => setP('paper', e.target.value)}>{TB_PAPER.map(t => <option key={t}>{t}</option>)}</select></Field>
          <Field label="خيارات الطباعة"><div style={{ display: 'grid', gap: 4, fontSize: 12.5 }}>
            <label><input type="checkbox" checked={f.print.mono} onChange={e => setP('mono', e.target.checked)} data-tb="mono" /> طباعة أحادية اللون</label>
            <label><input type="checkbox" checked={f.print.showLogo} onChange={e => setP('showLogo', e.target.checked)} /> الشعار في المستندات</label>
            <label><input type="checkbox" checked={f.print.showContact} onChange={e => setP('showContact', e.target.checked)} /> بيانات الاتصال في الترويسة</label></div></Field>
        </div>
      </fieldset>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', margin: '10px 0' }}>
        {canEdit && <button className="btn pri" onClick={save} disabled={!dirty} data-tb-save><Check size={14} />حفظ هوية المنشأة</button>}
        {canEdit && <button className="btn gh" onClick={reset} data-tb-reset><RotateCcw size={14} />استعادة الإعدادات الافتراضية</button>}
        <span style={{ flex: 1 }} />
        <button className="btn sm gh" onClick={() => setPrev(v => !v)}><Eye size={13} />{prev ? 'إخفاء المعاينة' : 'معاينة مباشرة'}</button>
        <div className="seg" role="group" aria-label="لغة المعاينة">{[['ar', 'عربي'], ['en', 'English']].map(([k, t]) => <button key={k} className={'btn sm' + (lang === k ? ' pri' : ' gh')} onClick={() => setLang(k)}>{t}</button>)}</div>
      </div>
      {prev && <div className="tb-preview">
        <div className="tb-chip" data-tb-chip style={{ '--tbp': B.colors.primary }}>{B.logo ? <img src={B.logo} alt="" /> : <span className="tb-ini">{(B.name || '؟').slice(0, 1)}</span>}<b>{B.name || 'اسم المنشأة'}</b></div>
        <iframe title="معاينة مستند بهوية المنشأة" data-tb-preview srcDoc={html} sandbox="" style={{ width: '100%', height: 460, border: '1px solid var(--line)', borderRadius: 10, background: '#fff' }} />
      </div>}
    </div>);
}
