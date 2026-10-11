# 1 Build the React frontend
FROM node:26-alpine AS build-frontend
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# 2 Backend production dependencies
FROM node:26-alpine AS backend-deps
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --omit=dev

# 3 Nginx + Node (TypeScript runs directly via Node's type stripping)
FROM node:26-alpine

# nginx serves the SPA and proxies /api; supervisor runs both processes
RUN apk add --no-cache nginx supervisor curl tini && \
    rm -rf /var/cache/apk/*

WORKDIR /app

COPY --from=backend-deps /app/backend/node_modules /app/backend/node_modules
COPY backend/ /app/backend/

COPY --from=build-frontend /app/frontend/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
COPY docker/supervisord.conf /etc/supervisord.conf

# All runtime data lives in one volume, with a folder per module:
#   storage/server/session.secret
#   storage/sipitordipit/sipitordipit.db
#   storage/pyramid/pyramid.db
RUN mkdir -p /app/backend/storage
VOLUME ["/app/backend/storage"]

ENV NODE_ENV=production \
    HOST=127.0.0.1 \
    PORT=8000 \
    ALLOWED_ORIGINS="*" \
    TRUST_PROXY=true

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD curl -fs http://127.0.0.1/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["supervisord", "-c", "/etc/supervisord.conf"]
