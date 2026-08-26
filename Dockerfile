FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable
COPY lecture-handout-generator/package.json lecture-handout-generator/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_STANDALONE=true
COPY --from=deps /app/node_modules ./node_modules
COPY lecture-handout-generator/ ./
RUN pnpm db:generate && pnpm build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends poppler-utils && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app ./
EXPOSE 3000
CMD ["sh", "-c", "pnpm db:migrate && pnpm db:seed && pnpm start"]
