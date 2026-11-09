/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useEffect } from 'react';
import { Check, AlertTriangle, Clock, Store, Timer, Settings } from 'lucide-react';
import { Field, Kpi, Modal, NUM_LOCALE, ROLES, arDate, countedClosing, isoD, today } from '../../App.jsx';

export function Shifts({ org, ops, me, myBranches, commitOrg, say }) {
  const [now, setNow] = useState(new Date());
  const [edit, setEdit] = useState(null);
  const isGM = ROLES[me.role]?.scope === 'all';

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);

  const status = (b) => {
    const [h, m] = (b.shiftEndTime || '02:00').split(':').map(Number);
    const dl = new Date(now); dl.setHours(h, m, 0, 0);
    // الورديات التي تنتهي بعد منتصف الليل تخص يوم العمل السابق
    if (h < 6 && now.getHours() >= 6) dl.setDate(dl.getDate() + 1);
    const mins = Math.round((dl - now) / 60000);
    const workDay = h < 6 ? isoD(new Date(dl.getTime() - 86400000)) : isoD(dl);
    const done = (ops.closings || []).some(c => c.branchId === b.id && c.date === workDay && countedClosing(c));
    const warn = mins <= (b.reminderBeforeMinutes || 30) && mins > 0;
    return { dl, mins, done, warn, late: mins < 0 && !done, workDay };
  };

  const save = async (b) => {
    await commitOrg(d => ({ ...d, branches: d.branches.map(x => x.id === b.id ? b : x) }), {
      actionType: 'update', targetType: 'branch', targetId: b.id, branchName: b.name,
      title: 'عدّل إعدادات وردية فرع',
      details: `${b.name} · نهاية الوردية ${b.shiftEndTime} · تنبيه قبل ${b.reminderBeforeMinutes} دقيقة`
    });
    say('تم حفظ إعدادات الوردية'); setEdit(null);
  };

  const fmtLeft = (m) => m < 0
    ? `تأخر ${Math.floor(-m / 60)} س ${(-m) % 60} د`
    : `متبقٍ ${Math.floor(m / 60)} س ${m % 60} د`;

  const rows = myBranches.map(b => ({ b, st: status(b) }));
  const late = rows.filter(r => r.st.late).length;

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="grid g3">
        <Kpi label="فروع أغلقت وردية اليوم" value={rows.filter(r => r.st.done).length + ' / ' + rows.length} icon={Check} color="#4FB286" />
        <Kpi label="فروع متأخرة عن الإغلاق" value={late} sub={late ? 'تتطلب متابعة فورية' : 'لا تأخير'} icon={AlertTriangle} color={late ? '#D9544D' : '#5B93C4'} />
        <Kpi label="الوقت الآن" value={now.toLocaleTimeString(NUM_LOCALE, { hour: '2-digit', minute: '2-digit' })} sub={arDate(today())} icon={Clock} color="#C8A24A" />
      </div>

      <div className="grid g2">
        {rows.map(({ b, st }) => (
          <div key={b.id} className="card" style={{
            borderColor: st.late ? 'rgba(217,84,77,.45)' : st.warn ? 'rgba(224,164,88,.45)' : 'var(--line)'
          }}>
            <div className="card-h" style={{ marginBottom: 10 }}>
              <div className="card-t"><Store size={15} color="var(--brass)" />{b.name}</div>
              {st.done ? <span className="badge b-mint"><Check size={11} />تم الإغلاق</span>
                : st.late ? <span className="badge b-rose"><AlertTriangle size={11} />متأخر</span>
                  : st.warn ? <span className="badge b-amber"><Timer size={11} />اقترب الموعد</span>
                    : <span className="badge b-dim">قيد التشغيل</span>}
            </div>
            <div className="grid g2" style={{ gap: 9 }}>
              <div className="mono-b"><span style={{ fontSize: 11.5 }}>نهاية الوردية</span>
                <span className="num" style={{ fontWeight: 600 }}>{b.shiftEndTime}</span></div>
              <div className="mono-b"><span style={{ fontSize: 11.5 }}>العدّاد</span>
                <span className="num" style={{ fontWeight: 600, color: st.done ? 'var(--mint)' : st.late ? 'var(--rose)' : 'var(--brass)' }}>
                  {st.done ? 'مكتمل' : fmtLeft(st.mins)}
                </span></div>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <span className={'badge ' + (b.autoClosingReminderEnabled ? 'b-mint' : 'b-dim')}>
                تذكير تلقائي {b.autoClosingReminderEnabled ? 'مفعّل' : 'موقوف'}
              </span>
              <span className="badge b-dim">قبل <span className="num">{b.reminderBeforeMinutes || 30}</span> دقيقة</span>
              {b.emailReminderEnabled && <span className="badge b-sky">تنبيه بريدي</span>}
              {b.inAppReminderEnabled && <span className="badge b-sky">إشعار داخل المنصة</span>}
            </div>
            {b.managerEmails && (
              <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 8, direction: 'ltr', textAlign: 'right' }}>
                {b.managerEmails}
              </div>
            )}
            {isGM && <button className="btn sm" style={{ marginTop: 12 }} onClick={() => setEdit({ ...b })}>
              <Settings size={13} />إعدادات الوردية والتذكير
            </button>}
          </div>
        ))}
      </div>

      {edit && (
        <Modal title={`إعدادات وردية ${edit.name}`} icon={Clock} onClose={() => setEdit(null)}
          foot={<><button className="btn pri" onClick={() => save(edit)}><Check size={14} />حفظ الإعدادات</button>
            <button className="btn gh" onClick={() => setEdit(null)}>إلغاء</button></>}>
          <div className="grid g2">
            <Field label="وقت نهاية الوردية">
              <input type="time" className="inp" value={edit.shiftEndTime || '02:00'}
                onChange={e => setEdit({ ...edit, shiftEndTime: e.target.value })} />
            </Field>
            <Field label="التنبيه قبل الموعد">
              <select className="sel" value={edit.reminderBeforeMinutes || 30}
                onChange={e => setEdit({ ...edit, reminderBeforeMinutes: Number(e.target.value) })}>
                {[15, 30, 45, 60].map(m => <option key={m} value={m}>{m} دقيقة</option>)}
              </select>
            </Field>
          </div>
          {[['autoClosingReminderEnabled', 'تفعيل تذكيرات الإغلاق التلقائية'],
          ['inAppReminderEnabled', 'إشعار داخل المنصة'],
          ['emailReminderEnabled', 'تنبيه عبر البريد الإلكتروني']].map(([k, lbl]) => (
            <label key={k} className="row" style={{ fontSize: 12.5, cursor: 'pointer', marginBottom: 9 }}>
              <input type="checkbox" checked={!!edit[k]} onChange={e => setEdit({ ...edit, [k]: e.target.checked })} />
              {lbl}
            </label>
          ))}
          <Field label="بريد المدراء المستلمين (مفصول بفاصلة)">
            <input className="inp" style={{ direction: 'ltr' }} value={edit.managerEmails || ''}
              placeholder="admin@restaurant.sa, finance@restaurant.sa"
              onChange={e => setEdit({ ...edit, managerEmails: e.target.value })} />
          </Field>
        </Modal>
      )}
    </div>
  );
}
