# 1 Build the React frontend
FROM node:25-alpine AS build-frontend
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# 2 Nginx + Python (FastAPI)
FROM python:3.14-alpine

# System packages: nginx (serves SPA + reverse proxy), supervisor (runs both processes)
RUN apk add --no-cache nginx supervisor curl tini && \
    rm -rf /var/cache/apk/*

WORKDIR /app

# Backend Python deps
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Backend source
COPY backend/ /app/backend/

# Frontend build output → served by Nginx
COPY --from=build-frontend /app/frontend/dist /usr/share/nginx/html

# Nginx config (proxies /api and /ws to FastAPI on 127.0.0.1:8000)
COPY nginx.conf /etc/nginx/nginx.conf

# Supervisor config (runs nginx + uvicorn together)
COPY docker/supervisord.conf /etc/supervisord.conf

# Persistent storage for rooms.json (survives restarts when mounted as a volume)
RUN mkdir -p /app/backend/storage
VOLUME ["/app/backend/storage"]

# Production CORS allows the same origin (Nginx serves frontend and proxies to backend)
ENV ALLOWED_ORIGINS="*"
ENV SAVE_INTERVAL_SEC=5

EXPOSE 80

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["supervisord", "-c", "/etc/supervisord.conf"]
