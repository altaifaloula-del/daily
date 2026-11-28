import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* v56.56 (ملاحظة v56.54 f): قائمة الأصول التي يحتاجها هيكل نقطة البيع ليُفتح دون إنترنت — نقطة الدخول وحزمة mod-pos وكل ما تستوردانه
   (ثابتًا أو عند الطلب، بلا حزم التطبيقات الأخرى) وملفات CSS. تُكتب dist/pos-shell.json ويقرؤها posSwSync للتسخين (بحد أعلى). لا بيانات فيها. */
function posShellList() {
  let base = '/';
  return {
    name: 'pos-shell-list',
    configResolved(c) { base = c.base || '/'; },
    generateBundle(_o, bundle) {
      const chunks = Object.values(bundle).filter(x => x.type === 'chunk'); const by = new Map(chunks.map(c => [c.fileName, c]));
      const want = new Set(), q = chunks.filter(c => c.isEntry || c.name === 'mod-pos').map(c => c.fileName);
      while (q.length) { const f = q.shift(); if (want.has(f)) continue; const c = by.get(f); if (!c) continue;
        if (/^mod-/.test(c.name) && c.name !== 'mod-pos') continue;   // تطبيقات أخرى تُحمَّل عند الطلب — ليست من هيكل نقطة البيع
        want.add(f); [...(c.imports || []), ...(c.dynamicImports || [])].forEach(x => q.push(x));
        ((c.viteMetadata && c.viteMetadata.importedCss) || []).forEach(x => want.add(x)); }
      const all = [...want].filter(f => /\.(js|css)$/.test(f)).sort(), files = all.slice(0, 60).map(f => base + f);
      // v56.56 (قرار المجلس G): لا إسقاط صامت — القائمة المقصوصة تُعلَّم في الملف ويُنبَّه عند البناء
      if (all.length > 60) this.warn('pos-shell.json مقصوص: ' + all.length + ' ملفًا > 60 — ارفع الحد أو قلّل حزم هيكل نقطة البيع');
      this.emitFile({ type: 'asset', fileName: 'pos-shell.json', source: JSON.stringify({ files, ...(all.length > 60 ? { truncated: true, total: all.length } : {}) }) });
    }
  };
}

// VITE_BASE يضبط مسار الجذر: '/' للاستضافة العادية، و'/اسم-المستودع/' لـ GitHub Pages
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react(), posShellList()],
  server: {
    port: 3000,
    proxy: { '/api': 'http://localhost:8787' }
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2200,
    rollupOptions: {
      output: {
        // v29.6: المكتبات في ملفات مستقلة لا يتغير اسمها بين التحديثات — بعد كل نشر يُنزّل المستخدم كود المنصة وحده
        // وتبقى React والرسوم البيانية والأيقونات في ذاكرة المتصفح (Firebase يُحمَّل أصلًا بعد الدخول فقط)
        manualChunks(id) {
          // v38.3: تطبيقات المنصة في ست حزم تُحمَّل عند الطلب (mods/<المجموعة>/)
          const mg = id.replace(/\\/g, '/').match(/\/mods\/([a-z]+)\//);
          if (mg) return 'mod-' + mg[1];
          // نواة المنصة في حزمتها — وإلا سحبها Rollup إلى أول حزمة تطبيقات تستوردها
          if (/\/(App\.jsx|styles\.js|storage\.js)$/.test(id.replace(/\\/g, '/'))) return 'core';
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react';
          if (/node_modules\/(recharts|d3-[^/]+|victory-vendor|lodash|react-smooth|recharts-scale|decimal\.js-light|eventemitter3|internmap|tiny-invariant|clsx|react-is|prop-types|fast-equals|react-transition-group|dom-helpers)\//.test(id)) return 'vendor-charts';
          if (/node_modules\/lucide-react\//.test(id)) return 'vendor-icons';
          return undefined;
        }
      }
    }
  }
});
