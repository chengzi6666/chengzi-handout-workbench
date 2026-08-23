"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Share2 } from "lucide-react";

function PageContent({ page }: { page: Record<string, unknown> }) {
  return <><span className="book-kicker">橙子讲义工坊</span><h2>{String(page.title ?? "")}</h2>{page.subtitle ? <h3>{String(page.subtitle)}</h3> : null}{page.technique ? <div className="book-callout">核心方法：{String(page.technique)}</div> : null}{Array.isArray(page.body) ? <ol>{page.body.map((item, index) => <li key={index}>{String(item)}</li>)}</ol> : null}{typeof page.text === "string" ? <p className="book-reading">{page.text}</p> : null}{Array.isArray(page.topics) ? <div>{(page.topics as Array<{ question: string; referenceAnswer: string }>).map((item, index) => <section key={index}><b>{index + 1}. {item.question}</b><p>参考：{item.referenceAnswer}</p></section>)}</div> : null}{page.method ? <p>{String(page.method)}</p> : null}{Array.isArray(page.practice) ? <div>{(page.practice as Array<{ prompt: string; answer: string }>).map((item, index) => <section key={index}><b>{index + 1}. {item.prompt}</b><p>参考答案：{item.answer}</p></section>)}</div> : null}{Array.isArray(page.steps) ? <ol>{page.steps.map((item, index) => <li key={index}>{String(item)}</li>)}</ol> : null}{page.framework ? <div className="book-callout">{String(page.framework)}</div> : null}</>;
}

export function Flipbook({ title, description, pages }: { title: string; description: string; pages: Array<Record<string, unknown>> }) {
  const [index, setIndex] = useState(-1); const total = pages.length;
  async function share() { if (navigator.share) await navigator.share({ title, text: description, url: location.href }); else { await navigator.clipboard.writeText(location.href); alert("分享链接已复制；在微信中发送后会显示为标题卡片"); } }
  return <main className="book-stage"><header><div><span>电子翻页书</span><h1>{title}</h1></div><button onClick={() => void share()}><Share2 size={17} /> 分享</button></header><div className="book-shell"><button aria-label="上一页" disabled={index < 0} onClick={() => setIndex((value) => value - 1)}><ChevronLeft /></button><div className={`book ${index >= 0 ? "opened" : ""}`}><div className="book-cover" onClick={() => setIndex(0)}><small>{description}</small><h2>{title}</h2><p>点击封面开始阅读</p></div>{index >= 0 && <article key={index} className="book-page turning"><PageContent page={pages[index]} /><footer>{index + 1} / {total}</footer></article>}</div><button aria-label="下一页" disabled={index >= total - 1} onClick={() => setIndex((value) => value + 1)}><ChevronRight /></button></div></main>;
}
