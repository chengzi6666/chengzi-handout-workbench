export type ProjectStatus = "draft" | "text_review" | "layout_review" | "completed";

export interface HandoutProject {
  id: string;
  name: string;
  grade: string;
  lessonCount: number;
  teachingYear: number;
  season: string;
  teachingYearConfirmed: boolean;
  outputKinds: OutputKind[];
  status: ProjectStatus;
  pinned: boolean;
  updatedAt: string;
}

export type OutputKind =
  | "lesson_student"
  | "combined_student"
  | "combined_answers"
  | "parent_manual"
  | "lesson_answers";

export interface AiProviderConfig {
  id: string;
  displayName: string;
  kind: "openai" | "openai_compatible" | "internal";
  baseUrl: string;
  model: string;
  enabled: boolean;
}

export const OUTPUT_OPTIONS: Array<{ id: OutputKind; label: string; detail: string }> = [
  { id: "lesson_student", label: "每讲学生版讲义", detail: "每讲生成一个可编辑Word" },
  { id: "combined_student", label: "五讲合订学生版", detail: "课程间插入真正的分页符" },
  { id: "combined_answers", label: "合订版参考答案", detail: "每讲答案从新页开始" },
  { id: "parent_manual", label: "家长使用手册", detail: "按课程信息自动生成" },
  { id: "lesson_answers", label: "独立参考答案", detail: "每讲生成独立答案Word" }
];
