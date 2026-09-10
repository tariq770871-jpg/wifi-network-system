# WiFi Network System - Backend API
# Multi-stage build: أصغر حجماً وأمان أعلى
FROM node:20-alpine AS base

# ---- Dependencies stage ----
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# ---- Runtime stage ----
FROM base AS runtime
WORKDIR /app

ENV NODE_ENV=production

# تشغيل بمستخدم غير جذري للأمان
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

# مجلد الصور المرفوعة (للمهام الميدانية)
RUN mkdir -p /app/uploads && chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "src/app.js"]
