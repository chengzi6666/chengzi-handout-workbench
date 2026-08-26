/** A saved rich page already contains its complete body, including reading ruby. */
export function shouldAppendGeneratedPinyin(page: Record<string, unknown>) {
  return !(typeof page.richHtml === "string" && page.richHtml.trim().length > 0) && Array.isArray(page.pinyinUnits);
}
