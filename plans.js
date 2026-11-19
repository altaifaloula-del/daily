/**
 * v51.3 — المرحلة 07 / S4: خطط الاشتراك وأعلام الخصائص — مصدر واحد للواجهة والخادم.
 * ⚠ محتوى الخطط «مسودة» إلى أن يعتمد المالك التسعير (قرار معلّق). الآلية نفسها نهائية.
 * الطيف = «enterprise» دائمًا (كل الخصائص) — لا يتغير له شيء.
 * التطبيق الفعلي: الخادم يرفض الخاصية غير المشمولة (الذكاء، الفوترة الإلكترونية)، والواجهة تعرض الحالة فقط.
 */
export const PLAN_FEATURES = Object.freeze({
  basic: Object.freeze({ ai: false, zatca: true, maxBranches: 1 }),
  pro: Object.freeze({ ai: true, zatca: true, maxBranches: 5 }),
  enterprise: Object.freeze({ ai: true, zatca: true, maxBranches: 0 })   // 0 = بلا حد
});
export const PLAN_AR = Object.freeze({ basic: 'الأساسية', pro: 'المتقدمة', enterprise: 'المؤسسات' });
export const FEATURE_AR = Object.freeze({ ai: 'التحليل بالذكاء الاصطناعي', zatca: 'الفوترة الإلكترونية (فاتورة)', maxBranches: 'عدد الفروع' });
export const STATUS_AR = Object.freeze({ active: 'نشط', readonly: 'للقراءة فقط', suspended: 'موقوف' });
export const TENANT_STATUSES = Object.freeze(['active', 'readonly', 'suspended']);
/** خصائص خطة؛ خطة غير معروفة ⇒ الأساسية (الأضيق) */
export const planFeatures = (plan) => PLAN_FEATURES[plan] || PLAN_FEATURES.basic;
export const planAllows = (plan, feature) => { const v = planFeatures(plan)[feature]; return typeof v === 'number' ? true : v === true; };
/** هل يُسمح بفرع إضافي؟ */
export const branchesOk = (plan, count) => { const m = planFeatures(plan).maxBranches; return !m || count <= m; };
