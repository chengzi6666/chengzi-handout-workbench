import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { writeFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const tsxBin = join(dirname(require.resolve("tsx/package.json")), "dist", "cli.mjs");
const children = [
  spawn(process.execPath, [nextBin, "start"], { cwd: process.cwd(), env: process.env, stdio: "inherit" }),
  spawn(process.execPath, [tsxBin, "src/worker/index.ts"], { cwd: process.cwd(), env: process.env, stdio: "inherit" }),
];

// 公司内网模型网关桥：frps 监听 7000（公网走 Railway 域名 WebSocket），
// 本机 frpc 反向连入后，容器内 127.0.0.1:9000 即公司 ai-service.tal.com。
// 未配置 FRPS_TOKEN 时（本地开发）不启动，行为与原来完全一致。
if (process.env.FRPS_TOKEN) {
  writeFileSync("frps.toml", [
    "bindPort = 7000",
    `auth.token = ${JSON.stringify(process.env.FRPS_TOKEN)}`,
    "allowPorts = [{ start = 9000, end = 9000 }]"
  ].join("\n"), "utf8");
  console.log("[bridge] frps 已启动：本机 frpc 通过 WebSocket 域名接入，容器内 127.0.0.1:9000 转发公司模型网关");
  children.push(spawn("frps", ["-c", "frps.toml"], { cwd: process.cwd(), env: process.env, stdio: "inherit" }));
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
