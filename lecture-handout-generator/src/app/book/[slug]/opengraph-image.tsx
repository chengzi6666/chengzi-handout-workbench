import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { objectStore } from "@/lib/object-store";

export const runtime = "nodejs";
export const alt = "橙子讲义工坊电子讲义";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const book = await db.publishedFlipbook.findUnique({ where: { slug }, include: { project: { include: { backgroundPack: { include: { assets: true } } } } } });
  const title = book?.title ?? "小学语文电子讲义";
  const description = book?.description ?? "真读书 · 有深度 · 用得上";
  const shareAsset = book?.project.backgroundPack?.assets.find((asset) => asset.role === "WECHAT_SHARE");
  let shareImage = "";
  if (shareAsset) {
    const bytes = Buffer.from(await objectStore().get(shareAsset.objectKey));
    const mime = /\.jpe?g$/iu.test(shareAsset.objectKey) ? "image/jpeg" : "image/png";
    shareImage = `data:${mime};base64,${bytes.toString("base64")}`;
  }
  const position = (book?.project.layoutConfig as { backgroundCrop?: Record<string, { x?: number; y?: number }> } | null)?.backgroundCrop?.WECHAT_SHARE;
  return new ImageResponse(
    (
      <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "74px", overflow: "hidden", color: "#fff9f2", background: "linear-gradient(135deg, #f68a51 0%, #bd633e 58%, #8e4938 100%)" }}>
        {shareImage ? <img alt="微信分享封面" src={shareImage} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: `${position?.x ?? 50}% ${position?.y ?? 50}%` }} /> : null}
        {shareImage ? <div style={{ position: "absolute", inset: 0, display: "flex", background: "linear-gradient(90deg, rgba(24,18,14,.72), rgba(24,18,14,.08) 72%)" }} /> : null}
        <div style={{ display: "flex", fontSize: 28, letterSpacing: 4 }}>橙子讲义工坊 · 电子翻页书</div>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 940 }}>
          <div style={{ display: "flex", fontSize: 70, fontWeight: 800, lineHeight: 1.2 }}>{title}</div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 31, opacity: 0.92 }}>{description}</div>
        </div>
        <div style={{ display: "flex", fontSize: 26 }}>真读书 · 有深度 · 用得上</div>
      </div>
    ),
    size,
  );
}
