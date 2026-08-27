import { execFileSync, spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const project = "9c56ab23-258a-4918-a71d-229c9a1db596";
const environment = "e7f9d4a5-0d28-4778-9cc9-e96dbdc6e110";
const appService = "212ab9c5-bf0b-477d-a3b5-6bae394a518b";
const databaseService = "9a40c03e-ae0e-4901-bcfb-d63aff812964";
const localProxy = process.env.RAILWAY_DB_SOCKS_PROXY || (process.platform === "win32" ? "127.0.0.1:7890" : "");

async function startHttpConnectTunnel(proxyHost, proxyPort, targetHost, targetPort) {
  const server = createServer((client) => {
    client.pause();
    const request = httpRequest({
      host: proxyHost,
      port: proxyPort,
      method: "CONNECT",
      path: `${targetHost}:${targetPort}`,
      timeout: 15_000,
    });
    request.once("connect", (response, upstream, head) => {
      // CONNECT has completed; the request timeout must not remain attached to
      // the upgraded PostgreSQL socket or it will tear down a healthy bridge
      // exactly 15 seconds later.
      request.setTimeout(0);
      if (response.statusCode !== 200) {
        upstream.destroy();
        client.destroy();
        return;
      }
      client.on("error", () => upstream.destroy());
      upstream.on("error", () => client.destroy());
      if (head.length) client.write(head);
      client.pipe(upstream).pipe(client);
      client.resume();
    });
    request.once("timeout", () => request.destroy(new Error("proxy CONNECT timeout")));
    request.once("error", (error) => {
      console.warn(`Railway DB HTTP CONNECT tunnel: ${error.message}`);
      client.destroy();
    });
    request.end();
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return server;
}
function railwayJson(args) {
  let executable = "npx";
  let commandArgs = ["-y", "@railway/cli@latest", ...args];
  if (process.platform === "win32") {
    // Reusing the already downloaded native CLI avoids npx trying to replace its
    // own locked cache while a previous Railway command is still shutting down.
    const npxRoot = join(process.env.LOCALAPPDATA || "", "npm-cache", "_npx");
    const cached = existsSync(npxRoot)
      ? readdirSync(npxRoot)
          .map((entry) => join(npxRoot, entry, "node_modules", "@railway", "cli", "bin", "railway.exe"))
          .find(existsSync)
      : undefined;
    if (cached) {
      executable = cached;
      commandArgs = args;
    } else {
      executable = "npx.cmd";
    }
  }
  return JSON.parse(execFileSync(executable, commandArgs, {
    cwd: appRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    env: localProxy ? {
      ...process.env,
      HTTP_PROXY: process.env.HTTP_PROXY || `http://${localProxy}`,
      HTTPS_PROXY: process.env.HTTPS_PROXY || `http://${localProxy}`,
    } : process.env,
  }));
}

const common = ["-p", project, "-e", environment];
const appVars = railwayJson(["variables", ...common, "-s", appService, "--json"]);
const dbVars = railwayJson(["variables", ...common, "-s", databaseService, "--json"]);
const proxyList = railwayJson(["tcp-proxy", "list", ...common, "-s", databaseService, "--json"]);
const proxy = proxyList.proxies?.find((item) => item.applicationPort === 5432);
if (!proxy) throw new Error("Railway Postgres 尚未配置 TCP 代理");

let databaseHost = proxy.domain;
let databasePort = proxy.proxyPort;
let databaseTunnel;
if (localProxy) {
  const separator = localProxy.lastIndexOf(":");
  const socksHost = localProxy.slice(0, separator);
  const socksPort = Number(localProxy.slice(separator + 1));
  try {
    databaseTunnel = await startHttpConnectTunnel(socksHost, socksPort, proxy.domain, proxy.proxyPort);
    const address = databaseTunnel.address();
    databaseHost = "127.0.0.1";
    databasePort = typeof address === "object" && address ? address.port : proxy.proxyPort;
    console.log(`Railway 数据库已通过本机代理建立双网络隧道（127.0.0.1:${databasePort}）。`);
  } catch (error) {
    console.warn(`本机代理不可用，Railway 数据库改用直连：${error instanceof Error ? error.message : error}`);
  }
}
// The proxy hop is deliberately kept to one database connection. Prisma's
// default pool can otherwise open dozens of simultaneous tunnels, which makes
// Clash or Railway's TCP proxy intermittently reset the bridge after a while.
const databaseUrl = `postgresql://${encodeURIComponent(dbVars.PGUSER)}:${encodeURIComponent(dbVars.PGPASSWORD)}@${databaseHost}:${databasePort}/${encodeURIComponent(dbVars.PGDATABASE)}?connection_limit=1&pool_timeout=30`;
const require = createRequire(import.meta.url);
const tsxBin = join(dirname(require.resolve("tsx/package.json")), "dist", "cli.mjs");
const env = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  APP_ENCRYPTION_KEY: appVars.APP_ENCRYPTION_KEY,
  WORKER_JOB_KINDS: "CONTENT_GENERATE",
  BRIDGE_REQUEUE_NETWORK_ERRORS: "true",
  ...(process.env.OUTBOUND_PROXY_URL ? { OUTBOUND_PROXY_URL: process.env.OUTBOUND_PROXY_URL } : {}),
};

console.log("橙子讲义公司模型桥已启动：Railway 负责保存与分享，本机负责调用公司 GPT-5.4。");
console.log("保持本窗口运行；网络暂不可用时任务会停在 80%，恢复公司网络后自动继续。");
const child = spawn(process.execPath, [tsxBin, "src/worker/index.ts"], { cwd: appRoot, env, stdio: "inherit" });
child.on("exit", (code) => { process.exitCode = code ?? 0; });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { child.kill(signal); databaseTunnel?.close(); });
