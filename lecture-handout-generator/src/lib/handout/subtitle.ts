const subtitleByTechnique: Array<[RegExp, string]> = [
  [/人\s*事\s*理/u, "读懂人物 · 讲清事情 · 说出道理"], [/举例/u, "亮出观点 · 讲清理由 · 举出例子"], [/小手小脚/u, "观察动作 · 写出画面 · 表达心情"], [/帮帮礼/u, "发现困难 · 说清帮助 · 礼貌回应"], [/结局反推/u, "先定结局 · 反推过程 · 写成故事"], [/真想/u, "找到本体 · 对应喻体 · 说出效果"], [/观人理/u, "观察言行 · 找到证据 · 评价人物"], [/心情折线/u, "梳理事件 · 标出心情 · 有序复述"], [/问人/u, "提出问题 · 结合人物 · 预测情节"], [/概事人情理/u, "概括事件 · 分析人物 · 读懂主旨"]
];

export function normalizeLessonSubtitle(value: unknown, technique: string, goals: string[]) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (raw && !/(?:\d{4}|口径|初稿|讲义文字|暑期|秋季)/u.test(raw)) return raw;
  const matched = subtitleByTechnique.find(([pattern]) => pattern.test(technique));
  if (matched) return matched[1];
  return goals.slice(0, 3).map((goal) => goal.replace(/^(?:能够|能|学会|了解)/u, "").replace(/[。；].*$/u, "").slice(0, 10)).filter(Boolean).join(" · ") || "读懂文本 · 学会方法 · 清楚表达";
}
