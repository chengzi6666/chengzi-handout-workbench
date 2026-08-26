import { Prisma, type ProcessingJob } from "@prisma/client";
import { db } from "@/lib/db";
import { objectStore } from "@/lib/object-store";
import { extractPdfTextPages, renderPdfPage } from "@/lib/pdf/extract";
import { extractWordText } from "@/lib/word/extract";
import { generateProjectContent } from "@/lib/handout/generate-project-content";
import { getConfiguredProvider } from "@/lib/ai/configured-provider";

let stopping = false;
process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });

async function recoverInterruptedJobs() {
  const staleBefore = new Date(Date.now() - 10 * 60 * 1000);
  const recovered = await db.processingJob.updateMany({
    where: { status: "RUNNING", startedAt: { lt: staleBefore }, project: { deletedAt: null } },
    data: { status: "QUEUED", startedAt: null, error: null, result: Prisma.JsonNull }
  });
  if (recovered.count > 0) console.log(`recovered ${recovered.count} interrupted job(s)`);
}

async function claimJob() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    // 回收站项目不再领取任务；已删除项目可能仍保留历史任务记录。
    const job = await db.processingJob.findFirst({ where: { status: "QUEUED", project: { deletedAt: null } }, orderBy: { createdAt: "asc" } });
    if (!job) return null;
    const claimed = await db.processingJob.updateMany({
      where: { id: job.id, status: "QUEUED" },
      data: { status: "RUNNING", startedAt: new Date(), attempts: { increment: 1 } }
    });
    if (claimed.count === 1) return db.processingJob.findUnique({ where: { id: job.id } });
  }
  return null;
}

async function ocrScannedPdf(pdf: Uint8Array, projectId: string, pageCount: number, report: (pageNumber: number, totalPages: number) => Promise<void>) {
  const project = await db.project.findFirst({ where: { id: projectId, deletedAt: null }, select: { selectedProviderId: true } });
  if (!project) throw new Error("OCR项目不存在");
  const provider = await getConfiguredProvider(project.selectedProviderId);
  const results: Array<{ pageNumber: number; text: string }> = [];
  // Batch five pages into one vision request. The group model is commonly capped at 5 RPM;
  // sending one page per request made a 45-page teaching deck take tens of minutes.
  const batchSize = 5;
  for (let start = 1; start <= pageCount; start += batchSize) {
    const stillActive = await db.project.findFirst({ where: { id: projectId, deletedAt: null }, select: { id: true } });
    if (!stillActive) throw new Error("项目已移入回收站，OCR已停止");
    const numbers = Array.from({ length: Math.min(batchSize, pageCount - start + 1) }, (_, offset) => start + offset);
    await report(numbers[0], pageCount);
    const rendered = await Promise.all(numbers.map((pageNumber) => renderPdfPage(pdf, pageNumber)));
    let response;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        response = await provider.generateVisionText({
          systemPrompt: "你是中文教材OCR校对员。严格输出JSON：{\"pages\":[{\"pageNumber\":数字,\"text\":\"原文\"}]}。逐字识别每张图片中可见的中文、数字、英文和标点；不要解释、不要Markdown、不要补写。版面无文字时text为空字符串。",
          userPrompt: `依次识别主讲PDF第${numbers.join("、")}页。图片顺序与页码顺序一致；保留段落换行，看不清的字符用□代替。`,
          imageDataUrls: rendered.map((page) => `data:image/png;base64,${Buffer.from(page.image).toString("base64")}`),
          temperature: 0
        });
        break;
      } catch (error) {
        const message = error instanceof Error ? error.message : "OCR调用失败";
        if (!message.includes("returned 429") || attempt === 3) throw error;
        // The current group model is commonly provisioned at 5 RPM. Back off before retrying
        // instead of marking the entire scanned course as failed.
        await new Promise((resolve) => setTimeout(resolve, 13_000 * (attempt + 1)));
      }
    }
    if (!response) throw new Error(`第${numbers[0]}页OCR未返回内容`);
    const raw = response.text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? response.text;
    let parsed: { pages?: Array<{ pageNumber?: number; text?: string }> };
    try { parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)); }
    catch { throw new Error(`第${numbers[0]}-${numbers.at(-1)}页OCR返回格式异常，请重试`); }
    for (const pageNumber of numbers) {
      const item = parsed.pages?.find((entry) => entry.pageNumber === pageNumber);
      results.push({ pageNumber, text: typeof item?.text === "string" ? item.text.trim() : "" });
    }
    // Leave a small buffer under the default 5 RPM quota; one 45-page deck is now 9 requests.
    if (start + batchSize <= pageCount) await new Promise((resolve) => setTimeout(resolve, 12_500));
  }
  return results;
}

