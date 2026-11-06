import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// VITE_BASE يضبط مسار الجذر: '/' للاستضافة العادية، و'/اسم-المستودع/' لـ GitHub Pages
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
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
