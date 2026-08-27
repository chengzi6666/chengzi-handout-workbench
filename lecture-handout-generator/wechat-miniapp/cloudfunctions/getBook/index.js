const cloud = require("wx-server-sdk");
const crypto = require("crypto");
const http = require("http");
const https = require("https");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const DEFAULT_API_BASE = "https://chengzi-handout-workbench-production.up.railway.app";
const CACHE_COLLECTION = "published_flipbooks";
const ALLOWED_HOSTS = new Set([
  "chengzi-handout-workbench-production.up.railway.app",
  "lecture-handout-generator-production.up.railway.app",
]);

function checkedUrl(value) {
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol) || !ALLOWED_HOSTS.has(url.hostname)) {
    throw new Error("拒绝同步非讲义系统资源");
  }
  return url;
}

function request(value, binary = false, redirects = 0) {
  const url = checkedUrl(value);
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const req = client.get(url, { timeout: 30000 }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        if (redirects >= 5) return reject(new Error("资源重定向次数过多"));
        const redirected = new URL(response.headers.location, url).toString();
        try { checkedUrl(redirected); } catch (error) { return reject(error); }
        return resolve(request(redirected, binary, redirects + 1));
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        return reject(new Error("资源接口返回 " + response.statusCode));
      }
      const chunks = [];
      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => {
        const body = Buffer.concat(chunks);
        if (body.length > 50 * 1024 * 1024) return reject(new Error("单个图片超过 50MB"));
        if (binary) return resolve(body);
        try { resolve(JSON.parse(body.toString("utf8"))); }
        catch { reject(new Error("书籍数据格式错误")); }
      });
    });
    req.on("timeout", () => req.destroy(new Error("资源读取超时")));
    req.on("error", reject);
  });
}

function isMirrorableUrl(value) {
  try { checkedUrl(value); return true; } catch { return false; }
}

function assetExtension(value) {
  const match = checkedUrl(value).pathname.match(/\.([a-zA-Z0-9]{2,5})$/);
  return match ? "." + match[1].toLowerCase() : ".png";
}

async function mirrorUrl(url, slug, version, memo) {
  if (memo.has(url)) return memo.get(url);
  const pending = (async () => {
    const digest = crypto.createHash("sha256").update(url).digest("hex").slice(0, 24);
    const cloudPath = `published-books/${slug}/${version}/${digest}${assetExtension(url)}`;
    const uploaded = await cloud.uploadFile({ cloudPath, fileContent: await request(url, true) });
    return uploaded.fileID;
  })();
  memo.set(url, pending);
  try { return await pending; }
  catch (error) { memo.delete(url); throw error; }
}

async function mirrorValue(value, slug, version, memo) {
  if (Array.isArray(value)) return Promise.all(value.map((item) => mirrorValue(item, slug, version, memo)));
  if (value && typeof value === "object") {
    const entries = await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await mirrorValue(item, slug, version, memo)]));
    return Object.fromEntries(entries);
  }
  if (typeof value !== "string") return value;
  if (isMirrorableUrl(value)) return mirrorUrl(value, slug, version, memo);
  const matches = [...new Set(value.match(/https?:\/\/[^\s\"'<>]+/g) || [])].filter(isMirrorableUrl);
  let next = value;
  for (const url of matches) next = next.split(url).join(await mirrorUrl(url, slug, version, memo));
  return next;
}

async function cachedBook(slug, sourceBook) {
  const version = String(new Date(sourceBook.updatedAt || 0).getTime() || Date.now());
  const document = db.collection(CACHE_COLLECTION).doc(slug);
  try {
    const cached = await document.get();
    if (cached.data && cached.data.sourceVersion === version && cached.data.book) return cached.data.book;
  } catch (error) {
    if (!String((error && error.errMsg) || error).includes("does not exist")) console.warn("读取电子书缓存失败", error);
  }
  const book = await mirrorValue(sourceBook, slug, version, new Map());
  await document.set({ data: { sourceVersion: version, syncedAt: db.serverDate(), book } });
  return book;
}

async function storedBook(slug) {
  const document = db.collection(CACHE_COLLECTION).doc(slug);
  try {
    const cached = await document.get();
    return cached.data && cached.data.book ? cached.data.book : null;
  } catch (error) {
    if (!String((error && error.errMsg) || error).includes("does not exist")) {
      console.warn("读取电子书缓存失败", error);
    }
    return null;
  }
}

async function seedBook(slug, book) {
  const wxContext = cloud.getWXContext();
  // Mini-program calls always include an OPENID. Seeding is reserved for an
  // administrator invocation through CloudBase CLI, so readers cannot replace
  // a published book from the client.
  if (wxContext && wxContext.OPENID) throw new Error("无权写入电子书缓存");
  if (!book || !Array.isArray(book.pages)) throw new Error("电子书数据格式错误");
  await db.collection(CACHE_COLLECTION).doc(slug).set({
    data: {
      sourceVersion: String(new Date(book.updatedAt || 0).getTime() || Date.now()),
      syncedAt: db.serverDate(),
      book,
    },
  });
  return book;
}

exports.main = async (event) => {
  const slug = String(event.slug || "").replace(/[^A-Za-z0-9_-]/g, "");
  if (!slug) return { ok: false, error: "缺少书籍编号" };
  try {
    if (event.mode === "seed") return { ok: true, book: await seedBook(slug, event.book) };
    const stored = await storedBook(slug);
    if (stored) return { ok: true, book: stored };
    const base = process.env.BOOK_API_BASE || DEFAULT_API_BASE;
    const sourceBook = await request(base + "/api/public/books/" + slug);
    return { ok: true, book: await cachedBook(slug, sourceBook) };
  } catch (error) {
    console.error("电子书同步失败", error);
    return { ok: false, error: error.message || "电子书同步失败" };
  }
};
