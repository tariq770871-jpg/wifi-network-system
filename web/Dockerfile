# WiFi Network Dashboard - Web (React + Vite)
# Build stage ثم nginx لتقديم الملفات الثابتة
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY . .
# عنوان الـ API يُمرر وقت البناء: --build-arg VITE_API_URL=...
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---- Serve stage ----
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# SPA routing: توجيه كل المسارات إلى index.html
RUN printf 'server {\n\
    listen 80;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
    location /assets/ {\n\
        expires 30d;\n\
        add_header Cache-Control "public, immutable";\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO- http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
