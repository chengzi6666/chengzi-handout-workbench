import test from "node:test";
import assert from "node:assert/strict";
import { patternForGrade, patternPrompt } from "./grade-handout-patterns";

test("every supported grade has a specific handout pattern", () => {
  for (const grade of ["0升1", "1升2", "2升3", "3升4", "4升5"]) {
    assert.equal(patternForGrade(grade).grade, grade);
    assert.match(patternPrompt(grade), /交流话题不少于4题/);
    assert.match(patternPrompt(grade), /独立答案每讲固定三段/);
  }
});
