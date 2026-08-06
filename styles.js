/* تنسيقات المنصة */
export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Readex+Pro:wght@300;400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

:root{
  /* ===== نظام التصميم الموحّد — الرموز (Design Tokens) ===== */
  /* الأسطح */
  --ink:#14110F; --ink2:#1C1815; --ink3:#241F1B; --line:#332C26;
  --txt:#EFE7DB; --dim:#A2968A; --faint:#6E635A;
  /* الهوية */
  --brass:#C8A24A; --brass-d:#8C6F2C; --brass-l:#E0C074; --note-bg:rgba(28,24,21,.94);
  --mint:#4FB286; --rose:#D9544D; --amber:#E0A458; --sky:#5B93C4; --violet:#9B7BB8;
  /* مقياس المسافات (8pt grid) */
  --s1:4px; --s2:8px; --s3:12px; --s4:16px; --s5:20px; --s6:24px; --s8:32px; --s10:40px;
  /* الاستدارة */
  --r-sm:8px; --r:11px; --r-md:14px; --r-lg:18px; --r-xl:22px; --r-full:999px;
  /* الظلال (عمق متدرّج) */
  --sh-1:0 1px 2px rgba(0,0,0,.24); --sh-2:0 2px 8px rgba(0,0,0,.28);
  --sh-3:0 6px 20px rgba(0,0,0,.34); --sh-4:0 14px 40px rgba(0,0,0,.42);
  --sh-brass:0 4px 16px rgba(200,162,74,.24);
  /* الحركة */
  --ease:cubic-bezier(.4,0,.2,1); --ease-out:cubic-bezier(.16,1,.3,1);
  --t-fast:.14s; --t:.22s; --t-slow:.32s;
  /* حلقة التركيز (وصول) */
  --ring:0 0 0 3px rgba(200,162,74,.35);
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;width:100%;max-width:100%;overflow-x:hidden;position:relative}
#root{width:100%;max-width:100vw;overflow-x:hidden}
.rms{
  direction:rtl; background:var(--ink); color:var(--txt); min-height:100vh;
  font-family:'IBM Plex Sans Arabic','Readex Pro',system-ui,sans-serif;
  font-size:14px; line-height:1.6; -webkit-font-smoothing:antialiased;
  overflow-x:hidden; max-width:100vw;
}
.rms *{max-width:100%}
.rms .num{max-width:none}
.rms h1,.rms h2,.rms h3,.rms h4{font-family:'Readex Pro','IBM Plex Sans Arabic',sans-serif;font-weight:600;margin:0;letter-spacing:-.01em}
.num{font-family:'IBM Plex Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums;direction:ltr;display:inline-block}
.rms button{font-family:inherit}

/* ---- تخطيط ---- */
.shell{display:flex;min-height:100vh;width:100%;max-width:100vw;overflow-x:hidden}
.side{
  width:250px;flex-shrink:0;background:var(--ink2);border-inline-start:1px solid var(--line);
  padding:18px 12px;display:flex;flex-direction:column;gap:4px;
  position:sticky;top:0;height:100vh;overflow-y:auto
}
.brand{display:flex;align-items:center;gap:10px;padding:6px 8px 18px}
.sideclose{display:none}
/* مؤشر حافة السحب لفتح القائمة (جوال فقط) */
.edgehint{display:none}
.brand-mark{
  width:36px;height:36px;border-radius:10px;flex-shrink:0;
  background:linear-gradient(145deg,var(--brass),var(--brass-d));
  display:grid;place-items:center;color:#1a1410;font-weight:700;
  font-family:'Readex Pro',sans-serif;box-shadow:0 2px 10px rgba(200,162,74,.25)
}
.brand-t{font-size:13.5px;font-weight:600;line-height:1.3;font-family:'Readex Pro',sans-serif}
.brand-s{font-size:10.5px;color:var(--faint);letter-spacing:.04em}
.nav-lbl{font-size:10px;color:var(--faint);padding:14px 10px 6px;letter-spacing:.12em}
.nav-i{
  display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--r-sm);
  color:var(--dim);cursor:pointer;border:1px solid transparent;font-size:13px;
  background:none;width:100%;text-align:start;transition:background var(--t-fast),color var(--t-fast),transform var(--t-fast);position:relative
}
.nav-i:hover{background:var(--ink3);color:var(--txt)}
.nav-i:active{transform:scale(.98)}
.nav-i.on{background:var(--ink3);color:var(--txt);border-color:var(--line);box-shadow:inset 3px 0 0 -1px var(--brass)}
.nav-i .cnt{margin-inline-start:auto;font-size:10.5px;background:var(--brass);color:#1a1410;
  border-radius:20px;padding:1px 7px;font-weight:700}
