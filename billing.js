/**
 * v51.4 — المرحلة 07 / S5: فوترة اشتراكات مِثقال — منطق خالص مشترك بين الخادم والواجهة والأدوات (بلا شبكة ولا تخزين).
 * • المبالغ كلها بالهللة (أعداد صحيحة) — لا كسور عشرية في الحساب.
 * • الأسعار ليست في الكود: تأتي من إعداد الخادم MQ_PRICES_JSON — خطة بلا سعر ⇒ الفوترة معطّلة لها (قرار التسعير بيد المالك).
 * • وسائل الدفع: مدى، فيزا/ماستركارد، Apple Pay، STC Pay عبر بوابة «ميسر» (صفحة دفع مستضافة — بيانات البطاقة لا تمر بخوادمنا)،
 *   والتحويل البنكي يدويًا بمرجع الفاتورة ويؤكده مزوّد مِثقال.
 */
export const VAT_RATE = 15;
export const PERIODS = Object.freeze(['monthly', 'yearly']);
export const PERIOD_AR = Object.freeze({ monthly: 'شهري', yearly: 'سنوي' });
export const PAYMENT_METHODS = Object.freeze([
  Object.freeze({ id: 'mada', ar: 'مدى', via: 'gateway' }),
  Object.freeze({ id: 'card', ar: 'فيزا / ماستركارد', via: 'gateway' }),
  Object.freeze({ id: 'applepay', ar: 'Apple Pay', via: 'gateway' }),
  Object.freeze({ id: 'stcpay', ar: 'STC Pay', via: 'gateway' }),
  Object.freeze({ id: 'bank', ar: 'تحويل بنكي', via: 'manual' })
]);
export const INV_ST_AR = Object.freeze({ open: 'مستحقة', pending_transfer: 'بانتظار تأكيد التحويل', paid: 'مدفوعة', void: 'ملغاة' });
const PLANS = ['basic', 'pro', 'enterprise'];
const okHal = (v) => Number.isInteger(v) && v > 0 && v <= 100000000;   // حتى مليون ريال

/** يقرأ جدول الأسعار من JSON بالريال: {"basic":{"monthly":199,"yearly":1990}} ⇒ بالهللة. القيم غير الصالحة تُهمل مع سبب */
export function parsePrices(json) {
  const out = {}, errors = [];
  let o = {}; try { o = json ? JSON.parse(json) : {}; } catch { return { prices: {}, errors: ['MQ_PRICES_JSON غير صالح'] }; }
  for (const p of Object.keys(o || {})) {
    if (!PLANS.includes(p)) { errors.push('خطة غير معروفة: ' + p); continue; }
    for (const per of Object.keys(o[p] || {})) {
      if (!PERIODS.includes(per)) { errors.push(p + ': دورة غير معروفة ' + per); continue; }
      const h = Math.round(Number(o[p][per]) * 100);
      if (!okHal(h) || Math.abs(Number(o[p][per]) * 100 - h) > 1e-6) { errors.push(p + '/' + per + ': سعر غير صالح'); continue; }
      (out[p] = out[p] || {})[per] = h;
    }
  }
  return { prices: out, errors };
}
export const priceFor = (prices, plan, period) => (prices && prices[plan] && prices[plan][period]) || null;

/** الصافي ⇒ الضريبة والإجمالي (هللات) */
export function amounts(net) {
  if (!okHal(net)) throw new Error('مبلغ غير صالح');
  const vat = Math.round(net * VAT_RATE / 100);
  return { net, vat, total: net + vat };
}
export const sar = (h) => (Number(h || 0) / 100).toFixed(2);

const pad = (n, w) => String(n).padStart(w, '0');
export const invoiceNo = (seq, year) => 'MQ-' + year + '-' + pad(seq, 6);
export const okInvoiceNo = (v) => /^MQ-[0-9]{4}-[0-9]{6}$/.test(String(v || ''));

