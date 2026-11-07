import React from 'react';
import { createRoot } from 'react-dom/client';
import App, { ErrorBoundary } from './App';

// v32.0: حاجز أخطاء شامل — لا شاشة سوداء أبدًا؛ رسالة عربية مع «تحديث الصفحة»
createRoot(document.getElementById('root')).render(
  <React.StrictMode><ErrorBoundary full where="المنصة"><App /></ErrorBoundary></React.StrictMode>
);
