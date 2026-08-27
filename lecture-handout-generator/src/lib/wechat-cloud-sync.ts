import { createHash } from "node:crypto";
import sharp from "sharp";

type PublicBook = {
  slug: string;
  grade: string;
  title: string;
  description: string;
  updatedAt: Date | string;
  coverUrl: string | null;
  shareCoverUrl: string | null;
  pages: unknown[];
};

type SyncReply = { ok?: boolean; fileID?: string; error?: string };

const URL_PATTERN = /https?:\/\/[^\s\"'<>]+/g;

async function postSync(payload: unknown): Promise<SyncReply> {
  const endpoint = process.env.WECHAT_CLOUD_SYNC_URL;
  const secret = process.env.WECHAT_CLOUD_SYNC_SECRET;
  if (!endpoint || !secret) throw new Error("微信云同步尚未配置");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", "x-sync-secret": secret },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60_000),
  });
  const reply = (await response.json().catch(() => ({}))) as SyncReply;
  if (!response.ok || !reply.ok) throw new Error(reply.error || `微信云同步接口返回 ${response.status}`);
  return reply;
}

function assetExtension(url: string, contentType: string) {
  const pathname = new URL(url).pathname;
  const match = pathname.match(/\.([a-zA-Z0-9]{2,5})$/);
  if (match) return `.${match[1].toLowerCase()}`;
  if (contentType.includes("jpeg")) return ".jpg";
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("gif")) return ".gif";
  if (contentType.includes("svg")) return ".svg";
  return ".png";
}

async function uploadAsset(url: string, slug: string, version: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(45_000) });
  if (!response.ok) throw new Error(`电子书素材读取失败：${response.status}`);
  let bytes: Buffer<ArrayBufferLike> = Buffer.from(await response.arrayBuffer());
  let contentType = response.headers.get("content-type") || "application/octet-stream";
  let extension = assetExtension(url, contentType);
  if (contentType.startsWith("image/") && !contentType.includes("svg") && bytes.length > 700_000) {
    let width = 1800;
    let quality = 80;
    do {
      bytes = await sharp(bytes).rotate().resize({ width, height: Math.round(width * 1.42), fit: "inside", withoutEnlargement: true }).webp({ quality }).toBuffer();
      width = Math.round(width * 0.85);
      quality -= 8;
    } while (bytes.length > 900_000 && quality >= 52);
    contentType = "image/webp";
    extension = ".webp";
  }
  if (bytes.length > 1_100_000) throw new Error("单个电子书素材压缩后仍超过微信云限制");
  const digest = createHash("sha256").update(url).digest("hex").slice(0, 24);
  const cloudPath = `published-books/${slug}/${version}/${digest}${extension}`;
  const chunkSize = 48 * 1024;
  const total = Math.ceil(bytes.length / chunkSize);
  for (let index = 0; index < total; index += 1) {
    await postSync({
      mode: "assetChunk",
      slug,
      uploadId: digest,
      index,
      total,
      data: bytes.subarray(index * chunkSize, Math.min(bytes.length, (index + 1) * chunkSize)).toString("base64"),
    });
  }
  const reply = await postSync({ mode: "assetCommit", slug, uploadId: digest, total, cloudPath, contentType });
  if (!reply.fileID) throw new Error("微信云素材上传未返回文件地址");
  return reply.fileID;
}

export async function syncPublishedBookToWechat(book: PublicBook) {
  const version = String(new Date(book.updatedAt).getTime() || Date.now());
  const memo = new Map<string, Promise<string>>();
  const mirror = (url: string) => {
    let pending = memo.get(url);
    if (!pending) {
      pending = uploadAsset(url, book.slug, version);
      memo.set(url, pending);
    }
    return pending;
  };
  const transform = async (value: unknown): Promise<unknown> => {
    if (Array.isArray(value)) {
      const next = [];
      for (const item of value) next.push(await transform(item));
      return next;
    }
    if (value && typeof value === "object") {
      const entries: Array<[string, unknown]> = [];
      for (const [key, item] of Object.entries(value)) entries.push([key, await transform(item)]);
      return Object.fromEntries(entries);
    }
    if (typeof value !== "string") return value;
    const matches = [...new Set(value.match(URL_PATTERN) || [])];
    let next = value;
    for (const url of matches) next = next.split(url).join(await mirror(url));
    return next;
  };
  const mirrored = (await transform(book)) as PublicBook;
  const bookBytes = Buffer.from(JSON.stringify(mirrored), "utf8");
  const bookChunkSize = 48 * 1024;
  const bookTotal = Math.ceil(bookBytes.length / bookChunkSize);
  const bookUploadId = `book-${version}`;
  for (let index = 0; index < bookTotal; index += 1) {
    await postSync({
      mode: "bookChunk",
      slug: book.slug,
      uploadId: bookUploadId,
      index,
      total: bookTotal,
      data: bookBytes.subarray(index * bookChunkSize, Math.min(bookBytes.length, (index + 1) * bookChunkSize)).toString("base64"),
    });
  }
  await postSync({ mode: "bookCommit", slug: book.slug, uploadId: bookUploadId, total: bookTotal });
  return { assetCount: memo.size };
}
