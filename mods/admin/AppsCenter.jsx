/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState } from 'react';
import { Search, Clock, Settings } from 'lucide-react';
import { REG_APPS, REG_CATS, REG_IX, ROLES, appCanSee, appOpenNow, appUseGet, appUseSet } from '../../App.jsx';

export function AppsCenter({ org, me, commitOrg, say, setTab, openAcctView, openInvView }) {
  const [q, setQ] = useState('');
  const [mode, setMode] = useState('all');          // all | fav | rec
  const [manage, setManage] = useState(false);
  const [bump, setBump] = useState(0);              // لإعادة الرسم بعد تعديل المفضلة
  const canAdmin = !!ROLES[me.role]?.admin;
  const cfg = org.appsCfg || {};
  const hidden = cfg.hidden || [];
  const ordOf = (a) => (cfg.order && cfg.order[a.id] != null) ? cfg.order[a.id] : REG_APPS.indexOf(REG_IX[a.id]);
  const u = appUseGet(me.id);
  const isFav = (id) => (u.fav || []).includes(id);
  const toggleFav = (id) => {
    const v = appUseGet(me.id); v.fav = v.fav || [];
    v.fav = v.fav.includes(id) ? v.fav.filter(x => x !== id) : [...v.fav, id];
    appUseSet(me.id, v); setBump(b => b + 1);
  };
  const lastUsed = (id) => {
    const r = (u.rec || {})[id]; if (!r) return null;
    const d = Math.round((Date.now() - r.at) / 864e5);
    return d <= 0 ? 'اليوم' : d === 1 ? 'أمس' : 'قبل ' + d + ' يوم';
  };

  // الرؤية: صلاحيات الأدوار الحالية نفسها + إخفاءات المشرف
  const mine = REG_APPS.filter(a => appCanSee(me, a) && (manage || !hidden.includes(a.id)));
  const qq = q.trim();
  const match = (a) => !qq || (a.ar + ' ' + a.en + ' ' + a.d + ' ' + (a.kw || []).join(' ')).includes(qq);
  const inMode = (a) => mode === 'fav' ? isFav(a.id) : mode === 'rec' ? !!(u.rec || {})[a.id] : true;
  const shown = mine.filter(match).filter(inMode).sort((a, b) => ordOf(a) - ordOf(b));
  const activeCount = mine.filter(a => !a.soon).length;
  const favApps = mine.filter(a => isFav(a.id) && !a.soon);
  const recApps = Object.entries(u.rec || {}).sort((a, b) => (b[1].at || 0) - (a[1].at || 0))
    .map(([id]) => REG_IX[id]).filter(a => a && mine.includes(a)).slice(0, 6);

  const saveCfg = async (next, title, details) => {
    await commitOrg(d => ({ ...d, appsCfg: next }), {
      actionType: 'update', targetType: 'apps_center', targetId: 'appsCfg', title, details
    });
  };
  const toggleHidden = (id) => {
    const h = hidden.includes(id) ? hidden.filter(x => x !== id) : [...hidden, id];
    saveCfg({ ...cfg, hidden: h }, hidden.includes(id) ? 'أظهر تطبيقاً في مركز التطبيقات' : 'أخفى تطبيقاً من مركز التطبيقات', REG_IX[id]?.ar || id);
  };
  const move = (id, dir) => {
    const list = REG_APPS.filter(x => x.cat === REG_IX[id].cat).sort((a, b) => ordOf(a) - ordOf(b));
    const i = list.findIndex(x => x.id === id); const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const order = { ...(cfg.order || {}) };
    list.forEach((x, k) => { order[x.id] = REG_APPS.indexOf(REG_IX[x.id]); });
    const tmp = order[list[i].id]; order[list[i].id] = order[list[j].id]; order[list[j].id] = tmp;
    saveCfg({ ...cfg, order }, 'أعاد ترتيب تطبيقات المركز', REG_IX[id]?.ar || id);
  };

  const Card = ({ a }) => {
    const used = lastUsed(a.id);
    return (
      <div className={'appc' + (a.soon ? ' soon' : '')}>
        {!a.soon && (
          <button className={'appc-star' + (isFav(a.id) ? ' on' : '')} title={isFav(a.id) ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
            onClick={() => toggleFav(a.id)}>{isFav(a.id) ? '★' : '☆'}</button>
        )}
        <div className="appc-top">
          <div className="appc-ic"><a.icon size={19} /></div>
          <div style={{ minWidth: 0 }}>
            <div className="appc-n">{a.ar}</div>
            <div className="appc-e">{a.en}</div>
          </div>
        </div>
        <div className="appc-d">{a.d}</div>
        <div className="appc-f">
          {a.soon
            ? <span className="badge b-amber">قريباً · المرحلة {a.soon}</span>
            : <span className="badge b-mint">نشط</span>}
          {!a.soon && a.fns?.length > 0 && <span className="badge b-dim">{a.fns.length} وظائف</span>}
          {used && <span className="badge b-dim" style={{ opacity: .8 }}>آخر استخدام: {used}</span>}
        </div>
        {a.soon
          ? <button className="btn sm gh" disabled style={{ justifyContent: 'center' }}>ضمن خطة التطوير</button>
          : <button className="btn sm pri" style={{ justifyContent: 'center' }} onClick={() => appOpenNow(a, me, setTab, openAcctView, openInvView)}>فتح التطبيق</button>}
      </div>
    );
  };

  return (
    <div className="grid" style={{ gap: 14 }}>
      {/* الرأس: بحث ذكي + مرشحات + إدارة + هوية المستخدم */}
      <div className="card" style={{ paddingBottom: 12 }}>
        <div className="apps-hd">
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', insetInlineStart: 11, top: 12, color: 'var(--faint)' }} />
            <input className="inp" style={{ paddingInlineStart: 32 }} placeholder="ابحث عن تطبيق أو وظيفة… (جرّب: فاتورة، ضريبة، راتب)"
              value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <button className={'btn sm' + (mode === 'all' ? ' pri' : ' gh')} onClick={() => setMode('all')}>الكل</button>
          <button className={'btn sm' + (mode === 'fav' ? ' pri' : ' gh')} onClick={() => setMode('fav')}>⭐ المفضلة</button>
          <button className={'btn sm' + (mode === 'rec' ? ' pri' : ' gh')} onClick={() => setMode('rec')}><Clock size={13} />الأخيرة</button>
          {canAdmin && <button className={'btn sm' + (manage ? ' pri' : '')} onClick={() => setManage(m => !m)}><Settings size={13} />إدارة التطبيقات</button>}
          <span className="badge b-brass" style={{ marginInlineStart: 'auto' }}>{me.name} · {ROLES[me.role]?.ar?.split(' — ')[0] || me.role}</span>
        </div>
        <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          <span className="badge b-mint">{activeCount} تطبيقاً نشطاً لدورك</span>
          {mine.filter(a => a.soon).length > 0 && <span className="badge b-amber">{mine.filter(a => a.soon).length} ضمن خطة التطوير</span>}
          {mine.filter(a => a.soon).length === 0 && <span className="badge b-mint">خطة المراحل مكتملة ✓</span>}
          <span className="badge b-sky">محرك محاسبي مركزي واحد — كل التطبيقات تُقيّد فيه</span>
        </div>
        {manage && (
          <div className="note" style={{ marginTop: 10 }}>
            وضع الإدارة: أخفِ أو أظهر أو رتّب التطبيقات — الإخفاء هنا لا يعطّل الشاشة نفسها من القائمة الجانبية ولا يمس أي صلاحية.
          </div>
        )}
      </div>

      {/* المفضلة والأخيرة أعلى المركز */}
      {mode === 'all' && !qq && (favApps.length > 0 || recApps.length > 0) && (
        <div className="card" style={{ padding: 12 }}>
          {favApps.length > 0 && (
            <div className="appstrip" style={{ marginBottom: recApps.length ? 8 : 0 }}>
              <span style={{ fontSize: 11, color: 'var(--faint)' }}>⭐ المفضلة:</span>
              {favApps.map(a => <button key={a.id} className="appchip" onClick={() => appOpenNow(a, me, setTab, openAcctView, openInvView)}><span className="st">★</span>{a.ar}</button>)}
            </div>
          )}
          {recApps.length > 0 && (
            <div className="appstrip">
              <span style={{ fontSize: 11, color: 'var(--faint)' }}>الأخيرة:</span>
              {recApps.map(a => <button key={a.id} className="appchip" onClick={() => appOpenNow(a, me, setTab, openAcctView, openInvView)}><Clock size={11} />{a.ar}{(u.rec || {})[a.id]?.count > 1 && <span style={{ fontSize: 9, color: 'var(--faint)' }}>×{(u.rec || {})[a.id].count}</span>}</button>)}
            </div>
          )}
        </div>
      )}

      {/* الشبكة بالتصنيفات */}
      {REG_CATS.map(c => {
        const list = shown.filter(a => a.cat === c.id);
        if (!list.length) return null;
        return (
          <div key={c.id}>
            <div className="appcat">
              <c.icon size={17} color="var(--brass)" />
              <span className="t">{c.ar}</span>
              <span className="c">{c.en} · {list.filter(a => !a.soon).length} نشط{list.some(a => a.soon) ? ' + ' + list.filter(a => a.soon).length + ' قادم' : ''}</span>
            </div>
            <div className="appgrid">
              {list.map(a => manage ? (
                <div key={a.id} className={'appc' + (hidden.includes(a.id) ? ' soon' : '')}>
                  <div className="appc-top">
                    <div className="appc-ic"><a.icon size={19} /></div>
                    <div><div className="appc-n">{a.ar}</div><div className="appc-e">{a.en}</div></div>
                  </div>
                  <div className="appc-f" style={{ marginTop: 'auto' }}>
                    <button className={'btn sm ' + (hidden.includes(a.id) ? 'ok' : 'gh')} onClick={() => toggleHidden(a.id)}>
                      {hidden.includes(a.id) ? 'إظهار' : 'إخفاء'}</button>
                    <button className="btn sm gh" onClick={() => move(a.id, -1)}>▲</button>
                    <button className="btn sm gh" onClick={() => move(a.id, 1)}>▼</button>
                    {hidden.includes(a.id) && <span className="badge b-rose">مخفي</span>}
                  </div>
                </div>
              ) : <Card key={a.id} a={a} />)}
            </div>
          </div>
        );
      })}
      {shown.length === 0 && (
        <div className="card"><div className="empty">لا نتائج لبحثك — جرّب كلمة أخرى مثل «فاتورة» أو «قيد» أو «راتب».</div></div>
      )}

      <div className="card" style={{ background: 'rgba(200,162,74,.04)', borderStyle: 'dashed' }}>
        <div style={{ fontSize: 11.5, color: 'var(--dim)', lineHeight: 1.9 }}>
          <b style={{ color: 'var(--brass-l)' }}>معمارية المركز:</b> كل بطاقة تفتح وحدة فعلية تعمل الآن — لا صفحات وهمية.
          التطبيقات كلها تتشارك نفس المستخدمين والفروع ودليل الحسابات والشركاء (طبقة تكامل واحدة)،
          وكل عملية مالية فيها تصب تلقائيًا في المحرك المحاسبي المركزي: عملية ← قيد ← أستاذ ← ميزان ← قوائم.
          بطاقات «قريباً» هي خطة التطوير المعتمدة (م3 الضريبة، م4 المشتريات والمخزون، م5 الأصول والتسوية) وتظهر لأدوار المركز فقط.
        </div>
      </div>
    </div>
  );
}