async function parseSourceDocument(job: ProcessingJob) {
  const payload = job.payload as { sourceFileId?: string };
  if (!payload.sourceFileId) throw new Error("PDF解析任务缺少sourceFileId");
  const source = await db.sourceFile.findUnique({ where: { id: payload.sourceFileId }, include: { project: { select: { deletedAt: true } } } });
  if (!source || source.projectId !== job.projectId) throw new Error("PDF源文件不存在");
  if (source.project.deletedAt) throw new Error("项目已移入回收站，解析已停止");
  const pdf = await objectStore().get(source.objectKey);
  if (source.kind === "DOCUMENT") {
    const text = await extractWordText(pdf);
    await db.$transaction(async (transaction) => {
      await transaction.sourcePage.deleteMany({ where: { sourceFileId: source.id } });
      await transaction.sourcePage.create({ data: { sourceFileId: source.id, pageNumber: 1, extractedText: text } });
    });
    return { sourceFileId: source.id, pageCount: 1, type: "DOCUMENT" };
  }
  if (source.kind !== "PDF") throw new Error("只支持解析 PDF 或 DOCX 主讲文件");
  let pages = await extractPdfTextPages(pdf, async ({ pageNumber, totalPages }) => {
    const percent = Math.max(1, Math.round((pageNumber / totalPages) * 95));
    await db.processingJob.update({
      where: { id: job.id },
      data: { result: { stage: "extracting", pageNumber, totalPages, percent } as Prisma.InputJsonValue }
    });
  });
  // Many teaching decks are exported as image-only PDFs. Plain pdftotext correctly returns
  // blanks for them, so switch to the configured vision-capable company model rather than
  // sending an empty source to the lesson writer.
  if (pages.every((page) => page.text.replace(/\s/g, "").length === 0)) {
    await db.processingJob.update({
      where: { id: job.id },
      data: { result: { stage: "ocr", pageNumber: 0, totalPages: pages.length, percent: 4 } as Prisma.InputJsonValue }
    });
    pages = await ocrScannedPdf(pdf, job.projectId, pages.length, async (pageNumber, totalPages) => {
      const percent = Math.max(5, Math.round((pageNumber / totalPages) * 95));
      await db.processingJob.update({
        where: { id: job.id },
        data: { result: { stage: "ocr", pageNumber, totalPages, percent } as Prisma.InputJsonValue }
      });
    });
    if (pages.every((page) => page.text.replace(/\s/g, "").length === 0)) {
      throw new Error("扫描型PDF的OCR未识别出文字；请检查所选模型是否支持图片输入，或改上传DOCX版本");
    }
  }
  await db.processingJob.update({
    where: { id: job.id },
    data: { result: { stage: "writing", pageNumber: pages.length, totalPages: pages.length, percent: 99 } as Prisma.InputJsonValue }
  });
  await db.$transaction(async (transaction) => {
    await transaction.sourcePage.deleteMany({ where: { sourceFileId: source.id } });
    for (const page of pages) {
      await transaction.sourcePage.create({ data: { sourceFileId: source.id, pageNumber: page.pageNumber, extractedText: page.text } });
    }
  });
  return { sourceFileId: source.id, pageCount: pages.length };
}

async function runJob(job: ProcessingJob) {
  switch (job.kind) {
    case "PDF_PARSE": return parseSourceDocument(job);
    case "CONTENT_GENERATE": {
      const lessonIds = await generateProjectContent(job.projectId, async (completed, total) => {
        const percent = 82 + Math.round((completed / Math.max(total, 1)) * 16);
        await db.processingJob.update({
          where: { id: job.id },
          data: { result: { stage: "generating", pageNumber: completed, totalPages: total, percent } as Prisma.InputJsonValue },
        });
      });
      return { lessonIds };
    }
    default: throw new Error(`任务类型 ${job.kind} 尚未实现`);
  }
}

async function complete(job: ProcessingJob) {
  const activeProject = await db.project.findFirst({ where: { id: job.projectId, deletedAt: null }, select: { id: true } });
  if (!activeProject) return;
  try {
    const result = await runJob(job);
    // 删除源文件或移入回收站时，任务会在执行期间被移除/终止；此处用 updateMany 防止旧任务把 worker 拉崩。
    const finished = await db.processingJob.updateMany({ where: { id: job.id, status: "RUNNING" }, data: { status: "SUCCEEDED", result: result as Prisma.InputJsonValue, finishedAt: new Date() } });
    if (finished.count === 0) return;
    if (job.kind === "PDF_PARSE") {
      const remaining = await db.processingJob.count({ where: { projectId: job.projectId, kind: "PDF_PARSE", status: { in: ["QUEUED", "RUNNING"] } } });
      if (remaining === 0) {
        await db.project.update({ where: { id: job.projectId }, data: { status: "PARSING" } });
        const existingContentJob = await db.processingJob.count({ where: { projectId: job.projectId, kind: "CONTENT_GENERATE", status: { in: ["QUEUED", "RUNNING", "SUCCEEDED"] } } });
        if (existingContentJob === 0) await db.processingJob.create({ data: { projectId: job.projectId, kind: "CONTENT_GENERATE", payload: { automatic: true } } });
      }
    }
  } catch (error) {
    await db.processingJob.updateMany({ where: { id: job.id, status: "RUNNING" }, data: { status: "FAILED", error: error instanceof Error ? error.stack?.slice(0, 8000) ?? error.message : "未知错误", finishedAt: new Date() } });
    await db.project.updateMany({ where: { id: job.projectId, deletedAt: null }, data: { status: "FAILED" } });
  }
}

async function main() {
  console.log("handout worker started");
  await recoverInterruptedJobs();
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
