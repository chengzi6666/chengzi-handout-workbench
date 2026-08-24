"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Share2 } from "lucide-react";

function PageContent({ page, pageNumber }: { page?: Record<string, unknown>; pageNumber?: string }) {
  if (!page) return <div className="book-empty" />;
  return <>
    <span className="book-kicker">橙子讲义工坊</span><h2>{String(page.title ?? "")}</h2>
    {page.subtitle ? <h3>{String(page.subtitle)}</h3> : null}
    {page.technique ? <div className="book-callout">核心方法：{String(page.technique)}</div> : null}
    {Array.isArray(page.body) ? <ol>{page.body.map((item, index) => <li key={index}>{String(item)}</li>)}</ol> : null}
    {typeof page.text === "string" ? <p className="book-reading">{page.text}</p> : null}
    {Array.isArray(page.topics) ? <div>{(page.topics as Array<{ question: string; referenceAnswer: string }>).map((item, index) => <section key={index}><b>{index + 1}. {item.question}</b><p>参考：{item.referenceAnswer}</p></section>)}</div> : null}
    {page.method ? <p>{String(page.method)}</p> : null}
    {Array.isArray(page.practice) ? <div>{(page.practice as Array<{ prompt: string; answer: string }>).map((item, index) => <section key={index}><b>{index + 1}. {item.prompt}</b><p>参考答案：{item.answer}</p></section>)}</div> : null}
    {Array.isArray(page.steps) ? <ol>{page.steps.map((item, index) => <li key={index}>{String(item)}</li>)}</ol> : null}
    {page.framework ? <div className="book-callout">{String(page.framework)}</div> : null}
    <footer>{pageNumber}</footer>
  </>;
}

export function Flipbook({ title, description, pages, coverSrc }: { title: string; description: string; pages: Array<Record<string, unknown>>; coverSrc?: string }) {
  const [opened, setOpened] = useState(false); const [spread, setSpread] = useState(0); const [turning, setTurning] = useState<"next" | "previous" | null>(null); const total = pages.length;
  const left = pages[spread]; const right = pages[spread + 1]; const canPrevious = opened && spread > 0; const canNext = !opened || spread + 2 < total;
  async function share() { if (navigator.share) await navigator.share({ title, text: description, url: location.href }); else { await navigator.clipboard.writeText(location.href); alert("分享链接已复制；在微信中发送后会显示为标题卡片"); } }
  function previous() { if (!canPrevious || turning) return; setTurning("previous"); window.setTimeout(() => { setSpread((value) => Math.max(0, value - 2)); setTurning(null); }, 820); }
  function next() { if (turning) return; if (!opened) { setOpened(true); return; } if (canNext) { setTurning("next"); window.setTimeout(() => { setSpread((value) => Math.min(total - 1, value + 2)); setTurning(null); }, 820); } }
  return <main className="book-stage"><header><div><span>电子翻页书 · 双页阅读预览</span><h1>{title}</h1></div><button onClick={() => void share()}><Share2 size={17} /> 分享</button></header><div className="book-shell"><button aria-label="上一页" disabled={!canPrevious || Boolean(turning)} onClick={previous}><ChevronLeft /></button><div className={`spread-book ${opened ? "opened" : ""} ${coverSrc ? "has-cover" : ""}`}>{!opened ? <button className="book-cover-spread" onClick={next} style={coverSrc ? { backgroundImage: `url(${coverSrc})` } : undefined}>{!coverSrc && <><small>{description}</small><h2>{title}</h2><p>点击封面，像翻开一本书一样开始阅读</p></>}</button> : <><article className="book-leaf book-left" key={`left-${spread}`}><PageContent page={left} pageNumber={`${spread + 1} / ${total}`} /></article><article className="book-leaf book-right" key={`right-${spread}`}><PageContent page={right} pageNumber={right ? `${spread + 2} / ${total}` : undefined} /></article>{turning === "next" && <article className="book-turn-sheet turn-next"><PageContent page={right} /></article>}{turning === "previous" && <article className="book-turn-sheet turn-previous"><PageContent page={left} /></article>}<div className="book-spine" /></>}</div><button aria-label="下一页" disabled={!canNext || Boolean(turning)} onClick={next}><ChevronRight /></button></div>{opened && <p className="book-hint">点击左右箭头翻动下一张纸 · 当前第 {spread + 1}–{Math.min(spread + 2, total)} 页</p>}</main>;
}
