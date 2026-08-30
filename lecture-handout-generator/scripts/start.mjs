import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { writeFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const tsxBin = join(dirname(require.resolve("tsx/package.json")), "dist", "cli.mjs");
// WEB_PORT may explicitly separate the website from an optional TCP bridge.
// Otherwise Railway's assigned PORT must be respected so its router and
// healthcheck reach the same listener.
const webPort = process.env.WEB_PORT || process.env.PORT || "3000";
const children = [
  spawn(process.execPath, [nextBin, "start", "-p", webPort], { cwd: process.cwd(), env: process.env, stdio: "inherit" }),
];
// The company gateway is reachable only from the user's corporate network.
// In local-bridge mode Railway owns the web/database layer while the local
// bridge owns model execution; starting a second Railway worker would race the
// local bridge and mark jobs failed before the corporate-network worker sees
// them.
if (process.env.AI_EXECUTION_MODE !== "local-bridge") {
  children.push(spawn(process.execPath, [tsxBin, "src/worker/index.ts"], { cwd: process.cwd(), env: process.env, stdio: "inherit" }));
}

// 公司内网模型网关桥：frps 监听 7000（公网走 Railway TCP 代理），
// 本机 frpc 反向连入后，容器内 127.0.0.1:9000 即公司 ai-service.tal.com。
// 未配置 FRPS_TOKEN 时（本地开发）不启动，行为与原来完全一致。
console.log("[bridge] FRPS_TOKEN present:", Boolean(process.env.FRPS_TOKEN));
if (process.env.FRPS_TOKEN && process.env.AI_EXECUTION_MODE !== "local-bridge") {
  writeFileSync("frps.toml", [
    "bindPort = 7000",
    `auth.token = ${JSON.stringify(process.env.FRPS_TOKEN)}`,
    "allowPorts = [{ start = 9000, end = 9000 }]"
  ].join("\n"), "utf8");
  console.log("[bridge] frps starting on :7000, tunnel port 9000 -> 本机 frpc -> ai-service.tal.com");
  try {
    const frps = spawn("/usr/local/bin/frps", ["-c", "frps.toml"], { cwd: process.cwd(), env: process.env, stdio: "inherit" });
    frps.on("error", (err) => console.error("[bridge] frps spawn error:", err.message));
    children.push(frps);
  } catch (e) {
    console.error("[bridge] failed to start frps:", e);
  }
}

let stopping = false;
function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (!child.killed) child.kill(signal);
}
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
for (const child of children) child.on("exit", (code) => {
  if (!stopping && code && code !== 0) {
    stop();
    process.exitCode = code;
  }
});
