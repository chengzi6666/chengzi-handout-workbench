import type { LessonContent } from "./content-schema";

// A4 页面上的一个括号空格要可写、也不能把右括号挤到下一行。
const PAREN_SPACE = "　".repeat(24);
const UNDERLINE_SPACE = "＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿";

export function formatStudentBlank(text: string) {
  return text
    .replace(/_{1,}/g, UNDERLINE_SPACE)
    .replace(/[（(]\s*[）)]/g, `（${PAREN_SPACE}）`)
    .replace(/(^|[：:\s])\*(?=$|[\s，。；])/g, `$1${UNDERLINE_SPACE}`);
}

export function studentOralFramework(content: LessonContent) {
  const source = content.oralFramework ?? "";
  if (/[（(]\s*[）)]|_{3,}|\*/.test(source)) return formatStudentBlank(source);
  return `今天我学习了“${content.technique}”。我先说清________，再用原文“________”说明________，最后我想告诉大家：________。`;
}

export function normalizeStudentFacingContent(content: LessonContent) {
  const next = JSON.parse(JSON.stringify(content)) as LessonContent & { oralReferenceAnswer?: string };
  next.practice = next.practice.map((item) => ({ ...item, prompt: formatStudentBlank(item.prompt) }));
  if (!next.oralReferenceAnswer && next.oralFramework && !/[（(]\s*[）)]|_{3,}|\*/.test(next.oralFramework)) next.oralReferenceAnswer = next.oralFramework;
  next.oralFramework = studentOralFramework(next);
  return next;
}
