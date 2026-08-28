FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_STANDALONE=true
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm db:generate
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# poppler(PDF 解析) + ca-certificates/curl(装 frps 用)
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate \
 && apt-get update && apt-get install -y --no-install-recommends poppler-utils ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*
# 安装 frps v0.71.0（须与本机 frpc 同版本）到 /usr/local/bin/frps。
# start.mjs 在 FRPS_TOKEN 存在时会拉起它，监听 7000 并开放隧道端口 9000。
RUN curl -fsSL https://github.com/fatedier/frp/releases/download/v0.71.0/frp_0.71.0_linux_amd64.tar.gz -o /tmp/frp.tar.gz \
 && tar -xzf /tmp/frp.tar.gz -C /tmp \
 && cp /tmp/frp_0.71.0_linux_amd64/frps /usr/local/bin/frps \
 && chmod +x /usr/local/bin/frps \
 && rm -rf /tmp/frp.tar.gz /tmp/frp_0.71.0_linux_amd64
COPY --from=builder /app ./
EXPOSE 3000 7000
CMD ["sh", "-c", "pnpm db:migrate && pnpm db:seed && node scripts/start.mjs"]
