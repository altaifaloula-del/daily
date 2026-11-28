/**
 * حد معدل بسيط في الذاكرة (نُقل من server.js في v56.59).
 * v56.59 (مراجعة الأمان): لكل محدِّد مفتاح خاص به — بادئة فريدة لكل نداء rateLimit() — فلا تتشارك المحدِّدات بلا keyFn
 * عدّاد req.ip نفسه (كان محدِّد بنافذة دقيقة يعيد ضبط عدّاد محدِّد بنافذة ساعة على العنوان نفسه فيُلغي حدّه).
 * name اختياري لتسمية البادئة؛ now يُحقن للاختبار.
 */
export function createRateLimiter({ now = Date.now } = {}) {
  const buckets = new Map(); let seq = 0;
  function rateLimit({ windowMs, max, keyFn, name } = {}) {
    const pre = 'rl' + (++seq) + (name ? ':' + name : '') + '|';
    return (req, res, next) => {
      const t = now();
      const key = pre + ((keyFn ? keyFn(req) : '') || req.ip || 'anon');
      let b = buckets.get(key);
      if (!b || t - b.start > windowMs) { b = { start: t, n: 0, w: windowMs }; buckets.set(key, b); }
      b.n++;
      if (b.n > max) {
        res.setHeader && res.setHeader('Retry-After', String(Math.ceil((b.start + windowMs - t) / 1000)));
        return res.status(429).json({ error: 'طلبات كثيرة — أعد المحاولة بعد قليل' });
      }
      next();
    };
  }
  /** تنظيف العدّادات المنتهية (كل نافذة بطولها، وأطولها ساعة) */
  const sweep = () => { const t = now(); for (const [k, b] of buckets) if (t - b.start > Math.max(b.w || 0, 3600000)) buckets.delete(k); };
  return { rateLimit, sweep, buckets };
}
