# ── Stage 1: Build ────────────────────────────────────────────────────────
FROM oven/bun:1.3.8-alpine AS build

WORKDIR /app

# Accept an optional base path (e.g. /player/ for subdirectory deploys)
ARG VITE_BASE_PATH=/
ENV VITE_BASE_PATH=${VITE_BASE_PATH}

# Install dependencies first (layer-cached separately from source)
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy source and build
COPY . .
RUN VITE_BASE_PATH=${VITE_BASE_PATH} bun run build

# ── Stage 2: Serve ────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS serve

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
