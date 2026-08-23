import { db } from "@/lib/db";
import { renderPdfPage } from "@/lib/pdf/extract";
import { objectStore } from "@/lib/storage/object-store";

export async function getOrCreateSourcePageImage(pageId: string) {
  const page = await db.sourcePage.findUnique({ where: { id: pageId }, include: { sourceFile: true } });
  if (!page) return null;
  if (page.imageObjectKey) return { data: await objectStore().get(page.imageObjectKey), type: "png" as const };
  if (page.sourceFile.kind !== "PDF") return null;
  const rendered = await renderPdfPage(await objectStore().get(page.sourceFile.objectKey), page.pageNumber);
  const key = `projects/${page.sourceFile.projectId}/parsed/${page.sourceFileId}/page-${String(page.pageNumber).padStart(3, "0")}.png`;
  await objectStore().put({ key, body: rendered.image, contentType: "image/png" });
  await db.sourcePage.update({ where: { id: page.id }, data: { imageObjectKey: key, width: rendered.width, height: rendered.height } });
  return { data: rendered.image, type: "png" as const };
}
