export type PageRole = "lesson_home" | "conversation" | "reading" | "practice" | "little_teacher";

export interface PlannedPage {
  role: PageRole;
  continuation: boolean;
  backgroundRole: PageRole;
}

export function createFivePagePlan(overflows: Partial<Record<PageRole, boolean>> = {}): PlannedPage[] {
  const roles: PageRole[] = ["lesson_home", "conversation", "reading", "practice", "little_teacher"];
  return roles.flatMap((role) => [
    { role, continuation: false, backgroundRole: role },
    ...(overflows[role] ? [{ role, continuation: true, backgroundRole: role }] : [])
  ]);
}

export function breakBeforePage(previous: PlannedPage | undefined, current: PlannedPage) {
  if (!previous) return "nextPageSection" as const;
  return previous.backgroundRole === current.backgroundRole ? "pageBreak" as const : "nextPageSection" as const;
}

