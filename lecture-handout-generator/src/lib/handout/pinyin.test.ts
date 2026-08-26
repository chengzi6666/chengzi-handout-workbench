import assert from "node:assert/strict";
import test from "node:test";
import { createPinyinReview } from "./pinyin";

test("pinyin review uses phrase context for polyphonic characters", () => {
  const readings = createPinyinReview("成长，银行，重庆，重要。").map((unit) => unit.pinyin);
  assert.deepEqual(readings, ["chéng", "zhǎng", "", "yín", "háng", "", "chóng", "qìng", "", "zhòng", "yào", ""]);
});
