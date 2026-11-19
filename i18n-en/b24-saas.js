/* v51.3 دفعة الترجمة b24 — الاشتراك والمنشأة (المرحلة 07 / S4) */
export default {
"الاشتراك والمنشأة": "Subscription & organization",
"الخصائص المشمولة": "Included features",
"عدد الفروع يتجاوز حد الخطة — تواصل مع مِثقال لترقية الاشتراك.": "Branch count exceeds the plan limit — contact Mithqal to upgrade your subscription.",
"الخطة والحالة يحددهما مزوّد مِثقال ولا تُعدَّل من داخل المنشأة. تغييرها يتم بطلب ترقية أو تجديد.": "The plan and status are set by Mithqal and cannot be changed from inside the organization. Request an upgrade or renewal to change them.",
"الدمام — المملكة العربية السعودية": "Dammam — Saudi Arabia",
"المعرّف": "ID",
"موقع البيانات": "Data location",
"مشروع المنشأة الحالي": "Current organization project",
"مشروع البيانات": "Data project",
"المنشأة الرئيسية (الافتراضية)": "Main organization (default)",
"الأساسية": "Basic",
"المتقدمة": "Pro",
"المؤسسات": "Enterprise",
"التحليل بالذكاء الاصطناعي": "AI analysis",
"الفوترة الإلكترونية (فاتورة)": "E-invoicing (FATOORA)",
"عدد الفروع": "Branches",
"نشط": "Active",
"للقراءة فقط": "Read-only",
"موقوف": "Suspended",
"اشتراك المنشأة «للقراءة فقط» — يمكنك العرض والطباعة والتصدير، ولا يُحفظ أي تعديل حتى يُجدَّد الاشتراك.": "The organization subscription is read-only — you can view, print and export, but no changes are saved until the subscription is renewed."
};
export const RX = [
  [/^عدد الفروع: (.+) \(بلا حد\)$/, 'Branches: $1 (unlimited)'],
  [/^عدد الفروع: (.+)$/, 'Branches: $1']
];
