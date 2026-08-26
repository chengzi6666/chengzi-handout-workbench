import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const tsxBin = join(dirname(require.resolve("tsx/package.json")), "dist", "cli.mjs");
const children = [
  spawn(process.execPath, [nextBin, "start"], { cwd: process.cwd(), env: process.env, stdio: "inherit" }),
  spawn(process.execPath, [tsxBin, "src/worker/index.ts"], { cwd: process.cwd(), env: process.env, stdio: "inherit" }),
];

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
