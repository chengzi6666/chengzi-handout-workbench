import type { LessonContent } from "./content-schema";

// A4 页面上的一个括号空格要可写、也不能把右括号挤到下一行。
// 练习留白是给孩子手写的空间：括号题给 40 个下划线，普通横线给 20 个。
// 这里刻意使用用户可见的 ASCII 下划线，而不是短横（-）或 CSS 虚线；DOCX 层再转换为原生连续下划线。
const PAREN_SPACE = "_".repeat(40);
const UNDERLINE_SPACE = "_".repeat(20);

export function formatStudentBlank(text: string) {
  return text
    .replace(/[＿_]{1,}/g, UNDERLINE_SPACE)
    .replace(/[-—–]{3,}/g, UNDERLINE_SPACE)
    .replace(/[（(]\s*[）)]/g, `（${PAREN_SPACE}）`)
    .replace(/(^|[：:\s])\*(?=$|[\s，。；])/g, `$1${UNDERLINE_SPACE}`);
}

export function studentOralFramework(content: LessonContent) {
  const source = content.oralFramework ?? "";
  if (/[（(]\s*[）)]|[_＿-]{3,}|\*/.test(source)) return formatStudentBlank(source);
  return `今天学习的方法是《${content.technique}》。先说“人”：故事人物是____________________；再说“事”：从“____________________”这句话看出他/她____________________；最后说“理”：这件事告诉我____________________。`;
}

export function normalizeStudentFacingContent(content: LessonContent) {
  const next = JSON.parse(JSON.stringify(content)) as LessonContent & { oralReferenceAnswer?: string };
  next.practice = next.practice.map((item) => ({ ...item, prompt: formatStudentBlank(item.prompt) }));
  if (!next.oralReferenceAnswer && next.oralFramework && !/[（(]\s*[）)]|[_＿-]{3,}|\*/.test(next.oralFramework)) next.oralReferenceAnswer = next.oralFramework;
  next.oralFramework = studentOralFramework(next);
  return next;
}
