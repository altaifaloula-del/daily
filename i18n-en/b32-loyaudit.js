/* v52.6 دفعة الترجمة b32 — فحص سلامة النقاط والكوبونات */
export default {
"فحص سلامة النقاط والكوبونات": "Points & coupons integrity check",
"سليم ✓": "Clean ✓",
"التفاصيل": "Details",
"تعديل يدوي": "Manual adjustment",
"نقاط فاتورة بلا فاتورة": "Invoice points without an invoice",
"لا تطابق نقاط الفاتورة": "Does not match the invoice points",
"عكس إلغاء لفاتورة غير ملغاة": "Void reversal for a non-voided invoice",
"خصم مرتجع بلا مستند مرتجع": "Return deduction without a return document",
"دمج بلا سجل دمج معتمد": "Merge without an approved merge record",
"حركة بمصدر غير معروف": "Entry with an unknown source",
"معرّف مكرر": "Duplicate ID",
"حجز كوبون بلا فاتورة": "Coupon reservation without an invoice",
"كل حركة نقاط يجب أن يكون لها مصدر: فاتورة بالقيمة نفسها، أو مرتجع، أو إلغاء، أو دمج معتمد، أو جائزة، أو حركة دورية، أو تعديل يدوي مسجّل باسم من أجراه. وكل حجز كوبون أقدم من يوم يجب أن تقابله فاتورة. ما لا مصدر له يظهر هنا للمراجعة.": "Every points entry must have a source: an invoice with the same value, a return, a void, an approved merge, a reward, a periodic entry, or a manual adjustment recorded with who made it. Every coupon reservation older than a day must have an invoice. Anything without a source shows here for review.",
};
export const RX = [
  [/^(\d+) ملاحظة$/, '$1 findings'],
  [/^\(المتوقع (-?[\d.]+)\)$/, '(expected $1)'],
];
