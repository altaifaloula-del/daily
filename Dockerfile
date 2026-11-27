# ---- بناء الواجهة ----
# Node 22 LTS (Node 20 انتهى دعمه في أبريل 2026)
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# متغيرات الواجهة تُحقن وقت البناء لأن Vite يدمجها في الحزمة — كلها عامة بطبيعتها؛ لا تمرّر هنا أي سرّ خادم
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_AI_ENDPOINT
ARG VITE_AI_FEEDBACK_ENDPOINT
ARG VITE_FCM_VAPID_KEY
RUN npm run build
# v53.5: محرك المحاسبة لموصل Claude (MCP) — يُبنى هنا لأن esbuild من اعتماديات التطوير
RUN node scripts/build-mcp-engine.mjs

# ---- التشغيل ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server.js tenants.js server-auth.js plans.js billing.js server-billing.js server-provider.js server-automation.js server-users.js server-ledger.js server-poscredit.js server-posdev.js server-aiinv.js server-comms.js server-mcp.js server-mcp-worker.mjs server-refs.js ref-lib.mjs server-ailog.js ./
COPY scripts/backup-lib.mjs ./scripts/backup-lib.mjs
# server.js يستورد ./zatca/onboard.js و./zatca/vault.js — بدونها تتوقف الحاوية عند الإقلاع (ERR_MODULE_NOT_FOUND)
COPY zatca ./zatca
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-engine ./dist-engine
# التشغيل بمستخدم غير جذري
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-8787}/api/health" >/dev/null || exit 1
CMD ["node", "server.js"]
