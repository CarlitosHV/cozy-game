# ==========================================
# Stage 1: Base setup
# ==========================================
FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* bun.lock* ./

# ==========================================
# Stage 2: Development
# ==========================================
FROM base AS development
ENV NODE_ENV=development
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]

# ==========================================
# Stage 3: Builder
# ==========================================
FROM base AS builder
ENV NODE_ENV=production
RUN npm install
COPY . .
RUN npm run build

# ==========================================
# Stage 4: Production (Nginx SPA server)
# ==========================================
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
