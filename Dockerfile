# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
RUN apk upgrade --no-cache

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json .npmrc yarn.lock* package-lock.json* pnpm-lock.yaml* ./
# The brand system is consumed as a local file: dependency from the in-repo
# `branding` submodule, so its source must be present before installing.
COPY branding ./branding
RUN npm i -g npm@11.18.0 undici@6.27.0 && \
  rm -rf /usr/local/lib/node_modules/npm/node_modules/undici && \
  ln -s /usr/local/lib/node_modules/undici /usr/local/lib/node_modules/npm/node_modules/undici
RUN --mount=type=cache,id=console-npm,target=/root/.npm,sharing=locked \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci --legacy-peer-deps; \
  elif [ -f pnpm-lock.yaml ]; then yarn global add pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi


# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV NEXT_TELEMETRY_DISABLED=1

# Stable key so server action closures survive across deployments and instances.
# Without this, each build generates a random key — any client page rendered by
# an older build will fail to call server actions after a new revision deploys.
ARG NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
ENV NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=${NEXT_SERVER_ACTIONS_ENCRYPTION_KEY}

# Teams app catalog/manifest id for the "Add to Teams" deep link. NEXT_PUBLIC_*
# is inlined into the client bundle at build time, so it must be present here
# (a Cloud Run runtime env would never reach the already-built bundle). Empty is
# safe — the button just stays hidden until the value is set on the trigger.
ARG NEXT_PUBLIC_MS_TEAMS_APP_CATALOG_ID
ENV NEXT_PUBLIC_MS_TEAMS_APP_CATALOG_ID=${NEXT_PUBLIC_MS_TEAMS_APP_CATALOG_ID}

RUN npm run check:styles:all
RUN --mount=type=cache,id=console-next,target=/app/.next/cache npx next build

# Make sure public folder exists
RUN mkdir -p ./src/public
RUN mkdir -p ./src/styles

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

ARG NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
ENV NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=${NEXT_SERVER_ACTIONS_ENCRYPTION_KEY}

RUN apk add --no-cache python3

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./src/public
COPY --from=builder /app/src/public ./src/public
COPY --from=builder /app/src/styles ./src/styles

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./src
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./src/.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000

# set hostname to localhost
ENV HOSTNAME="0.0.0.0"
ENV NODE_OPTIONS="-r next-logger"

COPY ./next-logger.config.basic.js ./next-logger.config.basic.js
COPY ./next-logger.config.ts ./next-logger.config.ts

WORKDIR /app/src

CMD ["node", "server.js"]
