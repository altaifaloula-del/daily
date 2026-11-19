/* v50.2 دفعة الترجمة b23 — نصوص طويلة ومركّبة وجدها مسح الشاشات الفعلي */
export const RX = [
  [/^جرد مستمر من (\S+) — الاستلام يرسمل المخزون، والصرف والهدر والتسويات تُقيَّد (بالمتوسط المرجّح|بطريقة الوارد أولًا يصرف أولًا \(FIFO\))\.?$/, (_, d, m) => 'Perpetual inventory from ' + d + ' — receipts capitalize inventory, and issues, waste and adjustments are booked ' + (/FIFO/.test(m) ? 'using first in, first out (FIFO).' : 'at weighted average.')],
  [/^(.+) — الفترة المختارة$/, '$1 — selected period']
];
export default {
  'الإيراد = حصة كل صنف من صافي الفاتورة بعد الخصومات وقبل الضريبة، والمرتجعات مطروحة. التكلفة = تكلفة الوصفة بالمتوسط المرجّح حتى نهاية الفترة.': "Revenue = each item's share of the net invoice after discounts and before VAT, less returns. Cost = recipe cost at weighted average up to the period end.",
  'الوارد أخيرًا يصرف أولًا (LIFO) غير مسموح وفق المعايير الدولية المعتمدة في المملكة (IAS 2) فلا يُعرض. والتكلفة المعيارية (تكلفة الوصفة) متاحة للتحليل في «هندسة القائمة» و«الربحية» ولا تُقيَّد في الدفاتر.': 'Last in, first out (LIFO) is not permitted under the international standards adopted in the Kingdom (IAS 2), so it is not offered. Standard cost (recipe cost) is available for analysis in «Menu Engineering» and «Profitability» and is not booked.',
  '«تعريف العميل» = نسبة الطلبات التي أُدخل فيها جوال العميل. كلما ارتفعت صار تحليل العملاء أدق.': '«Customer identification» = the share of orders where the customer mobile was entered. The higher it is, the more accurate customer analysis becomes.',
  'الفترة المختارة': 'Selected period'
};
