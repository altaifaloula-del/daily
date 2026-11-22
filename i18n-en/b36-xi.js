/* v53.1 دفعة الترجمة b36 — استيراد فواتير المصروفات */
export default {
"استيراد من Excel": "Import from Excel",
"استيراد فواتير المصروفات من Excel": "Import expense invoices from Excel",
"رفع الكشف (xlsx/CSV)": "Upload statement (xlsx/CSV)",
"نموذج فارغ": "Blank template",
"الحساب حين لا يُعرف": "Account when unknown",
"الفرع حين لا يُذكر": "Branch when missing",
"الدفع حين لا يُذكر": "Payment when missing",
"— بلا (السطر يحتاج حسابًا) —": "— None (row needs an account) —",
"إنشاء الموردين غير الموجودين": "Create missing suppliers",
"الإجمالي شامل الضريبة (عند غياب عمودها)": "Total includes VAT (when no VAT column)",
"أضف الضريبة على «قبل الضريبة» (عند غياب عمودها)": "Add VAT to “before VAT” (when no VAT column)",
"الملاحظات فقط": "Issues only",
"سطر": "Row", "قبل الضريبة": "Before VAT", "تلقائي": "Auto", "المركز": "HQ", "(جديد)": "(new)",
"آجل": "On credit", "نقدًا (الصندوق)": "Cash (till)", "بنك/شبكة": "Bank/card",
"تاريخ غير مقروء": "Unreadable date", "تاريخ مستقبلي": "Future date", "الفترة مقفلة": "Period locked", "المبلغ غير صالح": "Invalid amount", "ضريبة سالبة": "Negative VAT",
"المورد غير محدد": "Supplier missing", "حساب المصروف غير محدد": "Expense account missing", "فاتورة ضريبية بلا رقم ضريبي صالح للمورد": "Tax invoice without a valid supplier VAT number",
"مسجّلة سابقًا": "Already recorded", "مكررة في الملف": "Duplicated in file",
"كشف بسطر لكل فاتورة: التاريخ، المورد، رقم الفاتورة، الفرع، البيان، الحساب (رقمه أو اسمه)، المبلغ قبل الضريبة والضريبة أو الإجمالي، وطريقة الدفع. تُسجَّل «فواتير خدمات ومصروفات» بقيدها، ولا يُحفظ السطر الذي به ملاحظة.": "A statement with one row per invoice: date, supplier, invoice number, branch, description, account (code or name), amount before VAT and VAT or the total, and payment method. Rows are recorded as “Service & expense invoices” with their entries; rows with issues are not saved.",
};
export const RX = [
  [/^حفظ (\d+) فاتورة$/, 'Save $1 invoices'],
  [/^الأعمدة المعروفة: (.+)$/, 'Recognized columns: $1'],
  [/^مورد غير موجود: (.+)$/, 'Unknown supplier: $1'],
  [/^فرع غير معروف: (.+)$/, 'Unknown branch: $1'],
  [/^استُوردت (\d+) فاتورة مصروفات وقُيّدت على حساباتها ✓$/, 'Imported $1 expense invoices and posted to their accounts ✓'],
];
