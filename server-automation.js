/**
 * v51.8 — أتمتة الاشتراكات (قرار المالك 2026-11-19: «إيقاف الاشتراك المتأخر» و«تذكير التجديد + فاتورة مسبقة»).
 * تعمل على خادم مِثقال كل ساعة (وعند الإقلاع، وفور أي دفعة لمنشأتها):
 *  1) فاتورة الدورة التالية تُصدر تلقائيًا قبل الاستحقاق بـ 7 أيام (إن وُجد سعر) — فيظهر للمنشأة مرجع الدفع مبكرًا.
 *  2) حالة الاشتراك تُطبَّق تلقائيًا من التوصية: بعد المهلة «للقراءة فقط»، وبعد 30 يومًا أخرى «موقوف»، وتعود «نشط» فور الدفع.
 *     الكتابة في قاعدة المنشأة بحساب خدمتها (saEnv) فقط، وبشرط وجود مستند الإصدار؛ بلا حساب خدمة تبقى توصية في اللوحة.
 *  • لا تمس الطيف أبدًا، ولا منشأة بلا سجل اشتراك، ولا الفترة التجريبية قبل نهايتها.
 *  • MQ_AUTO_STATUS=0 يوقف الجزء (2) ويبقي التوصيات؛ MQ_AUTO_INVOICE=0 يوقف الجزء (1).
 */
import { subscriptionState, priceFor, buildInvoice, nextPeriod, PERIODS } from './billing.js';

const iso = (now) => new Date(now()).toISOString();
const day = (now) => iso(now).slice(0, 10);

export function automationConfig(env = process.env) {
  return { status: env.MQ_AUTO_STATUS !== '0', invoice: env.MQ_AUTO_INVOICE !== '0' };
}

/** جولة واحدة لكل المنشآت (أو لمنشأة واحدة) — تعيد سجلًا بما حدث */
export async function runAutomation({ T, store, billing, auto, writeStatus, now = Date.now, only }) {
  const log = [];
  const subs = await store.listSubs();
  for (const sub of subs) {
    const t = T.byId(sub.tenant);
    if (!t || t.id === 'default' || (only && t.id !== only)) continue;
    const st = subscriptionState(sub.paidThrough || '', day(now));
    try {
      // (1) فاتورة مسبقة للدورة التالية
      if (auto.invoice && billing.enabled && (st.state === 'due' || st.state === 'grace' || st.state === 'overdue')) {
        const period = PERIODS.includes(sub.period) ? sub.period : 'monthly';
        const open = (await store.listInvoices(t.id)).find(v => (v.status === 'open' || v.status === 'pending_transfer') && v.plan === t.plan);
        if (!open && priceFor(billing.prices, t.plan, period)) {
          const np = nextPeriod(sub.paidThrough || '', day(now), period);
          const inv = buildInvoice({ seq: await store.nextSeq(), issuedAt: iso(now), tenant: t.id, buyer: sub.buyer || null, plan: t.plan, period, start: np.start, prices: billing.prices, seller: billing.seller });
          await store.putInvoice({ ...inv, auto: true });
          log.push({ tenant: t.id, action: 'invoice', no: inv.no });
        }
      }
      // (2) تطبيق الحالة
      const want = st.recommend, had = sub.appliedStatus || 'active';
      if (auto.status && want !== had) {
        if (!(t.sa && t.sa.client_email)) { log.push({ tenant: t.id, action: 'status-skipped', want, why: 'no-sa' }); continue; }
        await writeStatus(t, want);
        await store.putSub(t.id, { ...(await store.getSub(t.id)), appliedStatus: want, appliedAt: iso(now) });
        log.push({ tenant: t.id, action: 'status', from: had, to: want });
      }
    } catch (e) { log.push({ tenant: t.id, action: 'error', why: String(e.message || e).slice(0, 160) }); }
  }
  return log;
}

/** تشغيل دوري على الخادم: عند الإقلاع ثم كل ساعة، بلا تداخل بين جولتين */
export function scheduleAutomation(run, { everyMs = 3600000, firstMs = 60000 } = {}) {
  let busy = false;
  const tick = async () => { if (busy) return; busy = true; try { const log = await run(); if (log.length) console.log('[automation]', JSON.stringify(log)); } catch (e) { console.error('[automation]', e.message); } finally { busy = false; } };
  const a = setTimeout(tick, firstMs); const b = setInterval(tick, everyMs);
  if (a.unref) a.unref(); if (b.unref) b.unref();
  return tick;
}
