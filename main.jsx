import React from 'react';
import { createRoot } from 'react-dom/client';
import './brand/mithqal-brand-tokens.css';   // v50.3: ألوان الهوية الرسمية الموحّدة (--mithqal-*)
import { bootTenant, tenantErrorHtml } from './tenant-boot.js';

// v51.1 (S2): يُحدَّد المستأجر من السجل أولًا، ثم يُحمَّل التطبيق (طبقة التخزين تقرأ إعداده عند تحميلها).
// v32.0: حاجز أخطاء شامل — لا شاشة سوداء أبدًا؛ رسالة عربية مع «تحديث الصفحة»
const rootEl = document.getElementById('root');
// v51.5 (S6): صفحة التسجيل العام (?signup) مستقلة — لا تقلع على أي منشأة ولا تحمّل التطبيق
const isSignup = (() => { try { return new URLSearchParams(location.search).has('signup'); } catch { return false; } })();
if (isSignup) import('./mods/signup/SignupPage.jsx').then(({ SignupPage }) => createRoot(rootEl).render(<SignupPage />));
else bootTenant(window).then(async (b) => {
  if (!b.ok) { rootEl.innerHTML = tenantErrorHtml(b.error, b.id); return; }
  const { default: App, ErrorBoundary } = await import('./App');
  createRoot(rootEl).render(
    <React.StrictMode><ErrorBoundary full where="المنصة"><App /></ErrorBoundary></React.StrictMode>
  );
});
