/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useMemo } from 'react';
import { Wallet, FileBarChart, ChevronDown, Printer, Check, Landmark, Banknote, Signature, Plus, TrendingDown, ShieldCheck, AlertTriangle, Users, PenLine, Receipt, Download } from 'lucide-react';
import { ibanNorm, ibanStatus, loadIbanSigs, requestIban } from '../../App.jsx';   // v40.9
import { AdvanceForm, Field, Kpi, LOCK_MSG, MZ_LOGO_HTML, Modal, NUM_FACE, PAY_ADD_TYPES, ROLES, SignDocsModal, arDT, arDate, branchBanks, buildPayslipSignDocs, eosAccrualLines, eosCumAt, eosState, isoD, leaveBalance, lockedThru, makeXlsx, money, monthEnd, nowISO, openDocWin, payrollRowsOf, periodLocked, printA4, rolePost, sigBlockHtml, sigSvg, sum, today, uid } from '../../App.jsx';

export function Payroll({ org, ops, me, myBranches, scoped, commit, commitOrg, say }) {
  const [month, setMonth] = useState(today().slice(0, 7));
  const [add, setAdd] = useState(false);
  const [payFund, setPayFund] = useState('1201');   // v15.19: مصدر صرف الرواتب — بنك (افتراضي) أو خزينة رئيسية
  const [repOpen, setRepOpen] = useState(false);    // v9.5 قائمة تقارير التطبيق
  const [compF, setCompF] = useState(null);         // v11.0 تعديل راتب/بدلات موظف
  const [eosF, setEosF] = useState(null);           // v12.3 حاسبة نهاية الخدمة
  const [eosStart, setEosStart] = useState(null);   // v30.8 بدء المخصص
  const [gosiD, setGosiD] = useState(() => {
    const g = org.gosiCfg || {};
    return {
      enabled: !!g.enabled,
      empRate: String(g.empRate != null ? g.empRate : 9.75), erRate: String(g.erRate != null ? g.erRate : 11.75),
      saudiOldEmp: String(g.saudiOldEmp != null ? g.saudiOldEmp : (g.empRate != null ? g.empRate : 9.75)),
      saudiOldEr: String(g.saudiOldEr != null ? g.saudiOldEr : (g.erRate != null ? g.erRate : 11.75)),
      saudiNewEmp: String(g.saudiNewEmp != null ? g.saudiNewEmp : 10.75), saudiNewEr: String(g.saudiNewEr != null ? g.saudiNewEr : 12.75),
      nonSaudiEmp: String(g.nonSaudiEmp != null ? g.nonSaudiEmp : 0), nonSaudiEr: String(g.nonSaudiEr != null ? g.nonSaudiEr : 2),
      ceiling: String(g.ceiling != null ? g.ceiling : 45000),
    };
  });
  const ids = myBranches.map(b => b.id);
  const emps = (org.employees || []).filter(e => ids.includes(e.branchId));
  const canPay = ROLES[me.role]?.scope !== 'own';
  // ترحيل الاستحقاق/الصرف قرار على مستوى المنشأة كلها — يُقصر على الأدوار شاملة النطاق
  const canPost = rolePost(me.role);

  // v11.0 — التأمينات الاجتماعية (GOSI): موقوفة افتراضيًا، بنِسَب قابلة للتعديل، وعلى وعاء الأساسي+السكن
  const gosi = org.gosiCfg || {};
  const gosiOn = !!gosi.enabled;
  const gosiEmpRate = Number(gosi.empRate != null ? gosi.empRate : 9.75) || 0;
  const gosiErRate = Number(gosi.erRate != null ? gosi.erRate : 11.75) || 0;
  const r2 = (n) => Math.round(n * 100) / 100;
  const rows = payrollRowsOf(org, scoped.advances, emps, month);   // v36.9: حساب موحّد مع مسير الرواتب (يشمل الإضافي المعتمد)

  const totalNet = sum(rows, r => r.net);
  const totalGross = sum(rows, r => r.gross);
  const totalGEmp = r2(sum(rows, r => r.gEmp));
  const totalGEr = r2(sum(rows, r => r.gEr));
  const totalGosi = r2(totalGEmp + totalGEr);

  // م10 (v27.0) — إقرارات استلام الراتب الموقَّعة إلكترونيًا (ops.hrSignDocs): تُصدر تلقائيًا مع تسجيل الصرف، ويوقّعها الموظف من كشك الفرع أو من هنا
  const slipDocOf = (empId) => (ops.hrSignDocs || []).find(d => d.docType === 'payslip' && d.month === month && d.employeeId === empId && d.status !== 'voided') || null;
  const slipDocs = rows.map(r => slipDocOf(r.e.id)).filter(Boolean);
  const slipSigned = slipDocs.filter(d => d.status === 'signed').length;
  const missingSlips = rows.filter(r => r.net > 0 && !slipDocOf(r.e.id)).length;
  const [signRow, setSignRow] = useState(null);   // {emp, doc} — توقيع الاستلام من شاشة الرواتب (المكتب)
  const issueSlips = async () => {
    if (!missingSlips) return say('كل قسائم هذا الشهر صادرة للتوقيع مسبقًا', 'no');
    const ok = await commit(d => ({ ...d, hrSignDocs: [...buildPayslipSignDocs(rows, month, d.hrSignDocs || [], org.branches || [], me), ...(d.hrSignDocs || [])] }), {
      actionType: 'create', targetType: 'hr_sign_doc', targetId: 'payslips-' + month,
      title: 'إصدار قسائم الشهر للتوقيع الإلكتروني', details: month + ' · ' + missingSlips + ' قسيمة'
    });
    if (ok) say('صدرت ' + missingSlips + ' قسيمة للتوقيع — يوقّعها الموظفون من كشك الفرع أو من هنا ✓');
  };
  // خلية توقيع الموظف في المسير المطبوع: التوقيع الإلكتروني إن وُجد، وإلا فراغ للتوقيع اليدوي
  const musterSigCell = (r) => { const sd = slipDocOf(r.e.id); return sd && sd.status === 'signed' ? sigSvg(sd.sig, { width: 90 }) : (sd ? '<span style="font-size:9px;color:#999">بانتظار التوقيع</span>' : ''); };

  const printMuster = () => {
    const monthName = new Date(month + '-01').toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { month: 'long', year: 'numeric' });
    const gc = gosiOn ? '<th>تأمينات</th>' : '';
    const rws = rows.map(r => `<tr><td>${r.e.name}</td><td>${(org.branches.find(b => b.id === r.e.branchId) || {}).name || ''}</td><td class="n">${money(r.e.baseSalary || 0)}</td><td class="n">${r.allow ? money(r.allow) : '—'}</td><td class="n">${r.bonus ? money(r.bonus) : '—'}</td><td class="n">${money(r.gross)}</td><td class="n">${r.draws ? money(r.draws) : '—'}</td><td class="n">${r.cuts ? money(r.cuts) : '—'}</td>${gosiOn ? `<td class="n">${r.gEmp ? money(r.gEmp) : '—'}</td>` : ''}<td class="n">${money(r.net)}</td><td style="width:100px;height:36px;text-align:center">${musterSigCell(r)}</td></tr>`).join('');
    const span = gosiOn ? 9 : 8;
    printA4(org, 'مسير الرواتب — ' + monthName, arDate(today()) + ' · ' + rows.length + ' موظف' + (slipDocs.length ? ' · توقيعات إلكترونية ' + slipSigned + '/' + slipDocs.length : ''),
      `<table><thead><tr><th>الموظف</th><th>الفرع</th><th>الأساسي</th><th>البدلات</th><th>مكافآت</th><th>الإجمالي</th><th>سلف/سحب</th><th>خصومات</th>${gc}<th>الصافي</th><th>توقيع الموظف</th></tr></thead><tbody>${rws}
      <tr class="tot"><td colspan="${span}">إجمالي صافي المسير</td><td class="n">${money(totalNet)}</td><td></td></tr>${gosiOn ? `<tr class="tot"><td colspan="${span}">إجمالي التأمينات للتحويل (موظف + صاحب عمل)</td><td class="n">${money(totalGosi)}</td><td></td></tr>` : ''}</tbody></table>
      ${slipDocs.length ? '<div class="ft" style="text-align:right">التوقيعات الإلكترونية مسجَّلة عبر كشك الفرع/المكتب بعد التحقق بـPIN أو بحضور مستخدم مركزي — تفاصيلها في «التوقيع الإلكتروني ← سجل الإقرارات».</div>' : ''}`) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
  };

  // ===== v12.3: حماية الأجور (WPS) ونهاية الخدمة =====
  const empGrossOf = (e) => r2((e.baseSalary || 0) + (e.housingAllowance || 0) + (e.transportAllowance || 0) + (e.otherAllowance || 0));
  const tenureYears = (hire, end) => { if (!hire) return 0; const h = Date.parse(hire + 'T00:00:00'), t = Date.parse((end || today()) + 'T00:00:00'); if (isNaN(h) || isNaN(t) || t < h) return 0; return (t - h) / (365.25 * 86400000); };
  const eosFull = (wage, years) => years <= 5 ? wage * 0.5 * years : wage * (2.5 + (years - 5));
  const eosEntitled = (wage, years, reason) => { const full = eosFull(wage, years); if (reason === 'termination') return full; if (years < 2) return 0; if (years < 5) return full / 3; if (years < 10) return full * 2 / 3; return full; };
  const fmtYears = (y) => { const yr = Math.floor(y + 1e-9); const mo = Math.round((y - yr) * 12); return yr + ' سنة' + (mo ? ' و' + mo + ' شهر' : ''); };
  // ===== v30.8: مخصص نهاية الخدمة في الدفاتر =====
  const EOS = useMemo(() => eosState(ops), [ops]);
  const eosCentral = canPost && ROLES[me.role]?.scope === 'all';
  const eosMonthLines = useMemo(() => (EOS.open && month >= EOS.from) ? eosAccrualLines(org, ops, month) : [], [org, ops, month, EOS]);
  const eosTotalBal = r2(Object.values(EOS.bal).reduce((a, v) => a + v, 0));
  const eosPending = useMemo(() => { if (!EOS.open) return []; const out = []; let m = EOS.from; const cur = today().slice(0, 7);
    while (m < cur && out.length < 36) { if (!EOS.months.has(m)) out.push(m); const [y, mo] = m.split('-').map(Number); m = isoD(new Date(y, mo, 1)).slice(0, 7); } return out; }, [EOS]);
  const startEos = async () => {
    const f = eosStart; const m = f.month; if (!/^\d{4}-\d{2}$/.test(m)) return say('اختر الشهر', 'no');
    if (periodLocked(org, m + '-01')) return say(LOCK_MSG(m + '-01'), 'no');
    if (EOS.open) return say('المخصص مُفعّل مسبقًا من ' + EOS.from, 'no');
    const prevD = isoD(new Date(Date.parse(m + '-01T12:00:00') - 86400000));
    const lines = (org.employees || []).filter(e => e.hireDate && e.hireDate <= prevD).map(e => ({ empId: e.id, name: e.name, branchId: e.branchId || '', cum: eosCumAt(e, prevD), amt: eosCumAt(e, prevD) })).filter(l => l.amt > 0);
    const rec = { id: uid('eos'), kind: 'eos_open', month: m, date: m + '-01', asOf: prevD, lines, total: r2(sum(lines, l => l.amt)), ...(f.post ? {} : { noPost: true }), by: me.name, at: nowISO() };
    const ok = await commit(d => ({ ...d, ledgerEntries: [rec, ...(d.ledgerEntries || [])] }), { actionType: 'create', targetType: 'daily_closing', targetId: 'eos-open', need: 'post', title: 'بدء مخصص نهاية الخدمة', details: 'من ' + m + ' · المتراكم ' + money(rec.total) + (f.post ? ' (قيد على الأرباح المبقاة)' : ' (مسجّل مسبقًا في الأرصدة الافتتاحية — بلا قيد)') });
    if (ok) { setEosStart(null); say('فُعّل مخصص نهاية الخدمة من ' + m + ' ✓'); }
  };
  const postEos = async () => {
    if (!EOS.open) return; if (month < EOS.from) return say('الشهر قبل بداية المخصص (' + EOS.from + ')', 'no');
    if (EOS.months.has(month)) return say('مخصص هذا الشهر مُرحّل مسبقًا', 'no');
    if (month > today().slice(0, 7)) return say('لا يُرحَّل شهر مستقبلي', 'no');
    const D = monthEnd(month); if (periodLocked(org, D)) return say(LOCK_MSG(D), 'no');
    const miss = eosPending.filter(m => m < month); if (miss.length) return say('رحّل الأشهر السابقة أولًا بالترتيب: ' + miss.join('، '), 'no');
    const lines = eosMonthLines;
    const rec = { id: uid('eos'), kind: 'eos_accrual', month, date: D, lines, total: r2(sum(lines, l => l.amt)), by: me.name, at: nowISO() };
    const ok = await commit(d => ({ ...d, ledgerEntries: [rec, ...(d.ledgerEntries || [])] }), { actionType: 'create', targetType: 'daily_closing', targetId: 'eos-' + month, need: 'post', title: 'رحّل مخصص نهاية الخدمة', details: month + ' · ' + lines.length + ' موظف · ' + money(rec.total) });
    if (ok) say('رُحّل مخصص ' + month + ' بـ ' + money(rec.total) + ' ✓');
  };
  const payEos = async (emp, calc, f) => {
    if (!EOS.open) return say('فعّل مخصص نهاية الخدمة أولًا', 'no');
    if (EOS.paid[emp.id]) return say('صُرفت مخالصة هذا الموظف مسبقًا', 'no');
    const D = (f.payDate || today());
    const empEnded = { ...emp, isActive: false, endDate: calc.endDate };
    const cumEnd = eosCumAt(empEnded, calc.endDate);
    const topUp = r2(cumEnd - (EOS.bal[emp.id] || 0));
    const recs = [];
    if (Math.abs(topUp) > 0.004) recs.push({ id: uid('eos'), kind: 'eos_accrual', month: calc.endDate.slice(0, 7) + '~' + emp.id, date: calc.endDate, lines: [{ empId: emp.id, name: emp.name, branchId: emp.branchId || '', cum: cumEnd, amt: topUp }], total: topUp, final: true, by: me.name, at: nowISO() });
    recs.push({ id: uid('eos'), kind: 'eos_pay', empId: emp.id, name: emp.name, branchId: emp.branchId || '', date: D, endDate: calc.endDate, reason: calc.reason, years: r2(calc.years), entitled: calc.entitled, leavePay: calc.leavePay, fund: f.fund || '1201', by: me.name, at: nowISO() });
    const lockedR = recs.find(r => periodLocked(org, r.date)); if (lockedR) return say(LOCK_MSG(lockedR.date), 'no');
    if (!window.confirm('صرف مخالصة ' + emp.name + ' بـ ' + money(calc.total) + ' وإيقاف الموظف بتاريخ ' + calc.endDate + '؟')) return;
    const ok1 = await commitOrg(d => ({ ...d, employees: (d.employees || []).map(x => x.id === emp.id ? { ...x, isActive: false, endDate: calc.endDate } : x) }), { actionType: 'update', targetType: 'user_account', targetId: emp.id, title: 'إنهاء خدمة موظف', details: emp.name + ' · ' + calc.endDate });
    if (!ok1) return;
    const ok = await commit(d => ({ ...d, ledgerEntries: [...recs, ...(d.ledgerEntries || [])] }), { actionType: 'create', targetType: 'daily_closing', targetId: 'eos-pay-' + emp.id, need: 'post', title: 'صرف مخالصة نهاية الخدمة', details: emp.name + ' · ' + money(calc.total) });
    if (ok) { setEosF(null); say('سُجّل صرف المخالصة واستُخدم المخصص ✓'); }
  };
  const exportWPS = async () => {
    // v40.9: الملف يحمل الآيبان الموثّق فقط (آخر اعتماد موقّع أو المعتمد غير المطبَّق) — وإلا يُمنع
    const sigs = await loadIbanSigs();
    if (sigs === 'err') return say('تعذّر التحقق من توثيق الآيبانات — تحقق من الاتصال وأعد المحاولة (لم يُصدَر الملف)', 'no');
    const IS = ibanStatus(org, sigs); const effOf = (e) => { const p = IS.payees.find(x => x.ent === 'emp:' + e.id); return sigs === null ? ibanNorm(e.iban) : (p && p.effective) || ''; };
    const blocked = sigs === null ? [] : rows.filter(r => r.e.iban && !effOf(r.e));
    if (blocked.length) return say('لا يُصدَر ملف حماية الأجور: ' + blocked.length + ' موظف بآيبان غير موثّق (' + blocked.slice(0, 4).map(r => r.e.name).join('، ') + (blocked.length > 4 ? '…' : '') + ') — وثّقه من «المالية والمحاسبة ← ضبط حسابات الدفع»', 'no');
    const head = ['رقم الهوية/الإقامة', 'اسم الموظف', 'الآيبان IBAN', 'الأساسي', 'بدل السكن', 'بدلات أخرى', 'الاستقطاعات', 'صافي الراتب', 'أيام العمل'];
    const lines = rows.map(r => [r.e.idNumber || r.e.iqamaNo || r.e.nationalId || '', r.e.name, effOf(r.e), r.e.baseSalary || 0, r.e.housingAllowance || 0, r2((r.e.transportAllowance || 0) + (r.e.otherAllowance || 0) + (r.bonus || 0)), r2(r.draws + r.cuts + r.gEmp), r.net, 30]);
    try {
      const blob = makeXlsx([{ name: ('حماية الأجور ' + month).slice(0, 28), rows: [head, ...lines] }]);
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'حماية_الأجور_WPS_' + month + '.xlsx'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1500);
      const missing = rows.filter(r => !(r.e.iban && (r.e.idNumber || r.e.iqamaNo || r.e.nationalId))).length;
      say(missing ? ('نُزّل ملف Excel — لكن ' + missing + ' موظف بلا آيبان/هوية كاملة؛ أكمِلها من «تعديل الراتب»') : 'نُزّل ملف حماية الأجور (Excel) ✓', missing ? 'no' : 'ok');
    } catch (e) { say('تعذّر توليد ملف Excel', 'no'); }
  };
  const printEOSlip = (emp, calc) => {
    printA4(org, 'مخالصة نهاية الخدمة — ' + emp.name, 'حتى ' + arDate(calc.endDate) + ' · ' + (calc.reason === 'termination' ? 'إنهاء من صاحب العمل' : 'استقالة'),
      `<table><tbody>
      <tr><td>تاريخ التعيين</td><td class="n">${emp.hireDate || '—'}</td></tr>
      <tr><td>تاريخ انتهاء الخدمة</td><td class="n">${calc.endDate}</td></tr>
      <tr><td>مدة الخدمة</td><td class="n">${fmtYears(calc.years)}</td></tr>
      <tr><td>الأجر الشهري (أساسي + بدلات)</td><td class="n">${money(calc.wage)}</td></tr>
      <tr><td>مكافأة نهاية الخدمة الكاملة</td><td class="n">${money(calc.full)}</td></tr>
      <tr><td>المستحق حسب سبب الانتهاء</td><td class="n">${money(calc.entitled)}</td></tr>
      ${calc.leavePay ? `<tr><td>بدل إجازة متبقية (${calc.leaveDays} يوم)</td><td class="n">${money(calc.leavePay)}</td></tr>` : ''}
      <tr class="tot"><td>إجمالي المخالصة النهائية</td><td class="n">${money(calc.total)}</td></tr>
      </tbody></table>
      <div class="box" style="margin-top:12px;font-size:10px;color:#777">محسوبة وفق نظام العمل السعودي (م 84/85): نصف شهر عن كل سنة للخمس الأولى، وشهر كامل لما بعدها؛ وتُخفَّض في الاستقالة حسب المدة. تقدير استرشادي؛ التسوية النهائية قد تشمل بنودًا أخرى.</div>`) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
  };

  const printPayslip = (r) => {
    const co = org.company || {};
    const b = org.branches.find(x => x.id === r.e.branchId);
    const m = (n) => money(n);
    const monthName = new Date(month + '-01').toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { month: 'long', year: 'numeric' });
    const adRows = r.ads.map(a => `<tr>
      <td>${arDate(a.date)}</td>
      <td>${['advance', 'salary_draw'].includes(a.type) ? 'سلفة/سحب' : a.type === 'overtime' ? 'عمل إضافي' : a.type === 'bonus' ? 'مكافأة' : 'خصم/جزاء'}</td>
      <td class="n">${m(a.amount)}</td>
      <td>${a.reason || '—'}</td></tr>`).join('') || '<tr><td colspan="4" class="ce">لا سلف أو خصومات هذا الشهر</td></tr>';
    const w = openDocWin('width=850,height=1000');
    if (!w) return;
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>قسيمة راتب - ${r.e.name} - ${monthName}</title>
      <style>${NUM_FACE}
        *{margin:0;padding:0;box-sizing:border-box;font-family:'MizanNum','Segoe UI',Tahoma,sans-serif}
        body{padding:32px;color:#222;background:#fff}
        .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #C8A24A;padding-bottom:16px;margin-bottom:20px}
        .logo{width:64px;height:64px;object-fit:contain}
        .co-n{font-size:19px;font-weight:bold;color:#8C6F2C}
        .co-m{font-size:11px;color:#666;margin-top:3px}
        .title{text-align:center;font-size:16px;font-weight:bold;margin:8px 0}
        .sub{text-align:center;font-size:13px;color:#666;margin-bottom:20px}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 20px;margin-bottom:20px}
        .fld{display:flex;justify-content:space-between;padding:8px 12px;background:#F6F2E9;border-radius:6px;font-size:13px}
        .fld b{color:#8C6F2C}
        table{width:100%;border-collapse:collapse;margin:16px 0;font-size:12.5px}
        th{background:#241F1B;color:#fff;padding:8px;text-align:right}
        td{border:1px solid #ddd;padding:7px 10px}
        td.n{text-align:left;font-variant-numeric:tabular-nums}
        td.ce{text-align:center;color:#999}
        .totals{margin-top:20px;border:2px solid #C8A24A;border-radius:10px;overflow:hidden}
        .totals .row{display:flex;justify-content:space-between;padding:11px 16px;font-size:14px;border-bottom:1px solid #eee}
        .totals .net{background:#241F1B;color:#fff;font-size:17px;font-weight:bold;border:none}
        .sign{display:flex;justify-content:space-between;margin-top:48px;gap:40px}
        .sign div{flex:1;text-align:center;border-top:1px solid #999;padding-top:8px;font-size:12px;color:#666}
        @media print{body{padding:16px}}
      </style></head><body>
      <div class="head">
        <div style="display:flex;gap:14px;align-items:center">
          ${co.logoUrl ? `<img class="logo" src="${co.logoUrl}">` :MZ_LOGO_HTML}
          <div><div class="co-n">${co.name || 'المنشأة'}</div>
          <div class="co-m">الرقم الضريبي: ${co.taxNumber || '—'} · س.تجاري: ${co.commercialReg || '—'}</div></div>
        </div>
        <div style="text-align:left;font-size:11px;color:#888">تاريخ الإصدار<br><b>${arDate(today())}</b></div>
      </div>
      <div class="title">قسيمة راتب</div>
      <div class="sub">عن شهر ${monthName}</div>
      <div class="grid">
        <div class="fld"><span>اسم الموظف</span><b>${r.e.name}</b></div>
        <div class="fld"><span>المسمى الوظيفي</span><b>${r.e.jobTitle || '—'}</b></div>
        <div class="fld"><span>الفرع</span><b>${b?.name || '—'}</b></div>
        <div class="fld"><span>رقم الموظف</span><b>${r.e.empNo || r.e.id.slice(-5)}</b></div>
      </div>
      <table><thead><tr><th>التاريخ</th><th>البند</th><th class="n">المبلغ</th><th>السبب</th></tr></thead>
        <tbody>${adRows}</tbody></table>
      <div class="totals">
        <div class="row"><span>الراتب الأساسي</span><b>${m(r.e.baseSalary || 0)} ر.س</b></div>
        <div class="row"><span>بدل السكن</span><b>${m(r.e.housingAllowance || 0)} ر.س</b></div>
        ${(r.e.transportAllowance || 0) ? `<div class="row"><span>بدل النقل</span><b>${m(r.e.transportAllowance || 0)} ر.س</b></div>` : ''}
        ${(r.e.otherAllowance || 0) ? `<div class="row"><span>بدلات أخرى</span><b>${m(r.e.otherAllowance || 0)} ر.س</b></div>` : ''}
        <div class="row"><span>إجمالي الاستحقاق</span><b>${m(r.gross)} ر.س</b></div>
        <div class="row"><span>السلف والسحوبات</span><b style="color:#C0392B">- ${m(r.draws)} ر.س</b></div>
        <div class="row"><span>الخصومات والجزاءات</span><b style="color:#C0392B">- ${m(r.cuts)} ر.س</b></div>
        ${r.gEmp ? `<div class="row"><span>التأمينات الاجتماعية (حصة الموظف)</span><b style="color:#C0392B">- ${m(r.gEmp)} ر.س</b></div>` : ''}
        <div class="row net"><span>صافي المستحق</span><b>${m(r.net)} ر.س</b></div>
      </div>
      ${r.gEr ? `<div style="margin-top:10px;font-size:11px;color:#666;text-align:center">حصة صاحب العمل من التأمينات: ${m(r.gEr)} ر.س (على المنشأة، خارج صافي الموظف)</div>` : ''}
      <div class="sign">
        <div>${(() => { const sd = slipDocOf(r.e.id); return sd && sd.status === 'signed' ? sigBlockHtml(sd, 150) + '<div style="margin-top:4px">توقيع الموظف — إقرار استلام</div>' : (sd ? 'توقيع الموظف <span style="font-size:9px;color:#999">(بانتظار التوقيع الإلكتروني)</span>' : 'توقيع الموظف'); })()}</div>
        <div>المحاسب</div>
        <div>اعتماد الإدارة</div>
      </div>
      </body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 500);
  };

  // ترحيل استحقاق الشهر وقيد الصرف إلى دفتر الشركاء — قيود دائمة لا تتغيّر بتغيّر الشهر (إصلاح المراجعة #4)
  const accrualPosted = (ops.ledgerEntries || []).some(x => x.kind === 'salary_accrual' && x.month === month);
  const payoutPosted = (ops.ledgerEntries || []).some(x => x.kind === 'salary_payout' && x.month === month);
  const postAccrual = async () => {
    if (lockedThru(org) && month <= lockedThru(org)) return say(LOCK_MSG(month + '-01'), 'no');
    if (accrualPosted) return say('استحقاق هذا الشهر مُرحّل مسبقاً', 'no');
    const entries = rows.filter(r => r.gross > 0).map(r => ({
      id: uid('le'), partnerKey: 'emp:' + r.e.id, date: month + '-28', month, kind: 'salary_accrual',
      desc: 'استحقاق راتب شهر ' + month, src: 'salary', debit: 0, credit: r.gross
    }));
    if (!entries.length) return say('لا رواتب لترحيلها هذا الشهر', 'no');
    await commit(d => ({ ...d, ledgerEntries: [...entries, ...(d.ledgerEntries || [])] }), {
      actionType: 'create', targetType: 'daily_closing', targetId: 'payroll-' + month,
      title: 'رحّل استحقاق رواتب الشهر للدفتر', details: month + ' · ' + entries.length + ' موظف · إجمالي ' + money(sum(rows.filter(r => r.gross > 0), r => r.gross))
    });
    say('رُحّل استحقاق ' + month + ' إلى دفتر الشركاء ✓');
  };
  const postPayout = async () => {
    if (lockedThru(org) && month <= lockedThru(org)) return say(LOCK_MSG(month + '-01'), 'no');
    if (!accrualPosted) return say('رحّل استحقاق الشهر أولاً', 'no');
    if (payoutPosted) return say('صرف هذا الشهر مسجّل مسبقاً', 'no');
    const entries = rows.filter(r => r.net > 0).map(r => ({
      id: uid('le'), partnerKey: 'emp:' + r.e.id, date: today(), month, kind: 'salary_payout',
      desc: 'صرف راتب شهر ' + month + ' (صافي بعد السلف والخصوم' + (r.gEmp > 0.004 ? ' والتأمينات' : '') + ')', src: 'salary', debit: r.net, credit: 0,
      gosi: r.gEmp || 0, gosiEr: r.gEr || 0,
      fund: payFund   // v15.19: مصدر صرف الرواتب المختار (بنك 1201 أو خزينة رئيسية 1101)
    }));
    if (!entries.length) return say('لا صافي مستحق للصرف', 'no');
    // م10 (v27.0): مع قيد الصرف تُصدر قسيمة إقرار استلام لكل موظف (تُكتب في مستند فرعه كي يوقّعها من كشك الفرع)
    const ok = await commit(d => ({ ...d, ledgerEntries: [...entries, ...(d.ledgerEntries || [])], hrSignDocs: [...buildPayslipSignDocs(rows, month, d.hrSignDocs || [], org.branches || [], me), ...(d.hrSignDocs || [])] }), {
      actionType: 'create', targetType: 'daily_closing', targetId: 'payout-' + month,
      title: 'سجّل صرف رواتب الشهر', details: month + ' · صافي ' + money(sum(rows.filter(r => r.net > 0), r => r.net)) + (payFund === '1101' ? ' · نقداً من الخزينة' : ' · من البنك') + (totalGosi > 0.004 ? ' · تأمينات ' + money(totalGosi) : '') + ' · صدرت ' + entries.length + ' قسيمة للتوقيع الإلكتروني'
    });
    if (!ok) return;
    say('سُجّل صرف رواتب ' + month + (payFund === '1101' ? ' نقداً من الخزينة الرئيسية' : ' من البنك') + ' — أُقفل استحقاق الشهر وصدرت قسائم الإقرار للتوقيع الإلكتروني ✓');
  };
  // v11.0 — حفظ إعداد التأمينات الاجتماعية
  const saveGosi = async () => {
    await commitOrg(d => ({ ...d, gosiCfg: {
      enabled: !!gosiD.enabled,
      empRate: Number(gosiD.saudiOldEmp) || 0, erRate: Number(gosiD.saudiOldEr) || 0,
      saudiOldEmp: Number(gosiD.saudiOldEmp) || 0, saudiOldEr: Number(gosiD.saudiOldEr) || 0,
      saudiNewEmp: Number(gosiD.saudiNewEmp) || 0, saudiNewEr: Number(gosiD.saudiNewEr) || 0,
      nonSaudiEmp: Number(gosiD.nonSaudiEmp) || 0, nonSaudiEr: Number(gosiD.nonSaudiEr) || 0,
      ceiling: Number(gosiD.ceiling) || 45000,
    } }), {
      actionType: 'update', targetType: 'year_end', targetId: 'gosi',
      title: gosiD.enabled ? 'فعّل/حدّث التأمينات الاجتماعية' : 'أوقف التأمينات الاجتماعية',
      details: gosiD.enabled ? ('سعودي قديم ' + gosiD.saudiOldEr + '% · جديد ' + gosiD.saudiNewEr + '% · غير سعودي ' + gosiD.nonSaudiEr + '%') : 'موقوفة'
    });
    say(gosiD.enabled ? 'حُفظ إعداد التأمينات — تُحتسب لكل موظف مشمول ✓' : 'أُوقفت التأمينات');
  };
  // v11.0 — حفظ راتب وبدلات موظف
  const saveComp = async () => {
    const f = compF;
    const patch = { baseSalary: Number(f.baseSalary) || 0, housingAllowance: Number(f.housingAllowance) || 0, transportAllowance: Number(f.transportAllowance) || 0, otherAllowance: Number(f.otherAllowance) || 0, gosiSubject: !!f.gosiSubject, nationality: f.nationality || '', hireDate: (f.hireDate || '').trim(), iban: (f.iban || '').trim().replace(/\s/g, ''), idNumber: (f.idNumber || '').trim() };
    // v40.9: آيبان الموظف لا يتغيّر مباشرة — طلب يعتمده شخص آخر (الإزالة مباشرة)
    const empOld = ibanNorm(((org.employees || []).find(x => x.id === f.id) || {}).iban), empNew = ibanNorm(patch.iban);
    const empReq = empNew && empNew !== empOld; if (empReq) patch.iban = empOld;
    await commitOrg(d => ({ ...d, employees: (d.employees || []).map(x => x.id === f.id ? { ...x, ...patch } : x) }), {
      actionType: 'update', targetType: 'user_account', targetId: f.id,
      title: 'حدّث راتب/بدلات موظف', details: f.name + ' · أساسي ' + money(patch.baseSalary)
    });
    if (empReq) { const r = await requestIban(me, commitOrg, { ent: 'emp:' + f.id, name: f.name, iban: empOld }, empNew); setCompF(null); return say(r.ok ? 'حُفظ راتب ' + f.name + ' ✓ — وتغيير الآيبان أُرسل للاعتماد (يعتمده شخص آخر من المالية/الإدارة)' : (r.msg || 'تعذّر طلب الآيبان'), r.ok ? undefined : 'no'); }
    setCompF(null); say('حُفظ راتب ' + f.name + ' ✓');
  };

  return (
    <div className="grid" style={{ gap: 14 }}>
      {/* شريط التطبيق — v9.5 */}
      <div className="abar">
        <div className="abar-id"><span className="abar-ic"><Wallet size={17} /></span>الرواتب والسلف<small>مسير الرواتب · السلف والخصومات</small></div>
        <div className="abar-sp" />
        <div className="abar-dd">
          <button className="btn sm" onClick={() => setRepOpen(o => !o)}><FileBarChart size={14} />التقارير<ChevronDown size={13} /></button>
          {repOpen && (<>
            <div className="abar-back" onClick={() => setRepOpen(false)} />
            <div className="abar-menu">
              <div className="abar-hd">تقارير الرواتب</div>
              <button onClick={() => { setRepOpen(false); printMuster(); }}><Printer size={13} />مسير الرواتب الشهري</button>
            </div>
          </>)}
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div className="row">
          <input type="month" className="inp" style={{ width: 165 }} value={month} onChange={e => setMonth(e.target.value)} />
          <span className="badge b-dim">{emps.length} موظف</span>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {canPost && (accrualPosted
            ? <span className="badge b-mint"><Check size={11} />استحقاق {month} مُرحّل للدفتر</span>
            : <button className="btn" onClick={postAccrual}><Landmark size={14} />ترحيل استحقاق الشهر للدفتر</button>)}
          {canPost && !payoutPosted && (
            <select className="sel" style={{ width: 'auto' }} value={payFund} title="مصدر صرف الرواتب"
              onChange={e => setPayFund(e.target.value)}>
              <option value="1201">الصرف من البنك التجميعي</option>
              {branchBanks(org).map(bb => <option key={bb.code} value={bb.code}>الصرف من {bb.name}</option>)}
              <option value="1101">الصرف نقداً من الخزينة الرئيسية</option>
            </select>
          )}
          {canPost && (payoutPosted
            ? <span className="badge b-mint"><Check size={11} />صرف {month} مسجّل</span>
            : <button className="btn" disabled={!accrualPosted} onClick={postPayout}><Banknote size={14} />تسجيل صرف الرواتب</button>)}
          {canPost && payoutPosted && missingSlips > 0 && <button className="btn" onClick={issueSlips} title="لأشهر صُرفت قبل تفعيل التوقيع الإلكتروني"><Signature size={14} />إصدار قسائم الشهر للتوقيع ({missingSlips})</button>}
          {slipDocs.length > 0 && <span className={'badge ' + (slipSigned === slipDocs.length ? 'b-mint' : 'b-amber')} title="إقرارات استلام الراتب الموقَّعة إلكترونيًا"><Signature size={11} />التوقيعات {slipSigned}/{slipDocs.length}</span>}
          <button className="btn pri" onClick={() => setAdd(true)}><Plus size={15} />تسجيل سلفة أو خصم</button>
        </div>
      </div>

      <div className="grid g4">
        <Kpi label="إجمالي الاستحقاق (أساسي + بدلات)" value={money(totalGross)} icon={Wallet} color="#C8A24A" />
        <Kpi label="السلف والمسحوبات" value={money(sum(rows, r => r.draws))} icon={TrendingDown} color="#E0A458" />
        {gosiOn
          ? <Kpi label="التأمينات (موظف + عمل)" value={money(totalGosi)} sub={'استقطاع ' + money(totalGEmp) + ' · صاحب العمل ' + money(totalGEr)} icon={ShieldCheck} color="#5B93C4" />
          : <Kpi label="الخصومات والجزاءات" value={money(sum(rows, r => r.cuts))} icon={AlertTriangle} color="#D9544D" />}
        <Kpi label="صافي المستحق للصرف" value={money(totalNet)} sub={gosiOn ? 'بعد السلف والخصوم والتأمينات' : 'بعد السلف والخصوم'} icon={Banknote} color="#4FB286" />
      </div>

      {canPost && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <label className="row" style={{ gap: 6, fontSize: 12.5, cursor: 'pointer' }}>
              <input type="checkbox" checked={gosiD.enabled} onChange={e => setGosiD(s => ({ ...s, enabled: e.target.checked }))} />
              <ShieldCheck size={15} color="var(--brass)" />تفعيل التأمينات الاجتماعية (GOSI)
            </label>
            <button className="btn pri" onClick={saveGosi} disabled={!gosiD.enabled}><Check size={14} />حفظ إعداد التأمينات</button>
          </div>
          {gosiD.enabled && (
            <div className="grid g3" style={{ gap: 8, marginTop: 10 }}>
              <Field label="سعودي (قديم) — موظف %"><input className="inp n" inputMode="decimal" value={gosiD.saudiOldEmp} onChange={e => setGosiD(s => ({ ...s, saudiOldEmp: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
              <Field label="سعودي (قديم) — صاحب العمل %"><input className="inp n" inputMode="decimal" value={gosiD.saudiOldEr} onChange={e => setGosiD(s => ({ ...s, saudiOldEr: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
              <Field label="سقف الأجر الخاضع (ر.س)"><input className="inp n" inputMode="decimal" value={gosiD.ceiling} onChange={e => setGosiD(s => ({ ...s, ceiling: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
              <Field label="سعودي (جديد 2024+) — موظف %"><input className="inp n" inputMode="decimal" value={gosiD.saudiNewEmp} onChange={e => setGosiD(s => ({ ...s, saudiNewEmp: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
              <Field label="سعودي (جديد 2024+) — صاحب العمل %"><input className="inp n" inputMode="decimal" value={gosiD.saudiNewEr} onChange={e => setGosiD(s => ({ ...s, saudiNewEr: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
              <div />
              <Field label="غير سعودي — موظف %"><input className="inp n" inputMode="decimal" value={gosiD.nonSaudiEmp} onChange={e => setGosiD(s => ({ ...s, nonSaudiEmp: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
              <Field label="غير سعودي — صاحب العمل % (أخطار مهنية)"><input className="inp n" inputMode="decimal" value={gosiD.nonSaudiEr} onChange={e => setGosiD(s => ({ ...s, nonSaudiEr: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
            </div>
          )}
          <div className="note" style={{ marginTop: 8 }}>تُحتسب على وعاء (الأساسي + السكن) بحدّ أقصى السقف، للموظفين المشمولين فقط. تُطبَّق النسبة حسب «جنسية» الموظف (تُحدَّد من «تعديل الراتب»): سعودي قديم/جديد بحسب تاريخ التعيين قبل/بعد 3 يوليو 2024، أو غير سعودي (2% أخطار مهنية على صاحب العمل فقط). عند عدم تحديد الجنسية تُستخدم نِسَب «سعودي (قديم)». القيم افتراضات نظامية حالية — راجِعها مع GOSI/مُدد. يظهر القيد في المحاسبة (5202/2202) عند تسجيل الصرف.</div>
        </div>
      )}

      <div className="card">
        <div className="card-t" style={{ marginBottom: 12 }}><Users size={15} color="var(--brass)" />كشف رواتب {month}</div>
        <div className="tw">
          <table className="tb">
            <thead><tr>
              <th>الموظف</th><th>الفرع</th><th style={{ textAlign: 'end' }}>الأساسي</th><th style={{ textAlign: 'end' }}>البدلات</th><th style={{ textAlign: 'end' }}>الإجمالي</th>
              <th style={{ textAlign: 'end' }}>سلف</th><th style={{ textAlign: 'end' }}>خصومات</th>{gosiOn && <th style={{ textAlign: 'end' }}>تأمينات</th>}<th style={{ textAlign: 'end' }}>الصافي</th><th>التوقيع</th><th></th>
            </tr></thead>
            <tbody>
              {rows.map(r => { const sd = slipDocOf(r.e.id); return (
                <tr key={r.e.id}>
                  <td>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{r.e.name}<span style={{ fontSize: 9.5, color: 'var(--faint)', marginInlineStart: 6 }}>{r.e.jobTitle}</span></div>
                    <div className="row" style={{ gap: 4, marginTop: 3 }}>
                      {r.flags > 0 && <span className="badge b-rose">{r.flags} سحبية غير مبررة</span>}
                      {gosiOn && r.e.gosiSubject && <span className="badge b-sky" style={{ fontSize: 9 }}>مشمول تأمينات</span>}
                    </div>
                  </td>
                  <td style={{ fontSize: 11.5, color: 'var(--dim)' }}>{org.branches.find(b => b.id === r.e.branchId)?.name}</td>
                  <td className="num" style={{ textAlign: 'end' }}>{money(r.e.baseSalary || 0)}</td>
                  <td className="num" style={{ textAlign: 'end', color: 'var(--dim)' }}>{r.allow ? money(r.allow) : '—'}</td>
                  <td className="num" style={{ textAlign: 'end', fontWeight: 600 }}>{money(r.gross)}</td>
                  <td className="num" style={{ textAlign: 'end', color: 'var(--amber)' }}>{r.draws ? money(r.draws) : '—'}</td>
                  <td className="num" style={{ textAlign: 'end', color: 'var(--rose)' }}>{r.cuts ? money(r.cuts) : '—'}</td>
                  {gosiOn && <td className="num" style={{ textAlign: 'end', color: 'var(--sky)' }}>{r.gEmp ? money(r.gEmp) : '—'}</td>}
                  <td className="num" style={{ textAlign: 'end', color: 'var(--mint)', fontWeight: 700 }}>{money(r.net)}</td>
                  <td>
                    {!sd && (payoutPosted && r.net > 0 ? <span className="badge b-dim" title="أصدرها من زر «إصدار قسائم الشهر للتوقيع»">لم تُصدر</span> : <span style={{ color: 'var(--faint)' }}>—</span>)}
                    {sd && sd.status === 'signed' && <span className="badge b-mint" title={'وُقِّع ' + arDT(sd.signedAt) + (sd.pinVerified ? ' · PIN' : ' · بحضور ' + sd.witnessName)}><Check size={11} />موقَّع</span>}
                    {sd && sd.status === 'pending' && <span className="badge b-amber">بانتظار التوقيع</span>}
                  </td>
                  <td>
                    <div className="row" style={{ gap: 5, justifyContent: 'flex-end' }}>
                      {canPost && <button className="btn sm gh" onClick={() => setCompF({ id: r.e.id, name: r.e.name, baseSalary: String(r.e.baseSalary || 0), housingAllowance: String(r.e.housingAllowance || 0), transportAllowance: String(r.e.transportAllowance || 0), otherAllowance: String(r.e.otherAllowance || 0), gosiSubject: !!r.e.gosiSubject, nationality: r.e.nationality || '', hireDate: r.e.hireDate || '', iban: r.e.iban || '', idNumber: r.e.idNumber || r.e.iqamaNo || r.e.nationalId || '' })}>تعديل الراتب</button>}
                      {sd && sd.status === 'pending' && <button className="btn sm gh" onClick={() => setSignRow({ emp: r.e, doc: sd })} title="يوقّع الموظف هنا بحضورك (PIN أو شاهد)"><PenLine size={13} />توقيع الاستلام</button>}
                      <button className="btn sm gh" onClick={() => printPayslip(r)} title="قسيمة راتب"><Printer size={13} />قسيمة</button>
                    </div>
                  </td>
                </tr>
              ); })}
              {rows.length === 0 && <tr><td colSpan={gosiOn ? 11 : 10}><div className="empty">لا يوجد موظفون ضمن نطاقك.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {gosiOn && rows.some(r => r.gEmp > 0.004 || r.gEr > 0.004) && (
        <div className="card">
          <div className="card-h"><div className="card-t"><ShieldCheck size={15} color="var(--brass)" />التأمينات الاجتماعية — للتحويل عن شهر {month}</div>
            <span className="badge b-brass">الإجمالي للتحويل: <b className="num">{money(totalGosi)}</b></span></div>
          <div className="tw" style={{ marginTop: 8 }}>
            <table className="tb">
              <thead><tr><th>الموظف</th><th style={{ textAlign: 'end' }}>وعاء التأمين</th><th style={{ textAlign: 'end' }}>حصة الموظف</th><th style={{ textAlign: 'end' }}>حصة صاحب العمل</th><th style={{ textAlign: 'end' }}>الإجمالي</th></tr></thead>
              <tbody>
                {rows.filter(r => r.gEmp > 0.004 || r.gEr > 0.004).map(r => (
                  <tr key={r.e.id}>
                    <td style={{ fontSize: 12.5 }}>{r.e.name}</td>
                    <td className="num" style={{ textAlign: 'end', color: 'var(--dim)' }}>{money((r.e.gosiWage != null ? Number(r.e.gosiWage) || 0 : (r.e.baseSalary || 0) + (r.e.housingAllowance || 0)))}</td>
                    <td className="num" style={{ textAlign: 'end', color: 'var(--sky)' }}>{money(r.gEmp)}</td>
                    <td className="num" style={{ textAlign: 'end', color: 'var(--amber)' }}>{money(r.gEr)}</td>
                    <td className="num" style={{ textAlign: 'end', fontWeight: 700 }}>{money(r2(r.gEmp + r.gEr))}</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 800, background: 'rgba(200,162,74,.05)' }}>
                  <td>الإجمالي</td><td /><td className="num" style={{ textAlign: 'end' }}>{money(totalGEmp)}</td><td className="num" style={{ textAlign: 'end' }}>{money(totalGEr)}</td><td className="num" style={{ textAlign: 'end' }}>{money(totalGosi)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="note" style={{ marginTop: 8 }}>حصة الموظف مُستقطعة من صافي راتبه، وحصة صاحب العمل مصروف على المنشأة — كلاهما التزام يُحوَّل للتأمينات (حساب 2202). يُرحَّل قيدهما تلقائيًا عند «تسجيل صرف الرواتب».</div>
        </div>
      )}

      <div className="card">
        <div className="card-t" style={{ marginBottom: 12 }}><Receipt size={15} color="var(--brass)" />حركة السلف والخصومات</div>
        <div className="tw">
          <table className="tb">
            <thead><tr><th>التاريخ</th><th>الموظف</th><th>النوع</th><th>المبلغ</th><th>السبب</th><th>سجّله</th></tr></thead>
            <tbody>
              {scoped.advances.filter(a => a.month === month).sort((a, b) => b.date.localeCompare(a.date)).map(a => (
                <tr key={a.id}>
                  <td className="dt" style={{ whiteSpace: 'nowrap' }}>{arDate(a.date)}</td>
                  <td style={{ fontSize: 12 }}>{a.employeeName}</td>
                  <td><span className={'badge ' + (['advance', 'salary_draw'].includes(a.type) ? 'b-amber' : PAY_ADD_TYPES.includes(a.type) ? 'b-mint' : 'b-rose')}>
                    {{ overtime: 'عمل إضافي', advance: 'سلفة', salary_draw: 'مسحوبة', discount: 'خصم', absence_penalty: 'غياب', lateness_penalty: 'تأخير', bonus: 'مكافأة معتمدة', discipline_penalty: 'جزاء معتمد', unpaid_leave: 'إجازة بدون راتب', sick_leave_cut: 'خصم إجازة مرضية', other: 'أخرى' }[a.type] || a.type}
                  </span></td>
                  <td className="num">{money(a.amount)}</td>
                  <td style={{ fontSize: 11.5, color: 'var(--dim)' }}>{a.reason}</td>
                  <td style={{ fontSize: 11.5, color: 'var(--faint)' }}>{a.createdByName}</td>
                </tr>
              ))}
              {scoped.advances.filter(a => a.month === month).length === 0 &&
                <tr><td colSpan={6}><div className="empty">لا حركات مسجلة لهذا الشهر.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <div className="card-t"><ShieldCheck size={15} color="var(--brass)" />الأجور والتسويات — حماية الأجور ونهاية الخدمة</div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {eosCentral && !EOS.open && <button className="btn sm pri" onClick={() => setEosStart({ month: today().slice(0, 7), post: true })}>تفعيل مخصص نهاية الخدمة في الدفاتر</button>}
            {eosCentral && EOS.open && <button className="btn sm pri" disabled={EOS.months.has(month) || month < EOS.from || month > today().slice(0, 7)} onClick={postEos}>{EOS.months.has(month) ? 'مخصص ' + month + ' مُرحّل ✓' : 'ترحيل مخصص ' + month + ' (' + money(r2(sum(eosMonthLines, l => l.amt))) + ')'}</button>}
            {canPay && <button className="btn sm" onClick={exportWPS}><Download size={13} />ملف حماية الأجور (WPS)</button>}
          </div>
        </div>
        {EOS.open && <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          <span className="badge b-mint">المخصص مُفعّل من {EOS.from}</span>
          <span className="badge b-dim">رصيد المخصص في الدفاتر: <span className="num">{money(eosTotalBal)}</span></span>
          {eosPending.length > 0 && <span className="badge b-amber">أشهر لم تُرحَّل: {eosPending.join('، ')} — اختر الشهر من أعلى الصفحة ثم رحّله</span>}
        </div>}
        <div className="tw">
          <table className="tb">
            <thead><tr><th>الموظف</th><th>تاريخ التعيين</th><th>مدة الخدمة</th><th style={{ textAlign: 'end' }}>الأجر الشهري</th>{EOS.open && <th style={{ textAlign: 'end' }}>المخصص المسجّل</th>}<th style={{ textAlign: 'end' }}>مكافأة نهاية الخدمة (لو انتهت اليوم)</th><th /></tr></thead>
            <tbody>
              {emps.map(e => { const wage = empGrossOf(e); const yrs = tenureYears(e.hireDate, today()); const full = r2(eosFull(wage, yrs)); return (
                <tr key={e.id}>
                  <td style={{ fontWeight: 600, fontSize: 12.5 }}>{e.name}</td>
                  <td className="dt" style={{ fontSize: 12 }}>{e.hireDate ? arDate(e.hireDate) : <span style={{ color: 'var(--amber)' }}>غير محدّد</span>}</td>
                  <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{e.hireDate ? fmtYears(yrs) : '—'}</td>
                  <td className="num" style={{ textAlign: 'end' }}>{money(wage)}</td>
                  {EOS.open && <td className="num" style={{ textAlign: 'end', color: 'var(--dim)' }}>{EOS.paid[e.id] ? <span className="badge b-mint">صُرفت</span> : money(EOS.bal[e.id] || 0)}</td>}
                  <td className="num" style={{ textAlign: 'end', fontWeight: 700 }}>{e.hireDate ? money(full) : '—'}</td>
                  <td><button className="btn sm gh" onClick={() => { const lb = leaveBalance(org, ops, e, today()); setEosF({ id: e.id, reason: 'termination', endDate: today(), leaveDays: lb.ok && lb.balance > 0 ? String(Math.round(lb.balance * 100) / 100) : '' }); }}>تسوية</button></td>
                </tr>
              ); })}
              {emps.length === 0 && <tr><td colSpan={7}><div className="empty">لا موظفون في نطاقك.</div></td></tr>}
              {emps.length > 0 && (() => { const tot = r2(sum(emps, e => eosFull(empGrossOf(e), tenureYears(e.hireDate, today())))); return (
                <tr style={{ fontWeight: 800, background: 'rgba(200,162,74,.05)' }}>
                  <td colSpan={EOS.open ? 5 : 4}>مخصّص نهاية الخدمة التقديري (لو انتهت خدمة الجميع اليوم)</td>
                  <td className="num" style={{ textAlign: 'end', color: 'var(--brass-l)' }}>{money(tot)}</td><td />
                </tr>
              ); })()}
            </tbody>
          </table>
        </div>
        <div className="note" style={{ marginTop: 10 }}>ملف حماية الأجور (WPS) يُصدَّر CSV من مسير الشهر — أكمِل الآيبان ورقم الهوية لكل موظف من «تعديل الراتب». مكافأة نهاية الخدمة وفق نظام العمل السعودي (نصف شهر لكل سنة في الخمس الأولى، وشهر كامل لما بعدها). أضِف تاريخ التعيين ليظهر حسابها. اضغط «تسوية» لمخالصة مفصّلة بسبب الانتهاء وبدل الإجازة.</div>
      </div>

      {add && <AdvanceForm emps={emps} org={org} me={me} commit={commit} say={say} onClose={() => setAdd(false)} />}
      {signRow && <SignDocsModal org={org} ops={ops} me={me} emp={signRow.emp} docs={[signRow.doc]} onClose={() => setSignRow(null)} commit={commit} say={say} via="central" />}

      {eosStart && (() => { const m = eosStart.month || ''; const prevD = /^\d{4}-\d{2}$/.test(m) ? isoD(new Date(Date.parse(m + '-01T12:00:00') - 86400000)) : '';
        const tot = prevD ? r2(sum(org.employees || [], e => (e.hireDate && e.hireDate <= prevD) ? eosCumAt(e, prevD) : 0)) : 0;
        const noHire = (org.employees || []).filter(e => e.isActive !== false && !e.hireDate).length;
        return (
        <Modal title="تفعيل مخصص نهاية الخدمة" icon={ShieldCheck} onClose={() => setEosStart(null)}
          foot={<><button className="btn gh" onClick={() => setEosStart(null)}>إلغاء</button><button className="btn pri" onClick={startEos}><Check size={14} />تفعيل</button></>}>
          <Field label="بداية المخصص (شهر)"><input type="month" className="inp" value={m} onChange={e => setEosStart(f => ({ ...f, month: e.target.value }))} /></Field>
          <div className="mono-b" style={{ margin: '6px 0' }}><span style={{ fontSize: 12 }}>المتراكم حتى {prevD || '—'}</span><span className="num">{money(tot)}</span></div>
          <label className="row" style={{ gap: 7, fontSize: 12.5, cursor: 'pointer', margin: '6px 0' }}>
            <input type="radio" checked={!!eosStart.post} onChange={() => setEosStart(f => ({ ...f, post: true }))} />قيّد المتراكم الآن: من ح/ الأرباح المبقاة إلى ح/ مخصص نهاية الخدمة
          </label>
          <label className="row" style={{ gap: 7, fontSize: 12.5, cursor: 'pointer', margin: '6px 0' }}>
            <input type="radio" checked={!eosStart.post} onChange={() => setEosStart(f => ({ ...f, post: false }))} />المتراكم مسجّل مسبقًا في الأرصدة الافتتاحية (حساب 2203) — لا تُنشئ قيدًا
          </label>
          {noHire > 0 && <div className="note" style={{ color: 'var(--amber)' }}>⚠ {noHire} موظف بلا تاريخ تعيين — لن يُحتسب لهم مخصص حتى يُضاف من «تعديل الراتب».</div>}
          <div className="note">بعد التفعيل: رحّل كل شهر من زر «ترحيل مخصص الشهر» (من ح/ مصروف نهاية الخدمة إلى ح/ المخصص بالفرق). عند انتهاء خدمة موظف سجّل الصرف من «تسوية» فيُستخدم مخصصه.</div>
        </Modal>); })()}

      {eosF && (() => {
        const emp = emps.find(e => e.id === eosF.id); if (!emp) return null;
        const wage = empGrossOf(emp), years = tenureYears(emp.hireDate, eosF.endDate);
        const full = r2(eosFull(wage, years)), entitled = r2(eosEntitled(wage, years, eosF.reason));
        const leaveDays = Number(String(eosF.leaveDays).replace(/[^\d.]/g, '')) || 0, leavePay = r2(leaveDays * wage / 30);
        const total = r2(entitled + leavePay);
        const calc = { endDate: eosF.endDate, reason: eosF.reason, years, wage, full, entitled, leaveDays, leavePay, total };
        return (
          <Modal title={'تسوية نهاية الخدمة — ' + emp.name} icon={ShieldCheck} onClose={() => setEosF(null)}
            foot={<><button className="btn gh" onClick={() => setEosF(null)}>إغلاق</button><button className="btn" disabled={!emp.hireDate} onClick={() => printEOSlip(emp, calc)}><Printer size={14} />طباعة المخالصة</button>
              {eosCentral && EOS.open && !EOS.paid[emp.id] && emp.hireDate && <button className="btn pri" onClick={() => payEos(emp, calc, eosF)}><Check size={14} />تسجيل الصرف وإنهاء الخدمة</button>}</>}>
            {!emp.hireDate ? <div className="note">أضف «تاريخ التعيين» لهذا الموظف من «تعديل الراتب» أولًا لحساب المدة والمكافأة.</div> : <>
              <div className="grid g2">
                <Field label="سبب انتهاء الخدمة">
                  <select className="inp" value={eosF.reason} onChange={e => setEosF(f => ({ ...f, reason: e.target.value }))}>
                    <option value="termination">إنهاء من صاحب العمل</option>
                    <option value="resignation">استقالة</option>
                  </select>
                </Field>
                <Field label="تاريخ انتهاء الخدمة"><input className="inp" type="date" value={eosF.endDate} onChange={e => setEosF(f => ({ ...f, endDate: e.target.value }))} /></Field>
                <Field label="أيام إجازة متبقية (اختياري)"><input className="inp n" inputMode="decimal" value={eosF.leaveDays} onChange={e => setEosF(f => ({ ...f, leaveDays: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
                <Field label="الأجر الشهري"><input className="inp n" value={money(wage)} disabled /></Field>
              </div>
              <div className="card" style={{ background: 'rgba(200,162,74,.05)', marginTop: 10 }}>
                {[['مدة الخدمة', fmtYears(years)], ['المكافأة الكاملة', money(full)], ['المستحق حسب السبب', money(entitled)], leaveDays ? ['بدل الإجازة المتبقية', money(leavePay)] : null].filter(Boolean).map((x, i) => (
                  <div key={i} className="row" style={{ justifyContent: 'space-between', fontSize: 12.5, padding: '3px 0' }}><span>{x[0]}</span><b className="num">{x[1]}</b></div>
                ))}
                <div className="row" style={{ justifyContent: 'space-between', fontWeight: 900, fontSize: 14, borderTop: '1px solid var(--frame-o)', marginTop: 6, paddingTop: 6 }}><span>إجمالي المخالصة</span><b className="num" style={{ color: 'var(--brass-l)' }}>{money(total)}</b></div>
              </div>
              {eosCentral && EOS.open && !EOS.paid[emp.id] && <div className="grid g2" style={{ marginTop: 10 }}>
                <Field label="تاريخ الصرف"><input className="inp" type="date" value={eosF.payDate || today()} onChange={e => setEosF(f => ({ ...f, payDate: e.target.value }))} /></Field>
                <Field label="مصدر الصرف"><select className="sel" value={eosF.fund || '1201'} onChange={e => setEosF(f => ({ ...f, fund: e.target.value }))}>
                  <option value="1201">البنك التجميعي</option>{branchBanks(org).map(bb => <option key={bb.code} value={bb.code}>{bb.name}</option>)}<option value="1101">نقدًا من الخزينة الرئيسية</option></select></Field>
                <div className="note" style={{ gridColumn: 'span 2' }}>المسجّل في المخصص لهذا الموظف: <b className="num">{money(EOS.bal[emp.id] || 0)}</b> — يُستكمل حتى تاريخ الانتهاء ثم يُستخدم في الصرف، وأي فرق (كالاستقالة قبل سنتين) يُرد لحساب المصروف.</div>
              </div>}
              {EOS.paid[emp.id] && <div className="note" style={{ marginTop: 8 }}>صُرفت مخالصة هذا الموظف بتاريخ {EOS.paid[emp.id].date}.</div>}
              <div className="note" style={{ marginTop: 8 }}>وفق نظام العمل: نصف شهر لكل سنة في الخمس الأولى وشهر كامل لما بعدها. الاستقالة: لا شيء تحت سنتين، الثلث حتى 5 سنوات، الثلثان حتى 10، وكامل بعدها. تقدير استرشادي.</div>
            </>}
          </Modal>
        );
      })()}

      {compF && (
        <Modal title={'راتب وبدلات — ' + compF.name} icon={Wallet} onClose={() => setCompF(null)}
          foot={<><button className="btn gh" onClick={() => setCompF(null)}>إلغاء</button>
            <button className="btn pri" onClick={saveComp}><Check size={14} />حفظ</button></>}>
          <div className="grid g2">
            <Field label="الراتب الأساسي"><input className="inp n" inputMode="decimal" value={compF.baseSalary} onChange={e => setCompF(f => ({ ...f, baseSalary: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
            <Field label="بدل السكن"><input className="inp n" inputMode="decimal" value={compF.housingAllowance} onChange={e => setCompF(f => ({ ...f, housingAllowance: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
            <Field label="بدل النقل"><input className="inp n" inputMode="decimal" value={compF.transportAllowance} onChange={e => setCompF(f => ({ ...f, transportAllowance: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
            <Field label="بدلات أخرى"><input className="inp n" inputMode="decimal" value={compF.otherAllowance} onChange={e => setCompF(f => ({ ...f, otherAllowance: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
          </div>
          <div className="grid g2" style={{ marginTop: 8 }}>
            <Field label="الجنسية (لنِسبة التأمينات)"><select className="inp sel" value={compF.nationality || ''} onChange={e => setCompF(f => ({ ...f, nationality: e.target.value }))}><option value="">غير محدّد</option><option value="saudi">سعودي</option><option value="nonSaudi">غير سعودي</option></select></Field>
            <Field label="تاريخ التعيين (نهاية الخدمة + نظام التأمينات)"><input className="inp" type="date" value={compF.hireDate} onChange={e => setCompF(f => ({ ...f, hireDate: e.target.value }))} /></Field>
            <Field label="رقم الهوية/الإقامة (لحماية الأجور)"><input className="inp n" value={compF.idNumber} onChange={e => setCompF(f => ({ ...f, idNumber: e.target.value }))} /></Field>
            <Field label="الآيبان IBAN (لحماية الأجور)" style={{ gridColumn: '1 / -1' }}><input className="inp n" value={compF.iban} placeholder="SA00 0000 0000 0000 0000 0000" onChange={e => setCompF(f => ({ ...f, iban: e.target.value }))} /></Field>
          </div>
          <label className="row" style={{ gap: 6, fontSize: 12.5, cursor: 'pointer', marginTop: 8 }}>
            <input type="checkbox" checked={compF.gosiSubject} onChange={e => setCompF(f => ({ ...f, gosiSubject: e.target.checked }))} />
            مشمول بالتأمينات الاجتماعية (تُحتسب على الأساسي + السكن)
          </label>
          <div className="card" style={{ background: 'rgba(200,162,74,.05)', marginTop: 8 }}>
            <div className="row" style={{ justifyContent: 'space-between', fontWeight: 800, fontSize: 13.5 }}>
              <span>إجمالي الاستحقاق الشهري</span>
              <b className="num">{money(r2((Number(compF.baseSalary) || 0) + (Number(compF.housingAllowance) || 0) + (Number(compF.transportAllowance) || 0) + (Number(compF.otherAllowance) || 0)))}</b>
            </div>
          </div>
          <div className="note">يُطبَّق على مسير هذا الشهر والأشهر القادمة. تعديل الراتب لا يغيّر أشهرًا سبق ترحيل استحقاقها.</div>
        </Modal>
      )}
    </div>
  );
}
