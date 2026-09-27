# =============================================================================
# Securis - Production Dockerfile (multi-stage)
# =============================================================================
# Stages
#   deps     : clean, reproducible dependency install
#   builder  : Prisma client generation + Next.js production build (standalone)
#   migrator : lightweight image that can apply migrations / seed the database
#   runner   : minimal runtime image (non-root) serving the standalone server
#
# The image is environment-agnostic: DATABASE_URL and the secrets are provided
# at runtime (see docker-compose.yml and .env.example).
# =============================================================================

# ---- Stage 1: dependencies -------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
# libc compatibility shims for native dependencies.
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
# `npm ci` installs devDependencies too, which the migrator stage needs
# (prisma CLI, tsx).
RUN npm ci

# ---- Stage 2: build --------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate the Prisma client. `generate` only reads the schema, so a
# placeholder URL is sufficient and no database connection is made.
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
RUN npx prisma generate --schema=database/prisma/schema.prisma
# Produce .next/standalone (see next.config.ts -> output).
ENV NEXT_OUTPUT=standalone
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- Stage 3: migrator -----------------------------------------------------
# Used by `docker compose run --rm migrate` (and the one-shot compose service)
# to apply migrations and optionally seed. Keeps the runtime image lean.
FROM deps AS migrator
WORKDIR /app
COPY database ./database
COPY package.json ./
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
CMD ["npx", "prisma", "migrate", "deploy", "--schema=database/prisma/schema.prisma"]

# ---- Stage 4: runtime ------------------------------------------------------
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
# Ensure the Prisma engine/client are present in the standalone bundle.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Container healthcheck against the login route.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
