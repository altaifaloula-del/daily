/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useMemo, useEffect } from 'react';
import { authApi } from '../../storage';
import { Trash2, ChevronRight, Plus, Printer, Settings, ArrowUp, Check, Bell, X, TrendingUp, TrendingDown, ArrowLeftRight, Users, Search } from 'lucide-react';
import { BalCell, Field, Kpi, LOCK_MSG, Modal, MoneyField, NationalAddressFields, PT_SRC, PT_TYPE, PartnerChip, ROLES, buildPartners, contactFields, contactOf, money, naErr, naHas, naMissing, nextPartnerCode, nowISO, periodLocked, printPartnerStatement, today, uid, waNum } from '../../App.jsx';

export function Partners({ org, ops, me, commit, commitOrg, say }) {
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [openKey, setOpenKey] = useState(null);
  const [addP, setAddP] = useState(null);
  const [tx, setTx] = useState(null);
  const canEdit = ROLES[me.role]?.scope !== 'own';
  // كتابة سجل الرئيسي (مع المصادقة السحابية) للمدراء فقط
  const canWriteOrgP = !(typeof window !== 'undefined' && window.__forceOrgReadonly) && (!authApi.enabled || !!ROLES[me.role]?.admin);
  const pendReqs = ops.partnerRequests || [];

  const partners = useMemo(() => buildPartners(org, ops), [org, ops]);
  const cur = partners.find(p => p.key === openKey);
  // v30.6 — موردون سُجّلوا سابقًا كشركاء عامين (لا تراهم المشتريات): نقلهم لسجل الموردين بنفس المفتاح فتبقى حركاتهم
  const strayS = (org.partners || []).filter(pt => pt.type === 'supplier');
  const moveStray = async () => {
    const ok = await commitOrg(d => {
      const mv = (d.partners || []).filter(pt => pt.type === 'supplier');
      const have = new Set((d.suppliers || []).map(x => x.id));
      return { ...d, partners: (d.partners || []).filter(pt => pt.type !== 'supplier'),
        suppliers: [...(d.suppliers || []), ...mv.filter(pt => !have.has(pt.id)).map(pt => ({ ...contactOf(pt), id: pt.id, key: pt.key || ('cust:' + pt.id), code: pt.code, name: pt.name, category: pt.cat || '', phone: pt.phone || '', vatNo: pt.vatNo || pt.tax || '', address: pt.address || '', taxable: !!pt.taxable, terms: Number(pt.terms) || 0 }))] };
    }, { actionType: 'update', targetType: 'user_account', targetId: 'stray-suppliers', need: 'edit', title: 'نقل موردين إلى سجل الموردين', details: strayS.map(x => x.name).join('، ') });
    if (ok) say('نُقل ' + strayS.length + ' مورد إلى سجل الموردين — يظهرون الآن في المشتريات وأرصدتهم كما هي ✓');
  };

  // ترسيخ الأكواد على البطاقات القديمة مرة واحدة — حتى لا تتغير الأرقام بعد أي حذف مستقبلي
  useEffect(() => {
    if (!commitOrg || !canEdit || !canWriteOrgP) return;
    const missing = (org.suppliers || []).some(s => !s.code) || (org.employees || []).some(e => !e.code) || (org.partners || []).some(pt => !pt.code);
    if (!missing) return;
    const codeMap = new Map(partners.map(p => [p.key, p.code]));
    commitOrg(d => ({
      ...d,
      suppliers: (d.suppliers || []).map(s => s.code ? s : { ...s, code: codeMap.get('sup:' + s.id) }),
      employees: (d.employees || []).map(e => e.code ? e : { ...e, code: codeMap.get('emp:' + e.id) }),
      partners: (d.partners || []).map(pt => pt.code ? pt : { ...pt, code: codeMap.get(pt.key || ('cust:' + pt.id)) })
    }), { actionType: 'update', targetType: 'user_account', targetId: 'partner-codes', title: 'تثبيت أرقام الشركاء', details: 'ترسيخ الترقيم التلقائي على بطاقات الشركاء' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  let cr = 0, dr = 0, cCust = 0, cSupp = 0, cEmp = 0;
  partners.forEach(p => {
    if (p.balance > 0) cr += p.balance; else dr += -p.balance;
    if (p.type === 'customer') cCust++; else if (p.type === 'supplier') cSupp++; else cEmp++;
  });
  const net = cr - dr;
  const qq = (q || '').trim();
  const list = partners.filter(p => (filter === 'all' || p.type === filter) && (!qq || [p.name, p.code, p.phone, p.mobile2, p.contactPerson, p.email, p.tax, p.cat, p.city].some(v => v && String(v).includes(qq))));

  // اعتماد/رفض طلبات الإضافة الواردة من الفروع
  const approveReq = async (r) => {
    const id = uid('pt');
    const t = r.type === 'supplier' ? 'supplier' : r.type === 'employee' ? 'employee' : (r.type || 'customer');
    const code = nextPartnerCode(partners, t);
    let key, mut;
    if (t === 'supplier') { key = 'sup:' + id; mut = d => ({ ...d, suppliers: [...(d.suppliers || []), { id, code, name: r.name, category: r.cat || '', phone: r.phone || '', vatNo: '', address: '', taxable: false, terms: 0 }] }); }
    else if (t === 'employee') { key = 'emp:' + id; mut = d => ({ ...d, employees: [...(d.employees || []), { id, code, name: r.name, jobTitle: r.cat || '', phone: r.phone || '', baseSalary: 0, housingAllowance: 0, transportAllowance: 0, branchId: r.branchId || '', isActive: true }] }); }
    else { key = 'cust:' + id; mut = d => ({ ...d, partners: [...(d.partners || []), { id, key, code, name: r.name, type: t, cat: r.cat || '', phone: r.phone || '', tax: '', terms: 0 }] }); }
    const ok = await commitOrg(mut, { actionType: 'create', targetType: 'user_account', targetId: id, title: 'اعتمد طلب إضافة شريك', details: `${r.name} · ${code} · طلب من ${r.requestedBy || '—'}` });
    if (!ok) return;
    const openAmt = Number((r.opening || '').toString().replace(/,/g, '')) || 0;
    await commit(d => ({
      ...d,
      partnerRequests: (d.partnerRequests || []).filter(x => x.id !== r.id),
      ...(openAmt > 0 ? { ledgerEntries: [{ id: uid('le'), partnerKey: key, date: today(), desc: 'رصيد افتتاحي', src: 'open', ...(r.openingSide === 'debit' ? { debit: openAmt, credit: 0 } : { credit: openAmt, debit: 0 }) }, ...(d.ledgerEntries || [])] } : {})
    }), { actionType: 'update', targetType: 'user_account', targetId: r.id, title: 'إغلاق طلب إضافة شريك', details: r.name });
    say('اعتُمد الشريك ' + code + ' ✓');
  };
  const rejectReq = async (r) => {
    await commit(d => ({ ...d, partnerRequests: (d.partnerRequests || []).filter(x => x.id !== r.id) }),
      { actionType: 'delete', targetType: 'user_account', targetId: r.id, title: 'رفض طلب إضافة شريك', details: r.name });
    say('رُفض الطلب');
  };

  // v15.14 — ترقية شريك أضافه فرع (بلا اعتماد) إلى دفتر الشركاء الرسمي بالرئيسي.
  // يُكتب بنفس المفتاح والمعرّف فتبقى كل حركاته (المصروفات/السدادات المرتبطة) مربوطة دون تغيير.
  const promotePartner = async (p) => {
    if (!canWriteOrgP) return say('الترقية للسجل المركزي للإدارة فقط', 'no');
    const id = p.id;
    let mut;
    if (p.type === 'supplier') mut = d => ({ ...d, suppliers: [...(d.suppliers || []), { id, code: p.code, name: p.name, category: p.cat || '', phone: p.phone || '', vatNo: '', address: '', taxable: false, terms: 0 }] });
    else if (p.type === 'employee') mut = d => ({ ...d, employees: [...(d.employees || []), { id, code: p.code, name: p.name, jobTitle: p.cat || '', phone: p.phone || '', baseSalary: 0, housingAllowance: 0, transportAllowance: 0, branchId: p.branchOrigin || '', isActive: true }] });
    else mut = d => ({ ...d, partners: [...(d.partners || []), { id, key: p.key, code: p.code, name: p.name, type: p.type, cat: p.cat || '', phone: p.phone || '', tax: '', terms: 0 }] });
    const ok = await commitOrg(mut, { actionType: 'update', targetType: 'user_account', targetId: id, need: 'edit', title: 'رقّى شريك فرع إلى السجل المركزي', details: p.name + ' — من فرع ' + (p.branchOriginName || '') });
    if (!ok) return;
    await commit(d => ({ ...d, branchPartners: (d.branchPartners || []).filter(x => x.id !== p.id) }),
      { actionType: 'delete', targetType: 'user_account', targetId: p.id, title: 'إزالة شريك من دفتر الفرع بعد الترقية', details: p.name });
    setOpenKey(null);
    say('رُقّي «' + p.name + '» إلى السجل المركزي الرسمي ✓ — وكل حركاته السابقة بقيت مربوطة');
  };

  const saveCustomer = async () => {
    const c = addP;
    if (!c.name?.trim()) return say('اكتب اسم الجهة', 'no');
    if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(c.email).trim())) return say('البريد الإلكتروني غير صحيح', 'no');
    if (c.iban && !/^SA\d{22}$/.test(String(c.iban).trim())) return say('الآيبان السعودي: SA متبوعًا بـ 22 رقمًا', 'no');
    if (naErr(c.na)) return say('العنوان الوطني: ' + naErr(c.na), 'no');
    // v27.5 (إصلاح §12/18): «موظف» لا يُنشأ من دفتر الشركاء — كان يكتب بطاقة وهمية في org.partners
    // (مفتاح cust:) بلا فرع ولا راتب، لا تظهر في الحضور/الرواتب. الموظف الحقيقي يُنشأ في «البيانات
    // الرئيسية» (بفرع إلزامي) ويظهر هنا تلقائيًا عبر buildPartners (مفتاح emp:).
    // v34.1: الموظف يُنشأ هنا في سجل الموظفين الحقيقي (org.employees) بفرع إلزامي — فيظهر في الحضور والرواتب ودفتر الشركاء معًا
    if (c.type === 'employee') {
      if (!canWriteOrgP) return say('إضافة الموظفين وتعديلهم للإدارة فقط', 'no');
      if (!c.branchId) return say('اختر فرع الموظف', 'no');
      const empPatch = { name: c.name.trim(), jobTitle: (c.cat || '').trim(), phone: c.phone || '', branchId: c.branchId, ...(c.email ? { email: String(c.email).trim() } : {}), ...(c.notes ? { notes: c.notes } : {}) };
      if (c.edit) {
        const okE = await commitOrg(d => ({ ...d, employees: (d.employees || []).map(e => e.id === c.id ? { ...e, ...empPatch } : e) }), { actionType: 'update', targetType: 'user_account', targetId: c.id, title: 'حدّث بيانات موظف من جهات الاتصال', details: c.name });
        if (okE) { say('حُدّثت بيانات الموظف ✓'); setAddP(null); } return;
      }
      const dupE = (org.employees || []).find(e => (e.name || '').trim() === c.name.trim() && e.branchId === c.branchId);
      if (dupE && !window.confirm('يوجد موظف بنفس الاسم في هذا الفرع (' + (dupE.code || '') + '). إضافة موظف جديد رغم ذلك؟')) return;
      const idE = uid('em'); const codeE = nextPartnerCode(partners, 'employee');
      const okN = await commitOrg(d => ({ ...d, employees: [...(d.employees || []), { id: idE, code: codeE, ...empPatch, baseSalary: 0, housingAllowance: 0, transportAllowance: 0, isActive: true }] }),
        { actionType: 'create', targetType: 'user_account', targetId: idE, title: 'أضاف موظفًا من جهات الاتصال', details: c.name.trim() + ' · ' + ((org.branches || []).find(b => b.id === c.branchId) || {}).name });
      if (okN) { say('أُضيف الموظف «' + c.name.trim() + '» (' + codeE + ') ✓ — أكمل راتبه وبياناته من «شؤون الموظفين ← البيانات الرئيسية»'); setAddP(null); }
      return;
    }
    if (c.edit) {
      if (!canWriteOrgP) return say('تعديل بيانات الكرت للإدارة فقط', 'no');
      const patch = { name: c.name.trim(), cat: c.cat || '', phone: c.phone || '', terms: Number(c.terms) || 0, address: c.address || '', taxable: !!c.taxable, ...contactFields(c) };
      if (c.isSup) await commitOrg(d => ({ ...d, suppliers: (d.suppliers || []).map(s => s.id === c.id ? { ...s, ...patch, category: c.cat || '', vatNo: c.tax || '' } : s) }), { actionType: 'update', targetType: 'user_account', targetId: c.id, title: 'حدّث بيانات كرت مورد', details: c.name });
      else await commitOrg(d => ({ ...d, partners: (d.partners || []).map(p => p.id === c.id ? { ...p, ...patch, tax: c.tax || '', vatNo: c.tax || '' } : p) }), { actionType: 'update', targetType: 'user_account', targetId: c.id, title: 'حدّث بيانات كرت عميل', details: c.name });
      say('حُدّثت بيانات الكرت ✓'); setAddP(null); return;
    }
    if (!canWriteOrgP) {
      // دور غير إداري (كالمكتب الرئيسي المقيّد): يُرسل طلب اعتماد بدل كتابة تُرفض
      const req = {
        id: uid('pr'), name: c.name.trim(), type: c.type || 'customer', cat: c.cat || '', phone: c.phone || '',
        opening: c.opening || '', openingSide: c.openingSide || 'debit',
        requestedBy: me.name, branchId: '', branchName: '', at: nowISO()
      };
      const okReq = await commit(d => ({ ...d, partnerRequests: [req, ...(d.partnerRequests || [])] }), {
        actionType: 'create', targetType: 'user_account', targetId: req.id,
        title: 'طلب إضافة شريك للرئيسي', details: req.name + ' · بانتظار اعتماد الإدارة'
      });
      if (okReq) { say('أُرسل طلب اعتماد «' + req.name + '» لمسؤول النظام ✓'); setAddP(null); }
      return;
    }
    const dupe = partners.find(p => p.type === (c.type || 'customer') && (p.name || '').trim() === c.name.trim());
    if (dupe && !window.confirm('توجد جهة بنفس الاسم (' + dupe.code + '). إضافة جهة جديدة رغم ذلك؟')) return;
    const isSupNew = c.type === 'supplier';
    // v30.6: المورد الجديد يُسجَّل في سجل الموردين نفسه الذي تقرأه المشتريات (كان يُحفظ كشريك عام فلا يظهر في أوامر الشراء)
    const id = uid(isSupNew ? 'sp' : 'pt'); const key = (isSupNew ? 'sup:' : 'cust:') + id;
    const code = nextPartnerCode(partners, c.type || 'customer');
    const rec = isSupNew
      ? { id, code, name: c.name.trim(), category: c.cat || '', phone: c.phone || '', vatNo: c.tax || '', address: c.address || '', taxable: !!c.taxable, terms: Number(c.terms) || 0, ...contactFields(c) }
      : { id, key, code, name: c.name.trim(), type: c.type || 'customer', cat: c.cat || '', phone: c.phone || '', tax: c.tax || '', vatNo: c.tax || '', address: c.address || '', taxable: !!c.taxable, terms: Number(c.terms) || 0, ...contactFields(c) };
    await commitOrg(d => (isSupNew ? { ...d, suppliers: [...(d.suppliers || []), rec] } : { ...d, partners: [...(d.partners || []), rec] }),
      { actionType: 'create', targetType: 'user_account', targetId: id, title: 'أضاف جهة اتصال', details: rec.name + ' — ' + (PT_TYPE[c.type || 'customer']?.ar || '') });
    const openAmt = Number((c.opening || '').toString().replace(/,/g, '')) || 0;
    if (openAmt > 0) {
      const side = c.openingSide === 'debit' ? { debit: openAmt, credit: 0 } : { credit: openAmt, debit: 0 };
      await commit(d => ({ ...d, ledgerEntries: [{ id: uid('le'), partnerKey: key, date: today(), desc: 'رصيد افتتاحي', src: 'open', ...side }, ...(d.ledgerEntries || [])] }),
        { actionType: 'create', targetType: 'daily_closing', targetId: key, title: 'رصيد افتتاحي لشريك', details: rec.name });
    }
    say('تمت إضافة الشريك ✓'); setAddP(null);
  };

  const addEntry = async () => {
    const amt = Math.abs(Number((tx.amount || '').toString().replace(/,/g, ''))) || 0;
    if (amt <= 0) return say('أدخل مبلغاً صحيحاً', 'no');
    const side = tx.side === 'debit' ? { debit: amt, credit: 0 } : { credit: amt, debit: 0 };
    if (periodLocked(org, tx.date || today())) return say(LOCK_MSG(tx.date || today()), 'no');
    const entry = { id: uid('le'), partnerKey: cur.key, date: tx.date || today(), desc: tx.desc?.trim() || 'حركة يدوية', src: 'manual', ...side };
    await commit(d => ({ ...d, ledgerEntries: [entry, ...(d.ledgerEntries || [])] }),
      { actionType: 'create', targetType: 'daily_closing', targetId: cur.key, title: 'حركة يدوية في كشف حساب', details: `${cur.name} · ${tx.side === 'debit' ? 'مدين' : 'دائن'} ${money(amt)}` });
    say('تم تسجيل الحركة ✓'); setTx(null);
  };

  const delEntry = async (entryId) => {
    await commit(d => ({ ...d, ledgerEntries: (d.ledgerEntries || []).filter(e => e.id !== entryId) }),
      { actionType: 'delete', targetType: 'daily_closing', targetId: cur.key, title: 'حذف حركة يدوية', details: cur.name });
    say('حُذفت الحركة');
  };

  // ===== كشف حساب شريك =====
  if (cur) {
    let run = 0, sdr = 0, scr = 0;
    const rows = cur.txns.map((t, i) => {
      run += (t.credit || 0) - (t.debit || 0); sdr += t.debit || 0; scr += t.credit || 0;
      const src = PT_SRC[t.src] || PT_SRC.manual;
      const rbCol = Math.abs(run) < 0.005 ? 'var(--faint)' : (run > 0 ? 'var(--rose)' : 'var(--mint)');
      return (
        <tr key={i}>
          <td className="num" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>{t.date}</td>
          <td style={{ fontSize: 12.5 }}>{t.desc}
            <div style={{ fontSize: 10, color: src.c, marginTop: 3 }}>● {src.t}{t.ref ? ' · ' + t.ref : ''}</div></td>
          <td className="num" style={{ textAlign: 'end' }}>{t.debit ? money(t.debit) : '—'}</td>
          <td className="num" style={{ textAlign: 'end' }}>{t.credit ? money(t.credit) : '—'}</td>
          <td className="num" style={{ textAlign: 'end', fontWeight: 700, color: rbCol }}>{Math.abs(run) < 0.005 ? '0.00' : money(Math.abs(run))}</td>
          <td style={{ textAlign: 'center' }}>{(t.src === 'manual' || t.src === 'open') && canEdit
            ? <button className="btn sm gh" onClick={() => delEntry(t.entryId)} title="حذف"><Trash2 size={12} color="#D9544D" /></button>
            : <span style={{ fontSize: 9, color: 'var(--faint)' }} title="حركة تلقائية — تُصحَّح من مصدرها">🔒</span>}</td>
        </tr>
      );
    });
    const bal = scr - sdr;
    return (
      <div className="grid" style={{ gap: 14 }}>
        <button className="btn gh" style={{ alignSelf: 'flex-start' }} onClick={() => { setOpenKey(null); setTx(null); }}>
          <ChevronRight size={15} />رجوع إلى جهات الاتصال</button>

        <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16, alignItems: 'center' }}>
          <div>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <span className="card-t" style={{ fontSize: 20 }}>{cur.name}</span><PartnerChip type={cur.type} />
              <span className="badge b-dim num" style={{ fontSize: 10, color: 'var(--brass)' }}>{cur.code}</span>
              {cur.linked && <span className="badge b-mint" style={{ fontSize: 10 }}>◍ مرتبط بالفروع</span>}
              {cur.source === 'branch' && <span className="badge b-amber" style={{ fontSize: 10 }}>🏬 من فرع {cur.branchOriginName || ''} — لم يُرقَّ للرئيسي بعد</span>}
            </div>
            <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              <span className="badge b-dim">{cur.cat || '—'}</span>
              {cur.phone && <span className="badge b-dim">الجوال <span className="num">{cur.phone}</span></span>}
              {cur.tax && <span className="badge b-dim">الرقم الضريبي <span className="num">{cur.tax}</span></span>}
              {cur.taxable && <span className="badge b-mint">خاضع للضريبة</span>}
              {cur.address && <span className="badge b-dim">📍 {cur.address}</span>}
              {cur.type === 'customer' && cur.taxable && naMissing(cur.na).length > 0 && <span className="badge b-amber">العنوان الوطني ناقص للفاتورة الضريبية</span>}
              {cur.terms ? <span className="badge b-dim">مهلة <span className="num">{cur.terms}</span> يوم</span> : null}
              {cur.contactPerson && <span className="badge b-dim">👤 {cur.contactPerson}</span>}
              {cur.mobile2 && <span className="badge b-dim">جوال 2 <span className="num">{cur.mobile2}</span></span>}
              {cur.email && <a className="badge b-dim" href={'mailto:' + cur.email}>✉ {cur.email}</a>}
              {cur.city && <span className="badge b-dim">{cur.city}</span>}
              {cur.crNo && <span className="badge b-dim">س.ت <span className="num">{cur.crNo}</span></span>}
              {cur.iban && <span className="badge b-dim">{cur.bankName ? cur.bankName + ' · ' : ''}<span className="num">{cur.iban}</span></span>}
              {cur.creditLimit ? <span className="badge b-dim">حد ائتمان <span className="num">{money(cur.creditLimit)}</span></span> : null}
            </div>
            {cur.phone && <div className="row" style={{ gap: 6, marginTop: 8 }}>
              <a className="btn sm" href={'tel:' + cur.phone}>📞 اتصال</a>
              <a className="btn sm gh" target="_blank" rel="noreferrer" href={'https://wa.me/' + waNum(cur.phone)}>واتساب</a>
            </div>}
            {cur.notes && <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 8 }}>📝 {cur.notes}</div>}
          </div>
          <div style={{ textAlign: 'center', background: 'var(--ink3)', border: '1px solid var(--line)', borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>الرصيد الحالي</div>
            <div className="num" style={{ fontSize: 28, fontWeight: 800, margin: '4px 0', color: Math.abs(bal) < 0.005 ? 'var(--faint)' : (bal > 0 ? 'var(--rose)' : 'var(--mint)') }}>{money(Math.abs(bal))}</div>
            <div style={{ fontSize: 11, color: 'var(--faint)' }}>{Math.abs(bal) < 0.005 ? 'الحساب مسدّد' : (bal > 0 ? 'دائن — مستحق للطرف علينا' : 'مدين — مستحق لنا على الطرف')}</div>
          </div>
        </div>

        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {canEdit && <button className="btn pri" onClick={() => setTx({ side: 'debit', date: today(), amount: '', desc: '' })}><Plus size={14} />إضافة حركة يدوية</button>}
          <button className="btn" onClick={() => printPartnerStatement(cur, org)}><Printer size={14} />طباعة كشف الحساب</button>
          {canEdit && cur.type === 'employee' && (org.employees || []).some(e => e.id === cur.id) && <button className="btn" onClick={() => { const e0 = (org.employees || []).find(e => e.id === cur.id) || {}; setAddP({ edit: true, id: cur.id, type: 'employee', name: e0.name || cur.name, cat: e0.jobTitle || '', phone: e0.phone || '', email: e0.email || '', notes: e0.notes || '', branchId: e0.branchId || '' }); }}><Settings size={14} />تعديل بيانات الموظف</button>}
          {canEdit && (cur.type === 'customer' || cur.type === 'supplier') && <button className="btn" onClick={() => setAddP({ edit: true, id: cur.id, isSup: (org.suppliers || []).some(x => x.id === cur.id), type: cur.type, name: cur.name, cat: (cur.cat === 'مورد' || cur.cat === 'عميل') ? '' : (cur.cat || ''), phone: cur.phone || '', tax: cur.tax || '', address: cur.address || '', taxable: !!cur.taxable, terms: cur.terms || '', ...contactOf(cur), creditLimit: cur.creditLimit || '' })}><Settings size={14} />تعديل بيانات الكرت</button>}
          {cur.type === 'employee' && <span className="badge b-dim" style={{ alignSelf: 'center' }}>بيانات الموظف تُعدَّل من «شؤون الموظفين ← البيانات الرئيسية»</span>}
          {canWriteOrgP && cur.source === 'branch' && <button className="btn pri" onClick={() => promotePartner(cur)}><ArrowUp size={14} />ترقية للسجل المركزي</button>}
        </div>

        {tx && (
          <div className="card" style={{ border: '1px dashed var(--brass-d)', background: 'var(--ink3)' }}>
            <div className="grid g4" style={{ alignItems: 'end', gap: 10 }}>
              <Field label="التاريخ"><input className="inp" type="date" value={tx.date} onChange={e => setTx({ ...tx, date: e.target.value })} /></Field>
              <Field label="البيان" style={{ gridColumn: 'span 2' }}><input className="inp" value={tx.desc} placeholder="مثال: دفعة سداد نقدية" onChange={e => setTx({ ...tx, desc: e.target.value })} /></Field>
              <Field label="النوع"><select className="sel" value={tx.side} onChange={e => setTx({ ...tx, side: e.target.value })}>
                <option value="debit">مدين (سداد/تخفيض ما علينا)</option>
                <option value="credit">دائن (فاتورة/زيادة ما علينا)</option></select></Field>
              <Field label="المبلغ"><MoneyField value={tx.amount} onChange={v => setTx({ ...tx, amount: v })} /></Field>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn pri" onClick={addEntry}><Check size={14} />حفظ الحركة</button>
                <button className="btn gh" onClick={() => setTx(null)}>إلغاء</button>
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="tw">
            <table className="tb">
              <thead><tr><th>التاريخ</th><th>البيان</th><th style={{ textAlign: 'end' }}>مدين</th><th style={{ textAlign: 'end' }}>دائن</th><th style={{ textAlign: 'end' }}>الرصيد</th><th></th></tr></thead>
              <tbody>{rows.length ? rows : <tr><td colSpan={6}><div className="empty">لا حركات على هذا الحساب بعد.</div></td></tr>}</tbody>
              <tfoot><tr style={{ background: 'var(--ink3)', fontWeight: 700 }}>
                <td colSpan={2} style={{ padding: '11px 14px' }}>الإجماليات</td>
                <td className="num" style={{ textAlign: 'end' }}>{money(sdr)}</td>
                <td className="num" style={{ textAlign: 'end' }}>{money(scr)}</td>
                <td className="num" style={{ textAlign: 'end', color: bal > 0 ? 'var(--rose)' : bal < 0 ? 'var(--mint)' : 'var(--faint)' }}>{money(Math.abs(bal))}</td>
                <td></td></tr></tfoot>
            </table>
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--faint)', lineHeight: 1.7 }}>الحركات المعلَّمة 🔒 مصدرها فواتير/إغلاقات/سلف — تُصحَّح من مصدرها للحفاظ على تطابق التدقيق. الحركات اليدوية فقط قابلة للحذف من هنا.</div>
      </div>
    );
  }

  // ===== قائمة جهات الاتصال =====
  return (
    <div className="grid" style={{ gap: 14 }}>
      {canWriteOrgP && strayS.length > 0 && (
        <div className="card" style={{ borderColor: 'rgba(224,164,88,.5)' }}>
          <div className="row" style={{ justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12.5, lineHeight: 1.8 }}><b>{strayS.length} مورد</b> مسجّلون كشركاء عامين فلا يظهرون في أوامر الشراء والفواتير: {strayS.map(x => x.name).join('، ')}.
              <div style={{ fontSize: 11, color: 'var(--faint)' }}>النقل يحفظ أكوادهم وكشوف حساباتهم كما هي.</div></div>
            <button className="btn sm pri" onClick={moveStray}>نقلهم إلى سجل الموردين</button>
          </div>
        </div>
      )}
      {canWriteOrgP && pendReqs.length > 0 && (
        <div className="card" style={{ borderColor: 'rgba(200,162,74,.45)' }}>
          <div className="card-t" style={{ marginBottom: 10 }}><Bell size={15} color="var(--brass)" />طلبات إضافة شركاء بانتظار اعتمادك ({pendReqs.length})</div>
          <div className="grid" style={{ gap: 8 }}>
            {pendReqs.map(r => (
              <div key={r.id} className="row" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', padding: '9px 12px', background: 'var(--ink)', borderRadius: 10, border: '1px solid var(--line)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{r.name} <PartnerChip type={r.type === 'supplier' ? 'supplier' : r.type === 'employee' ? 'employee' : 'customer'} /></div>
                  <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 3 }}>
                    {r.cat ? r.cat + ' · ' : ''}طلب من {r.requestedBy || '—'}{r.branchName ? ' — ' + r.branchName : ''}
                  </div>
                </div>
                <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                  <button className="btn sm pri" onClick={() => approveReq(r)}><Check size={13} />اعتماد</button>
                  <button className="btn sm gh" onClick={() => rejectReq(r)}><X size={13} color="#D9544D" />رفض</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="grid g4">
        <Kpi label="إجمالي دائن (علينا)" value={money(cr)} sub="مستحق للموردين والموظفين" icon={TrendingUp} color="#D9544D" />
        <Kpi label="إجمالي مدين (لنا)" value={money(dr)} sub="مستحق من العملاء والسلف" icon={TrendingDown} color="#4FB286" />
        <Kpi label="صافي المركز" value={money(Math.abs(net))} sub={net >= 0 ? 'صافي التزام علينا' : 'صافي مستحق لنا'} icon={ArrowLeftRight} color="#C8A24A" />
        <Kpi label="عدد الشركاء" value={String(partners.length)} sub={`${cCust} عميل · ${cSupp} مورد · ${cEmp} موظف`} icon={Users} color="#5B93C4" />
      </div>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {[['all', 'الكل', partners.length], ['supplier', 'الموردون', cSupp], ['customer', 'العملاء', cCust], ['employee', 'الموظفون', cEmp]].map(([k, lbl, n]) => (
          <button key={k} className={'btn sm' + (filter === k ? ' pri' : ' gh')} onClick={() => setFilter(k)}>{lbl} <span className="num" style={{ opacity: .7 }}>{n}</span></button>
        ))}
        <div style={{ marginInlineStart: 'auto', position: 'relative' }}>
          <input className="inp" style={{ width: 210, paddingInlineStart: 32 }} value={q} placeholder="ابحث بالاسم أو الجوال أو الكود…" onChange={e => setQ(e.target.value)} />
          <Search size={14} style={{ position: 'absolute', insetInlineStart: 10, top: 11, color: 'var(--faint)' }} />
        </div>
        {canEdit && <button className="btn sm" onClick={() => setAddP({ type: 'customer', openingSide: 'debit' })}><Plus size={14} />إضافة جهة اتصال</button>}
      </div>

      <div className="card">
        <div className="tw">
          <table className="tb cards">
            <thead><tr><th>الجهة</th><th>النوع</th><th>الاتصال</th><th>الربط بالفروع</th><th>الرصيد</th><th></th></tr></thead>
            <tbody>
              {list.map(p => (
                <tr key={p.key} style={{ cursor: 'pointer' }} onClick={() => setOpenKey(p.key)}>
                  <td data-label="الشريك"><div style={{ fontWeight: 700, fontSize: 13.5 }}>{p.name}{p.source === 'branch' && <span className="badge b-amber" style={{ fontSize: 9, marginInlineStart: 6 }}>فرع</span>}</div><div style={{ fontSize: 11, color: 'var(--faint)' }}><span className="num" style={{ color: 'var(--brass)' }}>{p.code}</span> · {p.cat}</div></td>
                  <td data-label="النوع"><PartnerChip type={p.type} /></td>
                  <td data-label="الاتصال" style={{ fontSize: 12, color: 'var(--dim)' }} onClick={e => e.stopPropagation()}>
                    {p.contactPerson && <div style={{ fontSize: 11.5 }}>{p.contactPerson}</div>}
                    {p.phone ? <a className="num" href={'tel:' + p.phone} style={{ color: 'var(--sky)' }}>{p.phone}</a> : (!p.email && !p.contactPerson ? '—' : null)}
                    {p.email && <div style={{ fontSize: 10.5 }}><a href={'mailto:' + p.email} style={{ color: 'var(--faint)' }}>{p.email}</a></div>}
                  </td>
                  <td data-label="الربط">{p.linked ? <span className="badge b-mint" style={{ fontSize: 10 }}>◍ مرتبط</span> : <span style={{ color: 'var(--faint)' }}>—</span>}</td>
                  <td data-label="الرصيد" className="num"><BalCell bal={p.balance} /></td>
                  <td style={{ textAlign: 'end', color: 'var(--faint)', fontSize: 11.5 }}>كشف الحساب ←</td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={6}><div className="empty">لا شركاء مطابقون.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {addP && (
        <Modal title={addP.edit ? 'تعديل بيانات الكرت' : 'جهة اتصال جديدة'} icon={Users} onClose={() => setAddP(null)}
          foot={<><button className="btn pri" onClick={saveCustomer}><Check size={14} />{addP.edit ? 'حفظ التعديلات' : 'حفظ الشريك'}</button>
            <button className="btn gh" onClick={() => setAddP(null)}>إلغاء</button></>}>
          {!addP.edit && (<>
          <Field label="نوع الشريك">
            <select className="sel" value={addP.type} onChange={e => setAddP({ ...addP, type: e.target.value })}>
              <option value="customer">عميل (يدين لنا عادةً)</option>
              <option value="supplier">مورد</option>
              <option value="employee">موظف</option>
            </select>
          </Field>
          <div style={{ fontSize: 10.5, color: 'var(--faint)', marginBottom: 8, marginTop: -4 }}>العميل والمورد يُسجَّلان في دفتر الشركاء، والموظف في سجل الموظفين (بفرع إلزامي) ويظهر هنا تلقائيًا.</div>
          </>)}
          <Field label="الاسم"><input className="inp" value={addP.name || ''} onChange={e => setAddP({ ...addP, name: e.target.value })} placeholder={addP.type === 'employee' ? 'اسم الموظف' : 'اسم الشريك أو الجهة'} /></Field>
          {addP.type === 'employee' ? (<>
            <div className="grid g2">
              <Field label="الفرع (إلزامي)"><select className="sel" value={addP.branchId || ''} onChange={e => setAddP({ ...addP, branchId: e.target.value })}><option value="">— اختر —</option>{(org.branches || []).filter(b => b.isActive !== false).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
              <Field label="المسمى الوظيفي"><input className="inp" value={addP.cat || ''} onChange={e => setAddP({ ...addP, cat: e.target.value })} placeholder="كاشير، طباخ، محاسب…" /></Field>
              <Field label="الجوال"><input className="inp" style={{ direction: 'ltr', textAlign: 'right' }} value={addP.phone || ''} onChange={e => setAddP({ ...addP, phone: e.target.value })} /></Field>
              <Field label="البريد الإلكتروني"><input className="inp" style={{ direction: 'ltr', textAlign: 'right' }} type="email" value={addP.email || ''} onChange={e => setAddP({ ...addP, email: e.target.value })} /></Field>
            </div>
            <Field label="ملاحظات"><input className="inp" value={addP.notes || ''} onChange={e => setAddP({ ...addP, notes: e.target.value })} /></Field>
            <div className="note">يُسجَّل في سجل الموظفين نفسه (الحضور والرواتب والسلف). الراتب والهوية والعقد تُكمَّل من «شؤون الموظفين ← البيانات الرئيسية».</div>
          </>) : (<>
          <div className="grid g2">
            <Field label="التصنيف"><input className="inp" value={addP.cat || ''} onChange={e => setAddP({ ...addP, cat: e.target.value })} placeholder="مثال: عميل جملة" /></Field>
            <Field label="الجوال"><input className="inp" style={{ direction: 'ltr', textAlign: 'right' }} value={addP.phone || ''} onChange={e => setAddP({ ...addP, phone: e.target.value })} /></Field>
            <Field label="الرقم الضريبي (15 رقمًا للمسجّل)"><input className="inp n" value={addP.tax || ''} onChange={e => setAddP({ ...addP, tax: e.target.value })} placeholder="3XXXXXXXXXXXX03" /></Field>
            <Field label="مهلة السداد (يوم)"><input className="inp" inputMode="numeric" value={addP.terms || ''} onChange={e => setAddP({ ...addP, terms: e.target.value })} /></Field>
            <Field label="الشخص المسؤول"><input className="inp" value={addP.contactPerson || ''} onChange={e => setAddP({ ...addP, contactPerson: e.target.value })} placeholder="اسم المندوب أو المحاسب" /></Field>
            <Field label="جوال إضافي"><input className="inp" style={{ direction: 'ltr', textAlign: 'right' }} value={addP.mobile2 || ''} onChange={e => setAddP({ ...addP, mobile2: e.target.value })} /></Field>
            <Field label="البريد الإلكتروني"><input className="inp" style={{ direction: 'ltr', textAlign: 'right' }} type="email" value={addP.email || ''} onChange={e => setAddP({ ...addP, email: e.target.value })} /></Field>
            <Field label="السجل التجاري"><input className="inp n" value={addP.crNo || ''} onChange={e => setAddP({ ...addP, crNo: e.target.value })} /></Field>
            {(addP.type || 'customer') === 'customer'
              ? <Field label="حد الائتمان (ر.س)"><input className="inp n" inputMode="decimal" value={addP.creditLimit || ''} onChange={e => setAddP({ ...addP, creditLimit: e.target.value.replace(/[^\d.]/g, '') })} /></Field>
              : <Field label="البنك"><input className="inp" value={addP.bankName || ''} onChange={e => setAddP({ ...addP, bankName: e.target.value })} /></Field>}
          </div>
          {addP.type === 'supplier' && <Field label="الآيبان (للسداد بالتحويل)"><input className="inp n" style={{ direction: 'ltr', textAlign: 'right' }} value={addP.iban || ''} placeholder="SA…" onChange={e => setAddP({ ...addP, iban: e.target.value.toUpperCase().replace(/\s/g, '') })} /></Field>}
          <Field label="ملاحظات"><input className="inp" value={addP.notes || ''} onChange={e => setAddP({ ...addP, notes: e.target.value })} /></Field>
          <NationalAddressFields value={addP.na} legacy={addP.address} onChange={na => setAddP(a => ({ ...a, na }))} />
          <Field label="العنوان القديم (نص حر) — يُستبدل بالحقول أعلاه" style={{ display: naHas(addP.na) || !addP.edit || !addP.address ? 'none' : undefined }}><input className="inp" value={addP.address || ''} onChange={e => setAddP({ ...addP, address: e.target.value })} placeholder="المدينة، الحي، الشارع، الرمز البريدي" /></Field>
          <label className="row" style={{ gap: 6, fontSize: 12.5, cursor: 'pointer', marginTop: 4 }}>
            <input type="checkbox" checked={!!addP.taxable} onChange={e => setAddP({ ...addP, taxable: e.target.checked })} />
            خاضع لضريبة القيمة المضافة (مسجّل ضريبيًا)
          </label>
          {!addP.edit && (
          <div className="card" style={{ background: 'var(--ink)', padding: 12, marginTop: 6 }}>
            <div className="lbl">رصيد افتتاحي (اختياري)</div>
            <div className="grid g2">
              <Field label="الجهة"><select className="sel" value={addP.openingSide} onChange={e => setAddP({ ...addP, openingSide: e.target.value })}>
                <option value="debit">مدين — الطرف مدين لنا</option>
                <option value="credit">دائن — نحن مدينون للطرف</option></select></Field>
              <Field label="المبلغ"><MoneyField value={addP.opening || ''} onChange={v => setAddP({ ...addP, opening: v })} /></Field>
            </div>
          </div>
          )}
          </>)}
        </Modal>
      )}
    </div>
  );
}
