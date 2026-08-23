import { pinyin } from "pinyin-pro";

export type PinyinUnit = { char: string; pinyin: string };

export function createPinyinReview(text: string): PinyinUnit[] {
  return Array.from(text).map((char) => ({
    char,
    pinyin: /[\u3400-\u9fff]/u.test(char) ? (pinyin(char, { toneType: "symbol", type: "array" })[0] ?? "") : ""
  }));
}

export function validatePinyinReview(text: string, units: PinyinUnit[]) {
  if (units.map((unit) => unit.char).join("") !== text) throw new Error("拼音审核文字与阅读文段不一致，请重新生成拼音草稿");
  if (units.some((unit) => /[\u3400-\u9fff]/u.test(unit.char) && !unit.pinyin.trim())) throw new Error("仍有汉字未填写拼音");
  return units;
}
