import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const args = Object.fromEntries(process.argv.slice(2).map((item) => item.split(/=(.*)/su).slice(0, 2)));
const baseUrl = (args["--base-url"] || "http://localhost:3100").replace(/\/$/u, "");
const root = args["--pages-root"];
const employeeNumber = args["--employee-number"];
const name = args["--name"];
if (!root || !employeeNumber || !name) throw new Error("需要 --pages-root、--employee-number 和 --name");

const books = [
  { code: "g1", grade: "0升1", title: "一年级读写课电子讲义" },
  { code: "g2", grade: "1升2", title: "二年级读写课电子讲义" },
  { code: "g3", grade: "2升3", title: "三年级读写课电子讲义" },
  { code: "g4", grade: "3升4", title: "四年级读写课电子讲义" },
  { code: "g5", grade: "4升5", title: "五年级读写课电子讲义" },
];

const login = await fetch(`${baseUrl}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ employeeNumber, name }) });
if (!login.ok) throw new Error(`登录失败：${login.status} ${await login.text()}`);
const cookie = login.headers.getSetCookie?.().map((item) => item.split(";", 1)[0]).join("; ") || login.headers.get("set-cookie")?.split(";", 1)[0];
if (!cookie) throw new Error("登录接口未返回会话 Cookie");

async function pages(folder) {
  const dir = join(root, folder);
  const names = (await readdir(dir)).filter((item) => item.endsWith(".webp")).sort();
  return Promise.all(names.map(async (fileName) => ({ fileName, bytes: await readFile(join(dir, fileName)) })));
}

for (const book of books) {
  const form = new FormData();
  form.set("title", book.title);
  form.set("grade", book.grade);
  form.set("description", `${book.grade}秋季五讲读写课：学生讲义与参考答案`);
  form.set("teachingYear", "2026");
  for (const page of await pages(`${book.code}-student`)) form.append("studentPages", new File([page.bytes], page.fileName, { type: "image/webp" }));
  for (const page of await pages(`${book.code}-answer`)) form.append("answerPages", new File([page.bytes], page.fileName, { type: "image/webp" }));
  console.log(`正在发布 ${book.title}…`);
  const response = await fetch(`${baseUrl}/api/import-existing-book`, { method: "POST", headers: { cookie }, body: form });
  const reply = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${book.title}失败：${reply.error || response.status}`);
  console.log(JSON.stringify(reply));
}