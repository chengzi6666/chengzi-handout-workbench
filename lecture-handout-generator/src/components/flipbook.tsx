"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Share2, Upload } from "lucide-react";
import type { SharedPage } from "@/lib/handout/page-spec";
import { shouldAppendGeneratedPinyin } from "@/lib/handout/flipbook-content";

function PinyinText({ units }: { units: Array<{ char: string; pinyin: string }> }) {
  return <p className="book-reading pinyin-reading">{units.map((unit, index) => unit.pinyin ? <ruby key={index}>{unit.char}<rt>{unit.pinyin}</rt></ruby> : <span key={index}>{unit.char}</span>)}</p>;
}
function TeacherExpression({ page }: { page: Record<string, unknown> }) {
  if (typeof page.teacherExpressionSrc !== "string") return null;
  const position = (page.teacherPosition ?? {}) as { x?: number; y?: number; width?: number; height?: number };
  return <img className="book-floating-teacher" src={page.teacherExpressionSrc} alt="主讲老师课堂表情" style={{ left: `${position.x ?? 67}%`, top: `${position.y ?? 57}%`, width: `${position.width ?? 25}%`, height: `${position.height ?? 30}%` }} />;
}
function PageContent({ page, headerText, footerText }: { page?: Record<string, unknown>; headerText?: string; footerText?: string }) {
  if (!page) return <div className="book-empty" />;
  if (typeof page.pageImageUrl === "string" && page.pageImageUrl) {
    return <img className="book-page-image" src={page.pageImageUrl} alt={String(page.title ?? "讲义页面")} />;
  }
  const showAnswers = page.collection === "answers";
  const sharedPage = page.sharedPage as SharedPage | undefined;
  // 版式审核保存的逐页富文本（高光、加粗、斜体、下划线）优先展示；
  // 它来自本项目的编辑器，不接收外部 HTML。
  if (typeof page.richHtml === "string" && page.richHtml) return <>
    {(page.headerText ?? headerText) ? <span className="book-kicker">{String(page.headerText ?? headerText)}</span> : null}
    <div className="book-rich-content" style={{ fontFamily: String(page.fontFamily ?? "Microsoft YaHei"), fontSize: `${Number(page.bodySize ?? 11)}pt` }} dangerouslySetInnerHTML={{ __html: page.richHtml }} />
    {/* richHtml 已经是版式预览保存下来的整页正文，阅读页的 ruby 也包含在其中。
        这里绝不能再根据 pinyinUnits 追加一次原文，否则翻页书会重复整段。 */}
    {showAnswers && Array.isArray(page.topics) ? <div className="book-answer-supplement">{(page.topics as Array<{ question: string; referenceAnswer: string }>).map((item, index) => <section key={index}><b>{index + 1}. {item.question}</b><p><b>参考：</b>{item.referenceAnswer}</p></section>)}</div> : null}
    {showAnswers && Array.isArray(page.practice) ? <div className="book-answer-supplement">{(page.practice as Array<{ prompt: string; answer: string }>).map((item, index) => <section key={index}><b>{index + 1}. {item.prompt}</b><p><b>参考作答：</b>{item.answer}</p></section>)}</div> : null}
    {page.kind === "practice" ? <TeacherExpression page={page} /> : null}
    {page.footerText ?? footerText ? <footer>{String(page.footerText ?? footerText)}</footer> : null}
  </>;
  if (sharedPage) return <>
    {(page.headerText ?? headerText) ? <span className="book-kicker">{String(page.headerText ?? headerText)}</span> : null}
    <div className="book-rich-content book-shared-content" style={{ fontFamily: String(page.fontFamily ?? "Microsoft YaHei"), fontSize: `${Number(page.bodySize ?? 11)}pt` }}>
      {sharedPage.blocks.map((block, index) => {
        if (block.kind === "title") return <h2 key={index} style={{ fontSize: `${Number(page.titleSize ?? 20)}pt` }}>{block.text}</h2>;
        if (block.kind === "heading") return <h3 key={index}>{block.text}</h3>;
        if (block.kind === "numbered") return <ol key={index}>{(block.items ?? []).map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ol>;
        if (block.kind === "callout") return <section className="book-callout" key={index}><b>{block.text}</b>{(block.items ?? []).map((item, itemIndex) => <p key={itemIndex}>{item}</p>)}</section>;
        if (sharedPage.role === "READING" && index === 1 && Array.isArray(page.pinyinUnits)) return <PinyinText key={index} units={page.pinyinUnits as Array<{ char: string; pinyin: string }>} />;
        return block.text ? <div key={index}>{<p>{block.text}</p>}{sharedPage.role === "PARENT_MANUAL" && index === 1 && typeof page.teacherPortraitSrc === "string" ? <img className="book-parent-teacher" src={page.teacherPortraitSrc} alt="主讲老师" /> : null}</div> : null;
      })}
      {sharedPage.role === "PRACTICE" && Array.isArray(page.practice) ? <>{(page.practice as Array<{ imageUrl?: string }>).map((item, index) => item.imageUrl ? <img key={index} className="book-question-image" src={item.imageUrl} alt={`第${index + 1}题题图`} /> : null)}</> : null}
    </div>
    {sharedPage.role === "PRACTICE" ? <TeacherExpression page={page} /> : null}
    {page.footerText ?? footerText ? <footer>{String(page.footerText ?? footerText)}</footer> : null}
  </>;
  return <>
    <span className="book-kicker">{String(page.headerText ?? headerText ?? "电子讲义")}</span><h2>{String(page.title ?? "")}</h2>
    {page.subtitle ? <h3>{String(page.subtitle)}</h3> : null}
    {typeof page.teacherPortraitSrc === "string" ? <img className="book-parent-teacher" src={page.teacherPortraitSrc} alt="主讲老师" /> : null}
    {page.technique ? <div className="book-callout">核心方法：{String(page.technique)}</div> : null}
    {Array.isArray(page.body) ? <ol>{page.body.map((item, index) => <li key={index}>{String(item)}</li>)}</ol> : null}
    {shouldAppendGeneratedPinyin(page) ? <PinyinText units={page.pinyinUnits as Array<{ char: string; pinyin: string }>} /> : typeof page.text === "string" ? <p className="book-reading">{page.text}</p> : null}
    {Array.isArray(page.topics) ? <div>{(page.topics as Array<{ question: string; referenceAnswer: string }>).map((item, index) => <section key={index}><b>{index + 1}. {item.question}</b>{showAnswers ? <p><b>参考：</b>{item.referenceAnswer}</p> : null}</section>)}</div> : null}
    {Array.isArray(page.questions) ? <ol>{(page.questions as unknown[]).map((item, index) => <li key={index}>{String(item)}</li>)}</ol> : null}
    {page.method ? <p>{String(page.method)}</p> : null}
    {Array.isArray(page.practice) ? <div>{(page.practice as Array<{ prompt: string; answer: string; imageUrl?: string }>).map((item, index) => <section key={index}><b>{index + 1}. {item.prompt}</b>{item.imageUrl ? <img className="book-question-image" src={item.imageUrl} alt={`第${index + 1}题题图`} /> : null}{showAnswers ? <p><b>参考作答：</b>{item.answer}</p> : null}</section>)}</div> : null}
    {Array.isArray(page.steps) ? <ol>{page.steps.map((item, index) => <li key={index}>{String(item)}</li>)}</ol> : null}
    {page.framework ? <div className="book-callout">{String(page.framework)}</div> : null}
    {page.footerText ?? footerText ? <footer>{String(page.footerText ?? footerText)}</footer> : null}
  </>;
}

type CropPosition = { x?: number; y?: number };

export function Flipbook({ title, description, pages, coverSrc, shareCoverSrc, coverPosition, shareCoverPosition, projectId, headerText, footerText }: { title: string; description: string; pages: Array<Record<string, unknown>>; coverSrc?: string; shareCoverSrc?: string; coverPosition?: CropPosition; shareCoverPosition?: CropPosition; projectId?: string; headerText?: string; footerText?: string }) {
  const [opened, setOpened] = useState(false); const [spread, setSpread] = useState(0); const [turning, setTurning] = useState<{ direction: "next" | "previous"; page?: Record<string, unknown> } | null>(null); const [included, setIncluded] = useState<string[]>(["parent", "student", "answers"]); const [publishMessage, setPublishMessage] = useState(""); const [publishedUrl, setPublishedUrl] = useState(""); const [focusedPage, setFocusedPage] = useState<"left" | "right" | null>(null);
  const [pagesPerView, setPagesPerView] = useState(2); const [touchHandout, setTouchHandout] = useState(false);
  useEffect(() => {
    // 手机上的横屏空间看似更宽，但两页 A4 会把每页压到半屏，正文反而难以阅读。
    // 手机一律单页，桌面与平板宽屏才保留双页翻阅体验。
    const compactQuery = window.matchMedia("(max-width: 950px)");
    const landscapeQuery = window.matchMedia("(orientation: landscape)");
    // 有些安卓浏览器会以“桌面网页”宽度汇报视口；触控设备仍应使用单页，
    // 否则 A4 页面会在横屏时被并排压缩并露出白边。
    const isTouchDevice = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
    const isMobileBrowser = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    const forceMobileLayout = isTouchDevice || isMobileBrowser;
    const sync = () => {
      const mobileLayout = forceMobileLayout || compactQuery.matches;
      setTouchHandout(mobileLayout);
      setPagesPerView(mobileLayout && !landscapeQuery.matches ? 1 : 2);
      setFocusedPage(null);
    };
    sync(); compactQuery.addEventListener("change", sync); landscapeQuery.addEventListener("change", sync);
    return () => { compactQuery.removeEventListener("change", sync); landscapeQuery.removeEventListener("change", sync); };
  }, []);
  const visiblePages = pages.filter((page) => included.includes(String(page.collection ?? "student")));
  const total = visiblePages.length; const left = visiblePages[spread]; const right = pagesPerView === 2 ? visiblePages[spread + 1] : undefined; const canPrevious = opened && spread > 0; const canNext = !opened || spread + pagesPerView < total;
  async function share() { const url = publishedUrl || location.href; if (navigator.share) { try { await navigator.share({ title, text: description, url }); return; } catch (error) { if ((error as Error).name === "AbortError") return; } } await navigator.clipboard.writeText(url); alert("分享链接已复制，可以粘贴发送到微信。"); }
  async function publish() { if (!projectId || included.length === 0) return; const response = await fetch(`/api/projects/${projectId}/publish`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ includes: included }) }); const payload = await response.json().catch(() => ({})); if (response.ok) { setPublishedUrl(payload.url); setPublishMessage("已生成手机分享链接，点击右上角复制后即可发送到微信。"); } else setPublishMessage(payload.error ?? "发布失败"); }
  function previous() { if (!canPrevious || turning) return; setFocusedPage(null); const page = visiblePages[Math.max(0, spread - pagesPerView)]; setSpread((value) => Math.max(0, value - pagesPerView)); setTurning({ direction: "previous", page }); window.setTimeout(() => setTurning(null), 520); }
  function next() { if (turning) return; setFocusedPage(null); if (!opened) { setOpened(true); return; } if (canNext) { const page = visiblePages[Math.min(total - 1, spread + pagesPerView - 1)]; setSpread((value) => Math.min(total - 1, value + pagesPerView)); setTurning({ direction: "next", page }); window.setTimeout(() => setTurning(null), 520); } }
  function toggle(kind: string) { setIncluded((value) => value.includes(kind) ? value.filter((item) => item !== kind) : ["parent", "student", "answers"].filter((item) => item === kind || value.includes(item))); setSpread(0); setOpened(false); }
  const pageStyle = (page?: Record<string, unknown>) => typeof page?.backgroundSrc === "string" ? { backgroundImage: `url(${page.backgroundSrc})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined;
  return <main className={`book-stage ${touchHandout ? "touch-handout" : ""}`}><header><div><span>电子翻页书 · {pagesPerView === 1 ? "单页" : "双页"}阅读</span><h1>{title}</h1></div><button onClick={() => void share()}><Share2 size={17} /> 复制分享链接</button></header>{projectId ? <><section className="flipbook-options"><b>电子翻页书包含：</b>{[["parent", "家长使用手册"], ["student", "学员电子版合集"], ["answers", "参考答案"]].map(([kind, label]) => <label key={kind}><input type="checkbox" checked={included.includes(kind)} onChange={() => toggle(kind)} /> {label}</label>)}<button disabled={!included.length} onClick={() => void publish()}><Upload size={15} /> 生成分享页</button>{publishMessage ? <span>{publishMessage}</span> : null}</section><section className="wechat-card-preview"><div className="wechat-card-image" style={shareCoverSrc ? { backgroundImage: `url(${shareCoverSrc})`, backgroundPosition: `${shareCoverPosition?.x ?? 50}% ${shareCoverPosition?.y ?? 50}%` } : undefined}>{!shareCoverSrc ? <span>未上传微信分享封面</span> : null}</div><div><b>微信分享卡片预览</b><strong>{title}</strong><p>{description}</p><small>{shareCoverSrc ? "将使用微信分享封面；发布到公网后，微信会抓取此卡片信息。" : "请回到版式工作台上传横版微信分享封面。"}</small></div></section></> : null}<div className="book-shell"><button aria-label="上一页" disabled={!canPrevious || Boolean(turning)} onClick={previous}><ChevronLeft /></button><div className={`spread-book ${opened ? "opened" : ""} ${coverSrc ? "has-cover" : ""} ${pagesPerView === 1 ? "single-page" : "double-page"} ${focusedPage ? `focused-${focusedPage}` : ""}`}>{!opened ? <button className="book-cover-spread" onClick={next} style={coverSrc ? { backgroundImage: `url(${coverSrc})`, backgroundPosition: `${coverPosition?.x ?? 50}% ${coverPosition?.y ?? 50}%` } : undefined}>{!coverSrc && <><small>{description}</small><h2>{title}</h2><p>点击封面，像翻开一本书一样开始阅读</p></>}</button> : <><article onClick={() => pagesPerView === 2 && touchHandout ? setFocusedPage((value) => value === "left" ? null : "left") : undefined} style={pageStyle(left)} className={`book-leaf book-left kind-${String(left?.kind ?? "home")}`} key={`left-${spread}`}><PageContent page={left} headerText={headerText} footerText={footerText} /></article>{pagesPerView === 2 ? <article onClick={() => touchHandout ? setFocusedPage((value) => value === "right" ? null : "right") : undefined} style={pageStyle(right)} className={`book-leaf book-right kind-${String(right?.kind ?? "home")}`} key={`right-${spread}`}><PageContent page={right} headerText={headerText} footerText={footerText} /></article> : null}{turning && <article className={`book-turn-sheet turn-${turning.direction}`}><PageContent page={turning.page} headerText={headerText} footerText={footerText} /></article>}<div className="book-spine" /></>}</div><button aria-label="下一页" disabled={!canNext || Boolean(turning)} onClick={next}><ChevronRight /></button></div>{opened && <p className="book-hint">{pagesPerView === 1 ? "竖屏单页阅读；旋转横屏后显示双页" : focusedPage ? "再次轻点页面，返回双页" : "轻点任意一页放大阅读；左右箭头按双页翻动"}</p>}</main>;
}
