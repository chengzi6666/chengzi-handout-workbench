import type { LessonContent } from "./content-schema";

// A4 页面上的一个括号空格要可写、也不能把右括号挤到下一行。
// 练习留白是给孩子手写的空间：括号题给 40 个全角空位，普通横线给 20 个。
// 预览层会把这些占位符渲染成连续书写线；DOCX 层会转换为原生下划线。
const PAREN_SPACE = "＿".repeat(40);
const UNDERLINE_SPACE = "＿".repeat(20);

export function formatStudentBlank(text: string) {
  return text
    .replace(/[＿_]{1,}/g, UNDERLINE_SPACE)
    .replace(/[（(]\s*[）)]/g, `（${PAREN_SPACE}）`)
    .replace(/(^|[：:\s])\*(?=$|[\s，。；])/g, `$1${UNDERLINE_SPACE}`);
}

export function studentOralFramework(content: LessonContent) {
  const source = content.oralFramework ?? "";
  if (/[（(]\s*[）)]|_{3,}|\*/.test(source)) return formatStudentBlank(source);
  return `今天学习的方法是《${content.technique}》。先说“人”：故事人物是＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿；再说“事”：从“＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿”这句话看出他/她＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿；最后说“理”：这件事告诉我＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿。`;
}

export function normalizeStudentFacingContent(content: LessonContent) {
  const next = JSON.parse(JSON.stringify(content)) as LessonContent & { oralReferenceAnswer?: string };
  next.practice = next.practice.map((item) => ({ ...item, prompt: formatStudentBlank(item.prompt) }));
  if (!next.oralReferenceAnswer && next.oralFramework && !/[（(]\s*[）)]|_{3,}|\*/.test(next.oralFramework)) next.oralReferenceAnswer = next.oralFramework;
  next.oralFramework = studentOralFramework(next);
  return next;
}
