/* v52.9 دفعة الترجمة b34 — حساب الدخول */
export default {
"حساب الدخول": "Login account",
"فحص الحساب": "Check account",
"تعيين الآن": "Set now",
"كلمة سر جديدة (8+ أرقام وحروف)": "New password (8+ letters and digits)",
"موقوف في خدمة الدخول": "Disabled in the sign-in service",
"فعّال": "Active",
"لا يوجد حساب دخول بهذا البريد في خدمة الدخول — عيّن كلمة سر أدناه فيُنشأ.": "No sign-in account with this email — set a password below to create it.",
"لمسؤول النظام فقط، وتُنفَّذ على الخادم. مفيدة حين يكون البريد شكليًا لا يستقبل رابط التعيين. لا تُحفظ كلمة السر في المنصة.": "System admin only, executed on the server. Useful when the email is a placeholder that cannot receive the reset link. The password is not stored in the platform.",
"تم تعيين كلمة السر الجديدة ✓ — يدخل بها الآن": "New password set ✓ — they can sign in with it now",
"لم يكن له حساب دخول — أُنشئ بالبريد وكلمة السر الجديدة ✓": "No sign-in account existed — created with the email and new password ✓",
"لمسؤول النظام فقط": "System admin only",
"هذا البريد ليس عضوًا في منشأتك": "This email is not a member of your organization",
"لا يُدار حساب مسؤول نظام آخر من هنا": "Another system admin's account cannot be managed here",
"غيّر كلمة سرك من «كلمة السر» في حسابك": "Change your own password from “Password” in your account",
"كلمة السر 8 أحرف على الأقل": "Password must be at least 8 characters",
"كلمة السر تجمع أرقامًا وحروفًا": "Password must mix letters and digits",
};
export const RX = [
  [/^الحالة: (.+)$/, 'Status: $1'],
  [/^آخر دخول: (.+) · آخر تغيير لكلمة السر: (.+)$/, 'Last sign-in: $1 · Password last changed: $2'],
  [/^أُنشئ: (.+)$/, 'Created: $1'],
];
