import { pinyin } from "pinyin-pro";

export type PinyinUnit = { char: string; pinyin: string };

export function createPinyinReview(text: string): PinyinUnit[] {
  // pinyin-pro has a phrase dictionary for polyphonic characters, but it can
  // only use that dictionary when it receives the complete sentence. Calling
  // it one character at a time made “成长” become chéng cháng.
  const chars = Array.from(text);
  const readings = pinyin(text, { toneType: "symbol", type: "array" });
  return chars.map((char, index) => ({
    char,
    pinyin: /[\u3400-\u9fff]/u.test(char) ? (readings[index] ?? "") : ""
  }));
}

export function validatePinyinReview(text: string, units: PinyinUnit[]) {
  if (units.map((unit) => unit.char).join("") !== text) throw new Error("拼音审核文字与阅读文段不一致，请重新生成拼音草稿");
  if (units.some((unit) => /[\u3400-\u9fff]/u.test(unit.char) && !unit.pinyin.trim())) throw new Error("仍有汉字未填写拼音");
  return units;
}
