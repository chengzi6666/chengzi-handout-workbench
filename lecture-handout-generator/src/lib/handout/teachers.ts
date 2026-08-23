export const BUILT_IN_TEACHERS = [
  { formalName: "吴晨晨", nickname: "橙子老师", grade: "0升1" },
  { formalName: "高远", nickname: "哈哈老师", grade: "1升2" },
  { formalName: "张驰", nickname: "驰哥", grade: "2升3" },
  { formalName: "唐润然", nickname: "大唐老师", grade: "3升4" },
  { formalName: "陈超", nickname: "超帅老师", grade: "4升5" }
] as const;

export function teacherDisplayName(context: "parent_manual" | "classroom", teacher: { formalName: string; nickname: string }) {
  return context === "parent_manual" ? `${teacher.formalName}老师` : teacher.nickname;
}

