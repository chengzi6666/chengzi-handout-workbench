FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_STANDALONE=true
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm db:generate
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN corepack enable
COPY --from=builder /app ./
EXPOSE 3000
CMD ["sh", "-c", "pnpm db:migrate && pnpm db:seed && pnpm start"]
