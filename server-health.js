/**
 * v56.59 — فحص الإعدادات /api/health/config (تدقيق المرحلة H، ملاحظة منخفضة):
 *  • ?deep=1 (طلب حقيقي صغير لمزوّد الذكاء الاصطناعي) لمدير المنصة الموثّق وحده — رمز دخول صالح لعضو نشط
 *    في المنشأة الرئيسية وبريده في platform/admins؛ أي طلب آخر يُتجاهل فيه deep.
 *  • المخرج العام لا يحمل معرّف مشروع حساب الخدمة (serviceAccount.project / projectIdEnv)؛ يبقى set وreadsData والحالة.
 */
const bearer = (req) => { const m = /^Bearer\s+(.+)$/i.exec(String((req && req.headers && req.headers.authorization) || '')); return m ? m[1].trim() : ''; };

/** هل الطالب مدير منصة موثّق للمنشأة الرئيسية؟ — أي خطأ ⇒ لا */
export async function healthAdmin(req, { verify, adminCheck }) {
  const tok = bearer(req); if (!tok || !verify || !adminCheck) return false;
  try {
    const u = await verify(tok);
    if (!u || u.blocked || u.tenant !== 'default' || !u.email) return false;
    return (await adminCheck({ headers: req.headers, user: u })) === true;
  } catch { return false; }
}

/** حذف معرّف المشروع من المخرج لغير مدير المنصة */
export function healthRedact(out, admin) {
  if (admin || !out || !out.serviceAccount) return out;
  const { project, projectIdEnv, ...sa } = out.serviceAccount;   // eslint-disable-line no-unused-vars
  return { ...out, serviceAccount: sa };
}
