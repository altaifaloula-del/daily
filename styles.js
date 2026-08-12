/* تنسيقات المنصة */
export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Markazi+Text:wght@500;600;700&family=Tajawal:wght@300;400;500;700;900&family=IBM+Plex+Mono:wght@400;500;600&family=Cairo:wght@400;600;700&family=Almarai:wght@400;700;800&display=swap');

:root{
  /* ===== نظام التصميم الموحّد — الرموز (Design Tokens) ===== */
  /* الأسطح — v7.3 «النحاسي الملكي المطوَّر»: أعمق وأنقى */
  --ink:#1A1613; --ink2:#221D19; --ink3:#2A2420; --line:#3C352C;
  --txt:#F2EADD; --dim:#AE9F8F; --faint:#786B5E;
  /* حدود مذهّبة + إطار البوابة + تباين الأرقام */
  --line-g:#57492F; --frame:rgba(200,162,74,.5); --frame-o:rgba(200,162,74,.2);
  --num:#FBF5E9; --acc-soft:rgba(200,162,74,.13);
  /* الهوية */
  --brass:#C8A24A; --brass-d:#8C6F2C; --brass-l:#EBCB80; --note-bg:rgba(27,23,20,.94);
  --mint:#4FB286; --rose:#D9544D; --amber:#E0A458; --sky:#5B93C4; --violet:#9B7BB8;
  /* مقياس المسافات (8pt grid) */
  --s1:4px; --s2:8px; --s3:12px; --s4:16px; --s5:20px; --s6:24px; --s8:32px; --s10:40px;
  /* الاستدارة */
  --r-sm:8px; --r:11px; --r-md:14px; --r-lg:18px; --r-xl:22px; --r-full:999px;
  /* الظلال (عمق متدرّج) */
  --sh-1:0 1px 2px rgba(0,0,0,.24); --sh-2:0 2px 8px rgba(0,0,0,.28);
  --sh-3:0 6px 20px rgba(0,0,0,.34); --sh-4:0 14px 40px rgba(0,0,0,.42);
  --sh-brass:0 8px 20px -8px rgba(200,162,74,.55);
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
  font-family:var(--font-ui,'Tajawal',system-ui,-apple-system,'Segoe UI',sans-serif);
  font-size:14px; line-height:1.65; -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale;
  text-rendering:optimizeLegibility; font-feature-settings:'kern' 1;
  overflow-x:hidden; max-width:100vw;
}
/* ═══════════ محرّك الثيمات — ١١ ثيمًا ═══════════
   كل ثيم يحدّد لُبّ ألوانه فقط؛ والباقي (الحدود المذهّبة، الظلال، حلقة التركيز،
   تدرّجات الهوية) مشتقّ تلقائيًا عبر color-mix من --brass و--ink. */
