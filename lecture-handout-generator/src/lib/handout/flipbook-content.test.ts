import assert from "node:assert/strict";
import test from "node:test";
import { shouldAppendGeneratedPinyin } from "./flipbook-content";

test("saved rich reading pages never append the generated passage a second time", () => {
  const page = { richHtml: "<h2>阅读文段</h2><p><ruby>没<rt>méi</rt></ruby>头脑</p>", pinyinUnits: [{ char: "没", pinyin: "méi" }] };
  assert.equal(shouldAppendGeneratedPinyin(page), false);
  assert.equal(shouldAppendGeneratedPinyin({ pinyinUnits: page.pinyinUnits }), true);
});
