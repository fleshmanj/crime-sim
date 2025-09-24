# ---- build stage ----
FROM node:20-slim AS build
WORKDIR /app

# Install deps (include dev so vite exists)
COPY package*.json ./
RUN npm ci --include=dev

# Copy source
COPY . .

# (rare but safe) ensure local bin shims are executable
RUN chmod +x node_modules/.bin/* || true

# Call Vite directly via node to avoid shim issues
RUN node node_modules/vite/bin/vite.js build

# ---- serve stage ----
FROM nginx:alpine AS serve

# Your nginx config should serve /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

