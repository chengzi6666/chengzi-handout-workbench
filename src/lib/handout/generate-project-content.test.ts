import test from "node:test";
import assert from "node:assert/strict";
import { sourcesForLessons } from "./generate-project-content";

test("one combined course document is split into five lessons", () => {
  const source = { id: "source", originalName: "五讲合订.docx", pages: [{ id: "page", pageNumber: 1, extractedText: "课程地图\n第一讲 原文摘抄：甲内容足够长\n第二讲 原文摘抄：乙内容足够长\n第三讲 原文摘抄：丙内容足够长\n第四讲 原文摘抄：丁内容足够长\n第五讲 原文摘抄：戊内容足够长" }] };
  const parts = sourcesForLessons([source], 5);
  assert.equal(parts.length, 5);
  assert.match(parts[3].pages[0].extractedText, /第四讲/);
  assert.doesNotMatch(parts[3].pages[0].extractedText, /第五讲/);
});

test("season-number lesson headings in a combined Word are split into five lessons", () => {
  const source = { id: "source", originalName: "L2合订.docx", pages: [{ id: "page", pageNumber: 1, extractedText: "秋 01 讲《没头脑和不高兴》——人事理法\n第一讲内容\n秋 02 讲《没头脑和不高兴》——举例法\n第二讲内容\n秋 03 讲《没头脑和不高兴》——小手小脚法\n第三讲内容\n秋 04 讲《没头脑和不高兴》——帮帮礼法\n第四讲内容\n秋 05 讲《笨狼的故事》——口诀法\n第五讲内容" }] };
  const parts = sourcesForLessons([source], 5);
  assert.equal(parts.length, 5);
  assert.match(parts[0].pages[0].extractedText, /秋 01 讲/);
  assert.match(parts[4].pages[0].extractedText, /秋 05 讲/);
});
