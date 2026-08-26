export type HandoutBackgroundRole =
  | "SIMPLE"
  | "COVER"
  | "WECHAT_SHARE"
  | "PARENT_MANUAL"
  | "LESSON_HOME"
  | "CONVERSATION"
  | "READING"
  | "PRACTICE"
  | "LITTLE_TEACHER";

/**
 * A single source of truth for the built-in page backgrounds.  The browser
 * preview, flipbook, and DOCX exporter must never each choose a palette of
 * their own: that was the reason a saved Word could be mint while the book was
 * butter.  User-uploaded backgrounds still override these defaults.
 */
export const DEFAULT_BACKGROUND_FILE: Record<HandoutBackgroundRole, string> = {
  SIMPLE: "blush-school.png",
  COVER: "butter-school.png",
  WECHAT_SHARE: "butter-school.png",
  PARENT_MANUAL: "blush-school.png",
  LESSON_HOME: "butter-school.png",
  CONVERSATION: "blush-school.png",
  READING: "mint-school.png",
  PRACTICE: "butter-school.png",
  LITTLE_TEACHER: "blush-school.png",
};

export function defaultBackgroundPath(role: HandoutBackgroundRole | string) {
  const file = DEFAULT_BACKGROUND_FILE[role as HandoutBackgroundRole] ?? DEFAULT_BACKGROUND_FILE.SIMPLE;
  return `/handout-backgrounds/${file}`;
}
