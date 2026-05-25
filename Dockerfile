# =========================================================
# Stage 1: Install ALL dependencies (build + runtime)
# =========================================================
FROM node:20-alpine AS deps

WORKDIR /app

# Copy dependency configuration files
COPY package.json package-lock.json* ./

# Install ALL packages (including devDependencies for build)
RUN npm install --legacy-peer-deps

# =========================================================
# Stage 2: Build Phase (Compile frontend + server)
# =========================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/package-lock.json* ./

# Declare Build Arguments (Vite embeds VITE_* variables during build)
ARG GEMINI_API_KEY
ARG VITE_STRIPE_PUBLISHABLE_KEY
ARG STRIPE_SECRET_KEY

# Set arguments as system envs in the build container
ENV GEMINI_API_KEY=$GEMINI_API_KEY
ENV VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY
ENV STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY

# Copy all codebase files, configs, and assets
COPY . .

# Build Vite frontend (dist/) AND compile server.ts → dist/server.mjs
RUN npm run build

# =========================================================
# Stage 3: Production Runner (Lean image with nginx + node)
# =========================================================
FROM node:20-alpine AS runner

# Install nginx
RUN apk add --no-cache nginx

WORKDIR /app

# Copy ONLY production dependencies
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/package-lock.json* ./
RUN npm install --omit=dev --legacy-peer-deps && npm cache clean --force

# Copy compiled assets from builder
COPY --from=builder /app/dist ./dist

# Copy nginx configuration
COPY nginx.conf /etc/nginx/http.d/default.conf

# Copy environment config files
COPY .env.example ./
COPY .env.local* ./

# Copy and set up entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Set production mode
ENV NODE_ENV=production

# Expose port 80 (nginx serves everything)
EXPOSE 80

# Start both nginx and the Node.js API server
CMD ["/entrypoint.sh"]