.main{flex:1;min-width:0;max-width:100%;display:flex;flex-direction:column;overflow-x:hidden}
.top{
  display:flex;align-items:center;gap:12px;padding:12px 20px;
  border-bottom:1px solid var(--line);background:rgba(20,17,15,.9);
  backdrop-filter:blur(10px);position:sticky;top:0;z-index:30;flex-wrap:wrap
}
.page{padding:20px;max-width:1500px;width:100%;overflow-x:hidden}
.hidden-desk{display:none}
@media(max-width:900px){
  /* ===== تخطيط تطبيق جوال: رأس ثابت + محتوى + شريط سفلي ثابت ===== */
  .shell{display:block;width:100%;max-width:100vw;overflow-x:hidden;min-height:100vh}
  .side{display:none !important}
  .main{display:block;width:100%;max-width:100vw;margin:0 !important;overflow-x:hidden}

  /* الرأس ثابت أعلى الشاشة */
  .top{position:sticky;top:0;padding:10px 12px;gap:6px;width:100%;max-width:100vw;overflow:hidden;flex-wrap:nowrap;z-index:30}
  .toptitle{font-size:14px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1 1 auto;font-weight:600}
  .topstatus{display:flex;align-items:center;gap:4px;flex:0 0 auto;min-width:0}
  .topstatus .badge{font-size:9px;padding:2px 6px}
  .topstatus .btn.sm{padding:6px 7px}
  .top .av,.avrow{display:none}
  .synctime .tt{display:none}
  .hidden-desk{display:none !important}

  /* المحتوى مع حشوة سفلية بحجم الشريط لئلا يُحجب آخره */
  .page{padding:14px;padding-bottom:96px;width:100%;max-width:100vw;overflow-x:hidden}

  .tick{display:none}
  .sideclose,.edgehint,.topmenu{display:none !important}
  .kpi-v{font-size:20px;overflow-wrap:anywhere}
  .g2,.g3,.g4{grid-template-columns:1fr}
}
}
}

.actbar{
  display:flex;align-items:center;gap:10px;
  background:linear-gradient(90deg,rgba(200,162,74,.16),rgba(200,162,74,.06));
  border-bottom:1px solid rgba(200,162,74,.35);
  color:var(--brass);padding:9px 20px;
  width:100%;max-width:100vw;overflow:hidden;box-sizing:border-box
}
.actbar-dot{
  width:8px;height:8px;border-radius:50%;background:var(--brass);flex-shrink:0;
  animation:pulse-dot 1.6s ease-in-out infinite
}
@keyframes pulse-dot{
  0%,100%{opacity:1;transform:scale(1)}
  50%{opacity:.4;transform:scale(1.4)}
}
@media(max-width:640px){.actbar{padding:8px 12px}.actbar .btn.sm{padding:5px 8px;font-size:11px}}