.rms{
  --brass:var(--acc);
  --brass-d:color-mix(in srgb,var(--brass) 76%,#000);
  --brass-l:color-mix(in srgb,var(--brass) 70%,#fff);
  --line-g:color-mix(in srgb,var(--brass) 26%,var(--line));
  --num:var(--txt); --acc-soft:color-mix(in srgb,var(--brass) 11%,transparent);
  --frame:color-mix(in srgb,var(--brass) 45%,transparent); --frame-o:color-mix(in srgb,var(--brass) 17%,transparent);
  --note-bg:color-mix(in srgb,var(--ink2) 95%,transparent);
  --sh-brass:0 8px 22px -8px color-mix(in srgb,var(--brass) 42%,transparent);
  --ring:0 0 0 3px color-mix(in srgb,var(--brass) 30%,transparent);
}
/* ── الوضع النهاري (فاتح) ── */
.rms.mode-light{
  --ink:#F4F3F0;--ink2:#FFFFFF;--ink3:#ECEAE4;--line:#E4E0D8;--txt:#262320;--dim:#68625A;--faint:#9A948B;
  --mint:#2F9469;--rose:#C63D34;--amber:#B27A1C;--sky:#3E71A6;--violet:#7E5FA6;
  --sh-1:0 1px 2px rgba(45,35,18,.05);--sh-2:0 3px 12px rgba(45,35,18,.08);--sh-3:0 8px 24px rgba(45,35,18,.11);--sh-4:0 16px 44px rgba(45,35,18,.15)
}
/* ── الوضع الليلي (داكن) ── */
.rms.mode-dark{
  --ink:#1A1714;--ink2:#221F1B;--ink3:#2A2621;--line:#3A352E;--txt:#EFEAE2;--dim:#AAA298;--faint:#776F64;
  --mint:#4FB286;--rose:#DA5A53;--amber:#E0A458;--sky:#5B93C4;--violet:#9B7BB8;
  --sh-1:0 1px 2px rgba(0,0,0,.24);--sh-2:0 2px 9px rgba(0,0,0,.30);--sh-3:0 6px 20px rgba(0,0,0,.36);--sh-4:0 14px 40px rgba(0,0,0,.44)
}
/* ══════════════ ١١ هوية تصميم كاملة (ثيمات) — v14.7 ══════════════
   كل ثيم يغيّر كل تفصيلة: لون الهوية + الزوايا + الظلال/الضبابية
   + شكل الأيقونة وحاويتها وسماكتها + نمط الخلفية + أسلوب الأزرار
   وبار البحث والحقول ومربّع الاختيار + الخط. الألوان الدلالية
   والتدرّجات تُشتقّ تلقائيًا من --acc (كتلة الاشتقاق أعلاه). */

/* مستهلِكات مشتركة تقودها متغيّرات كل ثيم (شكل + سماكة الأيقونة + مربّع الاختيار) */
.rms input[type=checkbox],.rms input[type=radio]{accent-color:var(--brass);width:16px;height:16px;cursor:pointer}
.rms .lh-box svg,.rms .appc-ic svg,.rms .abar-ic svg,.rms .esec-ic svg,.rms .appperm .ic svg,.rms .homebtn2 svg{stroke-width:var(--ico-sw,2)}
.rms .lh-box{border-radius:var(--ico-r,22px)}
.rms .tk{border-radius:var(--tk-r,6px)}

/* ── 1) الملكي الذهبي — فخم دافئ · أيقونة مربّعة مذهّبة · خط رقعة ── */
.rms.thm-royal{--acc:#A87D28;--r-sm:9px;--r:12px;--r-md:16px;--r-lg:20px;--r-xl:24px;--ico-r:20px;--ico-sw:2;--tk-r:6px;--font-head:'Markazi Text',serif;--font-ui:'Tajawal',sans-serif}
.rms.thm-royal .lh-box{background:linear-gradient(150deg,color-mix(in srgb,var(--c) 20%,var(--ink2)),var(--ink3));border:1px solid color-mix(in srgb,var(--brass) 42%,var(--line-g));box-shadow:0 7px 20px -9px color-mix(in srgb,var(--brass) 50%,transparent),inset 0 1px 0 color-mix(in srgb,#fff 16%,transparent)}
.rms.thm-royal .lh-bg::before{background:radial-gradient(900px 560px at 82% -8%,color-mix(in srgb,var(--brass) 16%,transparent),transparent 60%),radial-gradient(760px 520px at 6% 110%,color-mix(in srgb,var(--brass) 10%,transparent),transparent 55%)}
.rms.thm-royal .lh-bg::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(135deg,color-mix(in srgb,var(--brass) 5%,transparent) 0 2px,transparent 2px 22px);opacity:.5}

/* ── 2) الزجاجي الشفّاف — بطاقات ضبابية · أيقونة دائرية زجاجية · أزرار وحقول حبّة ── */
.rms.thm-glass{--acc:#2E7CC4;--r-sm:12px;--r:14px;--r-md:18px;--r-lg:22px;--r-xl:26px;--ico-r:50%;--ico-sw:1.75;--tk-r:50%;--font-head:'Cairo',sans-serif;--font-ui:'Tajawal',sans-serif}
.rms.thm-glass .card,.rms.thm-glass .kpi{background:color-mix(in srgb,var(--ink2) 66%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-color:color-mix(in srgb,#fff 14%,var(--line))}
.rms.thm-glass .lh-box{background:color-mix(in srgb,var(--ink2) 52%,transparent);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);border:1px solid color-mix(in srgb,#fff 24%,var(--line));box-shadow:0 8px 24px -12px color-mix(in srgb,var(--acc) 42%,transparent),inset 0 1px 0 color-mix(in srgb,#fff 26%,transparent)}
.rms.thm-glass .btn,.rms.thm-glass .inp,.rms.thm-glass .sel{border-radius:999px}
.rms.thm-glass .btn{background:color-mix(in srgb,var(--ink2) 58%,transparent);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.rms.thm-glass .lh-search .inp{background:color-mix(in srgb,var(--ink2) 52%,transparent);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.rms.thm-glass .lh-bg::before{background:radial-gradient(720px 520px at 14% 0%,color-mix(in srgb,#2E7CC4 24%,transparent),transparent 60%),radial-gradient(680px 520px at 90% 18%,color-mix(in srgb,#33BEC4 18%,transparent),transparent 60%),radial-gradient(740px 560px at 60% 110%,color-mix(in srgb,#6E7CF0 16%,transparent),transparent 60%)}

/* ── 3) النقي المسطّح — بلا ظلال ولا حاوية أيقونة · حقول بخطّ سفلي · خط سانس ── */
.rms.thm-minimal{--acc:#46525E;--r-sm:5px;--r:6px;--r-md:8px;--r-lg:10px;--r-xl:12px;--ico-r:12px;--ico-sw:1.5;--tk-r:3px;--font-head:'Tajawal',sans-serif;--font-ui:'Tajawal',sans-serif}
.rms.thm-minimal .card,.rms.thm-minimal .kpi{box-shadow:none;border:1px solid var(--line);background:var(--ink2)}
.rms.thm-minimal .card:hover,.rms.thm-minimal .kpi:hover{box-shadow:none;transform:none;border-color:var(--line-g)}
.rms.thm-minimal .kpi::after{display:none}
.rms.thm-minimal .kpi::before{width:2px}
.rms.thm-minimal .lh-box{box-shadow:none;background:transparent;border:none}
.rms.thm-minimal .lh-tile:hover{transform:none;background:var(--acc-soft)}
.rms.thm-minimal .btn{box-shadow:none;background:transparent;border:1px solid var(--line)}
.rms.thm-minimal .btn:hover:not(:disabled){box-shadow:none;background:var(--acc-soft);border-color:var(--line-g)}
.rms.thm-minimal .btn.pri{background:var(--brass);background-image:none;color:#fff;box-shadow:none}
.rms.thm-minimal .inp,.rms.thm-minimal .sel{background:transparent;border:none;border-bottom:1.5px solid var(--line);border-radius:0;padding-inline:2px}
.rms.thm-minimal .inp:focus,.rms.thm-minimal .sel:focus{box-shadow:none;background:transparent;border-bottom-color:var(--brass)}
.rms.thm-minimal .lh-search .inp{border:1px solid var(--line);border-radius:8px;padding-inline-start:34px}
.rms.thm-minimal .lh-bg::before{background:none}

/* ── 4) المرتفع الفاخر — أيقونات ممتلئة ملوّنة · ظلال قوية · خط عريض ── */
.rms.thm-elevated{--acc:#6A44A8;--r-sm:12px;--r:14px;--r-md:18px;--r-lg:24px;--r-xl:28px;--ico-r:26px;--ico-sw:2.25;--tk-r:8px;--font-head:'Cairo',sans-serif;--font-ui:'Tajawal',sans-serif}
.rms.thm-elevated .card,.rms.thm-elevated .kpi{box-shadow:var(--sh-3);border-color:transparent}
.rms.thm-elevated .card:hover,.rms.thm-elevated .kpi:hover{box-shadow:var(--sh-4);transform:translateY(-3px)}
.rms.thm-elevated .lh-box{background:linear-gradient(145deg,var(--c),color-mix(in srgb,var(--c) 52%,#000));color:#fff;border:none;box-shadow:0 12px 26px -10px color-mix(in srgb,var(--c) 70%,transparent),0 3px 8px rgba(0,0,0,.2)}
.rms.thm-elevated .lh-tile:hover{transform:translateY(-6px)}
.rms.thm-elevated .lh-tile:hover .lh-box{box-shadow:0 18px 34px -12px color-mix(in srgb,var(--c) 80%,transparent)}
.rms.thm-elevated .btn{box-shadow:var(--sh-2)}
.rms.thm-elevated .inp,.rms.thm-elevated .sel{background:var(--ink3);border-color:transparent;box-shadow:inset 0 1px 3px rgba(0,0,0,.12)}
.rms.thm-elevated .lh-bg::before{background:radial-gradient(760px 560px at 12% -6%,color-mix(in srgb,#6A44A8 22%,transparent),transparent 60%),radial-gradient(720px 560px at 90% 110%,color-mix(in srgb,#B06AC8 16%,transparent),transparent 60%)}

/* ── 5) المؤسسي الحادّ — زوايا حادّة · أيقونة مربّعة محدّدة · خلفية شبكية ── */
.rms.thm-corporate{--acc:#33459C;--r-sm:3px;--r:4px;--r-md:5px;--r-lg:7px;--r-xl:8px;--ico-r:5px;--ico-sw:2;--tk-r:2px;--font-head:'Almarai',sans-serif;--font-ui:'Tajawal',sans-serif}
.rms.thm-corporate .card,.rms.thm-corporate .kpi{border:1px solid var(--line-g);box-shadow:var(--sh-1)}
.rms.thm-corporate .lh-box{background:var(--ink2);border:1.5px solid var(--line-g);box-shadow:none}
.rms.thm-corporate .lh-tile:hover{transform:none;background:var(--acc-soft)}
.rms.thm-corporate .lh-tile:hover .lh-box{border-color:var(--brass)}
.rms.thm-corporate .btn{box-shadow:none;border-width:1.5px}
.rms.thm-corporate .btn.pri{background:var(--brass);background-image:none;color:#fff}
.rms.thm-corporate .lh-bg::before{background:radial-gradient(900px 600px at 100% -10%,color-mix(in srgb,var(--brass) 10%,transparent),transparent 55%)}
.rms.thm-corporate .lh-bg::after{content:'';position:absolute;inset:0;background:linear-gradient(color-mix(in srgb,var(--line) 55%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--line) 55%,transparent) 1px,transparent 1px);background-size:44px 44px;opacity:.35}

/* ── 6) الأخضر السعودي — هوية وطنية · نمط شيفرون · خط كوفي ── */
.rms.thm-saudi{--acc:#0F7A3D;--r-sm:8px;--r:11px;--r-md:15px;--r-lg:18px;--r-xl:22px;--ico-r:16px;--ico-sw:2;--tk-r:6px;--font-head:'Markazi Text',serif;--font-ui:'Tajawal',sans-serif}
.rms.thm-saudi .lh-box{background:linear-gradient(150deg,color-mix(in srgb,var(--c) 16%,var(--ink2)),var(--ink3));border:1px solid color-mix(in srgb,var(--acc) 34%,var(--line-g))}
.rms.thm-saudi .lh-bg::before{background:radial-gradient(880px 560px at 82% -8%,color-mix(in srgb,#0F7A3D 14%,transparent),transparent 60%),radial-gradient(760px 520px at 6% 110%,color-mix(in srgb,#0F7A3D 9%,transparent),transparent 55%)}
.rms.thm-saudi .lh-bg::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(45deg,color-mix(in srgb,#0F7A3D 5%,transparent) 0 3px,transparent 3px 18px);opacity:.5}

/* ── 7) النيون الليلي — سايبر متوهّج · أيقونة بحوافّ نيون · شبكة + كتل ── */
.rms.thm-neon{--acc:#16C8E6;--r-sm:9px;--r:12px;--r-md:15px;--r-lg:19px;--r-xl:24px;--ico-r:16px;--ico-sw:2;--tk-r:5px;--font-head:'Cairo',sans-serif;--font-ui:'Tajawal',sans-serif}
.rms.mode-dark.thm-neon{--ink:#07070F;--ink2:#0E0E1A;--ink3:#161626;--line:#242438;--txt:#E7F4FF;--dim:#9AA6C8;--faint:#5A6488}
.rms.mode-light.thm-neon{--ink:#EAF0FF;--ink2:#FFFFFF;--ink3:#E2E9FB;--line:#CBD6F2;--txt:#0E1230;--dim:#4A5480;--faint:#8A93B8}
.rms.thm-neon .lh-box{background:color-mix(in srgb,var(--c) 12%,var(--ink2));border:1.5px solid color-mix(in srgb,var(--c) 60%,transparent);box-shadow:0 0 0 1px color-mix(in srgb,var(--c) 28%,transparent),0 0 18px -2px color-mix(in srgb,var(--c) 52%,transparent),inset 0 0 14px -6px color-mix(in srgb,var(--c) 60%,transparent)}
.rms.thm-neon .lh-tile:hover{transform:translateY(-3px)}
.rms.thm-neon .lh-tile:hover .lh-box{box-shadow:0 0 0 1px var(--c),0 0 26px 0 color-mix(in srgb,var(--c) 62%,transparent)}
.rms.thm-neon .btn{border-color:color-mix(in srgb,var(--acc) 30%,var(--line))}
.rms.thm-neon .btn.pri{box-shadow:0 0 18px -4px color-mix(in srgb,var(--acc) 72%,transparent)}
.rms.thm-neon .inp:focus,.rms.thm-neon .sel:focus{box-shadow:0 0 0 3px color-mix(in srgb,var(--acc) 26%,transparent),0 0 16px -4px color-mix(in srgb,var(--acc) 52%,transparent)}
.rms.thm-neon .lh-bg::before{background:radial-gradient(720px 540px at 12% 0%,color-mix(in srgb,#16C8E6 26%,transparent),transparent 58%),radial-gradient(680px 520px at 92% 12%,color-mix(in srgb,#E838B0 22%,transparent),transparent 58%),radial-gradient(720px 560px at 60% 110%,color-mix(in srgb,#7C4DFF 20%,transparent),transparent 60%)}
.rms.thm-neon .lh-bg::after{content:'';position:absolute;inset:0;background:linear-gradient(color-mix(in srgb,var(--acc) 8%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--acc) 8%,transparent) 1px,transparent 1px);background-size:38px 38px;opacity:.5}

/* ── 8) الترابي الصحراوي — دافئ عضوي · أيقونة دائرية طينية · زوايا كبيرة ── */
.rms.thm-desert{--acc:#B4622F;--r-sm:14px;--r:18px;--r-md:22px;--r-lg:28px;--r-xl:34px;--ico-r:50%;--ico-sw:2;--tk-r:10px;--font-head:'Markazi Text',serif;--font-ui:'Tajawal',sans-serif}
.rms.mode-light.thm-desert{--ink:#F3EADB;--ink2:#FFFBF3;--ink3:#EDE0CC;--line:#E0CFB4;--txt:#3A2A1C;--dim:#7A6650;--faint:#A6906F}
.rms.mode-dark.thm-desert{--ink:#1C1611;--ink2:#241C15;--ink3:#2E241B;--line:#3E3020;--txt:#F0E4D2;--dim:#B6A188;--faint:#7E6B54}
.rms.thm-desert .lh-box{background:radial-gradient(circle at 35% 28%,color-mix(in srgb,var(--c) 26%,var(--ink2)),var(--ink3));border:1px solid color-mix(in srgb,var(--c) 30%,var(--line));box-shadow:0 8px 20px -10px color-mix(in srgb,var(--c) 45%,transparent)}
.rms.thm-desert .btn,.rms.thm-desert .inp,.rms.thm-desert .sel{border-radius:16px}
.rms.thm-desert .lh-search .inp{border-radius:999px}
.rms.thm-desert .lh-bg::before{background:radial-gradient(900px 620px at 80% -10%,color-mix(in srgb,#D98A45 20%,transparent),transparent 60%),radial-gradient(820px 560px at 8% 112%,color-mix(in srgb,#B4622F 14%,transparent),transparent 58%),linear-gradient(180deg,transparent 58%,color-mix(in srgb,#C9915A 12%,transparent))}

/* ── 9) الباستيل الهادئ — ناعم لطيف · أيقونة دائرية باستيل · أزرار حبّة ── */
.rms.thm-pastel{--acc:#D96FA6;--r-sm:14px;--r:18px;--r-md:22px;--r-lg:28px;--r-xl:34px;--ico-r:50%;--ico-sw:1.75;--tk-r:50%;--font-head:'Cairo',sans-serif;--font-ui:'Tajawal',sans-serif}
.rms.mode-light.thm-pastel{--ink:#FBF6FB;--ink2:#FFFFFF;--ink3:#F5EDF6;--line:#EEDDED;--txt:#3B2E3A;--dim:#8A7A88;--faint:#B6A6B4}
.rms.mode-dark.thm-pastel{--ink:#1A151C;--ink2:#221C25;--ink3:#2B2330;--line:#3A3040;--txt:#F0E7F2;--dim:#B7A6BC;--faint:#83718A}
.rms.thm-pastel .card,.rms.thm-pastel .kpi{box-shadow:0 8px 22px -14px color-mix(in srgb,var(--acc) 45%,transparent)}
.rms.thm-pastel .lh-box{background:color-mix(in srgb,var(--c) 18%,var(--ink2));border:1px solid color-mix(in srgb,var(--c) 22%,transparent);box-shadow:0 8px 20px -12px color-mix(in srgb,var(--c) 50%,transparent)}
.rms.thm-pastel .btn,.rms.thm-pastel .inp,.rms.thm-pastel .sel{border-radius:999px}
.rms.thm-pastel .lh-bg::before{background:radial-gradient(680px 520px at 12% 0%,color-mix(in srgb,#F2A6C8 34%,transparent),transparent 60%),radial-gradient(660px 520px at 90% 14%,color-mix(in srgb,#B6A6F0 30%,transparent),transparent 60%),radial-gradient(700px 560px at 58% 110%,color-mix(in srgb,#A6E6D0 26%,transparent),transparent 60%)}

/* ── 10) الورقي الكلاسيكي — دفتر أستاذ · أيقونة مربّعة مفرّغة · حقول مسطّرة · خط نسخ ── */
.rms.thm-paper{--acc:#A6321F;--r-sm:4px;--r:5px;--r-md:6px;--r-lg:8px;--r-xl:10px;--ico-r:6px;--ico-sw:1.75;--tk-r:2px;--font-head:'Markazi Text',serif;--font-ui:'Tajawal',sans-serif}
.rms.mode-light.thm-paper{--ink:#F4EFE3;--ink2:#FCF8EE;--ink3:#EDE5D3;--line:#DDD2BB;--txt:#2A2420;--dim:#6B6152;--faint:#9A8E78}
.rms.mode-dark.thm-paper{--ink:#171310;--ink2:#1F1A15;--ink3:#28221B;--line:#3A3225;--txt:#EDE4D2;--dim:#B3A588;--faint:#7C6E58}
.rms.thm-paper .card,.rms.thm-paper .kpi{box-shadow:none;border:1px solid var(--line-g);outline:1px solid color-mix(in srgb,var(--line) 60%,transparent);outline-offset:3px}
.rms.thm-paper .lh-box{background:transparent;border:1.5px solid var(--line-g);box-shadow:none}
.rms.thm-paper .lh-tile:hover{transform:none;background:var(--acc-soft)}
.rms.thm-paper .btn{box-shadow:none}
.rms.thm-paper .btn.pri{background:var(--brass);background-image:none;color:#fff}
.rms.thm-paper .inp,.rms.thm-paper .sel{background:transparent;border:none;border-bottom:1.5px solid var(--line-g);border-radius:0}
.rms.thm-paper .inp:focus,.rms.thm-paper .sel:focus{box-shadow:none;background:transparent;border-bottom-color:var(--brass)}
.rms.thm-paper .lh-search .inp{border:1.5px solid var(--line-g);border-radius:6px;padding-inline-start:34px}
.rms.thm-paper .lh-bg::before{background:none}
.rms.thm-paper .lh-bg::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent 0 27px,color-mix(in srgb,var(--line) 55%,transparent) 27px 28px);opacity:.6}

/* ── 11) الصناعي الفحمي — لوحة تقنية · أيقونة مقصوصة الزاوية · خلفية تظليل · نبرة أمبر ── */
.rms.thm-carbon{--acc:#F59E0B;--r-sm:5px;--r:6px;--r-md:7px;--r-lg:9px;--r-xl:11px;--ico-r:7px;--ico-sw:2;--tk-r:3px;--font-head:'Almarai',sans-serif;--font-ui:'Tajawal',sans-serif}
.rms.mode-dark.thm-carbon{--ink:#111318;--ink2:#181B22;--ink3:#20242D;--line:#2E3440;--txt:#E7ECF3;--dim:#9AA6B8;--faint:#5E6878}
.rms.mode-light.thm-carbon{--ink:#EDF0F4;--ink2:#FFFFFF;--ink3:#E3E8EF;--line:#CDD5E0;--txt:#1A2130;--dim:#4E5866;--faint:#8792A3}
.rms.thm-carbon .lh-box{background:var(--ink3);border:1px solid color-mix(in srgb,var(--acc) 28%,var(--line));box-shadow:none;clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))}
.rms.thm-carbon .lh-tile:hover{transform:none}
.rms.thm-carbon .lh-tile:hover .lh-box{border-color:var(--acc);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--acc) 40%,transparent)}
.rms.thm-carbon .btn{box-shadow:none}
.rms.thm-carbon .btn.pri{background:var(--brass);background-image:none;color:#14110a}
.rms.thm-carbon .inp,.rms.thm-carbon .sel{background:var(--ink3)}
.rms.thm-carbon .lh-bg::before{background:radial-gradient(880px 580px at 90% -8%,color-mix(in srgb,var(--acc) 12%,transparent),transparent 55%)}
.rms.thm-carbon .lh-bg::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(45deg,color-mix(in srgb,var(--line) 40%,transparent) 0 1px,transparent 1px 9px);opacity:.5}
.rms *{max-width:100%}
.rms .num{max-width:none}
.rms h1,.rms h2,.rms h3,.rms h4{font-family:var(--font-head,'Markazi Text',serif);font-weight:700;margin:0;letter-spacing:0;line-height:1.25}
.num{font-family:'IBM Plex Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums;direction:ltr;display:inline-block}
.rms button{font-family:inherit}

/* ---- تخطيط ---- */
.shell{display:flex;height:100vh;width:100%;max-width:100vw;overflow:hidden}
.side{
  width:250px;flex-shrink:0;background:var(--ink2);border-inline-start:1px solid var(--line);
  padding:18px 12px;display:flex;flex-direction:column;gap:4px;
  height:100vh;overflow-y:auto
}
.brand{display:flex;align-items:center;gap:10px;padding:6px 8px 18px}
.sideclose{display:none}
/* مؤشر حافة السحب لفتح القائمة (جوال فقط) */
.edgehint{display:none}
.brand-mark{
  width:36px;height:36px;border-radius:10px;flex-shrink:0;
  background:linear-gradient(140deg,var(--brass-l),var(--brass));
  display:grid;place-items:center;color:#1a1410;font-weight:700;
  font-family:var(--font-head,'Markazi Text',serif);box-shadow:0 2px 12px rgba(200,162,74,.3)
}
.brand-logo{width:38px;height:38px;border-radius:10px;flex-shrink:0;object-fit:cover;border:1px solid var(--line);background:var(--ink3)}
.brand-t{font-size:17px;font-weight:700;line-height:1.25;font-family:var(--font-head,'Markazi Text',serif)}
.brand-s{font-size:10.5px;color:var(--faint);letter-spacing:.04em}
.nav-lbl{font-size:10px;color:var(--faint);padding:14px 10px 6px;letter-spacing:.12em}
.nav-i{
  display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--r-sm);
  color:var(--dim);cursor:pointer;border:1px solid transparent;font-size:13px;
  background:none;width:100%;text-align:start;transition:background var(--t-fast),color var(--t-fast),transform var(--t-fast);position:relative
}
.nav-i:hover{background:var(--ink3);color:var(--txt)}
.nav-i:active{transform:scale(.98)}
.nav-i.on{background:var(--acc-soft);color:var(--txt);border-color:transparent;box-shadow:inset 3px 0 0 -1px var(--brass);font-weight:700}
.nav-i .cnt{margin-inline-start:auto;font-size:10.5px;background:var(--brass);color:#1a1410;
  border-radius:20px;padding:1px 7px;font-weight:700}
.main{flex:1;min-width:0;max-width:100%;display:flex;flex-direction:column;min-height:0;overflow:hidden}
.top{
  display:flex;align-items:center;gap:12px;padding:12px 22px;flex-shrink:0;
  border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--ink2) 88%,transparent);
  backdrop-filter:blur(10px);z-index:30;flex-wrap:wrap
}
.top .toptitle{font-size:21px;font-weight:800;font-family:var(--font-head,'Markazi Text',serif);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:42vw;margin:0;letter-spacing:.2px}
.topstatus{display:flex;align-items:center;gap:8px;margin-inline-start:auto;flex:0 0 auto}
.topstatus .btn.sm.gh{width:36px;height:36px;padding:0;display:inline-grid;place-items:center;border-radius:10px}
.topstatus .synctime{width:auto !important;padding:0 10px !important;gap:5px}
.topstatus .livebadge{padding:5px 10px;border-radius:999px;font-weight:600}
.page{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:24px;width:100%}
.page-inner{max-width:1500px;margin:0 auto;width:100%}
.hidden-desk{display:none}
/* ═══════════════════════════════════════════════════════
   التصميم المتجاوب — كتلة موحّدة واحدة (جوال ولوحي)
   معمار: رأس ثابت + محتوى ينساب + شريط أيقونات دائم
   ═══════════════════════════════════════════════════════ */
@media(max-width:900px){
  /* ---- الهيكل: عمود بارتفاع الشاشة المقفل (App Shell) ---- */
  html,body{overflow:hidden;height:100%}
  #root{height:100dvh;height:100vh}
  .shell{display:flex;flex-direction:column;height:100dvh;height:100vh;width:100%;max-width:100vw;overflow:hidden}
  .side{display:none !important}
  .main{display:flex;flex-direction:column;flex:1;min-height:0;width:100%;max-width:100vw;margin:0 !important;overflow:hidden}

  /* ---- الرأس الثابت أعلى القشرة ---- */
  .top{flex-shrink:0;padding:10px 12px;gap:6px;width:100%;max-width:100vw;overflow:hidden;flex-wrap:nowrap;z-index:30}
  .toptitle{font-size:19px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1 1 auto;font-weight:700;font-family:var(--font-head,'Markazi Text',serif)}
  .topstatus{display:flex;align-items:center;gap:4px;flex:0 1 auto;min-width:0}
  .topstatus .badge{font-size:9px;padding:2px 6px}
  .topstatus .btn.sm{padding:6px 7px}
  .top .av,.avrow{display:none}
  .synctime .tt{display:none}
  /* v15.7: تخفيف ازدحام رأس الجوال حتى تظهر «قائمة الحساب» (فيها تسجيل الخروج) بلا اقتصاص */
  .topstatus .livebadge,.topstatus .synctime,.topstatus .themebtn{display:none !important}
  .usermenu{flex-shrink:0}
  .hidden-desk{display:none !important}
  .sideclose,.edgehint,.topmenu{display:none !important}

  /* ---- منطقة المحتوى (الوحيدة التي تتمرّر) ---- */
  .page{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:14px;padding-bottom:20px;width:100%;max-width:100vw;overflow-x:hidden}
  .page-inner{max-width:100%}
  .page > *{max-width:100%}
  .tick{display:none}

  /* ---- الشريط السفلي الثابت ---- */
  .botnav{
    display:flex !important;flex-shrink:0;z-index:50;
    background:var(--ink2);border-top:1px solid var(--line);
    padding:6px 4px calc(6px + env(safe-area-inset-bottom));
    justify-content:space-around;align-items:stretch;box-shadow:0 -8px 24px rgba(0,0,0,.35)
  }
  .botnav-i{display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;padding:6px 2px;border:none;background:none;color:var(--faint);cursor:pointer;border-radius:9px;font-family:inherit;position:relative;transition:.15s}
  .botnav-i.on{color:var(--brass)}
  .botnav-i span{font-size:9.5px;line-height:1;font-weight:500}
  .botnav-i .bdg{position:absolute;top:2px;inset-inline-end:calc(50% - 20px);background:var(--rose);color:#fff;font-size:8px;font-weight:700;min-width:15px;height:15px;border-radius:20px;display:grid;place-items:center;padding:0 3px}
  .botnav-more{color:var(--dim)}

  /* رأس الصفحة على الجوال: العنوان ثم زر كامل العرض */
  .pagehead{flex-direction:column;align-items:stretch;gap:10px}
  .newclosing-btn{width:100%;padding:13px;font-size:14px}

  /* ---- البطاقات والشبكات ---- */
  .card{max-width:100%;overflow-wrap:anywhere}
  .grid,.g2,.g3,.g4{max-width:100%}
  .card .row{flex-wrap:wrap}
  .card .row > *{min-width:0}
}

/* ---- شاشات الجوال الأصغر (≤640) ---- */
@media(max-width:640px){
  .g2,.g3,.g4{grid-template-columns:1fr !important}

  /* الحقول: 16px لمنع تكبير iOS التلقائي */
  .inp,.sel,textarea.inp{font-size:16px;padding:11px 12px;max-width:100%}
  .note-i{font-size:16px}
  .pin input{font-size:20px}

  /* المسافات المضغوطة */
  .card{padding:13px;border-radius:12px}
  .kpi{padding:12px 13px}
  .kpi-v{font-size:20px}

  /* الأزرار أكبر للمس */
  .btn{padding:11px 15px;font-size:13px}
  .btn.sm{padding:8px 12px;font-size:12px}
  .card-h,.row{gap:8px}

  /* الجداول: تمرير داخلي دون دفع الصفحة */
  .tw{overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%;margin:0;padding:0}
  table.tb{min-width:520px}
  .tb th,.tb td{padding:9px 8px}

  /* صفوف تطبيقات التوصيل: تلتف بأناقة */
  .mono-b{flex-wrap:wrap}
  .mono-b > div:first-child{flex:1 1 100%;margin-bottom:4px}
  .mono-b .inp.n{flex:1;max-width:none !important}

  /* الفئات النقدية والملاحظات */
  .notes{grid-template-columns:repeat(2,1fr);gap:8px}

  /* النافذة على الجوال: كاملة العرض، تنمو بطول محتواها، القناع يتمرّر */
  .mask{padding:0;align-items:flex-start}
  .modal{width:100% !important;max-width:100% !important;min-height:100%;
    border-radius:0;margin:0}
  .modal-b{padding:14px}
  .modal-h{padding:14px 16px;border-radius:0}
  .modal-f{padding:12px 14px calc(12px + env(safe-area-inset-bottom));gap:8px;flex-wrap:nowrap;border-radius:0}
  .modal-f .btn{flex:1;min-width:0;padding:12px 8px;justify-content:center}

  /* مؤشر الخطوات: اسم الخطوة الحالية فقط */
  .step-lbl{display:none}
  .step{padding:8px 10px}
  .step-active .step-lbl{display:inline}

  /* بوابة الدخول */
  .gate{padding:14px;align-items:flex-start;padding-top:8vh}
  .gate-c{max-width:100%}

  /* شريط النشاط */
  .actbar{padding:8px 12px}
  .actbar .btn.sm{padding:5px 8px;font-size:11px}
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

/* صفحة الأيقونات الكاملة (بديل القائمة على الجوال) */
.sheet-mask{position:fixed;inset:0;z-index:70;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;animation:fadein .2s}
@keyframes fadein{from{opacity:0}to{opacity:1}}
.sheet{width:100%;background:var(--ink2);border-radius:20px 20px 0 0;padding:8px 16px calc(20px + env(safe-area-inset-bottom));max-height:80vh;overflow-y:auto;animation:sheetup .25s cubic-bezier(.2,.8,.2,1)}
@keyframes sheetup{from{transform:translateY(100%)}to{transform:translateY(0)}}
.sheet-handle{width:40px;height:4px;border-radius:4px;background:var(--line);margin:6px auto 12px}
.sheet-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;font-size:14px;font-weight:600;font-family:var(--font-head,'Markazi Text',serif)}
.iconsgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.icontile{display:flex;flex-direction:column;align-items:center;gap:8px;padding:14px 6px;border-radius:14px;border:1px solid var(--line);background:var(--ink);color:var(--dim);cursor:pointer;font-family:inherit;transition:.15s}
.icontile:active{transform:scale(.96)}
.icontile.on{background:var(--ink3);color:var(--brass);border-color:var(--brass-d)}
.icontile-i{position:relative;display:grid;place-items:center;width:46px;height:46px;border-radius:13px;background:var(--ink3)}
.icontile.on .icontile-i{background:linear-gradient(145deg,var(--brass),var(--brass-d));color:#1a1410}
.icontile span{font-size:11px;text-align:center;line-height:1.3}
.icontile-b{position:absolute;top:-4px;inset-inline-end:-4px;background:var(--rose);color:#fff;font-size:9px;font-weight:700;min-width:16px;height:16px;border-radius:20px;display:grid;place-items:center;padding:0 3px}

.newclosing-btn{flex-shrink:0;padding:11px 18px;font-size:13px;justify-content:center}

/* مؤشر خطوات الإغلاق اليومي */
.stepper{display:flex;gap:6px;margin-bottom:18px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px}
.step{display:flex;align-items:center;gap:7px;padding:8px 12px;border-radius:var(--r-sm);border:1px solid var(--line);background:var(--ink3);color:var(--dim);cursor:pointer;font-family:inherit;font-size:12px;white-space:nowrap;flex-shrink:0;transition:all var(--t-fast)}
.step-dot{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:var(--ink);font-size:11px;font-weight:700;flex-shrink:0;transition:all var(--t-fast)}
.step-active{background:linear-gradient(135deg,var(--brass-l),var(--brass-d));color:#1a1410;border-color:transparent;box-shadow:var(--sh-brass)}
.step-active .step-dot{background:rgba(0,0,0,.2);color:#1a1410}
.step-done{color:var(--mint);border-color:rgba(79,178,134,.35)}
.step-done .step-dot{background:var(--mint);color:#0d1b14}
.step-lbl{font-weight:600}

/* ===================== تحسينات الجوال ===================== */


/* إزالة وميض اللمس الأزرق على كل الأزرار */
.rms button,.rms a,.rms .gate-u,.rms .nav-i,.rms .botnav-i{-webkit-tap-highlight-color:transparent}

/* شريط تنقّل سفلي للجوال */
.botnav{display:none}

/* رأس الصفحة الموحّد (عنوان + إجراء) */
.pagehead{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.pagehead-t{font-size:21px;font-weight:700;font-family:var(--font-head,'Markazi Text',serif)}
.pagehead-s{font-size:12px;color:var(--dim);margin-top:2px}

/* ---- عناصر ---- */
.card{background:var(--ink2);border:1px solid var(--line-g);border-radius:var(--r-md);padding:var(--s4);box-shadow:var(--sh-1);transition:box-shadow var(--t),border-color var(--t)}
.card:hover{box-shadow:var(--sh-2)}
.card-h{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;flex-wrap:wrap}
.card-t{font-size:17px;font-weight:700;display:flex;align-items:center;gap:8px;font-family:var(--font-head,'Markazi Text',serif)}
.grid{display:grid;gap:12px}
.grid>*{min-width:0}
.g2{grid-template-columns:repeat(2,minmax(0,1fr))}
.g3{grid-template-columns:repeat(3,minmax(0,1fr))}
.g4{grid-template-columns:repeat(4,minmax(0,1fr))}
@media(min-width:641px) and (max-width:1080px){.g4{grid-template-columns:repeat(2,minmax(0,1fr))}.g3{grid-template-columns:repeat(2,minmax(0,1fr))}}

.kpi{background:linear-gradient(160deg,var(--ink2),var(--ink3));border:1px solid var(--line-g);border-radius:var(--r-md);padding:var(--s4) var(--s4);position:relative;overflow:hidden;box-shadow:var(--sh-1);transition:transform var(--t) var(--ease-out),box-shadow var(--t)}
.kpi:hover{transform:translateY(-2px);box-shadow:var(--sh-3)}
.kpi::before{content:'';position:absolute;inset-block-start:0;inset-inline-start:0;width:3px;height:100%;background:var(--acc,var(--brass))}
.kpi::after{content:'';position:absolute;inset-block-start:-40%;inset-inline-end:-10%;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle,var(--acc,var(--brass)),transparent 70%);opacity:.06;pointer-events:none}
.kpi-l{font-size:11.5px;color:var(--dim);display:flex;align-items:center;gap:6px;font-weight:500}
.kpi-v{font-size:24px;font-weight:700;margin-top:8px;letter-spacing:-.02em;line-height:1.1;color:var(--num)}
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
.btn.pri{background:linear-gradient(135deg,var(--brass-l),var(--brass));color:#1a1410;border-color:transparent;font-weight:700;box-shadow:var(--sh-brass)}
.btn.pri:hover:not(:disabled){filter:brightness(1.05);box-shadow:0 12px 26px -8px rgba(200,162,74,.6)}
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
.b-violet{color:var(--violet);border-color:rgba(155,123,184,.4);background:rgba(155,123,184,.12)}

.tw{overflow-x:auto;min-width:0;max-width:100%;margin:0 -4px}
table.tb{width:100%;border-collapse:collapse;font-size:12.5px;min-width:520px}
.tb th{
  text-align:start;padding:9px 10px;color:var(--faint);font-weight:500;font-size:10.5px;
  letter-spacing:.06em;border-bottom:1px solid var(--line);white-space:nowrap
}
.tb td{padding:10px;border-bottom:1px solid rgba(51,44,38,.55);vertical-align:middle}
.tb tr:last-child td{border-bottom:none}
.tb tbody tr:hover{background:rgba(255,255,255,.018)}

/* ═══ النافذة تنمو بطول محتواها — القناع كله يتمرّر بحرية (لا حصر داخلي) ═══ */
/* ===== معمار النوافذ: قناع لا يتمرّر مطلقاً + نافذة بعمود واحد ورأس/تذييل ثابتين وتمرير واحد ===== */
.mask{position:fixed;inset:0;background:rgba(8,6,5,.62);backdrop-filter:blur(6px);z-index:80;
  display:grid;place-items:center;padding:clamp(8px,2.4vw,26px);
  overflow:hidden;overscroll-behavior:none}
.modal{background:var(--ink2);border:1px solid var(--line);border-radius:var(--r-lg);width:100%;max-width:640px;
  max-height:92vh;max-height:92dvh;display:flex;flex-direction:column;overflow:hidden;
  box-shadow:0 30px 70px rgba(0,0,0,.55)}
/* الرأس: ثابت لا يتمرّر */
.modal-h{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 18px;border-bottom:1px solid var(--line);background:var(--ink2)}
.modal-h-t{flex:1;min-width:0}
.modal-h-s{font-size:11.5px;color:var(--dim);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* الجسم: حاوية التمرير الوحيدة */
.modal-b{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:18px}
/* التذييل: ثابت لا يتمرّر ولا يتداخل مع المحتوى */
.modal-f{flex-shrink:0;display:flex;gap:9px;justify-content:flex-start;flex-wrap:wrap;padding:14px 18px calc(14px + env(safe-area-inset-bottom));border-top:1px solid var(--line);background:var(--ink2)}

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
  font-weight:700;border:2px solid var(--ink2);margin-inline-start:-7px;color:#16120f;font-family:var(--font-head,'Markazi Text',serif)}
.feed{display:flex;gap:10px;padding:9px 0;border-bottom:1px solid rgba(51,44,38,.5);font-size:12px}
.feed:last-child{border:none}
.feed-d{width:6px;height:6px;border-radius:50%;background:var(--brass);margin-top:7px;flex-shrink:0}
.hr{height:1px;background:var(--line);margin:14px 0;border:none}
.row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.mono-b{background:var(--ink);border:1px solid var(--line);border-radius:10px;padding:11px 13px;
  display:flex;justify-content:space-between;align-items:center;gap:10px}
.empty{text-align:center;padding:22px 16px;color:var(--faint);font-size:12.5px}
.tick{display:flex;gap:22px;overflow:hidden;white-space:nowrap;font-size:11.5px;color:var(--dim);
  border-top:1px solid var(--line);padding:8px 20px;background:var(--ink2);flex-shrink:0}


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
/* دخول الصفحة بالشفافية فقط — بلا transform حتى لا يُنشئ حاوية تحصر النوافذ الثابتة (position:fixed) */
.page > *{animation:pagein var(--t-slow) var(--ease-out) both}
@keyframes pagein{from{opacity:0}to{opacity:1}}
/* عناوين البطاقات أوضح */
.card-t{letter-spacing:-.01em}
/* حلقة تركيز عامة للوصول */
a:focus-visible,[role=button]:focus-visible,.nav-i:focus-visible,.botnav-i:focus-visible,.icontile:focus-visible{outline:none;box-shadow:var(--ring);border-radius:var(--r-sm)}
/* تعطيل الظهور المتحرك لمن يفضّل تقليل الحركة */
@media(prefers-reduced-motion:reduce){*{animation:none !important;transition-duration:.01ms !important}}

/* ---- السمة الفاتحة ---- */
/* النص فوق لون الهوية: أبيض افتراضًا، وداكن للهويات الفاتحة (الذهبي/النحاسي) */
.rms .btn.pri,.rms .brand-mark,.rms .av,.rms .lh-cnt,.rms .nav-i .cnt,.rms .step-active,.rms .icontile.on .icontile-i,.rms .toplogo-mark{color:#fff}
.rms:is(.thm-royal,.thm-carbon,.thm-neon,.thm-pastel) :is(.btn.pri,.brand-mark,.lh-cnt,.nav-i .cnt,.step-active,.icontile.on .icontile-i,.toplogo-mark){color:#1a1410}
.rms.mode-light .note-v{color:#1B1712}
.rms.mode-light .note-u,.rms.mode-light .note-t{color:#5A5148}
.rms.mode-light .note-i{background:rgba(255,255,255,.9);color:#241F1A;border-color:rgba(0,0,0,.12)}
.rms.mode-light .stp{background:rgba(255,255,255,.8);color:#241F1A;border-color:rgba(0,0,0,.1)}
.gate{background:radial-gradient(1100px 560px at 80% -8%,color-mix(in srgb,var(--brass) 13%,transparent),transparent 62%),var(--ink) !important}
/* شعار الشركة في الرأس */
.toplogo{width:34px;height:34px;border-radius:9px;object-fit:cover;flex-shrink:0;border:1px solid var(--line);background:var(--ink2)}
.toplogo-mark{width:34px;height:34px;border-radius:9px;flex-shrink:0;display:grid;place-items:center;font-family:var(--font-head,'Markazi Text',serif);font-weight:700;font-size:19px;background:linear-gradient(140deg,var(--brass-l),var(--brass))}
/* خلفية الواجهة الرئيسية (تحت التطبيقات): توهّج بلون الهوية + علامة/شعار باهت */
.lh-bg{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
.lh-bg::before{content:'';position:absolute;inset:0;background:radial-gradient(920px 540px at 82% -8%,color-mix(in srgb,var(--brass) 13%,transparent),transparent 60%),radial-gradient(780px 540px at 4% 112%,color-mix(in srgb,var(--brass) 8%,transparent),transparent 55%)}
.lh-wm{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(56vw,600px);height:auto;max-width:none;opacity:.04;object-fit:contain;pointer-events:none}
.lh-wm.mark{font-family:var(--font-head,'Markazi Text',serif);font-weight:700;font-size:min(52vw,540px);line-height:1;color:var(--brass);opacity:.05;width:auto;height:auto}
.lh{position:relative;z-index:1}

/* ---- بوابة الدخول ---- */
.gate{min-height:100vh;display:grid;place-items:center;padding:20px;
  background:radial-gradient(1100px 560px at 80% -8%,rgba(200,162,74,.1),transparent 62%),var(--ink)}
.gate-c{width:100%;max-width:440px}
/* إطار مذهّب مزدوج لبطاقة الدخول (تصميم v7.3) */
.gate-c .card{border-color:var(--frame);outline:1px solid var(--frame-o);outline-offset:5px;box-shadow:var(--sh-3)}
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

/* ═══════════════════════════════════════════════════════════
   شاشة الإغلاق اليومي — تصميم متجاوب v4.0
   كمبيوتر: خط زمني (يمين) + نموذج (وسط) + ملخّص حيّ (يسار)
   جوال: خط زمني رفيع + نموذج + ملخّص قابل للطي
   ═══════════════════════════════════════════════════════════ */
/* ===== نافذة الإغلاق كمساحة عمل بحجم الشاشة (90–95%)، وعلى الجوال ملء الشاشة ===== */
.modal-flow{width:min(1400px,94vw);height:94vh;height:94dvh;max-width:none;border-radius:var(--r-xl)}
.modal-flow .modal-b{flex:1;min-height:0;overflow:hidden;padding:0}
/* حاوية التمرير الوحيدة: عمود المحتوى + عمود ملخّص «لاصق» (لا تمرير منفصل) */
.cflow{display:grid;grid-template-columns:1fr 300px;height:100%;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.cflow-main{min-width:0}
.cflow-form{padding:20px 22px}
.cflow-sum{align-self:start;position:sticky;top:0;background:var(--ink);border-inline-start:1px solid var(--line);padding:16px 15px}
.cflow-sum-h{font-size:10.5px;color:var(--faint);letter-spacing:.1em;margin-bottom:12px}
.cflow-sum .mono-b{background:var(--ink2)}
.cflow-alert{border-radius:10px;padding:10px 12px;font-size:12px;display:flex;gap:8px;align-items:flex-start;margin-top:8px;line-height:1.5}
.cflow-msum{display:none}
/* لوحي: يُخفى الملخّص الجانبي ويظهر شريط ملخّص لاصق قابل للطي — عمود واحد وتمرير واحد */
@media(max-width:1040px){
  .cflow{grid-template-columns:1fr}
  .cflow-sum{display:none}
  .cflow-msum{display:block;position:sticky;top:0;z-index:2;border-bottom:1px solid var(--line);background:var(--ink2)}
  .cflow-msum-bar{display:flex;align-items:center;gap:16px;width:100%;padding:10px 16px;background:none;border:none;cursor:pointer;font-family:inherit;color:var(--txt)}
  .msum-i{display:flex;flex-direction:column;line-height:1.25;text-align:start}
  .msum-i small{font-size:9.5px;color:var(--dim)}
  .msum-i b{font-size:14px}
  .msum-chv{margin-inline-start:auto;color:var(--faint);font-size:12px}
  .cflow-msum-full{display:none;padding:2px 14px 12px}
  .cflow-msum.open .cflow-msum-full{display:block}
}
/* جوال: ملء الشاشة بارتفاع ديناميكي (dvh) يحترم شريط العنوان والـSafe Area */
@media(max-width:640px){
  .mask{padding:0}
  .modal-flow{width:100vw;height:100vh;height:100dvh;max-width:none;border-radius:0}
  .modal-flow .modal-h{padding-top:calc(14px + env(safe-area-inset-top))}
  .cflow-form{padding:14px}
}

/* ===== الأقسام القابلة للطي + الملخّص المؤسسي الحيّ (تصميم v5) ===== */
.eclose-tools{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.eclose-tools .hint{flex:1;min-width:0;font-size:11px;color:var(--faint);line-height:1.4}
.esec{border:1px solid var(--line);border-radius:14px;overflow:hidden;margin-bottom:11px;background:var(--ink2);transition:border-color .18s}
.esec.open{border-color:var(--brass-d)}
.esec-h{display:flex;align-items:center;gap:11px;width:100%;padding:13px 14px;background:none;border:none;cursor:pointer;color:var(--txt);text-align:start;min-height:54px;font-family:inherit}
.esec-h:focus-visible{outline:none;box-shadow:inset 0 0 0 2px rgba(200,162,74,.45)}
.esec-ic{width:34px;height:34px;border-radius:10px;background:var(--ink3);display:grid;place-items:center;color:var(--dim);flex-shrink:0}
.esec.done .esec-ic{background:rgba(79,178,134,.15);color:var(--mint)}
.esec-t{flex:1;min-width:0}
.esec-t b{font-size:14px;font-weight:700;display:block;line-height:1.3}
.esec-t span{font-size:11px;color:var(--dim);display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.esec-v{font-family:'IBM Plex Mono',monospace;font-size:13.5px;font-weight:600;color:var(--brass);white-space:nowrap;flex-shrink:0}
.esec-chv{color:var(--faint);transition:transform .22s var(--ease-out);flex-shrink:0}
.esec.open .esec-chv{transform:rotate(180deg)}
.esec-b{padding:4px 14px 15px;animation:esecin .24s var(--ease-out)}
@keyframes esecin{from{opacity:0;transform:translateY(-7px)}to{opacity:1;transform:none}}
.esum-h{font-size:10.5px;color:var(--faint);letter-spacing:.12em;margin-bottom:12px}
.esum-hero{border-radius:14px;padding:13px;margin-bottom:12px;border:1px solid var(--line)}
.esum-hero-l{font-size:11px;color:var(--dim)}
.esum-hero-v{font-size:26px;font-weight:700;line-height:1.1;margin-top:2px}
.esum-badge{display:inline-flex;align-items:center;gap:6px;margin-top:8px;font-size:12px;font-weight:700;padding:5px 11px;border-radius:20px;border:1px solid}
.esum-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(120,100,80,.14);font-size:12.5px}
.esum-row .k{color:var(--dim)}
.esum-row .v{font-weight:600}
.esum-row.sub{padding:4px 0;font-size:11.5px}
.esum-row.sub .k{color:var(--faint)}
.esum-net{margin-top:12px;border-radius:12px;padding:11px 13px;background:linear-gradient(145deg,rgba(200,162,74,.14),transparent);border:1px solid rgba(200,162,74,.3);display:flex;justify-content:space-between;align-items:center}
.esum-net .k{font-size:12px;color:var(--dim)}
.esum-net .v{font-size:17px;font-weight:700;color:var(--mint)}
@media(max-width:640px){ .eclose-tools .hint{display:none} }

/* ===== الزر العائم للإغلاق (جوال) — دائم الظهور فوق الشريط السفلي، يحترم Safe Area ===== */
.fab-new{display:none}
@media(max-width:900px){
  .newclosing-btn{display:none !important}
  .fab-new{
    display:inline-flex !important;align-items:center;gap:8px;width:auto;
    position:fixed;inset-inline-end:16px;bottom:calc(74px + env(safe-area-inset-bottom));
    z-index:49;min-height:54px;padding:0 22px;border-radius:30px;
    box-shadow:0 10px 26px rgba(200,162,74,.42),0 3px 10px rgba(0,0,0,.35);
    font-size:14.5px;font-weight:700
  }
  .fab-new .fab-lbl{white-space:nowrap}
}
@media(max-width:360px){
  .fab-new{padding:0;width:56px;min-width:56px;justify-content:center;border-radius:50%}
  .fab-new .fab-lbl{display:none}
}

/* ===== حقل عدة مبالغ (جمع تلقائي) ===== */
.moneysum{display:flex;justify-content:space-between;gap:10px;margin-top:6px;padding:7px 11px;border-radius:9px;background:rgba(200,162,74,.09);border:1px solid rgba(200,162,74,.3);font-size:11.5px;color:var(--dim)}
.moneysum b{color:var(--brass);font-weight:700}
.inp-sum-ta{font-family:'IBM Plex Mono',monospace;white-space:pre}
.inp-sum-ta.on{border-color:var(--brass-d);background:var(--ink2)}
.money-multi{display:flex;align-items:center;gap:10px;margin-top:6px;flex-wrap:wrap}
.money-add{flex-shrink:0}
.money-multi-t{font-size:11.5px;color:var(--dim);padding:5px 10px;border-radius:8px;background:rgba(200,162,74,.09);border:1px solid rgba(200,162,74,.3)}
.money-multi-t b{color:var(--brass);font-weight:700}

/* ===== الجداول ذات الكلاس .cards تتحوّل إلى بطاقات على الجوال (بلا تمرير أفقي ولا إخفاء أعمدة) ===== */
@media(max-width:760px){
  .tw:has(.tb.cards){overflow-x:visible;margin:0}
  .tb.cards{min-width:0;font-size:13px}
  .tb.cards thead{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
  .tb.cards, .tb.cards tbody, .tb.cards tr, .tb.cards td{display:block;width:100%}
  .tb.cards tr{border:1px solid var(--line);border-radius:12px;margin-bottom:10px;padding:4px 13px;background:var(--ink2)}
  .tb.cards tr:last-child td{border-bottom-color:rgba(120,100,80,.14)}
  .tb.cards td{direction:rtl;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid rgba(120,100,80,.14);text-align:end;white-space:normal !important;overflow-wrap:anywhere}
  .tb.cards td.num{unicode-bidi:plaintext}
  .tb.cards td:last-child{border-bottom:none}
  .tb.cards td::before{content:attr(data-label);color:var(--dim);font-size:11.5px;font-weight:600;text-align:start;flex-shrink:0}
  .tb.cards td.acts{justify-content:flex-end;padding-top:10px}
  .tb.cards td.acts::before{display:none}
  .tb.cards td[colspan]{display:block}
  .tb.cards td[colspan]::before{display:none}
}

/* ===== v6.2: الدخول السريع (رقم سري) + محرّر الصورة ===== */
.loginseg{display:flex;gap:6px;background:var(--ink3);border:1px solid var(--line);border-radius:12px;padding:4px;margin-bottom:14px}
.loginseg-b{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:9px 6px;border-radius:9px;border:none;background:transparent;color:var(--dim);font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;transition:.15s}
.loginseg-b.on{background:var(--ink);color:var(--brass-l);box-shadow:inset 0 0 0 1px var(--brass-d)}
.gate-err{color:var(--rose);font-size:12px;text-align:center;margin-bottom:10px}
.pin-dots{display:flex;gap:12px;justify-content:center;margin:4px 0 14px}
.pin-dot{width:13px;height:13px;border-radius:50%;border:2px solid var(--faint);transition:.15s}
.pin-dot.on{background:var(--brass);border-color:var(--brass);box-shadow:0 0 8px rgba(200,162,74,.5)}
.pinpad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}
.pinkey{padding:12px 0;border-radius:12px;border:1px solid var(--line);background:var(--ink3);color:var(--txt);font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:600;cursor:pointer;transition:.12s;display:flex;align-items:center;justify-content:center;min-height:50px}
.pinkey:hover{background:var(--ink2);border-color:var(--brass-d)}
.pinkey:active{transform:scale(.96);background:var(--brass);color:#1a1410}
.pinkey.ghost{font-size:13px;font-family:'Tajawal',sans-serif;color:var(--dim)}

.imgstage{position:relative;width:100%;height:300px;background:#0c0a08;border:1px solid var(--line);border-radius:14px;overflow:hidden;touch-action:none;user-select:none}
.cropbox{position:absolute;border:2px solid var(--brass);box-shadow:0 0 0 9999px rgba(0,0,0,.55);cursor:move;touch-action:none}
.crop-grid{position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,.22) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.22) 1px,transparent 1px);background-size:33.33% 33.33%}
.crop-h{position:absolute;inset-inline-start:-10px;bottom:-10px;width:22px;height:22px;border-radius:50%;background:var(--brass);border:2px solid #1a1410;cursor:nwse-resize;touch-action:none}
.editrow{display:flex;align-items:center;gap:10px;margin:9px 2px}
.editrow .lbl{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--dim);min-width:74px;margin:0}
.editrow input[type=range]{flex:1;accent-color:var(--brass);height:4px}

/* ═══ مركز تطبيقات ERP (v7.6) ═══ */
.apps-hd{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.appgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(232px,1fr));gap:11px}
.appc{background:var(--ink2);border:1px solid var(--line-g);border-radius:var(--r-md);padding:13px;display:flex;flex-direction:column;gap:8px;position:relative;transition:transform var(--t) var(--ease-out),box-shadow var(--t),border-color var(--t)}
.appc:hover{transform:translateY(-2px);box-shadow:var(--sh-3);border-color:var(--frame)}
.appc.soon{opacity:.6}
.appc-top{display:flex;align-items:flex-start;gap:10px;padding-inline-end:26px}
.appc-ic{width:38px;height:38px;border-radius:11px;background:var(--acc-soft);border:1px solid var(--frame-o);display:grid;place-items:center;color:var(--brass-l);flex-shrink:0}
.appc-n{font-weight:800;font-size:13.5px;line-height:1.3}
.appc-e{font-size:9px;color:var(--faint);letter-spacing:.04em;direction:ltr}
.appc-d{font-size:10.8px;color:var(--dim);line-height:1.6;flex:1}
.appc-f{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.appc-star{position:absolute;inset-inline-end:7px;inset-block-start:7px;background:none;border:none;cursor:pointer;color:var(--faint);padding:4px;border-radius:8px;line-height:1}
.appc-star.on{color:var(--brass-l)}
.appc-star:hover{background:var(--acc-soft);color:var(--brass-l)}
.appcat{display:flex;align-items:center;gap:9px;margin:14px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--line)}
.appcat .t{font-family:var(--font-head,'Markazi Text',serif);font-size:18.5px;font-weight:700}
.appcat .c{font-size:10px;color:var(--faint)}
.appstrip{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-bottom:2px}
.appchip{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;border:1px solid var(--line-g);background:var(--ink2);color:var(--txt);font-size:11.5px;cursor:pointer;font-family:inherit;transition:border-color var(--t-fast),background var(--t-fast)}
.appchip:hover{border-color:var(--frame);background:var(--ink3)}
.appchip .st{color:var(--brass-l)}
@media(max-width:560px){.appgrid{grid-template-columns:repeat(2,minmax(0,1fr))}.appc{padding:11px}.appc-e{display:none}}
@media(max-width:352px){.appgrid{grid-template-columns:1fr}}

/* ===== واجهة التطبيقات (Launcher) — v9.1 ===== */
.lh{max-width:1080px;margin:0 auto}
.lh-hi{text-align:center;font-size:13px;color:var(--dim);margin-bottom:4px}
.lh-hi b{color:var(--txt)}
.lh-role{text-align:center;margin:8px 0 2px;font-size:11px;color:var(--faint)}
.lh-role .pill{display:inline-flex;align-items:center;gap:6px;background:var(--acc-soft);color:var(--brass);
  border:1px solid var(--frame-o);padding:4px 12px;border-radius:999px;font-weight:700}
.lh-search{position:relative;max-width:460px;margin:14px auto 6px}
.lh-search .inp{width:100%;padding-inline-start:34px;border-radius:999px}
.lh-search .lh-si{position:absolute;inset-inline-start:12px;top:11px;color:var(--faint)}
.lh-sec{margin-top:22px}
.lh-sect{font-size:11px;color:var(--faint);letter-spacing:.3px;margin:0 4px 12px;display:flex;align-items:center;gap:8px}
.lh-sect .ic{color:var(--brass)}
.lh-sect::after{content:'';flex:1;height:1px;background:linear-gradient(to left,var(--line),transparent)}
.lh-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(134px,1fr));gap:18px 14px}
@media(min-width:901px){.lh-grid{grid-template-columns:repeat(6,1fr)}}
.lh-tile{position:relative;display:flex;flex-direction:column;align-items:center;gap:12px;padding:20px 8px 16px;
  border-radius:18px;cursor:pointer;border:1px solid transparent;transition:.15s;background:none}
.lh-tile:hover{background:var(--acc-soft);border-color:var(--line-g);transform:translateY(-3px)}
.lh-box{width:82px;height:82px;border-radius:22px;display:grid;place-items:center;position:relative;
  background:var(--ink3);border:1px solid var(--line-g);box-shadow:var(--sh-2);transition:.15s;color:var(--c,var(--brass))}
.lh-tile:hover .lh-box{border-color:color-mix(in srgb, var(--c,var(--brass)) 45%, var(--line-g))}
.lh-nm{font-size:13.5px;font-weight:600;text-align:center;line-height:1.45;color:var(--txt);max-width:160px}
.lh-star{position:absolute;top:9px;inset-inline-start:11px;width:26px;height:26px;border:1px solid var(--line);
  border-radius:8px;color:var(--faint);cursor:pointer;display:grid;place-items:center;opacity:0;transition:.15s;
  background:color-mix(in srgb,var(--ink3) 82%,transparent)}
.lh-tile:hover .lh-star{opacity:1}
.lh-star.on{opacity:1;color:var(--amber);border-color:var(--amber)}
.lh-bdg{position:absolute;top:11px;inset-inline-end:20px;min-width:18px;height:18px;border-radius:999px;
  background:var(--rose);color:#fff;font-size:10px;font-weight:700;display:grid;place-items:center;padding:0 4px}
.lh-cnt{position:absolute;top:-8px;inset-inline-start:-8px;min-width:24px;height:24px;border-radius:999px;
  background:var(--brass);color:#14110f;font-size:12px;font-weight:800;display:grid;place-items:center;padding:0 5px;
  border:2px solid var(--ink2);box-shadow:var(--sh-2)}
.lh-empty{color:var(--faint);text-align:center;font-size:12px;padding:30px}
.homebtn2{display:inline-grid;place-items:center;width:34px;height:34px;border-radius:9px;flex-shrink:0;
  border:1px solid var(--frame-o);background:var(--acc-soft);color:var(--brass);cursor:pointer}
@media(max-width:560px){.lh-grid{grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:14px 8px}
  .lh-box{width:66px;height:66px;border-radius:18px}.lh-nm{font-size:11.5px}
  .lh-cnt{min-width:21px;height:21px;font-size:11px}}

/* ظهور التطبيقات لكل مستخدم — v9.2 */
.appperm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px}
.appperm{display:flex;align-items:center;gap:10px;padding:11px 13px;border-radius:12px;border:1px solid var(--line);
  background:var(--ink2);cursor:pointer;transition:.12s;text-align:start;font:inherit;color:var(--txt)}
.appperm:hover{border-color:var(--line-g)}
.appperm .ic{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;background:var(--ink3);
  border:1px solid var(--line-g);color:var(--brass);flex-shrink:0}
.appperm .nm{flex:1;font-size:11.5px;font-weight:600;min-width:0}
.appperm .nm small{display:block;font-size:9px;font-weight:500;margin-top:1px;color:var(--faint)}
.appperm .tk{width:22px;height:22px;border-radius:6px;border:1.5px solid var(--line-g);display:grid;place-items:center;color:transparent;flex-shrink:0}
.appperm.on{border-color:rgba(79,178,134,.5);background:rgba(79,178,134,.07)}
.appperm.on .tk{background:var(--mint);border-color:var(--mint);color:#0c1410}
.appperm.on.role .nm small{color:var(--mint)}
.appperm.ovr .nm small{color:var(--amber)}

/* شريط التطبيق (اسم + تقارير + إعدادات) — v9.4 */
.abar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;background:var(--ink2);
  border:1px solid var(--line);border-radius:var(--r-lg)}
.abar-id{display:flex;align-items:center;gap:9px;font-weight:700;font-size:14px}
.abar-ic{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;background:var(--ink3);
  border:1px solid var(--line-g);color:var(--brass)}
.abar-id small{display:block;font-size:9.5px;color:var(--faint);font-weight:500;margin-top:1px}
.abar-sp{margin-inline-start:auto}
.abar-dd{position:relative}
.abar-back{position:fixed;inset:0;z-index:40}
.abar-menu{position:absolute;top:calc(100% + 6px);inset-inline-end:0;min-width:230px;background:var(--ink2);
  border:1px solid var(--line-g);border-radius:12px;box-shadow:var(--sh-4);padding:6px;z-index:41}
.abar-menu .abar-hd{font-size:9.5px;color:var(--faint);padding:6px 10px 3px;letter-spacing:.3px}
.abar-menu button{display:flex;align-items:center;gap:9px;width:100%;text-align:start;padding:9px 10px;border:none;
  background:none;color:var(--txt);font:inherit;font-size:12px;border-radius:8px;cursor:pointer}
.abar-menu button:hover{background:var(--acc-soft)}
.abar-menu button svg{color:var(--faint);flex-shrink:0}

/* إخفاء القائمة الجانبية على الحاسوب — شبكة تطبيقات صرفة + قائمة حساب بالرأس — v9.6 */
@media(min-width:901px){
  .side{display:none !important}
  .main{width:100%;max-width:100%}
}
.usermenu{position:relative;flex-shrink:0;border-inline-start:1px solid var(--line);padding-inline-start:10px;margin-inline-start:3px}
.usermenu-btn{display:flex;align-items:center;gap:8px;padding:4px 10px 4px 5px;border-radius:999px;
  border:1px solid var(--line);background:var(--ink3);cursor:pointer;color:var(--txt)}
.usermenu-btn:hover{border-color:var(--line-g)}
.usermenu-btn .uav{width:26px;height:26px;border-radius:999px;background:var(--acc-soft);color:var(--brass);
  display:grid;place-items:center;font-weight:700;font-size:12px;flex-shrink:0}
.usermenu-btn .un{font-size:11.5px;font-weight:600;line-height:1.25;text-align:start;white-space:nowrap}
.usermenu-btn .un small{display:block;font-size:9px;color:var(--faint);font-weight:500}
.usermenu-menu{position:absolute;top:calc(100% + 8px);inset-inline-end:0;min-width:230px;background:var(--ink2);
  border:1px solid var(--line-g);border-radius:14px;box-shadow:var(--sh-4);padding:6px;z-index:61}
.usermenu-menu .umhd{padding:9px 11px;border-bottom:1px solid var(--line);margin-bottom:4px}
.usermenu-menu .umhd b{font-size:12.5px}
.usermenu-menu .umhd small{display:block;font-size:10px;color:var(--faint);margin-top:1px}
.usermenu-menu button{display:flex;align-items:center;gap:10px;width:100%;text-align:start;padding:9px 11px;
  border:none;background:none;color:var(--txt);font:inherit;font-size:12px;border-radius:8px;cursor:pointer}
.usermenu-menu button:hover{background:var(--acc-soft)}
.usermenu-menu button svg{color:var(--faint);flex-shrink:0}
.usermenu-menu button.danger:hover{background:rgba(217,84,77,.12);color:var(--rose)}
.usermenu-menu button.danger:hover svg{color:var(--rose)}
.usermenu-back{position:fixed;inset:0;z-index:60}
@media(max-width:900px){.usermenu-btn .un{display:none}}
`;
