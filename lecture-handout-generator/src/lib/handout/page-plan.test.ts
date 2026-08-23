import test from "node:test";
import assert from "node:assert/strict";
import { breakBeforePage, createFivePagePlan } from "./page-plan";
import { requiresPinyinReview } from "./content-schema";
import { teacherDisplayName } from "./teachers";

test("default lessons have five semantic pages", () => {
  assert.equal(createFivePagePlan().length, 5);
});

test("overflow creates a sixth page without changing the background role", () => {
  const pages = createFivePagePlan({ reading: true });
  assert.equal(pages.length, 6);
  assert.equal(pages[3].role, "reading");
  assert.equal(pages[3].continuation, true);
  assert.equal(breakBeforePage(pages[2], pages[3]), "pageBreak");
  assert.equal(breakBeforePage(pages[3], pages[4]), "nextPageSection");
});

test("only grade two requires pinyin review", () => {
  assert.equal(requiresPinyinReview("1升2"), true);
  assert.equal(requiresPinyinReview("2年级"), true);
  assert.equal(requiresPinyinReview("2升3"), false);
});

test("teacher name changes by document context", () => {
  const teacher = { formalName: "高远", nickname: "哈哈老师" };
  assert.equal(teacherDisplayName("parent_manual", teacher), "高远老师");
  assert.equal(teacherDisplayName("classroom", teacher), "哈哈老师");
});
