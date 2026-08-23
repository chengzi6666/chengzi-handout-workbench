import { Prisma, type ProcessingJob } from "@prisma/client";
import { db } from "@/lib/db";
import { objectStore } from "@/lib/storage/object-store";
import { extractPdfPages } from "@/lib/pdf/extract";

let stopping = false;
process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });

async function claimJob() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const job = await db.processingJob.findFirst({ where: { status: "QUEUED" }, orderBy: { createdAt: "asc" } });
    if (!job) return null;
    const claimed = await db.processingJob.updateMany({
      where: { id: job.id, status: "QUEUED" },
      data: { status: "RUNNING", startedAt: new Date(), attempts: { increment: 1 } }
    });
    if (claimed.count === 1) return db.processingJob.findUnique({ where: { id: job.id } });
  }
  return null;
}

async function parsePdf(job: ProcessingJob) {
  const payload = job.payload as { sourceFileId?: string };
  if (!payload.sourceFileId) throw new Error("PDF解析任务缺少sourceFileId");
  const source = await db.sourceFile.findUnique({ where: { id: payload.sourceFileId } });
  if (!source || source.projectId !== job.projectId) throw new Error("PDF源文件不存在");
  const pdf = await objectStore().get(source.objectKey);
  const pages = await extractPdfPages(pdf, async ({ pageNumber, totalPages }) => {
    const percent = Math.max(1, Math.round((pageNumber / totalPages) * 90));
    await db.processingJob.update({
      where: { id: job.id },
      data: { result: { stage: "extracting", pageNumber, totalPages, percent } as Prisma.InputJsonValue }
    });
  });
  const storedPages: Array<(typeof pages)[number] & { imageObjectKey: string }> = [];
  for (const [index, page] of pages.entries()) {
    const imageObjectKey = `projects/${job.projectId}/parsed/${source.id}/page-${String(page.pageNumber).padStart(3, "0")}.png`;
    await objectStore().put({ key: imageObjectKey, body: page.image, contentType: "image/png" });
    storedPages.push({ ...page, imageObjectKey });
    const percent = 90 + Math.max(1, Math.round(((index + 1) / pages.length) * 9));
    await db.processingJob.update({
      where: { id: job.id },
      data: { result: { stage: "saving", pageNumber: index + 1, totalPages: pages.length, percent } as Prisma.InputJsonValue }
    });
  }
  await db.processingJob.update({
    where: { id: job.id },
    data: { result: { stage: "writing", pageNumber: pages.length, totalPages: pages.length, percent: 99 } as Prisma.InputJsonValue }
  });
  await db.$transaction(async (transaction) => {
    await transaction.sourcePage.deleteMany({ where: { sourceFileId: source.id } });
    for (const page of storedPages) {
      await transaction.sourcePage.create({ data: { sourceFileId: source.id, pageNumber: page.pageNumber, extractedText: page.text, imageObjectKey: page.imageObjectKey, width: page.width, height: page.height } });
    }
  });
  return { sourceFileId: source.id, pageCount: pages.length };
}

async function runJob(job: ProcessingJob) {
  switch (job.kind) {
    case "PDF_PARSE": return parsePdf(job);
    default: throw new Error(`任务类型 ${job.kind} 尚未实现`);
  }
}

async function complete(job: ProcessingJob) {
  try {
    const result = await runJob(job);
    await db.processingJob.update({ where: { id: job.id }, data: { status: "SUCCEEDED", result: result as Prisma.InputJsonValue, finishedAt: new Date() } });
    if (job.kind === "PDF_PARSE") {
      const remaining = await db.processingJob.count({ where: { projectId: job.projectId, kind: "PDF_PARSE", status: { in: ["QUEUED", "RUNNING"] } } });
      if (remaining === 0) await db.project.update({ where: { id: job.projectId }, data: { status: "TEXT_REVIEW" } });
    }
  } catch (error) {
    await db.processingJob.update({ where: { id: job.id }, data: { status: "FAILED", error: error instanceof Error ? error.stack?.slice(0, 8000) ?? error.message : "未知错误", finishedAt: new Date() } });
    await db.project.update({ where: { id: job.projectId }, data: { status: "FAILED" } });
  }
}

async function main() {
  console.log("handout worker started");
  while (!stopping) {
    const job = await claimJob();
    if (job) await complete(job);
    else await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exitCode = 1;
});
