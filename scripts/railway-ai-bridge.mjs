import { execFileSync, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const project = "9c56ab23-258a-4918-a71d-229c9a1db596";
const environment = "e7f9d4a5-0d28-4778-9cc9-e96dbdc6e110";
const appService = "212ab9c5-bf0b-477d-a3b5-6bae394a518b";
const databaseService = "9a40c03e-ae0e-4901-bcfb-d63aff812964";
function railwayJson(args) {
  const executable = process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : "npx";
  const commandArgs = process.platform === "win32"
    ? ["/d", "/s", "/c", `npx -y @railway/cli@latest ${args.join(" ")}`]
    : ["-y", "@railway/cli@latest", ...args];
  return JSON.parse(execFileSync(executable, commandArgs, {
    cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "inherit"],
  }));
}

const common = ["-p", project, "-e", environment];
const appVars = railwayJson(["variables", ...common, "-s", appService, "--json"]);
const dbVars = railwayJson(["variables", ...common, "-s", databaseService, "--json"]);
const proxyList = railwayJson(["tcp-proxy", "list", ...common, "-s", databaseService, "--json"]);
const proxy = proxyList.proxies?.find((item) => item.applicationPort === 5432);
if (!proxy) throw new Error("Railway Postgres 尚未配置 TCP 代理");

const databaseUrl = `postgresql://${encodeURIComponent(dbVars.PGUSER)}:${encodeURIComponent(dbVars.PGPASSWORD)}@${proxy.domain}:${proxy.proxyPort}/${encodeURIComponent(dbVars.PGDATABASE)}?sslmode=require`;
const require = createRequire(import.meta.url);
const tsxBin = join(dirname(require.resolve("tsx/package.json")), "dist", "cli.mjs");
const env = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  APP_ENCRYPTION_KEY: appVars.APP_ENCRYPTION_KEY,
  WORKER_JOB_KINDS: "CONTENT_GENERATE",
  BRIDGE_REQUEUE_NETWORK_ERRORS: "true",
  OUTBOUND_PROXY_URL: process.env.OUTBOUND_PROXY_URL || "http://127.0.0.1:7890",
};

console.log("橙子讲义公司模型桥已启动：Railway 负责保存与分享，本机负责调用公司 GPT-5.4。");
console.log("保持本窗口运行；网络暂不可用时任务会停在 80%，恢复公司网络后自动继续。");
const child = spawn(process.execPath, [tsxBin, "src/worker/index.ts"], { cwd: process.cwd(), env, stdio: "inherit" });
child.on("exit", (code) => { process.exitCode = code ?? 0; });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
