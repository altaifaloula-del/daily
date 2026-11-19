import React from 'react';
import { createRoot } from 'react-dom/client';
import App, { ErrorBoundary } from './App';
import './brand/mithqal-brand-tokens.css';   // v50.3: ألوان الهوية الرسمية الموحّدة (--mithqal-*)

// v32.0: حاجز أخطاء شامل — لا شاشة سوداء أبدًا؛ رسالة عربية مع «تحديث الصفحة»
createRoot(document.getElementById('root')).render(
  <React.StrictMode><ErrorBoundary full where="المنصة"><App /></ErrorBoundary></React.StrictMode>
);
