import { ImageResponse } from "next/og";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const alt = "橙子讲义工坊电子讲义";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const book = await db.publishedFlipbook.findUnique({ where: { slug } });
  const title = book?.title ?? "小学语文电子讲义";
  const description = book?.description ?? "真读书 · 有深度 · 用得上";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "74px", color: "#fff9f2", background: "linear-gradient(135deg, #f68a51 0%, #bd633e 58%, #8e4938 100%)" }}>
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
