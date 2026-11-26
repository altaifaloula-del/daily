/* v56.5 — تجربة الدخول: خلفية حيّة خفيفة (جسيمات + ضوء يتبع المؤشر) ورسالة الترحيب بعد الدخول.
   زخرفة بصرية فقط: لا تلمس المصادقة ولا الجلسة ولا تخزّن شيئًا. تتوقف كليًا مع «تقليل الحركة»،
   وتخفّ على الجوال، وتتوقف عند إخفاء التبويب. */
import React, { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';

const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

/** جسيمات دقيقة وضوء ناعم يتبع المؤشر — يكتب --mx/--my على حاوية البوابة */
export function LoginFx({ hostRef }) {
  const cv = useRef(null);
  useEffect(() => {
    const host = hostRef && hostRef.current; const c = cv.current;
    if (!host || !c || reduced()) return undefined;
    const ctx = c.getContext('2d'); if (!ctx) return undefined;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, Hh = 0, raf = 0, px = 0.5, py = 0.4, tx = 0.5, ty = 0.4, pts = [];
    const css = getComputedStyle(host);
    const gv = (css.getPropertyValue('--brass') || '').trim();
    const gold = /^(#[0-9a-f]{3,8}|rgba?\([^)]*\))$/i.test(gv) ? gv : 'rgb(217,168,62)';   // قيمة لا يفهمها canvas (color-mix…) ⇐ ذهبي الهوية
    const size = () => {
      W = host.clientWidth; Hh = host.clientHeight; c.width = Math.max(1, W * dpr); c.height = Math.max(1, Hh * dpr);   // العرض بالـ CSS (100%) لا بالبكسل
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = W < 640 ? 12 : W < 1024 ? 24 : 40;
      pts = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * Hh, r: 0.6 + Math.random() * 1.6, vx: (Math.random() - 0.5) * 0.12, vy: -0.05 - Math.random() * 0.14, a: 0.12 + Math.random() * 0.33, d: 0.3 + Math.random() * 0.7, g: Math.random() < 0.55 }));
    };
    const move = (e) => { const r = host.getBoundingClientRect(); tx = (e.clientX - r.left) / Math.max(1, r.width); ty = (e.clientY - r.top) / Math.max(1, r.height); };
    const tick = () => {
      px += (tx - px) * 0.06; py += (ty - py) * 0.06;
      host.style.setProperty('--mx', (px * 100).toFixed(2) + '%'); host.style.setProperty('--my', (py * 100).toFixed(2) + '%');
      ctx.clearRect(0, 0, W, Hh);
      const ox = (px - 0.5) * 18, oy = (py - 0.5) * 18;
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        if (p.y < -4) { p.y = Hh + 4; p.x = Math.random() * W; } if (p.x < -4) p.x = W + 4; if (p.x > W + 4) p.x = -4;
        ctx.globalAlpha = p.a; ctx.fillStyle = p.g ? gold : 'rgba(255,255,255,.85)';
        ctx.beginPath(); ctx.arc(p.x + ox * p.d, p.y + oy * p.d, p.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1; raf = requestAnimationFrame(tick);
    };
    const vis = () => { cancelAnimationFrame(raf); if (!document.hidden) raf = requestAnimationFrame(tick); };
    size(); raf = requestAnimationFrame(tick);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => size()) : null; if (ro) ro.observe(host); else window.addEventListener('resize', size); window.addEventListener('pointermove', move, { passive: true }); document.addEventListener('visibilitychange', vis);
    return () => { cancelAnimationFrame(raf); if (ro) ro.disconnect(); else window.removeEventListener('resize', size); window.removeEventListener('pointermove', move); document.removeEventListener('visibilitychange', vis); };
  }, [hostRef]);
  return <canvas ref={cv} className="mq-fx" aria-hidden="true" />;
}

/** علامة الترحيب: تُضبط قبل محاولة الدخول وتُقرأ مرة واحدة بعد ظهور المنصة (صالحة دقيقتين فقط) */
export const WELCOME_KEY = 'mq:welcome';
export const markWelcome = () => { try { sessionStorage.setItem(WELCOME_KEY, String(Date.now())); } catch { } };
export const clearWelcome = () => { try { sessionStorage.removeItem(WELCOME_KEY); } catch { } };

/** ترحيب قصير باسم المستخدم الفعلي فوق المنصة — لا يحجب النقر ولا يؤخر أي شيء */
export function WelcomeFx({ name }) {
  const [on, setOn] = useState(() => { try { const t = Number(sessionStorage.getItem(WELCOME_KEY)) || 0; sessionStorage.removeItem(WELCOME_KEY); return t > 0 && Date.now() - t < 120000; } catch { return false; } });
  useEffect(() => { if (!on) return undefined; const t = setTimeout(() => setOn(false), 1700); return () => clearTimeout(t); }, [on]);
  if (!on || !name) return null;
  return (
    <div className="mq-welcome" role="status" aria-live="polite">
      <div className="mq-welcome-in">
        <span className="mq-welcome-ok"><Check size={26} strokeWidth={2.6} aria-hidden="true" /></span>
        <div className="mq-welcome-t"><span>أهلًا بك</span> <b data-noi18n="1">{name}</b></div>
      </div>
    </div>);
}
