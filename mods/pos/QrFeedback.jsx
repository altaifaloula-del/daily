/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useEffect } from 'react';
import { QrCode, BarChart3, AlertTriangle, Printer, RefreshCw } from 'lucide-react';
import { QrBranchesView, QrComplaints, QrDashboard, ROLES, qrFs, qrIsComplaint, qrMs, qrPrintReport, qrStatusOf } from '../../App.jsx';

export function QrFeedback({ org, me, myBranches, say, commitOrg }) {
  const R = ROLES[me.role] || {};
  const central = R.scope === 'all';
  const ro = !!R.readOnly;
  const [view, setView] = useState('dash');
  const [days, setDays] = useState(30);
  const [sel, setSel] = useState('all');
  const [fb, setFb] = useState([]);
  const [pub, setPub] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const brs = myBranches || [];
  const brKeyStr = brs.map(b => b.id).join(',');

  // اشتراك لحظي: المركز باستعلام واحد على الفترة، والفرع باستعلام لكل فرع مسموح (يطابق قواعد الأمان)
  useEffect(() => {
    let dead = false;
    const unsubs = [];
    const ids = brKeyStr ? brKeyStr.split(',') : [];
    setLoading(true); setErr(null);
    (async () => {
      let f;
      try { f = await qrFs(); } catch (e) { if (!dead) { setErr({ kind: 'load', msg: String((e && e.message) || e) }); setLoading(false); } return; }
      if (dead) return;
      if (!f) { setErr({ kind: 'nofb' }); setLoading(false); return; }
      const since = f.Timestamp.fromMillis(Date.now() - days * 864e5);
      const onErr = (e) => {
        if (dead) return;
        const code = (e && e.code) || '';
        setErr({ kind: code === 'failed-precondition' ? 'index' : code === 'permission-denied' ? 'denied' : 'load', msg: String((e && e.message) || e) });
        setLoading(false);
      };
      const rows = (s) => s.docs.map(d => ({ id: d.id, ...d.data() }));
      if (central) {
        const q = f.query(f.collection(f.db, 'qr_feedback'), f.where('createdAt', '>=', since), f.orderBy('createdAt', 'desc'), f.limit(3000));
        unsubs.push(f.onSnapshot(q, (s) => { if (!dead) { setFb(rows(s)); setLoading(false); } }, onErr));
      } else if (!ids.length) {
        setFb([]); setLoading(false);
      } else {
        const parts = {};
        ids.forEach(id => {
          const q = f.query(f.collection(f.db, 'qr_feedback'), f.where('branchId', '==', id), f.where('createdAt', '>=', since), f.orderBy('createdAt', 'desc'), f.limit(1000));
          unsubs.push(f.onSnapshot(q, (s) => {
            if (dead) return;
            parts[id] = rows(s);
            setFb(Object.values(parts).flat().sort((a, b) => qrMs(b.createdAt) - qrMs(a.createdAt)));
            setLoading(false);
          }, onErr));
        });
      }
      ids.forEach(id => unsubs.push(f.onSnapshot(f.doc(f.db, 'qr_branches', id),
        (s) => { if (!dead) setPub(p => ({ ...p, [id]: s.exists() ? s.data() : null })); },
        () => { if (!dead) setPub(p => ({ ...p, [id]: null })); })));
    })();
    return () => { dead = true; unsubs.forEach(u => { try { u(); } catch { } }); };
  }, [central, brKeyStr, days]);

  const nb = (id) => ((org.branches || []).find(b => b.id === id) || {}).name || id;
  const scopeFb = sel === 'all' ? fb : fb.filter(f => f.branchId === sel);
  const openCount = scopeFb.filter(f => qrIsComplaint(f) && qrStatusOf(f) !== 'resolved').length;

  // تحديث حقول المتابعة (الحالة/الملاحظات/التحليل) — القواعد تسمح بهذه الحقول فقط
  const upd = async (item, build, okMsg) => {
    if (ro) { say('صلاحيتك للعرض فقط', 'no'); return false; }
    try {
      const f = await qrFs();
      await f.updateDoc(f.doc(f.db, 'qr_feedback', item.id), { ...build(f), updatedAt: f.serverTimestamp() });
      if (okMsg) say(okMsg);
      return true;
    } catch (e) {
      say('تعذّر الحفظ: ' + ((e && e.code) === 'permission-denied' ? 'لا تملك صلاحية على هذا الفرع' : ((e && e.message) || 'خطأ غير متوقع')), 'no');
      return false;
    }
  };

  const idxLink = err && err.msg ? (err.msg.match(/https:\/\/console\.firebase\.google\.com\S+/) || [])[0] : '';

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card" style={{ padding: '9px 13px' }}>
        <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
          <div className="row" style={{ gap: 8 }}>
            <QrCode size={16} color="var(--brass)" />
            <b style={{ fontSize: 13 }}>تقييم العملاء بالـ QR</b>
            <span style={{ fontSize: 11, color: 'var(--dim)' }} className="hub-desc">· آراء العملاء والشكاوى والاتجاهات لحظيًا</span>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button className={'btn sm' + (view === 'dash' ? ' pri' : ' gh')} onClick={() => setView('dash')}><BarChart3 size={13} />لوحة التقييمات</button>
            <button className={'btn sm' + (view === 'complaints' ? ' pri' : ' gh')} onClick={() => setView('complaints')}>
              <AlertTriangle size={13} />الشكاوى{openCount > 0 && <span className="badge b-rose" style={{ padding: '1px 7px' }}>{openCount}</span>}
            </button>
            <button className={'btn sm' + (view === 'branches' ? ' pri' : ' gh')} onClick={() => setView('branches')}><QrCode size={13} />رموز QR للفروع</button>
          </div>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          {brs.length > 1 && (
            <select className="sel" style={{ width: 'auto', padding: '6px 10px' }} value={sel} onChange={e => setSel(e.target.value)}>
              <option value="all">كل الفروع</option>
              {brs.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <select className="sel" style={{ width: 'auto', padding: '6px 10px' }} value={days} onChange={e => setDays(+e.target.value)}>
            <option value={14}>آخر 14 يومًا</option>
            <option value={30}>آخر 30 يومًا</option>
            <option value={90}>آخر 90 يومًا</option>
          </select>
          <button className="btn sm gh" disabled={loading || !!err}
            onClick={() => qrPrintReport({ org, fb: scopeFb, brs: sel === 'all' ? brs : brs.filter(b => b.id === sel), days, sel, nb, say })}>
            <Printer size={13} />طباعة التقرير
          </button>
          {loading && <span style={{ fontSize: 11.5, color: 'var(--dim)' }}><RefreshCw size={12} className="spin" /> جارٍ التحميل…</span>}
        </div>
      </div>

      {err && err.kind === 'nofb' && (
        <div className="card"><div className="empty">
          وحدة تقييم العملاء تحتاج Firestore (متغيرات VITE_FIREBASE_* مضبوطة وقت البناء) — صفحة العميل العامة لا تعمل في وضع الخادم المحلي أو التخزين المحلي.
        </div></div>
      )}
      {err && err.kind !== 'nofb' && (
        <div className="card" style={{ borderColor: 'rgba(217,84,77,.45)', color: 'var(--rose)', fontSize: 12.5 }}>
          <b>{err.kind === 'index' ? 'يلزم فهرس Firestore للاستعلام (branchId + createdAt).' : err.kind === 'denied' ? 'رفض الخادم قراءة التقييمات.' : 'تعذّر تحميل التقييمات.'}</b>{' '}
          {err.kind === 'index' && <>انشر ملف firestore.indexes.json{idxLink ? <> أو <a href={idxLink} target="_blank" rel="noreferrer" style={{ color: 'var(--sky)' }}>أنشئ الفهرس من هنا</a></> : null}، ثم أعد فتح الشاشة.</>}
          {err.kind === 'denied' && <>تأكد من نشر قواعد firestore.rules الجديدة، ومن «مزامنة صلاحيات الأعضاء» لهذا الحساب.</>}
          {err.kind === 'load' && <span style={{ color: 'var(--dim)' }}>{err.msg}</span>}
        </div>
      )}

      {view === 'dash' && err?.kind !== 'nofb' && <QrDashboard fb={fb} scopeFb={scopeFb} brs={brs} sel={sel} nb={nb} upd={upd} ro={ro} say={say} loading={loading} />}
      {view === 'complaints' && err?.kind !== 'nofb' && <QrComplaints scopeFb={scopeFb} nb={nb} upd={upd} ro={ro} me={me} loading={loading} />}
      {view === 'branches' && err?.kind !== 'nofb' && <QrBranchesView org={org} brs={brs} fb={fb} pub={pub} canPublish={central && !ro} canAddBranch={!!R.admin} commitOrg={commitOrg} say={say} />}
    </div>
  );
}
