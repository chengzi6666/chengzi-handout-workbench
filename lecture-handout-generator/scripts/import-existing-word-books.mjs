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
  console.log(`正在发布 ${book.title}…`);
  let started = args[`--resume-${book.code}`] ? { projectId: args[`--resume-${book.code}`] } : null;
  if (!started) {
    const start = await fetch(`${baseUrl}/api/import-existing-book/start`, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ title: book.title, grade: book.grade, description: `${book.grade}秋季五讲读写课：学生讲义与参考答案`, teachingYear: 2026 }) });
    started = await start.json().catch(() => ({}));
    if (!start.ok) throw new Error(`${book.title}初始化失败：${started.error || start.status}`);
  }
  for (const [collection, folder] of [["student", `${book.code}-student`], ["answers", `${book.code}-answer`]]) {
    const bookPages = await pages(folder);
    for (let index = 0; index < bookPages.length; index += 1) {
      const page = bookPages[index];
      let uploaded = false;
      for (let attempt = 1; attempt <= 5 && !uploaded; attempt += 1) {
        const form = new FormData();
        form.set("projectId", started.projectId);
        form.set("collection", collection);
        form.set("pageNumber", String(index + 1));
        form.set("page", new File([page.bytes], page.fileName, { type: "image/webp" }));
        try {
          const response = await fetch(`${baseUrl}/api/import-existing-book/page`, { method: "POST", headers: { cookie }, body: form });
          const reply = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(reply.error || String(response.status));
          uploaded = true;
        } catch (error) {
          if (attempt === 5) throw error;
          await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
        }
      }
    }
  }
  let reply;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/import-existing-book/finalize`, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ projectId: started.projectId }) });
      reply = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(reply.error || String(response.status));
      break;
    } catch (error) {
      if (attempt === 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
  const assets = {};
  for (const page of reply.pages || []) {
    const sourceFileId = String(page.pageImageUrl).split("/").pop();
    let mirrored;
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      try {
        const response = await fetch(`${baseUrl}/api/import-existing-book/sync-asset`, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ projectId: started.projectId, sourceFileId }) });
        mirrored = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(mirrored.error || String(response.status));
        break;
      } catch (error) {
        if (attempt === 5) throw error;
        await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
      }
    }
    assets[mirrored.pageImageUrl] = mirrored.fileID;
  }
  const manifest = await fetch(`${baseUrl}/api/import-existing-book/sync-manifest`, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ projectId: started.projectId, assets }) });
  const manifestReply = await manifest.json().catch(() => ({}));
  if (!manifest.ok) throw new Error(`${book.title}微信云目录提交失败：${manifestReply.error || manifest.status}`);
  reply.wechatCloud = manifestReply;
  console.log(JSON.stringify(reply));
}
