/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useRef, useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { SIG_H, SIG_W, simplifySig } from '../../App.jsx';

export function HrSignPad({ onChange, disabled }) {
  const canvasRef = useRef(null);
  const strokes = useRef([]);   // مسارات مكتملة
  const cur = useRef(null);     // المسار الجاري
  const [, bump] = useState(0);
  const geom = () => {
    const c = canvasRef.current; const rect = c ? c.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
    return { rect, sx: rect.width ? SIG_W / rect.width : 1, sy: rect.height ? SIG_H / rect.height : 1 };
  };
  const redraw = () => {
    const c = canvasRef.current; if (!c) return;
    let ctx = null; try { ctx = c.getContext('2d'); } catch { ctx = null; }
    if (!ctx) return;   // بيئات بلا canvas (اختبارات) — المسارات تُسجَّل رغم ذلك
    const rect = c.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
    const cw = Math.max(1, Math.round((rect.width || SIG_W) * dpr)), ch = Math.max(1, Math.round((rect.height || SIG_H) * dpr));
    if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height);
    ctx.setTransform(c.width / SIG_W, 0, 0, c.height / SIG_H, 0, 0);
    ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(24, SIG_H - 34); ctx.lineTo(SIG_W - 24, SIG_H - 34); ctx.stroke(); ctx.restore();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1b2a6b'; ctx.lineWidth = 3;
    const all = cur.current ? [...strokes.current, cur.current] : strokes.current;
    all.forEach(pts => {
      if (pts.length < 2) return;
      ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
      if (pts.length < 4) ctx.lineTo(pts[0] + 0.5, pts[1]);
      for (let i = 2; i + 1 < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
      ctx.stroke();
    });
  };
  const pt = (e) => { const { rect, sx, sy } = geom(); return [((e.clientX || 0) - rect.left) * sx, ((e.clientY || 0) - rect.top) * sy]; };
  const emit = () => { const s = simplifySig(strokes.current); onChange && onChange(s.length ? { w: SIG_W, h: SIG_H, s } : null); };
  const down = (e) => {
    if (disabled) return;
    if (e.preventDefault) e.preventDefault();
    try { if (e.currentTarget && e.currentTarget.setPointerCapture && e.pointerId != null) e.currentTarget.setPointerCapture(e.pointerId); } catch { }
    cur.current = pt(e); redraw();
  };
  const move = (e) => { if (!cur.current) return; if (e.preventDefault) e.preventDefault(); cur.current.push(...pt(e)); redraw(); };
  const up = (e) => { if (!cur.current) return; if (e && e.preventDefault) e.preventDefault(); strokes.current.push(cur.current); cur.current = null; redraw(); emit(); bump(x => x + 1); };
  const clear = () => { strokes.current = []; cur.current = null; redraw(); emit(); bump(x => x + 1); };
  const undo = () => { strokes.current.pop(); redraw(); emit(); bump(x => x + 1); };
  useEffect(() => { redraw(); const h = () => redraw(); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h); }, []); // eslint-disable-line
  const n = strokes.current.length;
  return (
    <div>
      <canvas ref={canvasRef} data-testid="sigpad" aria-label="لوحة التوقيع"
        style={{ width: '100%', maxWidth: 520, aspectRatio: SIG_W + ' / ' + SIG_H, display: 'block', border: '1.5px dashed var(--brass)', borderRadius: 12, background: '#fff', touchAction: 'none', cursor: disabled ? 'not-allowed' : 'crosshair' }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} />
      <div className="row" style={{ gap: 6, marginTop: 6, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>{n ? n + ' خط' : 'وقّع بإصبعك أو بالقلم داخل الإطار'}</div>
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className="btn sm gh" disabled={!n} onClick={undo}>تراجع</button>
          <button type="button" className="btn sm gh" disabled={!n} onClick={clear}><Trash2 size={13} />مسح</button>
        </div>
      </div>
    </div>
  );
}
