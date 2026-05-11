# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first (layer cache optimisation)
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Copy source and build for production
COPY . .
RUN npm run build -- --configuration production

# ─── Stage 2: Serve ───────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built Angular app from the builder stage
COPY --from=builder /app/dist/vero-platform/browser /usr/share/nginx/html

# Copy nginx template — the official nginx image auto-runs envsubst
# at container start, replacing ${BACKEND_URL} with the runtime env var.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
