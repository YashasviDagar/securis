# =============================================================================
# Securis - Production Dockerfile (multi-stage)
# =============================================================================
# Builds a small production image for the Next.js application.
#
# Stage 1 (deps)    : installs dependencies with a clean, reproducible install.
# Stage 2 (builder) : generates the Prisma client and builds Next.js.
# Stage 3 (runner)  : minimal runtime image containing only the standalone
#                     server output.
#
# Connection: consumes DATABASE_URL at runtime (never at build time) so the
# image stays environment-agnostic. See docker-compose.yml.
# =============================================================================

# ---- Stage 1: dependencies -------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
# Install libc compatibility shims required by some native dependencies.
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

# ---- Stage 2: build --------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate the Prisma client. A placeholder URL is supplied because `generate`
# only reads the schema; it never connects to the database.
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
RUN npx prisma generate --schema=database/prisma/schema.prisma
# Enable Next.js standalone output for the runtime image (see next.config.ts).
ENV NEXT_OUTPUT=standalone
RUN npm run build

# ---- Stage 3: runtime ------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Run as an unprivileged user.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Container healthcheck against the login route.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
