import test from "node:test";
import assert from "node:assert/strict";
import { normalizeLessonSubtitle } from "./subtitle";

test("legacy lesson data without learning goals still gets a safe subtitle", () => {
  assert.equal(normalizeLessonSubtitle("2026口径讲义文字初稿", undefined, undefined), "读懂文本 · 学会方法 · 清楚表达");
});
