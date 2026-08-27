import { createHash } from "node:crypto";

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
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 7 * 1024 * 1024) throw new Error("单个电子书素材超过 7MB，请压缩后再发布");
  const contentType = response.headers.get("content-type") || "application/octet-stream";
  const digest = createHash("sha256").update(url).digest("hex").slice(0, 24);
  const reply = await postSync({
    mode: "asset",
    slug,
    cloudPath: `published-books/${slug}/${version}/${digest}${assetExtension(url, contentType)}`,
    contentType,
    data: bytes.toString("base64"),
  });
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
    if (Array.isArray(value)) return Promise.all(value.map(transform));
    if (value && typeof value === "object") {
      return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await transform(item)])));
    }
    if (typeof value !== "string") return value;
    const matches = [...new Set(value.match(URL_PATTERN) || [])];
    let next = value;
    for (const url of matches) next = next.split(url).join(await mirror(url));
    return next;
  };
  const mirrored = (await transform(book)) as PublicBook;
  await postSync({ mode: "seed", slug: book.slug, book: mirrored });
  return { assetCount: memo.size };
}
