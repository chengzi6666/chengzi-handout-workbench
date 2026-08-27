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
  if (!["https:", "http:"].includes(url.protocol) || !ALLOWED_HOSTS.has(url.hostname)) throw new Error("拒绝同步非讲义系统资源");
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
      if (response.statusCode < 200 || response.statusCode >= 300) { response.resume(); return reject(new Error("资源接口返回 " + response.statusCode)); }
      const chunks = [];
      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => {
        const body = Buffer.concat(chunks);
        if (body.length > 50 * 1024 * 1024) return reject(new Error("单个图片超过 50MB"));
        if (binary) return resolve(body);
        try { resolve(JSON.parse(body.toString("utf8"))); } catch { reject(new Error("书籍数据格式错误")); }
      });
    });
    req.on("timeout", () => req.destroy(new Error("资源读取超时")));
    req.on("error", reject);
  });
}
function isMirrorableUrl(value) { try { checkedUrl(value); return true; } catch { return false; } }
function assetExtension(value) { const match = checkedUrl(value).pathname.match(/\.([a-zA-Z0-9]{2,5})$/); return match ? "." + match[1].toLowerCase() : ".png"; }
async function mirrorUrl(url, slug, version, memo) {
  if (memo.has(url)) return memo.get(url);
  const pending = (async () => {
    const digest = crypto.createHash("sha256").update(url).digest("hex").slice(0, 24);
    const cloudPath = `published-books/${slug}/${version}/${digest}${assetExtension(url)}`;
    return (await cloud.uploadFile({ cloudPath, fileContent: await request(url, true) })).fileID;
  })();
  memo.set(url, pending);
  try { return await pending; } catch (error) { memo.delete(url); throw error; }
}
async function mirrorValue(value, slug, version, memo) {
  if (Array.isArray(value)) return Promise.all(value.map((item) => mirrorValue(item, slug, version, memo)));
  if (value && typeof value === "object") return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await mirrorValue(item, slug, version, memo)])));
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
  try { const cached = await document.get(); if (cached.data && cached.data.sourceVersion === version && cached.data.book) return cached.data.book; } catch (error) { if (!String((error && error.errMsg) || error).includes("does not exist")) console.warn("读取电子书缓存失败", error); }
  const book = await mirrorValue(sourceBook, slug, version, new Map());
  await document.set({ data: { sourceVersion: version, syncedAt: db.serverDate(), book } });
  return book;
}
async function storedBook(slug) {
  try { const cached = await db.collection(CACHE_COLLECTION).doc(slug).get(); return cached.data && cached.data.book ? cached.data.book : null; }
  catch (error) { if (!String((error && error.errMsg) || error).includes("does not exist")) console.warn("读取电子书缓存失败", error); return null; }
}
async function seedBook(slug, book) {
  if (!book || !Array.isArray(book.pages)) throw new Error("电子书数据格式错误");
  await db.collection(CACHE_COLLECTION).doc(slug).set({ data: { sourceVersion: String(new Date(book.updatedAt || 0).getTime() || Date.now()), syncedAt: db.serverDate(), book } });
  return book;
}
function chunkDocumentId(slug, uploadId, index) {
  return `_chunk_${slug}_${String(uploadId).replace(/[^A-Za-z0-9_-]/g, "")}_${index}`;
}
async function storeAssetChunk(event) {
  const index = Number(event.index);
  const total = Number(event.total);
  if (!Number.isInteger(index) || !Number.isInteger(total) || index < 0 || total < 1 || index >= total || total > 200) throw new Error("素材分块参数无效");
  const data = String(event.data || "");
  if (!data || data.length > 90 * 1024) throw new Error("素材分块大小无效");
  await db.collection(CACHE_COLLECTION).doc(chunkDocumentId(event.slug, event.uploadId, index)).set({ data: { kind: "assetChunk", uploadId: event.uploadId, index, total, data } });
  return true;
}
async function commitAssetChunks(event) {
  const total = Number(event.total);
  if (!Number.isInteger(total) || total < 1 || total > 200) throw new Error("素材分块总数无效");
  const ids = Array.from({ length: total }, (_, index) => chunkDocumentId(event.slug, event.uploadId, index));
  const rows = await Promise.all(ids.map((id) => db.collection(CACHE_COLLECTION).doc(id).get()));
  const fileContent = Buffer.concat(rows.map((row, index) => {
    if (!row.data || row.data.index !== index) throw new Error("素材分块不完整");
    return Buffer.from(row.data.data, "base64");
  }));
  if (fileContent.length > 8 * 1024 * 1024) throw new Error("云端素材大小无效");
  const cloudPath = String(event.cloudPath || "");
  if (!cloudPath.startsWith(`published-books/${event.slug}/`) || !/^[A-Za-z0-9_./-]+$/.test(cloudPath)) throw new Error("云端素材路径无效");
  const uploaded = await cloud.uploadFile({ cloudPath, fileContent });
  await Promise.all(ids.map((id) => db.collection(CACHE_COLLECTION).doc(id).remove().catch(() => null)));
  return uploaded.fileID;
}async function uploadAsset(event) {
  const cloudPath = String(event.cloudPath || "");
  if (!cloudPath.startsWith(`published-books/${event.slug}/`) || !/^[A-Za-z0-9_./-]+$/.test(cloudPath)) throw new Error("云端素材路径无效");
  const data = Buffer.from(String(event.data || ""), "base64");
  if (!data.length || data.length > 8 * 1024 * 1024) throw new Error("云端素材大小无效");
  return (await cloud.uploadFile({ cloudPath, fileContent: data })).fileID;
}
function parseHttpEvent(event) {
  if (!event || (!event.httpMethod && !event.requestContext)) return null;
  let body = event.body || {};
  if (typeof body === "string") {
    try { body = JSON.parse(event.isBase64Encoded ? Buffer.from(body, "base64").toString("utf8") : body); } catch { body = {}; }
  }
  const headers = event.headers || {};
  return { body, secret: headers["x-sync-secret"] || headers["X-Sync-Secret"] || "" };
}
function httpReply(statusCode, payload) { return { statusCode, headers: { "content-type": "application/json; charset=utf-8" }, body: JSON.stringify(payload) }; }
async function handle(event, trusted = false) {
  const slug = String(event.slug || "").replace(/[^A-Za-z0-9_-]/g, "");
  if (!slug) return { ok: false, error: "缺少书籍编号" };
  if ((["seed", "asset", "assetChunk", "assetCommit"].includes(event.mode)) && !trusted) throw new Error("无权写入电子书缓存");
  if (event.mode === "assetChunk") return { ok: true, stored: await storeAssetChunk({ ...event, slug }) };
  if (event.mode === "assetCommit") return { ok: true, fileID: await commitAssetChunks({ ...event, slug }) };
  if (event.mode === "asset") return { ok: true, fileID: await uploadAsset({ ...event, slug }) };
  if (event.mode === "seed") return { ok: true, book: await seedBook(slug, event.book) };
  const stored = await storedBook(slug);
  if (stored) return { ok: true, book: stored };
  const sourceBook = await request((process.env.BOOK_API_BASE || DEFAULT_API_BASE) + "/api/public/books/" + slug);
  return { ok: true, book: await cachedBook(slug, sourceBook) };
}
exports.main = async (event) => {
  const httpEvent = parseHttpEvent(event);
  try {
    if (httpEvent) {
      if (!process.env.SYNC_SECRET || httpEvent.secret !== process.env.SYNC_SECRET) return httpReply(401, { ok: false, error: "同步认证失败" });
      return httpReply(200, await handle(httpEvent.body, true));
    }
    const wxContext = cloud.getWXContext();
    return await handle(event || {}, !(wxContext && wxContext.OPENID));
  } catch (error) {
    console.error("电子书同步失败", error);
    const payload = { ok: false, error: error.message || "电子书同步失败" };
    return httpEvent ? httpReply(500, payload) : payload;
  }
};
