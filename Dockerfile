# ---- بناء الواجهة ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# متغيرات Firebase تُحقن وقت البناء لأن Vite يدمجها في حزمة الواجهة
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_SENDER_ID
ARG VITE_FIREBASE_APP_ID
RUN npm run build

# ---- التشغيل ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.js ./
COPY --from=build /app/dist ./dist
EXPOSE 8787
CMD ["node", "server.js"]
