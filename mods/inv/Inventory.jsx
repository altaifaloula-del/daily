/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useEffect, useMemo } from 'react';
import { HardDrive, FileBarChart, ChevronDown, Printer, ArrowLeftRight, ClipboardCheck, Truck, Store, BarChart3, AlertTriangle, Trash2, TrendingUp, Download, Check, Upload, Plus, Landmark, X } from 'lucide-react';
import { BlindCount, Field, ITEM_TYPES, Kpi, LOCK_MSG, MAIN_WH, MOVE_KINDS, Modal, PriceAlerts, ROLES, SectionNav, UsageVariance, WarehousesPanel, WasteControl, WasteFields, arDate, isCostCtl, isStocked, itemAvgCosts, itemType, makeXlsx, money, nowISO, pFactor, parseCsvGrid, parseXlsxGrid, partGross, partYield, periodLocked, printA4, q3, stockByWh, submitWaste, sum, today, uid, wasteCfg, wasteReasonAr, whName, whOn } from '../../App.jsx';

export function Inventory({ org, ops, me, commit, commitOrg, say, invIntent }) {
  const [view, setView] = useState('items');        // items | moves | count | recipes
  const [repOpen, setRepOpen] = useState(false);    // v9.4 قائمة تقارير التطبيق
  const [itemF, setItemF] = useState(null);         // نموذج صنف
  const [impF, setImpF] = useState(null);           // v30.3 استيراد أصناف من Excel/CSV: {name, grid, map, start, update, opening}
  const [moveF, setMoveF] = useState(null);         // نموذج حركة
  const [prodF, setProdF] = useState(null);         // نموذج وصفة
  const [menuQty, setMenuQty] = useState({});        // v12.4 مسودة كميات البيع الشهرية لهندسة القائمة
  const [ivD, setIvD] = useState(() => { const v = org.invValuation || {}; return { enabled: !!v.enabled, auto: v.auto !== false, asOf: v.asOf || today(), value: v.value != null ? String(v.value) : '' }; });
  useEffect(() => { if (invIntent && invIntent.v) setView(invIntent.v); }, [invIntent && invIntent.ts]);

  const canW = ROLES[me?.role]?.scope === 'all' && !isCostCtl(me);   // v37.8: مراقب التكاليف اطّلاع فقط على الأصناف والوصفات
  const items = org.items || [];
  const products = org.products || [];
  const moves = ops.stockMoves || [];
  const taxCfg = org.taxCfg || {};
  const netOf = (p) => taxCfg.enabled ? Math.round(p / (1 + (Number(taxCfg.rate) || 15) / 100) * 100) / 100 : p;

  // v29.9: مع المستودعات تعرض شاشة الأصناف إجمالي المنشأة (كل المستودعات + الطريق)
  const SBall = useMemo(() => stockByWh(org, ops), [org, ops]);
  const bal = SBall.total;
  // الجرد وحركات الشاشة المركزية تخص المستودع الرئيسي — تُقارن برصيده هو لا بإجمالي المنشأة
  const mainBal = whOn(org) ? (SBall.byWh[MAIN_WH] || {}) : SBall.total;
  const mainOf = (id) => Math.round((mainBal[id] || 0) * 1000) / 1000;
  const AVG = useMemo(() => itemAvgCosts(org, ops), [org, ops]);   // v30.4 المتوسط المرجّح
  const avgOf = (id) => AVG[id] || 0;
  const balOf = (id) => Math.round((bal[id] || 0) * 1000) / 1000;
  const stockValue = sum(items.filter(isStocked), it => Math.max(0, balOf(it.id)) * avgOf(it.id));
  const lowItems = items.filter(it => isStocked(it) && (it.minQty || 0) > 0 && balOf(it.id) <= it.minQty);

  // v10.0 — رسملة المخزون (الطريقة الدورية): بضاعة آخر المدة تُرسمل أصلًا وتُخفّض تكلفة الفترة
  const saveIv = async () => {
    if (periodLocked(org, ivD.asOf)) return say(LOCK_MSG(ivD.asOf), 'no');
    const val = ivD.auto ? stockValue : (Math.round((Number(ivD.value) || 0) * 100) / 100);
    await commitOrg(d => ({ ...d, invValuation: { enabled: ivD.enabled, auto: ivD.auto, asOf: ivD.asOf || today(), value: val } }), {
      actionType: 'update', targetType: 'inventory_valuation', targetId: 'iv',
      title: 'حدّث رسملة المخزون', details: (ivD.enabled ? 'مُفعّلة · ' : 'موقوفة · ') + money(val)
    });
    say(ivD.enabled ? 'فُعّلت رسملة المخزون — يظهر قيد بضاعة آخر المدة في المحاسبة' : 'أُوقفت رسملة المخزون');
  };
  const stateOf = (it) => {
    const b = balOf(it.id), mn = it.minQty || 0;
    if (mn > 0 && b <= mn) return ['b-rose', 'اطلب الآن'];
    if (mn > 0 && b <= mn * 1.3) return ['b-amber', 'قارب الحد'];
    return ['b-mint', 'جيد'];
  };
  const itemName = (id) => (items.find(x => x.id === id) || {}).name || '—';

  // ===== v30.3 — استيراد الأصناف من Excel/CSV =====
  const IMP_COLS = [['name', 'اسم الصنف', /اسم|الصنف|المادة|item|name|product/i], ['unit', 'الوحدة', /^(?!.*(شراء|purchase)).*(وحد|unit|uom)/i],
    ['cost', 'التكلفة', /تكلف|سعر|cost|price/i], ['minQty', 'الحد الأدنى', /أدنى|ادنى|الحد|min|reorder/i],
    ['maxQty', 'الحد الأعلى', /أعلى|اعلى|max/i], ['qty', 'الرصيد الافتتاحي', /رصيد|كمي|qty|quantity|opening/i],
    ['type', 'نوع الصنف', /نوع|type/i], ['purchaseUnit', 'وحدة الشراء', /وحدة الشراء|purchase unit|pack/i], ['purchaseFactor', 'معامل التحويل', /معامل|تحويل|factor|per pack/i]];
  const typeOf = (v) => { const t = String(v || '').trim(); return /خدم|serv/i.test(t) ? 'service' : /بيع|sale|sell/i.test(t) ? 'sale' : t ? 'stock' : ''; };
  const normNum = (v) => { const t = String(v == null ? '' : v).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[٫]/g, '.').replace(/[,٬\s]/g, '');
    if (t === '') return null; const n = Number(t); return Number.isFinite(n) ? n : NaN; };
  const normName = (v) => String(v || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const detectImp = (grid) => {
    for (let r = 0; r < Math.min(grid.length, 10); r++) {
      const row = grid[r].map(c => String(c || '').trim()); const map = {};
      IMP_COLS.forEach(([k, , re]) => { const i = row.findIndex((c, j) => c && re.test(c) && !Object.values(map).includes(j) && !(k === 'minQty' && /أعلى|اعلى|max/i.test(c))); if (i >= 0) map[k] = i; });
      if (map.name != null) return { map, start: r + 1 };
    }
    return { map: { name: 0, unit: 1, cost: 2, minQty: 3, maxQty: -1, qty: -1 }, start: 0 };
  };
  const impPick = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    try {
      const grid = /\.xlsx$/i.test(f.name) ? await parseXlsxGrid(await f.arrayBuffer()) : parseCsvGrid(await f.text());
      if (!grid || !grid.length) return say('الملف فارغ أو غير مقروء', 'no');
      const d = detectImp(grid);
      setImpF({ name: f.name, grid, map: { maxQty: -1, qty: -1, unit: -1, cost: -1, minQty: -1, ...d.map }, start: d.start, update: true, opening: (d.map.qty ?? -1) >= 0 });
    } catch (err) { say('تعذّرت قراءة الملف — إن كان Excel قديمًا (.xls) فاحفظه بصيغة xlsx أو CSV وأعد رفعه', 'no'); }
  };
  const impTemplate = () => {
    try {
      const blob = makeXlsx([{ name: 'الأصناف', rows: [['اسم الصنف', 'نوع الصنف', 'الوحدة', 'التكلفة', 'الحد الأدنى', 'الحد الأعلى', 'الرصيد الافتتاحي', 'وحدة الشراء', 'معامل التحويل'],
        ['أرز بسمتي', 'استهلاكي', 'كغ', 6.5, 50, 200, 120, 'كيس', 40], ['زيت طبخ', 'استهلاكي', 'لتر', 9.25, 20, 80, 40, 'كرتون', 12],
        ['مياه معدنية', 'قابل للبيع', 'حبة', 0.6, 100, 600, 240, 'كرتون', 24], ['صيانة المكيفات', 'خدمي', 'زيارة', 150, '', '', '', '', '']] }]);
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'نموذج_استيراد_الأصناف.xlsx'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (e) { say('تعذّر توليد النموذج', 'no'); }
  };
  // صفوف المعاينة: جديد / تحديث / خطأ / مكرر في الملف
  const impRows = (() => {
    if (!impF) return [];
    const m = impF.map; const cell = (r, k) => (m[k] != null && m[k] >= 0) ? r[m[k]] : '';
    const seen = new Set();
    return impF.grid.slice(impF.start).map((r, i) => {
      const name = String(cell(r, 'name') || '').trim(); if (!name) return null;
      const unit = String(cell(r, 'unit') || '').trim();
      const cost = normNum(cell(r, 'cost')), minQty = normNum(cell(r, 'minQty')), maxQty = normNum(cell(r, 'maxQty')), qty = normNum(cell(r, 'qty'));
      const type = typeOf(cell(r, 'type')), purchaseUnit = String(cell(r, 'purchaseUnit') || '').trim(), purchaseFactor = normNum(cell(r, 'purchaseFactor'));
      const key = normName(name); const ex = items.find(x => normName(x.name) === key);
      let st = ex ? 'update' : 'new', why = '';
      if ([cost, minQty, maxQty, qty, purchaseFactor].some(v => Number.isNaN(v) || (v != null && v < 0))) { st = 'error'; why = 'رقم غير صالح'; }
      else if (seen.has(key)) { st = 'dup'; why = 'مكرر في الملف'; }
      seen.add(key);
      return { line: impF.start + i + 1, name, unit, cost, minQty, maxQty, qty, type, purchaseUnit, purchaseFactor, st, why, ex };
    }).filter(Boolean);
  })();
  const doImport = async () => {
    const ok = impRows.filter(r => r.st === 'new' || (r.st === 'update' && impF.update));
    if (!ok.length) return say('لا أصناف صالحة للاستيراد', 'no');
    const withQty = impF.opening ? ok.filter(r => (r.qty || 0) > 0 && r.type !== 'service' && !(r.ex && itemType(r.ex) === 'service' && !r.type)) : [];
    if (withQty.length && periodLocked(org, today())) return say(LOCK_MSG(today()), 'no');
    const extra = (r) => ({ ...(r.type ? { type: r.type } : {}), ...(r.purchaseUnit ? { purchaseUnit: r.purchaseUnit, purchaseFactor: Math.max(1, r.purchaseFactor || 1) } : {}) });
    const recs = ok.map(r => r.ex
      ? { ...r.ex, ...(r.unit ? { unit: r.unit } : {}), ...(r.cost != null ? { cost: r.cost } : {}), ...(r.minQty != null ? { minQty: r.minQty } : {}), ...(r.maxQty != null ? { maxQty: r.maxQty } : {}), ...extra(r) }
      : { id: uid('it'), name: r.name, unit: r.unit || 'وحدة', cost: r.cost || 0, minQty: r.minQty || 0, ...(r.maxQty != null ? { maxQty: r.maxQty } : {}), isActive: true, type: 'stock', ...extra(r) });
    const okOrg = await commitOrg(d => {
      const list = [...(d.items || [])];
      recs.forEach(rec => { const i = list.findIndex(x => x.id === rec.id || normName(x.name) === normName(rec.name)); if (i >= 0) list[i] = { ...list[i], ...rec, id: list[i].id }; else list.push(rec); });
      return { ...d, items: list };
    }, { actionType: 'create', targetType: 'stock_item', targetId: 'import', title: 'استيراد أصناف من ' + impF.name,
      details: recs.length + ' صنف (' + ok.filter(r => r.st === 'new').length + ' جديد · ' + ok.filter(r => r.st === 'update').length + ' تحديث)' });
    if (!okOrg) return;
    let movesN = 0;
    if (withQty.length) {
      const idOf = (r) => (r.ex && r.ex.id) || (recs.find(x => normName(x.name) === normName(r.name)) || {}).id;
      const mv = withQty.map(r => ({ id: uid('sm'), date: today(), itemId: idOf(r), kind: 'in', qty: r.qty, note: 'رصيد افتتاحي — استيراد ' + impF.name, by: me.name, at: nowISO(),
        ...(r.cost != null ? { unitCost: r.cost } : {}), ...(whOn(org) ? { whId: MAIN_WH } : {}) })).filter(x => x.itemId);
      const okMv = await commit(d => ({ ...d, stockMoves: [...mv, ...(d.stockMoves || [])] }),
        { actionType: 'create', targetType: 'stock_move', targetId: 'import-opening', title: 'أرصدة افتتاحية للأصناف المستوردة' + (whOn(org) ? ' (المستودع الرئيسي)' : ''), details: mv.length + ' صنف' });
      if (okMv) movesN = mv.length;
    }
    setImpF(null);
    say('اُستورد ' + recs.length + ' صنف ✓' + (movesN ? ' وسُجّل رصيد افتتاحي لـ ' + movesN + ' صنف' + (whOn(org) ? ' في المستودع الرئيسي' : '') : ''));
  };

  const saveItem = async () => {
    const f = itemF;
    if (!f.name.trim()) return say('أدخل اسم الصنف', 'no');
    const pf = Math.max(1, Number(f.purchaseFactor) || 1);
    const rec = { ...(f.id ? items.find(x => x.id === f.id) || {} : {}), id: f.id || uid('it'), name: f.name.trim(), unit: (f.unit || '').trim() || 'وحدة', cost: Number(f.cost) || 0, minQty: Number(f.minQty) || 0, isActive: true,
      type: ITEM_TYPES[f.type] ? f.type : 'stock', purchaseUnit: (f.purchaseUnit || '').trim(), purchaseFactor: (f.purchaseUnit || '').trim() ? pf : 1,
      ...(f.type === 'sale' ? { sellPrice: Number(f.sellPrice) || 0 } : {}) };
    await commitOrg(d => ({ ...d, items: f.id ? (d.items || []).map(x => x.id === f.id ? rec : x) : [...(d.items || []), rec] }), {
      actionType: f.id ? 'update' : 'create', targetType: 'stock_item', targetId: rec.id,
      title: f.id ? 'عدّل صنف مخزون' : 'أضاف صنف مخزون', details: rec.name + ' · ' + money(rec.cost) + '/' + rec.unit
    });
    setItemF(null); say('حُفظ الصنف ✓');
  };

  const saveMove = async () => {
    const f = moveF; const it = items.find(x => x.id === f.itemId);
    const q = Number(f.qty) || 0;
    if (!it) return say('اختر الصنف', 'no');
    if (q <= 0) return say('أدخل كمية صحيحة', 'no');
    if (!isStocked(it)) return say('صنف خدمي لا يُخزَّن — لا حركات مخزون له', 'no');
    const sign = MOVE_KINDS[f.kind]?.sign || 1;
    // v30.4: الكمية بوحدة الشراء عند اختيارها تُحوَّل للوحدة الأساسية، والتوريد يحمل تكلفته فيُحدّث المتوسط
    const fac = f.uom === 'p' ? pFactor(it) : 1;
    const qBase = Math.round(q * fac * 1000) / 1000;
    const uc = f.kind === 'in' && f.unitCost !== '' && f.unitCost != null ? Math.round((Number(f.unitCost) || 0) / fac * 10000) / 10000 : null;
    if (f.kind === 'waste') {   // v37.4 — سبب منظّم + صورة + اعتماد فوق الحد
      const have = whOn(org) ? mainOf(it.id) : balOf(it.id);
      if (qBase > have + 0.0005) return say('الكمية تتجاوز الرصيد: ' + it.name + ' (المتاح ' + have + ')', 'no');
      const ok = await submitWaste({ org, me, commit, say, col: 'stockMoves', whId: whOn(org) ? MAIN_WH : '', branchId: '', lines: [{ itemId: it.id, qty: qBase }], f, avg: AVG, title: whOn(org) ? whName(org, MAIN_WH) : 'المخزون' });
      if (ok) setMoveF(null);
      return;
    }
    const rec = { id: uid('sm'), date: today(), itemId: it.id, kind: f.kind, qty: sign * qBase, note: f.note || '', by: me.name, at: nowISO(),
      ...(uc != null ? { unitCost: uc } : {}), ...(whOn(org) ? { whId: MAIN_WH } : {}) };
    await commit(d => ({ ...d, stockMoves: [rec, ...(d.stockMoves || [])] }), {
      actionType: 'create', targetType: 'stock_move', targetId: rec.id,
      title: 'سجّل حركة مخزون — ' + (MOVE_KINDS[f.kind]?.ar || ''), details: it.name + ' · ' + q + ' ' + it.unit + (f.note ? ' · ' + f.note : '')
    });
    setMoveF(null); say('سُجّلت الحركة ✓');
  };


  // v8.2: طباعة أرصدة المخزون + قائمة جرد ورقية بعمود عدّ فارغ
  const printStock = () => {
    const rows = items.map(it => `<tr><td>${it.name}</td><td>${it.unit}</td><td class="n">${money(it.cost)}</td><td class="n">${balOf(it.id)}</td><td class="n">${money(balOf(it.id) * (it.cost || 0))}</td><td class="n">${it.minQty || '—'}</td></tr>`).join('');
    printA4(org, 'أرصدة المخزون', arDate(today()) + ' · ' + items.length + ' صنفًا',
      `<table><thead><tr><th>الصنف</th><th>الوحدة</th><th>التكلفة</th><th>الرصيد</th><th>القيمة</th><th>حد الطلب</th></tr></thead><tbody>${rows}
      <tr class="tot"><td colspan="4">قيمة المخزون الإجمالية</td><td class="n">${money(stockValue)}</td><td></td></tr></tbody></table>`) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
  };
  const printCountSheet = () => {
    // v37.5 — جرد أعمى: الورقة بلا رصيد دفتري ولا فرق
    const rows = items.filter(isStocked).map(it => `<tr><td>${it.name}</td><td>${it.unit}</td><td style="height:26px"></td><td></td></tr>`).join('');
    printA4(org, 'قائمة جرد أعمى', arDate(today()) + ' — تُملأ أثناء العدّ ثم تُدخل في شاشة الجرد · لا يظهر الرصيد الدفتري للعادّ',
      `<table><thead><tr><th>الصنف</th><th>الوحدة</th><th>العدّ الفعلي</th><th>ملاحظات</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="sign"><div>قام بالعدّ</div><div>أعاد العدّ</div><div>اعتماد (شخص آخر)</div></div>`) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
  };

  const prodCost = (p) => sum(p.parts || [], pt => partGross(pt) * avgOf(pt.itemId));   // v37.6: الكمية الإجمالية (بالناتج) × المتوسط المرجّح
  // v12.4 — هندسة القائمة: كمية البيع الشهرية (يدخلها المستخدم) × هامش الوصفة
  const menuQtyOf = (p) => { const raw = menuQty[p.id]; return Number(String(raw != null ? raw : (p.salesQty || 0)).replace(/[^\d.]/g, '')) || 0; };
  const saveMenuQty = async () => {
    await commitOrg(d => ({ ...d, products: (d.products || []).map(p => ({ ...p, salesQty: menuQtyOf(p) })) }), { actionType: 'update', targetType: 'inventory', targetId: 'menuQty', title: 'حفظ كميات البيع الشهرية (هندسة القائمة)', details: products.length + ' منتج' });
    say('حُفظت الكميات ✓');
  };
  const exportMenuXlsx = () => {
    const r2m = (n) => Math.round((Number(n) || 0) * 100) / 100;
    const head = ['المنتج', 'سعر البيع', 'الصافي', 'التكلفة', 'هامش الوحدة', 'الهامش %', 'الكمية الشهرية', 'مساهمة الربح', 'التصنيف'];
    const cls = menuClassifier();
    const body = products.map(p => { const cost = prodCost(p), net = netOf(p.sellPrice || 0), cm = r2m(net - cost), qty = menuQtyOf(p); return [p.name, p.sellPrice || 0, net, cost, cm, net > 0 ? Math.round((net - cost) / net * 1000) / 10 : 0, qty, r2m(cm * qty), cls(p).k]; });
    try {
      const blob = makeXlsx([{ name: 'هندسة القائمة', rows: [head, ...body] }]);
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'هندسة_القائمة.xlsx'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1500);
      say('نُزّل تحليل القائمة (Excel) ✓');
    } catch (e) { say('تعذّر توليد ملف Excel', 'no'); }
  };
  // مُصنِّف نجم/لغز/حصان/كلب وفق (الرواج × الربحية) — قواطع كازافانا-سميث
  const menuClassifier = () => {
    const r2m = (n) => Math.round((Number(n) || 0) * 100) / 100;
    const rw = products.map(p => { const cost = prodCost(p), net = netOf(p.sellPrice || 0); return { id: p.id, cm: r2m(net - cost), qty: menuQtyOf(p) }; });
    const withQty = rw.filter(r => r.qty > 0); const N = withQty.length;
    const totalQty = sum(withQty, r => r.qty); const totalCM = sum(withQty, r => r.cm * r.qty);
    const avgCM = totalQty > 0 ? totalCM / totalQty : 0; const popCut = N > 0 ? 0.7 * totalQty / N : 0;
    return (p) => { const r = rw.find(x => x.id === p.id) || { cm: 0, qty: 0 }; if (r.qty <= 0) return { k: 'بلا كمية', c: 'b-dim' }; const hiPop = r.qty >= popCut, hiCM = r.cm >= avgCM; if (hiPop && hiCM) return { k: 'نجم', c: 'b-mint' }; if (!hiPop && hiCM) return { k: 'لغز', c: 'b-sky' }; if (hiPop && !hiCM) return { k: 'حصان', c: 'b-amber' }; return { k: 'كلب', c: 'b-rose' }; };
  };
  const saveProd = async () => {
    const f = prodF;
    if (!f.name.trim()) return say('أدخل اسم المنتج', 'no');
    const badY = (f.parts || []).find(pt => pt.itemId && pt.yield !== '' && pt.yield != null && !(Number(pt.yield) > 0 && Number(pt.yield) <= 100));
    if (badY) return say('معامل الناتج بين 1 و100% — ' + ((items.find(x => x.id === badY.itemId) || {}).name || ''), 'no');
    const parts = (f.parts || []).filter(pt => pt.itemId && Number(pt.qty) > 0).map(pt => ({ itemId: pt.itemId, qty: Number(pt.qty), ...(partYield(pt) < 100 ? { yield: Math.round(partYield(pt) * 10) / 10 } : {}) }));
    const dv = Number((f.disc || {}).v) || 0;
    if (dv > 0 && (f.disc || {}).t !== 'amt' && dv > 100) return say('نسبة خصم الصنف لا تتجاوز 100%', 'no');
    if (dv > 0 && (f.disc || {}).t === 'amt' && dv >= (Number(f.sellPrice) || 0)) return say('خصم الصنف يجب أن يكون أقل من سعر البيع', 'no');
    const rec = { id: f.id || uid('pr'), name: f.name.trim(), sellPrice: Number(f.sellPrice) || 0, parts, cat: (f.cat || '').trim(), ...(f.posOff ? { posOff: true } : {}),
      ...(dv > 0 ? { disc: { t: (f.disc || {}).t === 'amt' ? 'amt' : 'pct', v: dv, ...((f.disc || {}).to ? { to: f.disc.to } : {}) } } : {}) };
    await commitOrg(d => ({ ...d, products: f.id ? (d.products || []).map(x => x.id === f.id ? rec : x) : [...(d.products || []), rec] }), {
      actionType: f.id ? 'update' : 'create', targetType: 'product', targetId: rec.id,
      title: f.id ? 'عدّل وصفة منتج' : 'أضاف منتجًا بوصفته', details: rec.name + ' · تكلفة ' + money(prodCost(rec))
    });
    setProdF(null); say('حُفظ المنتج ✓');
  };

  return (
    <div className="grid" style={{ gap: 14 }}>
      {/* شريط التطبيق — v9.4 */}
      <div className="abar">
        <div className="abar-id"><span className="abar-ic"><HardDrive size={17} /></span>المخزون والمنتجات<small>الأصناف · الحركات · الجرد · المنتجات والوصفات</small></div>
        <div className="abar-sp" />
        <div className="abar-dd">
          <button className="btn sm" onClick={() => setRepOpen(o => !o)}><FileBarChart size={14} />التقارير<ChevronDown size={13} /></button>
          {repOpen && (<>
            <div className="abar-back" onClick={() => setRepOpen(false)} />
            <div className="abar-menu">
              <div className="abar-hd">تقارير المخزون والمنتجات</div>
              <button onClick={() => { setRepOpen(false); printStock(); }}><Printer size={13} />تقرير المخزون والأرصدة</button>
              <button onClick={() => { setRepOpen(false); printCountSheet(); }}><Printer size={13} />ورقة جرد ورقية</button>
            </div>
          </>)}
        </div>
      </div>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <SectionNav label="أقسام المخزون" cur={view} onPick={setView} items={[{ id: 'items', ar: 'الأصناف والأرصدة', icon: HardDrive }, { id: 'moves', ar: 'الحركات', icon: ArrowLeftRight }, { id: 'count', ar: 'الجرد' + (whOn(org) ? ' (الرئيسي)' : ''), icon: ClipboardCheck }, { id: 'wh', ar: 'المستودعات', icon: Truck }, { id: 'recipes', ar: 'الوصفات والتكلفة', icon: Store }, { id: 'menu', ar: 'هندسة القائمة', icon: BarChart3 }, { id: 'usage', ar: 'الاستهلاك النظري والفعلي', icon: AlertTriangle }, { id: 'waste', ar: 'ضبط الهدر', icon: Trash2, badge: (ops.wasteRequests || []).filter(r => r.status === 'pending').length || null }, { id: 'prices', ar: 'تنبيهات الأسعار', icon: TrendingUp, badge: (ops.purchaseOrders || []).filter(po => po.status === 'pending' && po.priceAlert).length || null }]} />
      </div>

      <div className="grid g4">
        <Kpi label="قيمة المخزون (بآخر تكلفة)" value={money(stockValue)} sub={items.length + ' صنفاً'} icon={HardDrive} color="#C8A24A" />
        <Kpi label="أصناف تحت حد الطلب" value={String(lowItems.length)} sub={lowItems.map(i => i.name).join('، ').slice(0, 40) || 'لا شيء — ممتاز'} icon={AlertTriangle} color={lowItems.length ? '#D9544D' : '#4FB286'} />
        <Kpi label="حركات المخزون" value={String(moves.length)} sub="توريد · صرف · هدر · جرد" icon={ArrowLeftRight} color="#5B93C4" />
        <Kpi label="منتجات بوصفات" value={String(products.length)} sub="تكلفة وهامش لكل منتج" icon={Store} color="#9B7BB8" />
      </div>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {view === 'menu' && <button className="btn sm" style={{ marginInlineStart: 'auto' }} onClick={exportMenuXlsx}><Download size={13} />Excel</button>}
        {view === 'menu' && canW && <button className="btn sm pri" onClick={saveMenuQty}><Check size={14} />حفظ الكميات</button>}
        {view === 'items' && <button className="btn sm" style={{ marginInlineStart: 'auto' }} onClick={printStock}><Printer size={13} />طباعة الأرصدة</button>}
        {canW && view === 'items' && <><label className="btn sm" style={{ cursor: 'pointer' }}><Upload size={13} />استيراد من Excel<input type="file" accept=".xlsx,.csv,text/csv" style={{ display: 'none' }} onChange={impPick} /></label>
          <button className="btn sm gh" onClick={impTemplate}><Download size={13} />نموذج</button></>}
        {canW && view === 'items' && <button className="btn sm pri" onClick={() => setItemF({ name: '', unit: 'كغ', cost: '', minQty: '' })}><Plus size={14} />صنف جديد</button>}
        {canW && view === 'moves' && <button className="btn sm pri" style={{ marginInlineStart: 'auto' }} onClick={() => setMoveF({ kind: 'in', itemId: (items.find(isStocked) || {}).id || '', qty: '', note: '', uom: 'b', unitCost: '' })}><Plus size={14} />حركة جديدة</button>}
        {canW && view === 'recipes' && <button className="btn sm pri" style={{ marginInlineStart: 'auto' }} onClick={() => setProdF({ name: '', sellPrice: '', parts: [{ itemId: items[0]?.id || '', qty: '' }] })}><Plus size={14} />منتج جديد</button>}
      </div>

      {view === 'items' && (
        <div className="card">
          <div className="tw">
            <table className="tb">
              <thead><tr><th>الصنف</th><th>النوع</th><th>الوحدة</th><th style={{ textAlign: 'end' }}>متوسط التكلفة</th><th style={{ textAlign: 'end' }}>الرصيد</th><th style={{ textAlign: 'end' }}>القيمة</th><th>الحالة</th><th /></tr></thead>
              <tbody>
                {items.map(it => {
                  const [cls, txt] = stateOf(it); const b = balOf(it.id);
                  return (
                    <tr key={it.id}>
                      <td style={{ fontWeight: 600, fontSize: 12.5 }}>{it.name}</td>
                      <td><span className={'badge ' + ITEM_TYPES[itemType(it)].c}>{ITEM_TYPES[itemType(it)].short}</span></td>
                      <td style={{ fontSize: 11.5, color: 'var(--dim)' }}>{it.unit}{it.purchaseUnit && pFactor(it) > 1 ? <div style={{ fontSize: 10, color: 'var(--faint)' }}>{it.purchaseUnit} = {pFactor(it)} {it.unit}</div> : null}</td>
                      <td className="num" style={{ textAlign: 'end' }}>{money(avgOf(it.id))}</td>
                      <td className="num" style={{ textAlign: 'end', fontWeight: 700, color: b < 0 ? 'var(--rose)' : 'var(--txt)' }}>{isStocked(it) ? b : '—'}</td>
                      <td className="num" style={{ textAlign: 'end' }}>{isStocked(it) ? money(Math.max(0, b) * avgOf(it.id)) : '—'}</td>
                      <td>{isStocked(it) ? <><span className={'badge ' + cls}>{txt}</span>{(it.minQty || 0) > 0 && <div style={{ fontSize: 9, color: 'var(--faint)' }}>الحد: <span className="num">{it.minQty}</span></div>}</> : <span style={{ fontSize: 11, color: 'var(--faint)' }}>لا يُخزَّن</span>}</td>
                      <td>{canW && <button className="btn sm gh" onClick={() => setItemF({ ...it })}>تعديل</button>}</td>
                    </tr>
                  );
                })}
                {items.length === 0 && <tr><td colSpan={8}><div className="empty">لا أصناف بعد — أضف أصناف مخزونك (أرز، لحم، زيت…) ليبدأ التتبع.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'wh' && <WarehousesPanel org={org} ops={ops} me={me} commit={commit} commitOrg={commitOrg} say={say} />}

      {view === 'moves' && (
        <div className="card">
          {whOn(org) && <div className="note" style={{ marginBottom: 8, fontSize: 12 }}>حركات <b>المستودع الرئيسي</b> — حركات مستودعات الفروع يسجّلها كل فرع من شاشة «مستودع الفرع».</div>}
          <div className="tw">
            <table className="tb">
              <thead><tr><th>التاريخ</th><th>الصنف</th><th>النوع</th><th style={{ textAlign: 'end' }}>الكمية</th><th>البيان</th><th>بواسطة</th></tr></thead>
              <tbody>
                {moves.slice(0, 120).map(mv => (
                  <tr key={mv.id}>
                    <td className="num" style={{ fontSize: 11 }}>{mv.date}</td>
                    <td style={{ fontSize: 12.5 }}>{itemName(mv.itemId)}</td>
                    <td><span className={'badge ' + (MOVE_KINDS[mv.kind]?.c || 'b-dim')}>{MOVE_KINDS[mv.kind]?.ar || mv.kind}</span></td>
                    <td className="num" style={{ textAlign: 'end', fontWeight: 700, color: mv.qty < 0 ? 'var(--rose)' : 'var(--mint)' }}>{mv.qty > 0 ? '+' + mv.qty : mv.qty}</td>
                    <td style={{ fontSize: 11, color: 'var(--dim)' }}>{mv.kind === 'waste' && mv.reason ? wasteReasonAr(mv.reason) + (mv.note ? ' — ' + mv.note : '') + (mv.approvedBy ? ' · اعتمده ' + mv.approvedBy : '') : (mv.note || mv.ref || '—')}</td>
                    <td style={{ fontSize: 11, color: 'var(--faint)' }}>{mv.by || '—'}</td>
                  </tr>
                ))}
                {moves.length === 0 && <tr><td colSpan={6}><div className="empty">لا حركات بعد — التوريد من أوامر الشراء يظهر هنا تلقائياً.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'count' && (
        <div className="card" style={{ borderColor: ivD.enabled ? 'rgba(79,178,134,.4)' : 'var(--line)' }}>
          <div className="card-t" style={{ marginBottom: 8 }}><Landmark size={15} color="var(--brass)" />رسملة المخزون — بضاعة آخر المدة (الطريقة الدورية)</div>
          <div className="note" style={{ marginBottom: 10 }}>
            عند التفعيل: تُرسمَل قيمة المخزون الحالية أصلًا في المركز المالي، وتُخفّض تكلفة الفترة — فتصير
            <b> تكلفة البضاعة المباعة = المشتريات − بضاعة آخر المدة</b>. (موقوفة افتراضيًا؛ فعّلها عند الحاجة.)
          </div>
          <div className="row" style={{ gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label className="row" style={{ gap: 6, fontSize: 12, cursor: canW ? 'pointer' : 'default' }}>
              <input type="checkbox" checked={ivD.enabled} disabled={!canW} onChange={e => setIvD(s => ({ ...s, enabled: e.target.checked }))} />
              تفعيل رسملة المخزون
            </label>
            <label className="row" style={{ gap: 6, fontSize: 12, cursor: canW ? 'pointer' : 'default' }}>
              <input type="checkbox" checked={ivD.auto} disabled={!canW} onChange={e => setIvD(s => ({ ...s, auto: e.target.checked }))} />
              القيمة تلقائيًا من المخزون الحالي
            </label>
            <Field label="تاريخ التسوية" style={{ width: 160 }}>
              <input type="date" className="inp" value={ivD.asOf} disabled={!canW} onChange={e => setIvD(s => ({ ...s, asOf: e.target.value }))} />
            </Field>
            {!ivD.auto && <Field label="قيمة بضاعة آخر المدة (يدوي)" style={{ width: 180 }}>
              <input className="inp n" inputMode="decimal" value={ivD.value} disabled={!canW} onChange={e => setIvD(s => ({ ...s, value: e.target.value.replace(/[^\d.]/g, '') }))} />
            </Field>}
            <span className="badge b-brass">قيمة المخزون الحالية: <b className="num">{money(stockValue)}</b></span>
            {canW && <button className="btn pri" style={{ marginInlineStart: 'auto' }} onClick={saveIv}><Check size={14} />حفظ</button>}
          </div>
          {periodLocked(org, ivD.asOf) && <div className="note" style={{ marginTop: 8, borderColor: 'rgba(224,164,88,.4)' }}>⚠️ شهر {String(ivD.asOf).slice(0, 7)} مقفل — افتح الإقفال أولًا.</div>}
        </div>
      )}

      {view === 'count' && <BlindCount org={org} ops={ops} me={me} commit={commit} say={say} whId={MAIN_WH} branchId="" col="stockMoves" items={items.filter(isStocked)} title={whOn(org) ? whName(org, MAIN_WH) : 'المخزون'} canCount={canW} />}

      {view === 'usage' && <UsageVariance org={org} ops={ops} me={me} commit={commit} say={say} />}
      {view === 'prices' && <PriceAlerts org={org} ops={ops} />}
      {view === 'waste' && <WasteControl org={org} ops={ops} me={me} commit={commit} commitOrg={commitOrg} say={say} />}

      {view === 'recipes' && (
        <div className="grid g2">
          {products.map(p => {
            const cost = prodCost(p); const net = netOf(p.sellPrice || 0);
            const margin = net > 0 ? Math.round((net - cost) / net * 1000) / 10 : 0;
            return (
              <div key={p.id} className="card">
                <div className="card-h">
                  <div className="card-t"><Store size={15} color="var(--brass)" />{p.name}</div>
                  {canW && <button className="btn sm gh" onClick={() => setProdF({ ...p, parts: (p.parts || []).map(x => ({ ...x })) })}>تعديل</button>}
                </div>
                <table className="tb" style={{ fontSize: 12 }}>
                  <tbody>
                    {(p.parts || []).map((pt, i) => {
                      const it = items.find(x => x.id === pt.itemId) || {};
                      const y = partYield(pt);
                      return <tr key={i}><td>{it.name || '؟'}{y < 100 && <div style={{ fontSize: 10.5, color: 'var(--dim)' }}>ناتج {y}% · يُصرف <span className="num">{q3(partGross(pt))}</span> {it.unit || ''}</div>}</td><td className="num" style={{ textAlign: 'end' }}>{pt.qty} {it.unit || ''}</td><td className="num" style={{ textAlign: 'end' }}>{money(partGross(pt) * avgOf(pt.itemId))}</td></tr>;
                    })}
                    <tr style={{ fontWeight: 800 }}><td>تكلفة المنتج</td><td /><td className="num" style={{ textAlign: 'end', color: 'var(--brass-l)' }}>{money(cost)}</td></tr>
                  </tbody>
                </table>
                <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  <span className="badge b-brass">البيع {money(p.sellPrice)}{taxCfg.enabled ? ' شامل' : ''}</span>
                  {taxCfg.enabled && <span className="badge b-dim">الصافي {money(net)}</span>}
                  <span className={'badge ' + (margin >= 50 ? 'b-mint' : margin >= 30 ? 'b-amber' : 'b-rose')}>هامش {margin}%</span>
                </div>
              </div>
            );
          })}
          {products.length === 0 && <div className="card"><div className="empty">أضف منتجاً بوصفته (مكوناته من الأصناف) لترى تكلفته الحقيقية وهامشه.</div></div>}
        </div>
      )}

      {view === 'menu' && (() => {
        const r2m = (n) => Math.round((Number(n) || 0) * 100) / 100;
        const cls = menuClassifier();
        const rowsM = products.map(p => { const cost = prodCost(p), net = netOf(p.sellPrice || 0), cm = r2m(net - cost), qty = menuQtyOf(p); return { p, cost, net, cm, qty, contribution: r2m(cm * qty), marginPct: net > 0 ? Math.round((net - cost) / net * 1000) / 10 : 0, cl: cls(p) }; });
        const counts = { 'نجم': 0, 'لغز': 0, 'حصان': 0, 'كلب': 0 };
        rowsM.forEach(r => { if (counts[r.cl.k] != null) counts[r.cl.k]++; });
        const totalContribution = r2m(sum(rowsM, r => r.contribution));
        const anyQty = rowsM.some(r => r.qty > 0);
        return (
          <div className="grid" style={{ gap: 12 }}>
            {products.length === 0 ? <div className="card"><div className="empty">أضف منتجاتك ووصفاتها من «الوصفات والتكلفة» أولًا، ثم أدخل كميات بيعها الشهرية هنا.</div></div> : <>
              <div className="grid g4">
                <div className="card" style={{ padding: '10px 12px' }}><div style={{ fontSize: 11, color: 'var(--dim)' }}>⭐ نجوم (ربحي ورائج)</div><div className="num" style={{ fontSize: 20, fontWeight: 800, color: 'var(--mint)' }}>{counts['نجم']}</div></div>
                <div className="card" style={{ padding: '10px 12px' }}><div style={{ fontSize: 11, color: 'var(--dim)' }}>❓ ألغاز (ربحي قليل الطلب)</div><div className="num" style={{ fontSize: 20, fontWeight: 800, color: '#5B93C4' }}>{counts['لغز']}</div></div>
                <div className="card" style={{ padding: '10px 12px' }}><div style={{ fontSize: 11, color: 'var(--dim)' }}>🐎 أحصنة (رائج ضعيف الهامش)</div><div className="num" style={{ fontSize: 20, fontWeight: 800, color: 'var(--amber)' }}>{counts['حصان']}</div></div>
                <div className="card" style={{ padding: '10px 12px' }}><div style={{ fontSize: 11, color: 'var(--dim)' }}>🐕 كلاب (ضعيف الطلب والهامش)</div><div className="num" style={{ fontSize: 20, fontWeight: 800, color: 'var(--rose)' }}>{counts['كلب']}</div></div>
              </div>
              <div className="card">
                <div className="card-t" style={{ marginBottom: 8 }}><BarChart3 size={15} color="var(--brass)" />هندسة القائمة — أدخل كمية البيع الشهرية لكل منتج</div>
                <div className="tw">
                  <table className="tb">
                    <thead><tr><th>المنتج</th><th style={{ textAlign: 'end' }}>البيع</th><th style={{ textAlign: 'end' }}>التكلفة</th><th style={{ textAlign: 'end' }}>هامش الوحدة</th><th style={{ textAlign: 'end' }}>الهامش %</th><th style={{ textAlign: 'center' }}>كمية/شهر</th><th style={{ textAlign: 'end' }}>مساهمة الربح</th><th style={{ textAlign: 'center' }}>التصنيف</th></tr></thead>
                    <tbody>
                      {rowsM.map(r => (
                        <tr key={r.p.id}>
                          <td style={{ fontWeight: 600, fontSize: 12.5 }}>{r.p.name}</td>
                          <td className="num" style={{ textAlign: 'end' }}>{money(r.p.sellPrice || 0)}</td>
                          <td className="num" style={{ textAlign: 'end' }}>{money(r.cost)}</td>
                          <td className="num" style={{ textAlign: 'end', color: r.cm >= 0 ? 'var(--mint)' : 'var(--rose)' }}>{money(r.cm)}</td>
                          <td className="num" style={{ textAlign: 'end' }}>{r.marginPct}%</td>
                          <td style={{ textAlign: 'center' }}>{canW ? <input className="inp n" style={{ width: 80, textAlign: 'center' }} inputMode="decimal" value={menuQty[r.p.id] != null ? menuQty[r.p.id] : (r.p.salesQty || '')} placeholder="0" onChange={e => setMenuQty(m => ({ ...m, [r.p.id]: e.target.value.replace(/[^\d.]/g, '') }))} /> : <span className="num">{r.qty}</span>}</td>
                          <td className="num" style={{ textAlign: 'end', fontWeight: 700 }}>{money(r.contribution)}</td>
                          <td style={{ textAlign: 'center' }}><span className={'badge ' + r.cl.c}>{r.cl.k}</span></td>
                        </tr>
                      ))}
                      <tr style={{ fontWeight: 800, background: 'rgba(200,162,74,.05)' }}><td colSpan={6}>إجمالي مساهمة الربح الشهرية (من الكميات المُدخلة)</td><td className="num" style={{ textAlign: 'end', color: 'var(--brass-l)' }}>{money(totalContribution)}</td><td /></tr>
                    </tbody>
                  </table>
                </div>
                {!anyQty && <div className="note" style={{ marginTop: 8 }}>أدخل كمية البيع الشهرية لمنتجاتك (ثم «حفظ الكميات») ليصنّفها النظام. التكلفة والهامش يأتيان من وصفاتك تلقائيًا.</div>}
              </div>
              <div className="note">
                <b>كيف تُقرأ؟</b> يقارن النظام كل منتج بمتوسط القائمة في بُعدين: <b>الرواج</b> (كمية البيع) و<b>الربحية</b> (هامش الوحدة).
                <b> ⭐ نجم</b>: رائج وربحي — أبرِزه. <b>❓ لغز</b>: ربحي لكن قليل الطلب — روّج له. <b>🐎 حصان</b>: رائج ضعيف الهامش — راجع تكلفته أو سعره. <b>🐕 كلب</b>: ضعيف الطلب والهامش — طوّره أو أزِله. القواطع: متوسط الهامش المرجّح، و70% من متوسط الكمية.
              </div>
            </>}
          </div>
        );
      })()}

      <div className="card" style={{ background: 'rgba(200,162,74,.04)', borderStyle: 'dashed' }}>
        <div style={{ fontSize: 11.5, color: 'var(--dim)', lineHeight: 1.9 }}>
          <b style={{ color: 'var(--brass-l)' }}>حدود هذه المرحلة (بشفافية):</b> لا خصم تلقائي للمخزون مع البيع —
          النظام يسجّل إجماليات المبيعات لا أصنافها، فالاستهلاك يُسجَّل «صرفًا للتشغيل» أو عبر الجرد الدوري.
          التكلفة المعروضة بآخر سعر شراء، وتتحدّث تلقائيًا عند استلام أوامر الشراء.
          التقييم المحاسبي للمخزون (رسملة المشتريات وتكلفة المبيعات) قرار محاسبي يُبنى في مرحلة لاحقة —
          حاليًا تبقى المشتريات مصروفًا كما هي (طريقة الجرد الدوري المتعارفة للمطاعم).
        </div>
      </div>

      {impF && (
        <Modal title={'استيراد الأصناف — ' + impF.name} icon={Upload} wide onClose={() => setImpF(null)}
          foot={<><button className="btn pri" onClick={doImport} disabled={!impRows.some(r => r.st === 'new' || (r.st === 'update' && impF.update))}><Check size={14} />استيراد {impRows.filter(r => r.st === 'new' || (r.st === 'update' && impF.update)).length} صنف</button>
            <button className="btn gh" onClick={() => setImpF(null)}>إلغاء</button></>}>
          <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 8 }}>تعرّفت المنصة على الأعمدة تلقائيًا — صحّح الربط إن لزم:</div>
          <div className="grid g3" style={{ gap: 8, marginBottom: 10 }}>
            {IMP_COLS.map(([k, ar]) => (
              <Field key={k} label={ar}>
                <select className="inp sel" value={impF.map[k] ?? -1} onChange={e => setImpF(f => ({ ...f, map: { ...f.map, [k]: Number(e.target.value) }, ...(k === 'qty' ? { opening: Number(e.target.value) >= 0 } : {}) }))}>
                  <option value={-1}>— لا يوجد —</option>
                  {(impF.grid[Math.max(0, impF.start - 1)] || impF.grid[0] || []).map((h, i) => <option key={i} value={i}>{impF.start > 0 ? (String(h || '').trim() || ('عمود ' + (i + 1))) : ('عمود ' + (i + 1))}</option>)}
                </select>
              </Field>))}
          </div>
          <div className="row" style={{ gap: 14, flexWrap: 'wrap', fontSize: 12.5, marginBottom: 10 }}>
            <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={impF.update} onChange={e => setImpF(f => ({ ...f, update: e.target.checked }))} />تحديث الأصناف الموجودة بنفس الاسم (الوحدة والتكلفة والحدود)</label>
            {(impF.map.qty ?? -1) >= 0 && <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={impF.opening} onChange={e => setImpF(f => ({ ...f, opening: e.target.checked }))} />تسجيل الكميات رصيدًا افتتاحيًا{whOn(org) ? ' في المستودع الرئيسي' : ''}</label>}
            <label className="row" style={{ gap: 6 }}>السطر الأول للبيانات:
              <input className="inp n" style={{ width: 60 }} value={impF.start + 1} onChange={e => setImpF(f => ({ ...f, start: Math.max(0, (Number(e.target.value) || 1) - 1) }))} /></label>
          </div>
          <div className="row" style={{ gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <span className="badge b-mint">جديد {impRows.filter(r => r.st === 'new').length}</span>
            <span className="badge b-sky">تحديث {impRows.filter(r => r.st === 'update').length}</span>
            {impRows.some(r => r.st === 'error' || r.st === 'dup') && <span className="badge b-rose">يُتجاهل {impRows.filter(r => r.st === 'error' || r.st === 'dup').length}</span>}
          </div>
          <div className="tw" style={{ maxHeight: 340, overflow: 'auto' }}><table className="tb">
            <thead><tr><th>#</th><th>الصنف</th><th>الوحدة</th><th style={{ textAlign: 'end' }}>التكلفة</th><th style={{ textAlign: 'end' }}>الحد الأدنى</th><th style={{ textAlign: 'end' }}>الرصيد</th><th>الحالة</th></tr></thead>
            <tbody>{impRows.slice(0, 500).map(r => (
              <tr key={r.line} style={{ opacity: r.st === 'error' || r.st === 'dup' ? 0.55 : 1 }}>
                <td className="num" style={{ fontSize: 10.5, color: 'var(--faint)' }}>{r.line}</td><td>{r.name}</td><td style={{ fontSize: 11.5 }}>{r.unit || '—'}</td>
                <td className="num" style={{ textAlign: 'end' }}>{r.cost == null || Number.isNaN(r.cost) ? '—' : money(r.cost)}</td>
                <td className="num" style={{ textAlign: 'end' }}>{r.minQty == null || Number.isNaN(r.minQty) ? '—' : r.minQty}</td>
                <td className="num" style={{ textAlign: 'end' }}>{r.qty == null || Number.isNaN(r.qty) ? '—' : r.qty}</td>
                <td>{r.st === 'new' ? <span className="badge b-mint">جديد</span> : r.st === 'update' ? <span className={'badge ' + (impF.update ? 'b-sky' : 'b-dim')}>{impF.update ? 'تحديث' : 'موجود — يُتجاهل'}</span> : <span className="badge b-rose">{r.why}</span>}</td>
              </tr>))}
              {!impRows.length && <tr><td colSpan={7}><div className="empty">لا صفوف — تحقق من عمود «اسم الصنف» ومن السطر الأول للبيانات</div></td></tr>}
            </tbody></table></div>
        </Modal>
      )}
      {itemF && (
        <Modal title={itemF.id ? 'تعديل صنف' : 'صنف مخزون جديد'} icon={HardDrive} onClose={() => setItemF(null)}
          foot={<><button className="btn gh" onClick={() => setItemF(null)}>إلغاء</button>
            <button className="btn pri" onClick={saveItem}><Check size={14} />حفظ الصنف</button></>}>
          <Field label="اسم الصنف"><input className="inp" value={itemF.name} placeholder="أرز بسمتي، لحم غنم…" onChange={e => setItemF(f => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="نوع الصنف">
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {Object.entries(ITEM_TYPES).map(([k, t]) => <button key={k} type="button" className={'btn sm' + (itemType(itemF) === k ? ' pri' : ' gh')} onClick={() => setItemF(f => ({ ...f, type: k }))}>{t.short}</button>)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 4 }}>{ITEM_TYPES[itemType(itemF)].ar}</div>
          </Field>
          <div className="grid g3">
            <Field label="الوحدة الأساسية (للأرصدة والصرف)"><input className="inp" value={itemF.unit} placeholder="كغ · حبة · لتر" onChange={e => setItemF(f => ({ ...f, unit: e.target.value }))} /></Field>
            <Field label={'التكلفة المرجعية / ' + (itemF.unit || 'الوحدة')}><input className="inp n" inputMode="decimal" value={itemF.cost} onChange={e => setItemF(f => ({ ...f, cost: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
            {isStocked(itemF) && <Field label="حد الطلب الأدنى"><input className="inp n" inputMode="decimal" value={itemF.minQty} onChange={e => setItemF(f => ({ ...f, minQty: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>}
          </div>
          {isStocked(itemF) && (
            <div className="grid g3">
              <Field label="وحدة الشراء (اختياري)"><input className="inp" value={itemF.purchaseUnit || ''} placeholder="كرتون · كيس · صندوق" onChange={e => setItemF(f => ({ ...f, purchaseUnit: e.target.value }))} /></Field>
              <Field label={'كم ' + (itemF.unit || 'وحدة') + ' في ' + (itemF.purchaseUnit || 'وحدة الشراء')}><input className="inp n" inputMode="decimal" disabled={!(itemF.purchaseUnit || '').trim()} value={itemF.purchaseFactor ?? ''} placeholder="12" onChange={e => setItemF(f => ({ ...f, purchaseFactor: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
              {itemType(itemF) === 'sale' && <Field label="سعر البيع"><input className="inp n" inputMode="decimal" value={itemF.sellPrice ?? ''} onChange={e => setItemF(f => ({ ...f, sellPrice: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>}
            </div>
          )}
          <div className="note" style={{ fontSize: 11.5 }}>التكلفة تُحتسب بـ<b>المتوسط المرجّح</b>: كل استلام بتكلفته يعيد حساب المتوسط، والصرف والهدر يخرجان به. التكلفة المرجعية تُستخدم فقط قبل أول استلام مسعّر.{itemF.id ? ' المتوسط الحالي: ' + money(avgOf(itemF.id)) + ' / ' + (itemF.unit || 'وحدة') : ''}</div>
        </Modal>
      )}

      {moveF && (
        <Modal title="حركة مخزون جديدة" icon={ArrowLeftRight} onClose={() => setMoveF(null)}
          foot={<><button className="btn gh" onClick={() => setMoveF(null)}>إلغاء</button>
            <button className="btn pri" onClick={saveMove}><Check size={14} />تسجيل الحركة</button></>}>
          <div className="grid g2">
            <Field label="نوع الحركة">
              <select className="sel" value={moveF.kind} onChange={e => setMoveF(f => ({ ...f, kind: e.target.value }))}>
                <option value="in">توريد يدوي (+)</option>
                <option value="out">صرف للتشغيل (−)</option>
                <option value="waste">هدر/إتلاف (−)</option>
              </select>
            </Field>
            <Field label="الصنف">
              <select className="sel" value={moveF.itemId} onChange={e => setMoveF(f => ({ ...f, itemId: e.target.value, uom: 'b' }))}>
                {items.filter(isStocked).map(it => <option key={it.id} value={it.id}>{it.name} — رصيد {whOn(org) ? mainOf(it.id) : balOf(it.id)} {it.unit}</option>)}
              </select>
            </Field>
          </div>
          {(() => { const it = items.find(x => x.id === moveF.itemId); return it && it.purchaseUnit && pFactor(it) > 1 ? (
            <Field label="الوحدة">
              <div className="row" style={{ gap: 6 }}>
                <button type="button" className={'btn sm' + (moveF.uom !== 'p' ? ' pri' : ' gh')} onClick={() => setMoveF(f => ({ ...f, uom: 'b' }))}>{it.unit}</button>
                <button type="button" className={'btn sm' + (moveF.uom === 'p' ? ' pri' : ' gh')} onClick={() => setMoveF(f => ({ ...f, uom: 'p' }))}>{it.purchaseUnit} ({pFactor(it)} {it.unit})</button>
              </div>
            </Field>) : null; })()}
          <div className="grid g2">
            <Field label="الكمية"><input className="inp n" inputMode="decimal" value={moveF.qty} onChange={e => setMoveF(f => ({ ...f, qty: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
            {moveF.kind === 'in' && <Field label={'تكلفة ' + (() => { const it = items.find(x => x.id === moveF.itemId) || {}; return moveF.uom === 'p' ? (it.purchaseUnit || 'الوحدة') : (it.unit || 'الوحدة'); })() + ' (تُحدّث المتوسط)'}><input className="inp n" inputMode="decimal" value={moveF.unitCost ?? ''} placeholder={money(avgOf(moveF.itemId))} onChange={e => setMoveF(f => ({ ...f, unitCost: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>}
            {moveF.kind !== 'waste' && <Field label="البيان (اختياري)"><input className="inp" value={moveF.note} placeholder="صرف للمطبخ · توريد يدوي…" onChange={e => setMoveF(f => ({ ...f, note: e.target.value }))} /></Field>}
          </div>
          {moveF.kind === 'waste' && <WasteFields f={moveF} setF={setMoveF} cfg={wasteCfg(org)} me={me} say={say} value={Math.round((Number(moveF.qty) || 0) * (moveF.uom === 'p' ? pFactor(items.find(x => x.id === moveF.itemId)) : 1) * avgOf(moveF.itemId) * 100) / 100} />}
        </Modal>
      )}

      {prodF && (
        <Modal title={prodF.id ? 'تعديل منتج ووصفته' : 'منتج جديد بوصفته'} icon={Store} onClose={() => setProdF(null)} wide
          foot={<><button className="btn gh" onClick={() => setProdF(null)}>إلغاء</button>
            <button className="btn pri" onClick={saveProd}><Check size={14} />حفظ المنتج</button></>}>
          <div className="grid g2">
            <Field label="اسم المنتج"><input className="inp" value={prodF.name} placeholder="مندي لحم — وجبة" onChange={e => setProdF(f => ({ ...f, name: e.target.value }))} /></Field>
            <Field label={'سعر البيع' + ((org.taxCfg || {}).enabled ? ' (شامل الضريبة)' : '')}>
              <input className="inp n" inputMode="decimal" value={prodF.sellPrice} onChange={e => setProdF(f => ({ ...f, sellPrice: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
            <Field label="تصنيف نقطة البيع"><input className="inp" list="pos-cats" value={prodF.cat || ''} placeholder="وجبات، مشروبات، حلويات…" onChange={e => setProdF(f => ({ ...f, cat: e.target.value }))} />
              <datalist id="pos-cats">{[...new Set((org.products || []).map(p => p.cat).filter(Boolean))].map(c => <option key={c} value={c} />)}</datalist></Field>
            <label className="row" style={{ gap: 7, fontSize: 12.5, cursor: 'pointer', paddingTop: 18 }}><input type="checkbox" checked={!prodF.posOff} onChange={e => setProdF(f => ({ ...f, posOff: !e.target.checked }))} />متاح في نقطة البيع</label>
            <Field label="خصم الصنف في نقطة البيع (اختياري)"><div className="row" style={{ gap: 4 }}>
              <input className="inp n" inputMode="decimal" style={{ flex: 1 }} value={(prodF.disc || {}).v || ''} placeholder="0" onChange={e => setProdF(f => ({ ...f, disc: { ...(f.disc || {}), v: e.target.value.replace(/[^\d.]/g, '') } }))} />
              <button type="button" className={'btn sm' + ((prodF.disc || {}).t !== 'amt' ? ' pri' : ' gh')} onClick={() => setProdF(f => ({ ...f, disc: { ...(f.disc || {}), t: 'pct' } }))}>%</button>
              <button type="button" className={'btn sm' + ((prodF.disc || {}).t === 'amt' ? ' pri' : ' gh')} onClick={() => setProdF(f => ({ ...f, disc: { ...(f.disc || {}), t: 'amt' } }))}>ر.س</button></div></Field>
            {Number((prodF.disc || {}).v) > 0 && <Field label="ينتهي الخصم في (اختياري)"><input type="date" className="inp" value={(prodF.disc || {}).to || ''} onChange={e => setProdF(f => ({ ...f, disc: { ...(f.disc || {}), to: e.target.value } }))} /></Field>}
          </div>
          <div className="lbl" style={{ margin: '4px 0 6px' }}>المكوّنات (من أصناف المخزون)</div>
          <div className="note" style={{ marginBottom: 8 }}>اكتب الكمية <b>الصافية</b> في الطبق، ومعامل الناتج لكل مكوّن يفقد وزنًا (لحم 1 كجم ← 0.82 كجم مطبوخ = 82%). التكلفة والاستهلاك النظري يُحسبان على الكمية الخام. اتركه فارغًا = 100%.</div>
          {(prodF.parts || []).map((pt, i) => (
            <div key={i} className="row" style={{ gap: 8, marginBottom: 7, flexWrap: 'wrap' }}>
              <select className="sel" style={{ flex: 2, minWidth: 170 }} value={pt.itemId}
                onChange={e => setProdF(f => ({ ...f, parts: f.parts.map((x, k) => k === i ? { ...x, itemId: e.target.value } : x) }))}>
                <option value="">— اختر الصنف —</option>
                {items.map(it => <option key={it.id} value={it.id}>{it.name} ({money(it.cost)}/{it.unit})</option>)}
              </select>
              <input className="inp n" style={{ flex: 1, minWidth: 90 }} inputMode="decimal" placeholder="الكمية الصافية" value={pt.qty}
                onChange={e => setProdF(f => ({ ...f, parts: f.parts.map((x, k) => k === i ? { ...x, qty: e.target.value.replace(/[^\d.]/g, '') } : x) }))} />
              <div className="yld-in" title="معامل الناتج: نسبة الصافي من الخام بعد التنظيف/الطهي"><input className="inp n" inputMode="decimal" placeholder="100" value={pt.yield ?? ''}
                onChange={e => setProdF(f => ({ ...f, parts: f.parts.map((x, k) => k === i ? { ...x, yield: e.target.value.replace(/[^\d.]/g, '') } : x) }))} /><span>% ناتج</span></div>
              {pt.itemId && Number(pt.qty) > 0 && partYield(pt) < 100 && <span className="yld-g">يُصرف <b className="num">{q3(partGross(pt))}</b> {(items.find(x => x.id === pt.itemId) || {}).unit || ''} خام</span>}
              {prodF.parts.length > 1 && <button className="btn sm gh" onClick={() => setProdF(f => ({ ...f, parts: f.parts.filter((_, k) => k !== i) }))}><X size={13} /></button>}
            </div>
          ))}
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <button className="btn sm" onClick={() => setProdF(f => ({ ...f, parts: [...(f.parts || []), { itemId: '', qty: '' }] }))}><Plus size={13} />مكوّن إضافي</button>
            <span className="badge b-brass">التكلفة الحالية: {money(prodCost({ parts: (prodF.parts || []).filter(x => x.itemId) }))}</span>
          </div>
        </Modal>
      )}
    </div>
  );
}
