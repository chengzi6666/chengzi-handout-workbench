"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Share2, Upload } from "lucide-react";

function PinyinText({ units }: { units: Array<{ char: string; pinyin: string }> }) {
  return <p className="book-reading pinyin-reading">{units.map((unit, index) => unit.pinyin ? <ruby key={index}>{unit.char}<rt>{unit.pinyin}</rt></ruby> : <span key={index}>{unit.char}</span>)}</p>;
}
function PageContent({ page, pageNumber }: { page?: Record<string, unknown>; pageNumber?: string }) {
  if (!page) return <div className="book-empty" />;
  // 版式审核保存的逐页富文本（高光、加粗、斜体、下划线）优先展示；
  // 它来自本项目的编辑器，不接收外部 HTML。
  if (typeof page.richHtml === "string" && page.richHtml) return <><div className="book-rich-content" dangerouslySetInnerHTML={{ __html: page.richHtml }} /><footer>{pageNumber}</footer></>;
  return <>
    <span className="book-kicker">橙子讲义工坊</span><h2>{String(page.title ?? "")}</h2>
    {page.subtitle ? <h3>{String(page.subtitle)}</h3> : null}
    {page.technique ? <div className="book-callout">核心方法：{String(page.technique)}</div> : null}
    {Array.isArray(page.body) ? <ol>{page.body.map((item, index) => <li key={index}>{String(item)}</li>)}</ol> : null}
    {Array.isArray(page.pinyinUnits) ? <PinyinText units={page.pinyinUnits as Array<{ char: string; pinyin: string }>} /> : typeof page.text === "string" ? <p className="book-reading">{page.text}</p> : null}
    {Array.isArray(page.topics) ? <div>{(page.topics as Array<{ question: string; referenceAnswer: string }>).map((item, index) => <section key={index}><b>{index + 1}. {item.question}</b></section>)}</div> : null}
    {page.method ? <p>{String(page.method)}</p> : null}
    {Array.isArray(page.practice) ? <div>{(page.practice as Array<{ prompt: string; answer: string; imageUrl?: string }>).map((item, index) => <section key={index}><b>{index + 1}. {item.prompt}</b>{item.imageUrl ? <img className="book-question-image" src={item.imageUrl} alt={`第${index + 1}题题图`} /> : null}<p>我的作答：＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿</p></section>)}</div> : null}
    {Array.isArray(page.steps) ? <ol>{page.steps.map((item, index) => <li key={index}>{String(item)}</li>)}</ol> : null}
    {page.framework ? <div className="book-callout">{String(page.framework)}</div> : null}
    <footer>{pageNumber}</footer>
  </>;
}

export function Flipbook({ title, description, pages, coverSrc, projectId }: { title: string; description: string; pages: Array<Record<string, unknown>>; coverSrc?: string; projectId?: string }) {
  const [opened, setOpened] = useState(false); const [spread, setSpread] = useState(0); const [turning, setTurning] = useState<{ direction: "next" | "previous"; page?: Record<string, unknown> } | null>(null); const [included, setIncluded] = useState<string[]>(["parent", "student", "answers"]); const [publishMessage, setPublishMessage] = useState("");
  const visiblePages = pages.filter((page) => included.includes(String(page.collection ?? "student")));
  const total = visiblePages.length; const left = visiblePages[spread]; const right = visiblePages[spread + 1]; const canPrevious = opened && spread > 0; const canNext = !opened || spread + 2 < total;
  async function share() { await navigator.clipboard.writeText(location.href); alert("链接已复制。部署到公网后，微信会按页面标题、描述和封面抓取为网页卡片；本机 localhost 无法发送到手机。"); }
  async function publish() { if (!projectId || included.length === 0) return; const response = await fetch(`/api/projects/${projectId}/publish`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ includes: included }) }); const payload = await response.json().catch(() => ({})); setPublishMessage(response.ok ? `已生成可分享链接：${payload.url}` : payload.error ?? "发布失败"); }
  function previous() { if (!canPrevious || turning) return; const page = visiblePages[Math.max(0, spread - 1)]; setSpread((value) => Math.max(0, value - 2)); setTurning({ direction: "previous", page }); window.setTimeout(() => setTurning(null), 520); }
  function next() { if (turning) return; if (!opened) { setOpened(true); return; } if (canNext) { const page = right; setSpread((value) => Math.min(total - 1, value + 2)); setTurning({ direction: "next", page }); window.setTimeout(() => setTurning(null), 520); } }
  function toggle(kind: string) { setIncluded((value) => value.includes(kind) ? value.filter((item) => item !== kind) : ["parent", "student", "answers"].filter((item) => item === kind || value.includes(item))); setSpread(0); setOpened(false); }
  return <main className="book-stage"><header><div><span>电子翻页书 · 双页阅读预览</span><h1>{title}</h1></div><button onClick={() => void share()}><Share2 size={17} /> 复制分享链接</button></header>{projectId ? <><section className="flipbook-options"><b>电子翻页书包含：</b>{[["parent", "家长使用手册"], ["student", "学员电子版合集"], ["answers", "参考答案"]].map(([kind, label]) => <label key={kind}><input type="checkbox" checked={included.includes(kind)} onChange={() => toggle(kind)} /> {label}</label>)}<button disabled={!included.length} onClick={() => void publish()}><Upload size={15} /> 生成分享页</button>{publishMessage ? <span>{publishMessage}</span> : null}</section><section className="wechat-card-preview"><div className="wechat-card-image" style={coverSrc ? { backgroundImage: `url(${coverSrc})` } : undefined}>{!coverSrc ? <span>未上传分享封面</span> : null}</div><div><b>微信分享卡片预览</b><strong>{title}</strong><p>{description}</p><small>{coverSrc ? "将使用当前上传封面；发布到公网后，微信会抓取此卡片信息。" : "请回到版式工作台左侧“电子翻页书／微信封面”上传图片。"}</small></div></section></> : null}<div className="book-shell"><button aria-label="上一页" disabled={!canPrevious || Boolean(turning)} onClick={previous}><ChevronLeft /></button><div className={`spread-book ${opened ? "opened" : ""} ${coverSrc ? "has-cover" : ""}`}>{!opened ? <button className="book-cover-spread" onClick={next} style={coverSrc ? { backgroundImage: `url(${coverSrc})` } : undefined}>{!coverSrc && <><small>{description}</small><h2>{title}</h2><p>点击封面，像翻开一本书一样开始阅读</p></>}</button> : <><article className={`book-leaf book-left kind-${String(left?.kind ?? "home")}`} key={`left-${spread}`}><PageContent page={left} pageNumber={`${spread + 1} / ${total}`} /></article><article className={`book-leaf book-right kind-${String(right?.kind ?? "home")}`} key={`right-${spread}`}><PageContent page={right} pageNumber={right ? `${spread + 2} / ${total}` : undefined} /></article>{turning && <article className={`book-turn-sheet turn-${turning.direction}`}><PageContent page={turning.page} /></article>}<div className="book-spine" /></>}</div><button aria-label="下一页" disabled={!canNext || Boolean(turning)} onClick={next}><ChevronRight /></button></div>{opened && <p className="book-hint">点击左右箭头翻动下一张纸 · 当前第 {spread + 1}–{Math.min(spread + 2, total)} 页</p>}</main>;
}
