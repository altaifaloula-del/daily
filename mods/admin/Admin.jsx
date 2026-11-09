/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState } from 'react';
import { authApi } from '../../storage';
import { Building2, Users, Receipt, Truck, ShieldCheck, Grid3x3, Settings, Plus, Store, Lock, Check, Trash2 } from 'lucide-react';
import { ALL_TABS, AppPermsPanel, BranchForm, CategoriesPanel, DeliveryAppsPanel, ROLES, SystemPanel, TAB_AR, UserForm, clr, money, newBranchDraft, sha, today, uid } from '../../App.jsx';

export function Admin({ org, ops, me, commit, commitOrg, say }) {
  const [tab, setTab] = useState('branches');
  const [bEdit, setBEdit] = useState(null);
  const [uEdit, setUEdit] = useState(null);

  const saveBranch = async (b) => {
    const isNew = !org.branches.some(x => x.id === b.id);
    await commitOrg(d => ({ ...d, branches: isNew ? [...d.branches, b] : d.branches.map(x => x.id === b.id ? b : x) }), {
      actionType: isNew ? 'create' : 'update', targetType: 'branch', targetId: b.id, branchName: b.name,
      title: isNew ? 'أضاف فرعاً جديداً' : 'عدّل بيانات فرع', details: `${b.name} — ${b.city}`
    });
    say(isNew ? 'تمت إضافة الفرع' : 'تم تحديث بيانات الفرع'); setBEdit(null);
  };
  const saveUser = async (u) => {
    const isNew = !org.users.some(x => x.id === u.id);
    const email = (u.email || '').trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return say('أدخل بريداً إلكترونياً صحيحاً', 'no');
    if (org.users.some(x => x.id !== u.id && (x.email || '').toLowerCase() === email)) return say('هذا البريد مستخدم بحساب آخر', 'no');
    if (isNew && (!u.newPass || u.newPass.length < 6)) return say('كلمة سر الحساب الجديد يجب ألا تقل عن 6 أحرف', 'no');
    if (isNew && u.newPass && u.newPass !== u.newPass.trim()) return say('كلمة السر تبدأ أو تنتهي بمسافة — احذفها ثم أعد الحفظ (المسافات الخفية أشهر سبب لفشل الدخول لاحقاً)', 'no');
    // v15.15 — إصلاح جذري: كان إنشاء حساب المصادقة يجري «بعد» حفظ السجل، وفشله (خصوصاً بريد
    // ما زال قائماً في Firebase من محاولة سابقة) يُبتلع بصمت وتظهر رسالة «تم إنشاء الحساب»
    // بينما كلمة السر الجديدة لم تصل لحساب الدخول إطلاقاً — فيفشل دخول الموظف للأبد بلا
    // تفسير. الصحيح: إنشاء حساب المصادقة أولاً، وعند فشله نوقف الحفظ ونشرح بدقة ماذا يُفعل.
    if (authApi.enabled && isNew && u.newPass) {
      try { await authApi.createUser(email, u.newPass); }
      catch (e) {
        const c = String((e && e.code) || '');
        if (c.includes('email-already-in-use')) {
          return say('يوجد حساب دخول قديم بهذا البريد في Firebase وكلمة سره القديمة هي التي ستبقى سارية — لن تُطبَّق كلمة السر الجديدة. الحل: احذف هذا البريد من لوحة Firebase (Authentication → Users) ثم أعد إنشاء المستخدم هنا.', 'no');
        }
        if (c.includes('weak-password')) return say('كلمة السر ضعيفة وفق سياسة Firebase — اختر كلمة أقوى ثم أعد المحاولة', 'no');
        if (c.includes('invalid-email')) return say('البريد الإلكتروني غير مقبول لدى Firebase — تأكد من صياغته', 'no');
        if (c.includes('network')) return say('تعذّر الاتصال بخادم المصادقة — تحقق من الشبكة وأعد المحاولة (لم يُحفَظ شيء)', 'no');
        return say('تعذّر إنشاء حساب الدخول (' + c.replace('auth/', '') + ') — لم يُحفَظ المستخدم. أعد المحاولة', 'no');
      }
    }
    const rec = { ...u, email };
    // v28.1: مع Firebase لا تُخزَّن بصمة كلمة السر في مستند المنشأة، وتغيير كلمة سر حساب قائم يتم برابط على بريده
    if (u.newPass && !authApi.enabled) { rec.passHash = await sha(u.newPass); }
    if (authApi.enabled) { delete rec.passHash; delete rec.pin; }
    let resetMail = '';
    if (authApi.enabled && !isNew && u.newPass) {
      try { await authApi.resetPass(email); resetMail = 'sent'; } catch { resetMail = 'failed'; }
    }
    if (u.newPin) { rec.pinHash = await sha('pin:' + u.newPin); }
    delete rec.newPass; delete rec.newPin; delete rec.pin;
    await commitOrg(d => ({ ...d, users: isNew ? [...d.users, rec] : d.users.map(x => x.id === rec.id ? rec : x) }), {
      actionType: isNew ? 'create' : 'permission_change', targetType: 'user_account', targetId: rec.id,
      title: isNew ? 'أنشأ مستخدماً جديداً' : 'عدّل بيانات مستخدم', details: `${rec.name} — ${ROLES[rec.role].ar}`
    });
    // مزامنة العضوية وصفة المدير حسب الدور
    // v27.2: فشل المزامنة كان يُبتلع بصمت (upsertMember تعيد false) فيُحفظ المستخدم بلا عضوية خادمية صحيحة
    // ⇒ جهاز فرعه لا يستطيع قراءة/كتابة بياناته. نُبلغ صراحةً.
    let memOk = true;
    if (authApi.enabled) {
      memOk = await authApi.upsertMember(email, { active: rec.isActive !== false, role: rec.role, branchId: rec.branchId || '', branchIds: rec.allowedBranchIds || [], scope: (ROLES[rec.role]?.scope === 'all') ? 'all' : 'branch' });
      const admOk = await authApi.syncAdmin(email, !!ROLES[rec.role]?.admin && rec.isActive !== false);   // v28.1: الموقوف يخرج من قائمة المدراء
      if (memOk && !admOk && ROLES[rec.role]?.admin) say('حُفظ المستخدم لكن تعذّر إدراجه في قائمة المدراء على الخادم — نفّذ الحفظ من حساب مسؤول النظام الأول', 'no');
    }
    if (!memOk) say('حُفظ المستخدم في المنصة، لكن تعذّرت مزامنة عضويته على الخادم (حسابك ليس ضمن قائمة المدراء على الخادم) — لن يستطيع هذا المستخدم قراءة/كتابة بيانات فرعه حتى تُنفَّذ «مزامنة صلاحيات الأعضاء» من حساب مسؤول النظام الأول', 'no');
    else if (resetMail === 'sent') say('تم تحديث الحساب — كلمة السر لا تُغيَّر من هنا؛ أُرسل للمستخدم رابط تعيين كلمة سر جديدة على بريده ✓');
    else if (resetMail === 'failed') say('تم تحديث الحساب، لكن كلمة السر لم تتغير: تعذّر إرسال رابط التعيين إلى بريد المستخدم — أعد المحاولة', 'no');
    else say(isNew ? 'تم إنشاء الحساب — يدخل ببريده وكلمة سره ✓' : 'تم تحديث الحساب');
    setUEdit(null);
  };

  const delUser = async (u) => {
    if (u.id === me.id) return say('لا يمكنك حذف حسابك الحالي', 'no');
    if ((ROLES[u.role] || {}).admin && org.users.filter(x => x.isActive && (ROLES[x.role] || {}).admin).length <= 1) {
      return say('لا يمكن حذف آخر حساب مدير نشط في المنصة', 'no');
    }
    if (!window.confirm(`سيُحذف حساب «${u.name}» (${u.email}) نهائياً من المنصة، ويصبح بريده متاحاً لإنشاء حساب جديد به. إغلاقاته وسجلاته السابقة تبقى محفوظة في فرعها. هل أنت متأكد؟`)) return;
    await commitOrg(d => ({ ...d, users: d.users.filter(x => x.id !== u.id) }), {
      actionType: 'delete', targetType: 'user_account', targetId: u.id, title: 'حذف مستخدماً', details: `${u.name} — ${u.email}`
    });
    if (authApi.enabled) {
      try { await authApi.upsertMember(u.email, { active: false }); } catch { }
      // v28.1: المحذوف يخرج من قائمة المدراء على الخادم — وإلا بقي قادرًا على إعادة تفعيل عضويته بنفسه
      let admOut = false;
      try { admOut = await authApi.syncAdmin(u.email, false); } catch { admOut = false; }
      if (!admOut && (ROLES[u.role] || {}).admin) return say('حُذف الحساب من المنصة، لكن تعذّر إخراجه من قائمة المدراء على الخادم — نفّذ الحذف من حساب مسؤول النظام الأول أو أزل بريده من platform/admins في Firebase', 'no');
    }
    say('تم حذف الحساب');
  };

  // v27.1 — إعادة مزامنة عضويات الخادم (members/{email}: الفرع/النطاق/الدور) لكل المستخدمين — هي ما تعتمد عليه
  // قواعد Firestore لعزل الفروع؛ عضوية بلا فرع صحيح = جهاز الفرع يقرأ نسخة قديمة ولا يستطيع حفظ أي شيء سحابيًا.
  const [memSync, setMemSync] = useState(null);
  const syncMembers = async () => {
    if (!authApi.enabled) return say('المصادقة السحابية غير مفعّلة في هذه النسخة', 'no');
    setMemSync('busy');
    let ok = 0, fail = 0; const failed = [];
    for (const u of (org.users || [])) {
      if (!u.email) continue;
      const r = await authApi.upsertMember(u.email, { active: u.isActive !== false, role: u.role, branchId: u.branchId || '', branchIds: u.allowedBranchIds || [], scope: (ROLES[u.role]?.scope === 'all') ? 'all' : 'branch' });
      if (r) { ok++; try { await authApi.syncAdmin(u.email, !!ROLES[u.role]?.admin && u.isActive !== false); } catch { } } else { fail++; failed.push(u.name || u.email); }
    }
    setMemSync({ ok, fail, failed });
    if (fail) say('تعذّرت مزامنة ' + fail + ' عضوية (' + failed.slice(0, 3).join('، ') + (fail > 3 ? '…' : '') + ') — حسابك ليس ضمن قائمة المدراء على الخادم (platform/admins)؛ نفّذها من حساب مسؤول النظام الأول', 'no');
    else say('زُومنت عضويات ' + ok + ' مستخدم مع الخادم ✓ — أعد الدخول على أجهزة الفروع');
  };

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="row">
        <button className={'btn sm' + (tab === 'branches' ? ' pri' : ' gh')} onClick={() => setTab('branches')}>
          <Building2 size={14} />الفروع
        </button>
        <button className={'btn sm' + (tab === 'users' ? ' pri' : ' gh')} onClick={() => setTab('users')}>
          <Users size={14} />المستخدمون والصلاحيات
        </button>
        <button className={'btn sm' + (tab === 'cats' ? ' pri' : ' gh')} onClick={() => setTab('cats')}>
          <Receipt size={14} />بنود المصروف والميزانيات
        </button>
        <button className={'btn sm' + (tab === 'delivery' ? ' pri' : ' gh')} onClick={() => setTab('delivery')}>
          <Truck size={14} />تطبيقات التوصيل
        </button>
        <button className={'btn sm' + (tab === 'perms' ? ' pri' : ' gh')} onClick={() => setTab('perms')}>
          <ShieldCheck size={14} />مصفوفة الصلاحيات
        </button>
        <button className={'btn sm' + (tab === 'appperms' ? ' pri' : ' gh')} onClick={() => setTab('appperms')}>
          <Grid3x3 size={14} />ظهور التطبيقات للمستخدمين
        </button>
        <button className={'btn sm' + (tab === 'system' ? ' pri' : ' gh')} onClick={() => setTab('system')}>
          <Settings size={14} />بيانات الشركة والنسخ الاحتياطي
        </button>
        {(tab === 'branches' || tab === 'users') && <button className="btn pri" style={{ marginInlineStart: 'auto' }}
          onClick={() => tab === 'branches'
            ? setBEdit(newBranchDraft())
            : setUEdit({ id: uid('u'), name: '', email: '', role: 'branch_manager', newPass: '', branchId: org.branches[0]?.id, allowedBranchIds: [], isActive: true, createdAt: today() })}>
          <Plus size={15} />{tab === 'branches' ? 'فرع جديد' : 'مستخدم جديد'}
        </button>}
      </div>

      {tab === 'branches' && (
        <div className="grid g2">
          {org.branches.map(b => (
            <div key={b.id} className="card">
              <div className="card-h">
                <div className="card-t"><Store size={15} color="var(--brass)" />{b.name}</div>
                <span className={'badge ' + (b.isActive ? 'b-mint' : 'b-dim')}>{b.isActive ? 'نشط' : 'موقوف'}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 2 }}>
                <div>المدينة: {b.city} · المسؤول: {b.managerName}</div>
                <div>الجوال: <span className="num">{b.phone}</span> · نهاية الوردية: <span className="num">{b.shiftEndTime}</span></div>
                <div>العهدة الافتراضية: <span className="num" style={{ color: 'var(--brass)' }}>{money(b.defaultFloat)}</span> ر.س</div>
                {(b.bankName || b.bankIban) && <div>🏦 بنك الفرع: <b style={{ color: 'var(--brass)' }}>{b.bankName || '—'}</b>{b.bankIban ? <> · <span className="num" style={{ direction: 'ltr', unicodeBidi: 'embed' }}>{b.bankIban}</span></> : ''}</div>}
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn sm" onClick={() => setBEdit(b)}>تعديل</button>
                <button className="btn sm gh" onClick={() => saveBranch({ ...b, isActive: !b.isActive })}>
                  {b.isActive ? 'إيقاف' : 'تفعيل'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'users' && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            <div className="note" style={{ flex: 1, minWidth: 260 }}>قواعد الخادم تعزل الفروع اعتمادًا على «عضوية» كل حساب (الفرع/النطاق). إن ظهر على جهاز فرع شريط أحمر «لن تُحفظ أي بيانات» أو اختفى حضور/إغلاق بعد إعادة التحميل، اضغط «مزامنة صلاحيات الأعضاء» ثم أعد الدخول على ذلك الجهاز.</div>
            <button className="btn sm" disabled={memSync === 'busy'} onClick={syncMembers} title="إعادة كتابة members/{email} لكل المستخدمين من سجلاتهم هنا"><ShieldCheck size={13} />{memSync === 'busy' ? 'جارٍ المزامنة…' : 'مزامنة صلاحيات الأعضاء'}</button>
            {memSync && memSync !== 'busy' && <span className={'badge ' + (memSync.fail ? 'b-rose' : 'b-mint')}>{memSync.ok} ✓{memSync.fail ? ' · ' + memSync.fail + ' ✗' : ''}</span>}
          </div>
          <div className="tw">
            <table className="tb">
              <thead><tr><th>المستخدم</th><th>الدور</th><th>النطاق</th><th>الحالة</th><th></th></tr></thead>
              <tbody>
                {org.users.map((u, i) => (
                  <tr key={u.id}>
                    <td>
                      <div className="row" style={{ gap: 9, flexWrap: 'nowrap' }}>
                        <div className="av" style={{ background: clr(i), margin: 0 }}>{u.name.charAt(0)}</div>
                        <div><div style={{ fontSize: 12.5, fontWeight: 600 }}>{u.name}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>{u.email}</div></div>
                      </div>
                    </td>
                    <td><span className={'badge ' + (ROLES[u.role] || ROLES.cashier).badge}>{(ROLES[u.role] || ROLES.cashier).ar.split('—')[0]}</span></td>
                    <td style={{ fontSize: 11.5, color: 'var(--dim)' }}>
                      {(ROLES[u.role] || ROLES.cashier).scope === 'all' ? 'جميع الفروع'
                        : (ROLES[u.role] || ROLES.cashier).scope === 'own' ? (org.branches.find(b => b.id === u.branchId)?.name || '—')
                          : `${(u.allowedBranchIds || []).length} فرع مصرّح`}
                    </td>
                    <td><span className={'badge ' + (u.isActive ? 'b-mint' : 'b-dim')}>{u.isActive ? 'نشط' : 'موقوف'}</span></td>
                    <td>
                      <div className="row" style={{ gap: 5, flexWrap: 'nowrap' }}>
                        <button className="btn sm" onClick={() => setUEdit(u)}>تعديل</button>
                        <button className="btn sm gh" onClick={() => saveUser({ ...u, isActive: !u.isActive })} title={u.isActive ? 'إيقاف الحساب' : 'تفعيل الحساب'}>
                          {u.isActive ? <Lock size={12} /> : <Check size={12} />}
                        </button>
                        <button className="btn sm gh" onClick={() => delUser(u)} title="حذف الحساب نهائياً" style={{ color: 'var(--rose)' }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'cats' && <CategoriesPanel org={org} ops={ops} commitOrg={commitOrg} say={say} />}
      {tab === 'delivery' && <DeliveryAppsPanel org={org} ops={ops} commitOrg={commitOrg} say={say} />}
      {tab === 'appperms' && <AppPermsPanel org={org} commitOrg={commitOrg} say={say} />}
      {tab === 'system' && <SystemPanel org={org} ops={ops} me={me} commit={commit} commitOrg={commitOrg} say={say} />}
      {tab === 'perms' && (() => {
        const roleIds = ['system_admin', 'general_management', 'head_office', 'finance_department', 'cost_controller', 'regional_manager', 'branch_manager', 'cashier'];
        return (
          <div className="grid" style={{ gap: 12 }}>
            <div className="card">
              <div className="card-t" style={{ marginBottom: 10 }}><ShieldCheck size={15} color="var(--brass)" />مصفوفة الصلاحيات — من يرى ماذا (المصدر الواحد للحقيقة)</div>
              <div className="tw">
                <table className="tb" style={{ fontSize: 11.5 }}>
                  <thead><tr><th>الشاشة</th>{roleIds.map(r => <th key={r} style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>{(ROLES[r]?.ar || r).split(' — ')[0]}</th>)}</tr></thead>
                  <tbody>
                    {ALL_TABS.map(t => (
                      <tr key={t}>
                        <td style={{ fontWeight: 600 }}>{TAB_AR[t] || t}</td>
                        {roleIds.map(r => {
                          const ok = (ROLES[r]?.tabs || []).includes(t);
                          return <td key={r} style={{ textAlign: 'center', color: ok ? 'var(--mint)' : 'var(--faint)', fontWeight: ok ? 800 : 400 }}>{ok ? '✓' : '—'}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card" style={{ background: 'rgba(200,162,74,.04)', borderStyle: 'dashed' }}>
              <div style={{ fontSize: 11.5, color: 'var(--dim)', lineHeight: 2 }}>
                <b style={{ color: 'var(--brass-l)' }}>صلاحيات الكتابة الحساسة (إضافة إلى رؤية الشاشات):</b><br />
                • القيود اليدوية والأصول والتسوية البنكية وأوامر الشراء والمخزون: الأدوار كاملة النطاق (مسؤول النظام، الإدارة العليا، المكتب الرئيسي، المحاسب الرئيسي)<br />
                • تفعيل الضريبة ونسبتها، إدارة المستخدمين والفروع، إدارة التطبيقات: أدوار الإدارة فقط (مسؤول النظام، الإدارة العليا)<br />
                • الاعتماد النهائي للإغلاقات: أصحاب صفة «معتمِد» — والقيود التلقائية لا يعدّلها أحد: تصحيح المصدر يصحّح قيده<br />
                • مدير الفرع والكاشير: إدخال إغلاقات فرعهم فقط، وإضافة الشركاء عبر «طلب اعتماد» يقرّه المركز
              </div>
            </div>
          </div>
        );
      })()}

      {bEdit && <BranchForm b={bEdit} org={org} say={say} onSave={saveBranch} onClose={() => setBEdit(null)} />}
      {uEdit && <UserForm u={uEdit} org={org} onSave={saveUser} onClose={() => setUEdit(null)} />}
    </div>
  );
}
