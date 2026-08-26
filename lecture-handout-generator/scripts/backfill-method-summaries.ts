import { db } from "../src/lib/db";
import { getConfiguredProvider, parseJsonResponse } from "../src/lib/ai/configured-provider";
import { isMethodSummaryPlaceholder, lessonContentSchema } from "../src/lib/handout/content-schema";

const placeholder = { test: isMethodSummaryPlaceholder };

async function main() {
  const rows = await db.lesson.findMany({ include: { project: true }, orderBy: { updatedAt: "asc" } });
  const targets = rows.filter((row) => {
    const value = (row.structuredContent as { methodSummary?: unknown } | null)?.methodSummary;
    return typeof value === "string" && placeholder.test(value);
  });
  for (const row of targets) {
    const raw = row.structuredContent as Record<string, unknown>;
    const content = lessonContentSchema.parse({ ...raw, methodSummary: "正在修复方法小结" });
    const provider = await getConfiguredProvider(row.project.selectedProviderId);
    let summary = "";
    try {
      const result = await provider.generateText({
        systemPrompt: "你是小学语文教研编辑。只输出 JSON，不要解释。",
        userPrompt: `为${row.project.grade}阅读课补写“方法小结”。不得写“请补充”或要求用户操作。必须写成具体、可执行的2—3句话，包含先做什么、再做什么、最后怎样表达或检验。课程题目：${content.title}；课堂方法：${content.technique}；阅读文段：${content.readingExcerpt.text.slice(0, 1500)}。输出 {"methodSummary":"..."}`,
        temperature: 0.15,
      });
      const parsed = parseJsonResponse(result.text) as Record<string, unknown>;
      summary = typeof parsed.methodSummary === "string" ? parsed.methodSummary.trim() : "";
    } catch { /* fall through to a usable non-placeholder summary */ }
    if (!summary || placeholder.test(summary)) summary = `本讲运用“${content.technique}”：先从文本中找出人物、事情和关键词句，再按“谁做了什么、结果怎样”的顺序整理信息，最后用原文证据说清自己的理解。`;
    await db.lesson.update({ where: { id: row.id }, data: { structuredContent: { ...content, methodSummary: summary } } });
    console.log(`已回填：${row.project.name} / 第${row.lessonNumber}讲`);
  }
  console.log(`完成：${targets.length} 讲`);
}

void main().finally(() => db.$disconnect());