/* صفحة الأيقونات الكاملة (بديل القائمة على الجوال) */
.sheet-mask{position:fixed;inset:0;z-index:70;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;animation:fadein .2s}
@keyframes fadein{from{opacity:0}to{opacity:1}}
.sheet{width:100%;background:var(--ink2);border-radius:20px 20px 0 0;padding:8px 16px calc(20px + env(safe-area-inset-bottom));max-height:80vh;overflow-y:auto;animation:sheetup .25s cubic-bezier(.2,.8,.2,1)}
@keyframes sheetup{from{transform:translateY(100%)}to{transform:translateY(0)}}
.sheet-handle{width:40px;height:4px;border-radius:4px;background:var(--line);margin:6px auto 12px}
.sheet-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;font-size:14px;font-weight:600;font-family:'Readex Pro',sans-serif}
.iconsgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.icontile{display:flex;flex-direction:column;align-items:center;gap:8px;padding:14px 6px;border-radius:14px;border:1px solid var(--line);background:var(--ink);color:var(--dim);cursor:pointer;font-family:inherit;transition:.15s}
.icontile:active{transform:scale(.96)}
.icontile.on{background:var(--ink3);color:var(--brass);border-color:var(--brass-d)}
.icontile-i{position:relative;display:grid;place-items:center;width:46px;height:46px;border-radius:13px;background:var(--ink3)}
.icontile.on .icontile-i{background:linear-gradient(145deg,var(--brass),var(--brass-d));color:#1a1410}
.icontile span{font-size:11px;text-align:center;line-height:1.3}
.icontile-b{position:absolute;top:-4px;inset-inline-end:-4px;background:var(--rose);color:#fff;font-size:9px;font-weight:700;min-width:16px;height:16px;border-radius:20px;display:grid;place-items:center;padding:0 3px}

/* ===================== تحسينات الجوال ===================== */
@media(max-width:640px){
  /* ضمان التفاف الصفوف ومنع تجاوز الحقول ذات العرض الثابت */
  .card .row{flex-wrap:wrap}
  .card .row > *{min-width:0}
  .inp,.sel{max-width:100%}
  .page > *{max-width:100%}
  .card{max-width:100%;overflow-wrap:anywhere}
  .grid{max-width:100%}
  .kpi-v,.kpi-l,.kpi-s{max-width:100%;overflow:hidden;text-overflow:ellipsis}

  /* منع التكبير التلقائي عند التركيز على الحقول في iOS */
  .inp,.sel,textarea.inp{font-size:16px;padding:11px 12px}
  .note-i{font-size:16px}
  .pin input{font-size:20px}

  /* البطاقات والمسافات */
  .card{padding:13px;border-radius:12px}
  .kpi{padding:12px 13px}
  .kpi-v{font-size:20px}
  .modal-b{padding:14px}
  .modal-h,.modal-f{padding:12px 14px}
  .modal-f{flex-wrap:wrap}
  .modal-f .btn{flex:1;min-width:120px;justify-content:center}

  /* الأزرار أكبر للمس */
  .btn{padding:11px 15px;font-size:13px}
  .btn.sm{padding:8px 12px;font-size:12px}

  /* الرؤوس والصفوف تلتف */
  .card-h{gap:8px}
  .row{gap:8px}

  /* الجداول: تمرير أفقي داخلي دون دفع الصفحة */
  .tw{overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%;margin:0;padding:0}
  table.tb{min-width:520px}
  .tb th,.tb td{padding:9px 8px}

  /* الفئات النقدية: عمودان بدل ثلاثة */
  .notes{grid-template-columns:repeat(2,1fr);gap:8px}

  /* التذييل المتحرك يختفي (يزاحم الشريط السفلي) */
  .tick{display:none}

  /* بوابة الدخول */
  .gate{padding:14px;align-items:flex-start;padding-top:8vh}
  .gate-c{max-width:100%}

  /* شريط علوي: إخفاء صور المتصلين لتوفير مساحة */
  .top .av{display:none}

  /* النوافذ تملأ ارتفاعاً أكبر */
  .modal{max-height:94vh;border-radius:14px 14px 0 0;align-self:flex-end}
  .mask{align-items:flex-end;padding:0}

  /* صفوف قابلة للتمرير أفقياً (أزرار الخطوات والتبويبات) */
  .row.scroll-x{flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px}
  .row.scroll-x::-webkit-scrollbar{height:0}
  .row.scroll-x .btn{flex-shrink:0}
}

/* إزالة وميض اللمس الأزرق على كل الأزرار */
.rms button,.rms a,.rms .gate-u,.rms .nav-i,.rms .botnav-i{-webkit-tap-highlight-color:transparent}

/* شريط تنقّل سفلي للجوال */
.botnav{display:none}
@media(max-width:900px){
  .botnav{
    display:flex !important;position:fixed;inset-inline:0;bottom:0;z-index:50;
    background:var(--ink2);border-top:1px solid var(--line);
    padding:6px 4px calc(6px + env(safe-area-inset-bottom));
    justify-content:space-around;align-items:stretch;
    box-shadow:0 -8px 24px rgba(0,0,0,.35)
  }
  .botnav-i{
    display:flex;flex-direction:column;align-items:center;gap:3px;
    flex:1;padding:6px 2px;border:none;background:none;color:var(--faint);
    cursor:pointer;border-radius:9px;font-family:inherit;position:relative;transition:.15s
  }
  .botnav-i.on{color:var(--brass)}
  .botnav-i span{font-size:9.5px;line-height:1;font-weight:500}
  .botnav-i .bdg{
    position:absolute;top:2px;inset-inline-end:calc(50% - 20px);
    background:var(--rose);color:#fff;font-size:8px;font-weight:700;
    min-width:15px;height:15px;border-radius:20px;display:grid;place-items:center;padding:0 3px
  }
  .botnav-more{color:var(--dim)}
}

/* ---- عناصر ---- */
.card{background:var(--ink2);border:1px solid var(--line);border-radius:var(--r-md);padding:var(--s4);box-shadow:var(--sh-1);transition:box-shadow var(--t),border-color var(--t)}
.card:hover{box-shadow:var(--sh-2)}
.card-h{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;flex-wrap:wrap}
.card-t{font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px;font-family:'Readex Pro',sans-serif}
.grid{display:grid;gap:12px}
.g2{grid-template-columns:repeat(2,minmax(0,1fr))}
.g3{grid-template-columns:repeat(3,minmax(0,1fr))}
.g4{grid-template-columns:repeat(4,minmax(0,1fr))}
@media(max-width:1080px){.g4{grid-template-columns:repeat(2,minmax(0,1fr))}.g3{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:640px){.g2,.g3,.g4{grid-template-columns:1fr}}

.kpi{background:linear-gradient(160deg,var(--ink2),var(--ink3));border:1px solid var(--line);border-radius:var(--r-md);padding:var(--s4) var(--s4);position:relative;overflow:hidden;box-shadow:var(--sh-1);transition:transform var(--t) var(--ease-out),box-shadow var(--t)}
.kpi:hover{transform:translateY(-2px);box-shadow:var(--sh-3)}
.kpi::before{content:'';position:absolute;inset-block-start:0;inset-inline-start:0;width:3px;height:100%;background:var(--acc,var(--brass))}
.kpi::after{content:'';position:absolute;inset-block-start:-40%;inset-inline-end:-10%;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle,var(--acc,var(--brass)),transparent 70%);opacity:.06;pointer-events:none}
.kpi-l{font-size:11.5px;color:var(--dim);display:flex;align-items:center;gap:6px;font-weight:500}
.kpi-v{font-size:24px;font-weight:700;margin-top:8px;letter-spacing:-.02em;line-height:1.1}
.kpi-s{font-size:11px;color:var(--faint);margin-top:4px}

.btn{
  display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:10px 16px;border-radius:var(--r-sm);
  border:1px solid var(--line);background:var(--ink3);color:var(--txt);font-size:12.5px;
  cursor:pointer;font-weight:500;transition:transform var(--t-fast) var(--ease),background var(--t-fast),border-color var(--t-fast),box-shadow var(--t-fast);
  white-space:nowrap;box-shadow:var(--sh-1);-webkit-tap-highlight-color:transparent;user-select:none
}
.btn:hover:not(:disabled){border-color:var(--brass-d);background:#2E2823;box-shadow:var(--sh-2)}
.btn:active:not(:disabled){transform:translateY(1px) scale(.985);box-shadow:var(--sh-1)}
.btn:focus-visible{outline:none;box-shadow:var(--ring)}
.btn:disabled{opacity:.4;cursor:not-allowed;box-shadow:none}
.btn.pri{background:linear-gradient(145deg,var(--brass-l),var(--brass-d));color:#1a1410;border-color:transparent;font-weight:700;box-shadow:var(--sh-brass)}
.btn.pri:hover:not(:disabled){filter:brightness(1.06);box-shadow:0 6px 22px rgba(200,162,74,.34)}
.btn.ok{background:rgba(79,178,134,.14);border-color:rgba(79,178,134,.4);color:var(--mint)}
.btn.no{background:rgba(217,84,77,.13);border-color:rgba(217,84,77,.38);color:var(--rose)}
.btn.sm{padding:6px 10px;font-size:11.5px;border-radius:7px}
.btn.gh{background:transparent}

.inp,.sel{
  width:100%;padding:11px 13px;border-radius:var(--r-sm);background:var(--ink);
  border:1px solid var(--line);color:var(--txt);font-size:13px;font-family:inherit;outline:none;
  transition:border-color var(--t-fast),box-shadow var(--t-fast),background var(--t-fast)
}
.inp:hover,.sel:hover{border-color:var(--brass-d)}
.inp:focus,.sel:focus{border-color:var(--brass);box-shadow:var(--ring);background:var(--ink2)}
.inp::placeholder{color:var(--faint)}
.inp.n{font-family:'IBM Plex Mono',monospace;direction:ltr;text-align:end}
.lbl{display:block;font-size:11.5px;color:var(--dim);margin-bottom:5px}
.fld{margin-bottom:12px}
textarea.inp{resize:vertical;min-height:64px}

.badge{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;padding:3px 9px;border-radius:20px;border:1px solid;font-weight:600;white-space:nowrap}
.b-mint{color:var(--mint);border-color:rgba(79,178,134,.35);background:rgba(79,178,134,.1)}
.b-amber{color:var(--amber);border-color:rgba(224,164,88,.35);background:rgba(224,164,88,.1)}
.b-rose{color:var(--rose);border-color:rgba(217,84,77,.35);background:rgba(217,84,77,.1)}
.b-sky{color:var(--sky);border-color:rgba(91,147,196,.35);background:rgba(91,147,196,.1)}
.b-dim{color:var(--dim);border-color:var(--line);background:var(--ink3)}
.b-brass{color:var(--brass);border-color:rgba(200,162,74,.4);background:rgba(200,162,74,.1)}

.tw{overflow-x:auto;margin:0 -4px}
table.tb{width:100%;border-collapse:collapse;font-size:12.5px;min-width:520px}
.tb th{
  text-align:start;padding:9px 10px;color:var(--faint);font-weight:500;font-size:10.5px;
  letter-spacing:.06em;border-bottom:1px solid var(--line);white-space:nowrap
}
.tb td{padding:10px;border-bottom:1px solid rgba(51,44,38,.55);vertical-align:middle}
.tb tr:last-child td{border-bottom:none}
.tb tbody tr:hover{background:rgba(255,255,255,.018)}

.mask{position:fixed;inset:0;background:rgba(8,6,5,.78);backdrop-filter:blur(4px);z-index:80;
  display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto}
.modal{background:var(--ink2);border:1px solid var(--line);border-radius:16px;width:100%;max-width:640px;
  max-height:92vh;overflow-y:auto;box-shadow:0 30px 70px rgba(0,0,0,.55)}
.modal-h{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--ink2);z-index:2}
.modal-b{padding:18px}
.modal-f{display:flex;gap:9px;justify-content:flex-start;padding:14px 18px;border-top:1px solid var(--line);position:sticky;bottom:0;background:var(--ink2)}

/* ---- التوقيع البصري: شريط جرد الفئات النقدية ---- */
.notes{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
@media(min-width:700px){.notes{grid-template-columns:repeat(5,1fr)}}
.note{
  border-radius:11px;padding:9px 8px 8px;border:1px solid var(--line);
  background:linear-gradient(160deg,var(--nc) 0%,var(--note-bg) 62%);
  position:relative;overflow:hidden;transition:.18s
}
.note::before{
  content:'';position:absolute;inset-inline-end:-14px;inset-block-start:-14px;width:46px;height:46px;
  border-radius:50%;border:1px dashed rgba(255,255,255,.16)
}
.note:hover{transform:translateY(-2px);border-color:var(--nc)}
.note-v{font-size:12.5px;font-weight:700;font-family:'IBM Plex Mono',monospace;color:#fff;opacity:.95}
.note-u{font-size:9.5px;color:rgba(255,255,255,.6);margin-bottom:7px}
.note-r{display:flex;align-items:center;gap:5px}
.stp{width:24px;height:24px;border-radius:7px;border:1px solid rgba(255,255,255,.18);
  background:rgba(0,0,0,.35);color:#fff;display:grid;place-items:center;cursor:pointer;flex-shrink:0}
.stp:hover{background:rgba(0,0,0,.6)}
.note-i{
  flex:1;min-width:0;background:rgba(0,0,0,.42);border:1px solid rgba(255,255,255,.12);border-radius:7px;
  color:#fff;text-align:center;padding:4px 2px;font-family:'IBM Plex Mono',monospace;font-size:13px;outline:none
}
.note-t{font-size:10px;color:rgba(255,255,255,.55);text-align:center;margin-top:5px;font-family:'IBM Plex Mono',monospace}

.seal{
  border:2px solid var(--sc);color:var(--sc);border-radius:12px;padding:12px 16px;
  display:flex;align-items:center;gap:11px;transform:rotate(-1.2deg);
  background:rgba(0,0,0,.2);animation:stamp .38s cubic-bezier(.2,1.5,.4,1)
}
@keyframes stamp{0%{transform:scale(1.5) rotate(-10deg);opacity:0}100%{transform:scale(1) rotate(-1.2deg);opacity:1}}
@media(prefers-reduced-motion:reduce){.seal{animation:none}}

.dot{width:7px;height:7px;border-radius:50%;background:var(--mint);box-shadow:0 0 0 0 rgba(79,178,134,.6);animation:pulse 2.2s infinite}
@keyframes pulse{70%{box-shadow:0 0 0 7px rgba(79,178,134,0)}100%{box-shadow:0 0 0 0 rgba(79,178,134,0)}}
.av{width:27px;height:27px;border-radius:50%;display:grid;place-items:center;font-size:10.5px;
  font-weight:700;border:2px solid var(--ink2);margin-inline-start:-7px;color:#16120f;font-family:'Readex Pro',sans-serif}
.feed{display:flex;gap:10px;padding:9px 0;border-bottom:1px solid rgba(51,44,38,.5);font-size:12px}
.feed:last-child{border:none}
.feed-d{width:6px;height:6px;border-radius:50%;background:var(--brass);margin-top:7px;flex-shrink:0}
.hr{height:1px;background:var(--line);margin:14px 0;border:none}
.row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.mono-b{background:var(--ink);border:1px solid var(--line);border-radius:10px;padding:11px 13px;
  display:flex;justify-content:space-between;align-items:center;gap:10px}
.empty{text-align:center;padding:36px 16px;color:var(--faint);font-size:12.5px}
.tick{display:flex;gap:22px;overflow:hidden;white-space:nowrap;font-size:11.5px;color:var(--dim);
  border-top:1px solid var(--line);padding:8px 20px;background:var(--ink2)}


/* ===== لمسات نظام التصميم الختامية ===== */
/* شريط تمرير مخصّص */
*::-webkit-scrollbar{width:10px;height:10px}
*::-webkit-scrollbar-track{background:transparent}
*::-webkit-scrollbar-thumb{background:var(--line);border-radius:var(--r-full);border:2px solid var(--ink)}
*::-webkit-scrollbar-thumb:hover{background:var(--brass-d)}
*{scrollbar-width:thin;scrollbar-color:var(--line) transparent}
/* تحديد النص بلون الهوية */
::selection{background:rgba(200,162,74,.3);color:var(--txt)}
/* ظهور ناعم لمحتوى الصفحة عند التبديل */
.page > *{animation:pagein var(--t-slow) var(--ease-out) both}
@keyframes pagein{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
/* عناوين البطاقات أوضح */
.card-t{letter-spacing:-.01em}
/* حلقة تركيز عامة للوصول */
a:focus-visible,[role=button]:focus-visible,.nav-i:focus-visible,.botnav-i:focus-visible,.icontile:focus-visible{outline:none;box-shadow:var(--ring);border-radius:var(--r-sm)}
/* تعطيل الظهور المتحرك لمن يفضّل تقليل الحركة */
@media(prefers-reduced-motion:reduce){*{animation:none !important;transition-duration:.01ms !important}}

/* ---- السمة الفاتحة ---- */
.rms.lite{
  --ink:#F6F2E9; --ink2:#FFFDF8; --ink3:#EFE9DC; --line:#DDD4C4;
  --txt:#241F1A; --dim:#6C6155; --faint:#9A8E7F;
  --brass:#9A7620; --brass-d:#7A5C15; --brass-l:#B8942E; --mint:#2E8B62; --rose:#C0392B;
  --amber:#B57A1E; --sky:#3A6D9E; --violet:#7D5FA0; --note-bg:rgba(255,253,248,.93);
  /* ظلال أنعم تناسب الخلفية الفاتحة */
  --sh-1:0 1px 2px rgba(90,70,30,.10); --sh-2:0 2px 10px rgba(90,70,30,.12);
  --sh-3:0 6px 20px rgba(90,70,30,.15); --sh-4:0 14px 40px rgba(90,70,30,.18);
  --sh-brass:0 4px 16px rgba(154,118,32,.22);
  --ring:0 0 0 3px rgba(154,118,32,.28);
}
.rms.lite .top{background:rgba(255,253,248,.92)}
.rms.lite .note-v{color:#1B1712}
.rms.lite .note-u,.rms.lite .note-t{color:#5A5148}
.rms.lite .note-i{background:rgba(255,255,255,.85);color:#241F1A;border-color:rgba(0,0,0,.14)}
.rms.lite .stp{background:rgba(255,255,255,.75);color:#241F1A;border-color:rgba(0,0,0,.12)}
.rms.lite .btn.pri{color:#FFFDF8}
.rms.lite .brand-mark{color:#FFFDF8}
.rms.lite .av{color:#FFFDF8}
.rms.lite .gate{background:radial-gradient(1100px 560px at 80% -8%,rgba(154,118,32,.12),transparent 62%),var(--ink)}

/* ---- بوابة الدخول ---- */
.gate{min-height:100vh;display:grid;place-items:center;padding:20px;
  background:radial-gradient(1100px 560px at 80% -8%,rgba(200,162,74,.1),transparent 62%),var(--ink)}
.gate-c{width:100%;max-width:440px}
.gate-u{
  display:flex;align-items:center;gap:11px;padding:11px 13px;border-radius:11px;
  border:1px solid var(--line);background:var(--ink2);cursor:pointer;width:100%;text-align:start;
  transition:.15s;margin-bottom:8px;color:var(--txt)
}
.gate-u:hover{border-color:var(--brass-d);transform:translateX(-3px)}
.gate-u.on{border-color:var(--brass);background:var(--ink3)}
.pin{display:flex;gap:8px;justify-content:center;direction:ltr}
.pin input{width:46px;height:52px;text-align:center;font-size:20px;font-family:'IBM Plex Mono',monospace;
  background:var(--ink2);border:1px solid var(--line);border-radius:11px;color:var(--txt);outline:none}
.pin input:focus{border-color:var(--brass);box-shadow:0 0 0 3px rgba(200,162,74,.12)}
`;
