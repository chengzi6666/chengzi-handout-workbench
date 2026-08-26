import assert from "node:assert/strict";
import test from "node:test";
import { isMethodSummaryPlaceholder } from "./content-schema";

test("method summary placeholders can never pass generation or review", () => {
  assert.equal(isMethodSummaryPlaceholder("请结合本讲主讲内容补充方法小结。"), true);
  assert.equal(isMethodSummaryPlaceholder("补充方法小结"), true);
  assert.equal(isMethodSummaryPlaceholder("先找人物和事情，再按顺序整理，最后用原文证据说清道理。"), false);
});
