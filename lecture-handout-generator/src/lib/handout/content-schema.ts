import { z } from "zod";

export const conversationTopicSchema = z.object({
  question: z.string().trim().min(1),
  referenceAnswer: z.string().trim().min(1)
});

export const lessonContentSchema = z.object({
  lessonNumber: z.number().int().positive(),
  title: z.string().trim().min(1),
  subtitle: z.string().trim().optional(),
  technique: z.string().trim().min(1),
  learningGoals: z.array(z.string().trim().min(1)).min(3),
  curriculumAlignment: z.array(z.object({
    claim: z.string().trim().min(1),
    sourceUrl: z.string().url(),
    sourceTitle: z.string().trim().min(1),
    confirmed: z.boolean()
  })).min(1),
  parentBusySteps: z.array(z.string().trim().min(1)).min(1),
  parentExtendedSteps: z.array(z.string().trim().min(1)).min(1),
  conversationTopics: z.array(conversationTopicSchema).min(4),
  readingExcerpt: z.object({
    text: z.string().min(1),
    sourceFileId: z.string().min(1),
    sourcePages: z.array(z.number().int().positive()).min(1),
    sourceFingerprint: z.string().min(16),
    corrections: z.array(z.object({ before: z.string(), after: z.string(), reason: z.string().min(1), approved: z.boolean() })),
    approved: z.boolean()
  }),
  closeReadingQuestions: z.array(z.string().trim().min(1)).min(1),
  methodSummary: z.string().trim().min(1),
  practice: z.array(z.object({ prompt: z.string().trim().min(1), answer: z.string().trim().min(1), imageSourceFileId: z.string().optional(), imageSourcePageId: z.string().optional() })).min(1),
  littleTeacherSteps: z.array(z.string().trim().min(1)).min(1),
  oralFramework: z.string().trim().min(1)
});

export type LessonContent = z.infer<typeof lessonContentSchema>;

export function requiresPinyinReview(grade: string) {
  const normalized = grade.replace(/\s/g, "");
  return normalized === "1升2" || normalized === "2年级" || normalized === "升2年级";
}

export function assertReadyForLayout(content: LessonContent, grade: string, pinyinApproved: boolean) {
  const parsed = lessonContentSchema.parse(content);
  if (parsed.curriculumAlignment.some((item) => !item.confirmed)) throw new Error("教材对标尚未全部确认");
  if (!parsed.readingExcerpt.approved) throw new Error("阅读文段尚未审核");
  if (parsed.readingExcerpt.corrections.some((item) => !item.approved)) throw new Error("阅读文段仍有未确认纠错");
  if (requiresPinyinReview(grade) && !pinyinApproved) throw new Error("2年级阅读文段拼音尚未审核");
  return parsed;
}