/** نهاية الدورة: من تاريخ البداية (YYYY-MM-DD) شهرًا أو سنة، مع ضبط آخر الشهر (31 يناير + شهر = 28/29 فبراير) */
export function periodEnd(start, period) {
  const [y, m, d] = start.split('-').map(Number);
  const months = period === 'yearly' ? 12 : 1;
  const ty = y + Math.floor((m - 1 + months) / 12), tm = (m - 1 + months) % 12;
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  const dt = new Date(Date.UTC(ty, tm, Math.min(d, last)));
  dt.setUTCDate(dt.getUTCDate() - 1);   // الدورة تنتهي اليوم السابق لنفس التاريخ من الشهر التالي
  return dt.toISOString().slice(0, 10);
}
const addDays = (iso, n) => { const t = new Date(iso + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const nextDay = (iso) => addDays(iso, 1);

/**
 * حالة الاشتراك من تاريخ «مدفوع حتى»: نشط ⇒ مستحق (آخر 7 أيام) ⇒ مهلة بعد الانتهاء ⇒ يُوصى «للقراءة فقط» ⇒ يُوصى «موقوف».
 * توصية فقط — تغيير الحالة الفعلية في قاعدة المنشأة يبقى بأمر صريح من مزوّد مِثقال.
 */
export function subscriptionState(paidThrough, today, { dueDays = 7, graceDays = 7, readonlyDays = 30 } = {}) {
  if (!paidThrough) return { state: 'unpaid', recommend: 'active', daysLeft: null };
  const days = Math.round((Date.parse(paidThrough + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 864e5);
  if (days >= dueDays) return { state: 'active', recommend: 'active', daysLeft: days };
  if (days >= 0) return { state: 'due', recommend: 'active', daysLeft: days };
  if (-days <= graceDays) return { state: 'grace', recommend: 'active', daysLeft: days };
  if (-days <= graceDays + readonlyDays) return { state: 'overdue', recommend: 'readonly', daysLeft: days };
  return { state: 'lapsed', recommend: 'suspended', daysLeft: days };
}
export const SUB_STATE_AR = Object.freeze({ unpaid: 'لم يُفعَّل الدفع بعد', active: 'مدفوع', due: 'يستحق قريبًا', grace: 'مهلة سداد', overdue: 'متأخر', lapsed: 'منتهٍ' });

/** الدورة التالية: تبدأ بعد «مدفوع حتى» أو من اليوم إن كان منتهيًا أو غير موجود */
export function nextPeriod(paidThrough, today, period) {
  const start = paidThrough && paidThrough >= today ? nextDay(paidThrough) : today;
  return { start, end: periodEnd(start, period) };
}

/** فاتورة اشتراك جديدة — كل ما يلزم للفاتورة الضريبية محفوظ فيها وقت الإصدار (لا يتغير لاحقًا) */
export function buildInvoice({ seq, issuedAt, tenant, buyer, plan, period, start, prices, seller }) {
  const net = priceFor(prices, plan, period);
  if (!net) throw new Error('لا سعر معتمد لهذه الخطة والدورة');
  if (!PERIODS.includes(period)) throw new Error('دورة غير معروفة');
  const year = issuedAt.slice(0, 4);
  return {
    no: invoiceNo(seq, year), seq, issuedAt, tenant, plan, period, start, end: periodEnd(start, period),
    ...amounts(net), currency: 'SAR', status: 'open',
    seller: { name: seller.name, vatNo: seller.vatNo, crNo: seller.crNo || '', address: seller.address || '' },
    buyer: { name: (buyer && buyer.name) || tenant, vatNo: (buyer && buyer.vatNo) || '', address: (buyer && buyer.address) || '' },
    payments: []
  };
}

/** تسجيل دفعة مؤكدة (من البوابة بعد التحقق منها، أو تحويل بنكي أكده المزوّد) — بلا تكرار لنفس المرجع */
export function applyPayment(inv, { ref, method, amount, at }) {
  if (!inv || inv.status === 'void') return { inv, changed: false, error: 'الفاتورة ملغاة' };
  if ((inv.payments || []).some(p => p.ref === ref)) return { inv, changed: false };
  if (amount !== inv.total) return { inv, changed: false, error: 'المبلغ لا يطابق إجمالي الفاتورة' };
  if (inv.status === 'paid') return { inv, changed: false, error: 'مدفوعة سابقًا بمرجع آخر' };
  return { inv: { ...inv, status: 'paid', paidAt: at, method, payments: [...(inv.payments || []), { ref, method, amount, at }] }, changed: true };
}

export function sellerError(s) {
  if (!s || typeof s !== 'object') return 'بيانات البائع (مِثقال) غير مضبوطة';
  if (!s.name || String(s.name).trim().length < 2) return 'اسم البائع مطلوب';
  if (!/^3[0-9]{13}3$/.test(String(s.vatNo || ''))) return 'الرقم الضريبي للبائع (15 رقمًا يبدأ وينتهي بـ 3)';
  return '';
}
