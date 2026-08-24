"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Bold, Download, Highlighter, ImagePlus, Italic, Save, Underline } from "lucide-react";

const roles = [
  ["SIMPLE", "简单模式·全文"],
  ["COVER", "电子翻页书／微信封面"],
  ["PARENT_MANUAL", "家长手册"],
  ["LESSON_HOME", "课程首页"],
  ["CONVERSATION", "交流话题"],
  ["READING", "精读阅读"],
  ["PRACTICE", "真题带练"],
  ["LITTLE_TEACHER", "小老师"],
] as const;
type Teacher = {
  id: string;
  formalName: string;
  nickname: string;
  grade: string | null;
  assets: Array<{ id: string; label: string | null; kind: string }>;
};
type Position = {
  assetId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
type LessonPreview = {
  lessonNumber: number;
  title: string;
  subtitle?: string;
  technique: string;
  courseAlignment?: string;
  learningGoals: string[];
  conversationTopics: Array<{ question: string; referenceAnswer: string }>;
  readingExcerpt: { text: string };
  closeReadingQuestions: string[];
  methodSummary: string;
  practice: Array<{ prompt: string; answer: string; imageSourceFileId?: string; imageSourcePageId?: string }>;
  littleTeacherSteps: string[];
  oralFramework: string;
};
const pageRoles = [
  "LESSON_HOME",
  "CONVERSATION",
  "READING",
  "PRACTICE",
  "LITTLE_TEACHER",
] as const;
const pageLabels = ["课程首页", "交流话题", "精读阅读", "真题带练", "小老师"];
const WPS_SIZES = [
  ["初号", 42], ["小初", 36], ["一号", 26], ["小一", 24], ["二号", 22], ["小二", 18],
  ["三号", 16], ["小三", 15], ["四号", 14], ["小四", 12], ["五号", 10.5], ["小五", 9],
  ["六号", 7.5], ["小六", 6.5], ["七号", 5.5], ["八号", 5],
] as const;
type PageTypography = Record<string, { bodySize?: number; titleSize?: number }>;
const defaultBackgrounds: Record<(typeof pageRoles)[number], string> = {
  LESSON_HOME: "/handout-backgrounds/butter-school.png",
  CONVERSATION: "/handout-backgrounds/blush-school.png",
  READING: "/handout-backgrounds/mint-school.png",
  PRACTICE: "/handout-backgrounds/butter-school.png",
  LITTLE_TEACHER: "/handout-backgrounds/blush-school.png",
};

function bookTitle(value: string) {
  return value.match(/《[^》]+》/u)?.[0] ?? value.replace(/^第\s*\d+\s*讲[：:、\s]*/u, "").trim();
}

function visibleCourseAlignment(value?: string) {
  return value && /(?:[一二三四五六]|[1-6])年级.{0,10}(?:上册|下册)/u.test(value) && /(?:第.{1,4}单元|第.{1,4}课|快乐读书吧)/u.test(value)
    ? value
    : "待教研核对教材对标。";
}

function printableLearningGoal(value: string) {
  return value.replace(/^\s*(?:我|我们)\s*(?:要|能|可以|学会)?\s*/u, "").replace(/^能/u, "能够");
}

function defaultBodySize(pageIndex: number, lesson?: LessonPreview) {
  if (!lesson) return 11;
  const length = pageIndex === 0
    ? (lesson.courseAlignment?.length ?? 0) + lesson.learningGoals.join("").length
    : pageIndex === 1
      ? lesson.conversationTopics.map((item) => item.question.length + item.referenceAnswer.length).reduce((sum, value) => sum + value, 0)
      : pageIndex === 2
        ? lesson.readingExcerpt.text.length + lesson.closeReadingQuestions.join("").length
        : pageIndex === 3
          ? lesson.methodSummary.length + lesson.practice.map((item) => item.prompt.length).reduce((sum, value) => sum + value, 0)
          : lesson.littleTeacherSteps.join("").length + lesson.oralFramework.length;
  if (length > 900) return 8;
  if (length > 680) return 9;
  if (length > 480) return 10;
  return 11;
}

export function LayoutWorkspace({
  project,
  backgrounds: initialBackgrounds,
  teachers,
  lessons,
}: {
  project: {
    id: string;
    name: string;
    grade: string;
    teacherId: string | null;
    layoutConfig: unknown;
  };
  backgrounds: Array<{ id: string; role: string }>;
  teachers: Teacher[];
  lessons: LessonPreview[];
}) {
  const initial = (project.layoutConfig as { teacherImage?: Position } | null)
    ?.teacherImage ?? { x: 67, y: 57, width: 25, height: 30 };
  const [position, setPosition] = useState<Position>(initial);
  const [fontSize, setFontSize] = useState((project.layoutConfig as { fontSize?: number } | null)?.fontSize ?? 11);
  const [pageTypography, setPageTypography] = useState((project.layoutConfig as { pageTypography?: PageTypography } | null)?.pageTypography ?? {});
  const [noteOwnPage, setNoteOwnPage] = useState((project.layoutConfig as { noteOwnPage?: boolean } | null)?.noteOwnPage ?? false);
  const [highlightColor, setHighlightColor] = useState("#FFE08A");
  const [fontFamily, setFontFamily] = useState((project.layoutConfig as { fontFamily?: string } | null)?.fontFamily ?? "Microsoft YaHei");
  const [headerText, setHeaderText] = useState((project.layoutConfig as { headerText?: string } | null)?.headerText ?? "");
  const [footerText, setFooterText] = useState((project.layoutConfig as { footerText?: string } | null)?.footerText ?? "真读书 · 有深度 · 用得上");
  const [headerSize, setHeaderSize] = useState((project.layoutConfig as { headerSize?: number } | null)?.headerSize ?? 8);
  const [footerSize, setFooterSize] = useState((project.layoutConfig as { footerSize?: number } | null)?.footerSize ?? 8);
  const [richPreviewHtml, setRichPreviewHtml] = useState((project.layoutConfig as { richPreviewHtml?: Record<string, string> } | null)?.richPreviewHtml ?? {});
  const [teacherId, setTeacherId] = useState(
    project.teacherId ??
      teachers.find((teacher) => teacher.grade === project.grade)?.id ??
      teachers[0]?.id ??
      "",
  );
  const [backgrounds, setBackgrounds] = useState(initialBackgrounds);
  const [message, setMessage] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [lessonIndex, setLessonIndex] = useState(0);
  const [previewKind, setPreviewKind] = useState<"student" | "answers" | "parent">("student");
  const canvas = useRef<HTMLDivElement>(null);
  const canvasCopy = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const teacher = teachers.find((item) => item.id === teacherId);
  const expressions =
    teacher?.assets.filter((asset) => asset.kind === "EXPRESSION") ?? [];
  const activeAsset = useMemo(
    () =>
      expressions.find((asset) => asset.id === position.assetId) ??
      expressions[0],
    [expressions, position.assetId],
  );
  const currentRole = pageRoles[pageIndex];
  const currentLesson = lessons[lessonIndex];
  const previewKey = `${previewKind}-${currentLesson?.lessonNumber ?? 0}-${pageIndex}`;
  const currentTypography = pageTypography[previewKey] ?? {};
  const currentBodySize = currentTypography.bodySize ?? Math.min(fontSize, defaultBodySize(pageIndex, currentLesson));
  const currentTitleSize = currentTypography.titleSize ?? 20;
  const defaultTeacherKey =
    (
      {
        "0升1": "0l1",
        "1升2": "1l2",
        "2升3": "2l3",
        "3升4": "3l4",
        "4升5": "4l5",
      } as Record<string, string>
    )[project.grade] ?? "1l2";
  const teacherPreviewSrc = activeAsset
    ? `/api/assets/teacher/${activeAsset.id}`
    : `/teacher-defaults/${defaultTeacherKey}-expression.png`;
  const uploadedBackground =
    backgrounds.find((asset) => asset.role === currentRole) ??
    backgrounds.find((asset) => asset.role === "SIMPLE");
  const previewBackground = uploadedBackground
    ? `url(/api/assets/background/${uploadedBackground.id})`
    : `url(${defaultBackgrounds[currentRole]})`;
  async function upload(role: string, files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    form.set("role", role);
    form.set("mode", role === "SIMPLE" ? "simple" : "professional");
    const response = await fetch(`/api/projects/${project.id}/backgrounds`, {
      method: "POST",
      body: form,
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "上传失败");
      return;
    }
    setBackgrounds((items) => [
      ...items.filter((item) => item.role !== role),
      payload.asset,
    ]);
    setMessage("背景已保存");
  }
  function move(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current || !canvas.current) return;
    const rect = canvas.current.getBoundingClientRect();
    setPosition((value) => ({
      ...value,
      x: Math.max(
        0,
        Math.min(
          100 - value.width,
          ((event.clientX - rect.left) / rect.width) * 100 - value.width / 2,
        ),
      ),
      y: Math.max(
        0,
        Math.min(
          100 - value.height,
          ((event.clientY - rect.top) / rect.height) * 100 - value.height / 2,
        ),
      ),
    }));
  }
  async function save() {
    const nextRichPreviewHtml = canvasCopy.current
      ? { ...richPreviewHtml, [previewKey]: canvasCopy.current.innerHTML }
      : richPreviewHtml;
    setRichPreviewHtml(nextRichPreviewHtml);
    const [projectResponse, layoutResponse] = await Promise.all([
      fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ teacherId }),
      }),
      fetch(`/api/projects/${project.id}/layout`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          teacherImage: { ...position, assetId: activeAsset?.id },
          fontFamily, fontSize, pageTypography, noteOwnPage, headerText, footerText, headerSize, footerSize, richPreviewHtml: nextRichPreviewHtml,
        }),
      }),
    ]);
    setMessage(
      projectResponse.ok && layoutResponse.ok
        ? "版式审核结果已保存"
        : "保存失败",
    );
  }
  async function download(kind: string) {
    setDownloading(kind);
    setMessage("正在生成 Word，请勿关闭本页…");
    try {
      const response = await fetch(`/api/projects/${project.id}/export?kind=${kind}`);
      if (!response.ok) { const payload = await response.json().catch(() => ({})); throw new Error(payload.error ?? "Word生成失败"); }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/u)?.[1];
      const fileName = encoded ? decodeURIComponent(encoded) : "讲义.docx";
      const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
      anchor.href = url; anchor.download = fileName; anchor.click(); URL.revokeObjectURL(url);
      setMessage("Word 已生成并开始下载。");
    } catch (error) { setMessage(error instanceof Error ? error.message : "下载失败"); }
    finally { setDownloading(null); }
  }
  function updatePageTypography(patch: { bodySize?: number; titleSize?: number }) {
    setPageTypography((value) => ({ ...value, [previewKey]: { ...value[previewKey], ...patch } }));
  }
  function formatSelection(command: "bold" | "italic" | "underline" | "hiliteColor" | "fontSize") {
    const selection = window.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed || !canvasCopy.current?.contains(selection.anchorNode)) {
      setMessage("请先在预览正文中用鼠标选中要调整的文字");
      return;
    }
    if (command === "fontSize") {
      document.execCommand("fontSize", false, "7");
      canvasCopy.current.querySelectorAll("font[size='7']").forEach((node) => {
        (node as HTMLElement).style.fontSize = `${currentBodySize}pt`;
        node.removeAttribute("size");
      });
    } else document.execCommand(command, false, command === "hiliteColor" ? highlightColor : undefined);
    setMessage("已应用到选中文字；点击“保存版式审核”后保存本次版式设置");
  }
  return (
    <main className="review-page">
      <header className="review-header">
        <Link href="/">
          <ArrowLeft size={17} /> 返回工作台
        </Link>
        <div>
          <span>第二次人工审核</span>
          <h1>{project.name} · 版式工作台</h1>
        </div>
      </header>
      <div className="layout-studio">
        <aside className="asset-panel">
          <h2>背景图片</h2>
          <p>系统会自动套用默认美化背景；上传图片仅用于覆盖对应页面。</p>
          {roles.map(([role, label]) => (
            <label className="asset-upload" key={role}>
              <span>
                <ImagePlus size={15} />
                {label}
              </span>
              <em>
                {backgrounds.some((item) => item.role === role)
                  ? "已上传，可替换"
                  : "系统默认 · 可替换"}
              </em>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => void upload(role, event.target.files)}
              />
            </label>
          ))}
        </aside>
        <section className="layout-center">
          <div className="layout-toolbar" id="format">
            <div className="preview-kind-tabs" aria-label="预览文档类型">
              <button type="button" className={previewKind === "student" ? "active" : ""} onClick={() => setPreviewKind("student")}>学生版讲义</button>
              <button type="button" className={previewKind === "answers" ? "active" : ""} onClick={() => setPreviewKind("answers")}>参考答案</button>
              <button type="button" className={previewKind === "parent" ? "active" : ""} onClick={() => setPreviewKind("parent")}>家长使用手册</button>
            </div>
            {previewKind !== "parent" && <div className="lesson-tabs" aria-label="讲次选择">
              {lessons.map((lesson, index) => <button type="button" className={lessonIndex === index ? "active" : ""} onClick={() => setLessonIndex(index)} key={lesson.lessonNumber}>第{lesson.lessonNumber}讲</button>)}
            </div>}
            {previewKind === "student" && <div className="page-tabs" aria-label="讲义预览页面">
              {pageLabels.map((label, index) => (
                <button
                  type="button"
                  className={pageIndex === index ? "active" : ""}
                  onClick={() => setPageIndex(index)}
                  key={label}
                >
                  {index + 1}. {label}
                </button>
              ))}
            </div>}
            <label>
              正文字体
              <select value={fontFamily} onChange={(event) => setFontFamily(event.target.value)}>
                <option value="Microsoft YaHei">微软雅黑</option>
                <option value="SimSun">宋体</option>
                <option value="KaiTi">楷体</option>
                <option value="FangSong">仿宋</option>
              </select>
            </label>
            <label>
              主讲老师
              <select
                value={teacherId}
                onChange={(event) => setTeacherId(event.target.value)}
              >
                {teachers.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.formalName}（{item.nickname}）
                  </option>
                ))}
              </select>
            </label>
            <label>
              本页正文字号
              <select value={currentBodySize} onChange={(event) => updatePageTypography({ bodySize: Number(event.target.value) })}>
                {WPS_SIZES.map(([label, size]) => <option key={label} value={size}>{label}（{size} 磅）</option>)}
              </select>
            </label>
            <label>
              本页标题字号
              <select value={currentTitleSize} onChange={(event) => updatePageTypography({ titleSize: Number(event.target.value) })}>
                {WPS_SIZES.map(([label, size]) => <option key={label} value={size}>{label}（{size} 磅）</option>)}
              </select>
            </label>
            <label>
              页眉文字
              <input value={headerText} maxLength={80} placeholder="留空则不显示" onChange={(event) => setHeaderText(event.target.value)} />
            </label>
            <label>
              页眉字号
              <select value={headerSize} onChange={(event) => setHeaderSize(Number(event.target.value))}>
                {WPS_SIZES.slice(7).map(([label, size]) => <option key={label} value={size}>{label}（{size} 磅）</option>)}
              </select>
            </label>
            <label>
              页脚文字
              <input value={footerText} maxLength={80} onChange={(event) => setFooterText(event.target.value)} />
            </label>
            <label>
              页脚字号
              <select value={footerSize} onChange={(event) => setFooterSize(Number(event.target.value))}>
                {WPS_SIZES.slice(7).map(([label, size]) => <option key={label} value={size}>{label}（{size} 磅）</option>)}
              </select>
            </label>
            <div className="inline-format-tools" aria-label="文字调整">
              <span>文字调整</span>
              <button type="button" title="加粗选中文字" onMouseDown={(event) => event.preventDefault()} onClick={() => formatSelection("bold")}><Bold size={15} /></button>
              <button type="button" title="斜体选中文字" onMouseDown={(event) => event.preventDefault()} onClick={() => formatSelection("italic")}><Italic size={15} /></button>
              <button type="button" title="为选中文字加下划线" onMouseDown={(event) => event.preventDefault()} onClick={() => formatSelection("underline")}><Underline size={15} /></button>
              <button type="button" title="高光选中文字" onMouseDown={(event) => event.preventDefault()} onClick={() => formatSelection("hiliteColor")}><Highlighter size={15} /></button>
              <input aria-label="高光颜色" type="color" value={highlightColor} onChange={(event) => setHighlightColor(event.target.value)} />
              <button type="button" title="以本页正文字号调整选中文字" onMouseDown={(event) => event.preventDefault()} onClick={() => formatSelection("fontSize")}>字号</button>
            </div>
            {previewKind === "student" && pageIndex === 3 && (
              <>
                <label>
                  真题页主讲卡通
                  <select
                    value={activeAsset?.id ?? ""}
                    onChange={(event) =>
                      setPosition((value) => ({
                        ...value,
                        assetId: event.target.value,
                      }))
                    }
                  >
                    {expressions.map((asset) => (
                      <option value={asset.id} key={asset.id}>
                        {asset.label ?? "表情"}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  缩放
                  <input
                    type="range"
                    min="10"
                    max="55"
                    value={position.width}
                    onChange={(event) =>
                      setPosition((value) => ({
                        ...value,
                        width: Number(event.target.value),
                        height: Number(event.target.value) * 1.2,
                      }))
                    }
                  />
                </label>
              </>
            )}
          </div>
          <div
            className="page-canvas"
            ref={canvas}
            onPointerMove={move}
            onPointerUp={() => {
              dragging.current = false;
            }}
            onPointerLeave={() => {
              dragging.current = false;
            }}
            style={{ backgroundImage: previewBackground }}
          >
            {headerText ? <div className="preview-running-header" style={{ fontFamily, fontSize: `${headerSize}pt` }}>{headerText}</div> : null}
            <div
              className="canvas-copy"
              ref={canvasCopy}
              contentEditable
              suppressContentEditableWarning
              style={{ fontFamily, fontSize: `${currentBodySize}pt` }}
              onInput={() => setMessage("文字已调整；保存版式审核后继续导出")}
            >
              {richPreviewHtml[previewKey] ? (
                <div dangerouslySetInnerHTML={{ __html: richPreviewHtml[previewKey] }} />
              ) : !currentLesson ? (
                <>
                  <h2>尚无已审核内容</h2>
                  <p>完成文字审核后，这里会自动显示真实讲义。</p>
                </>
              ) : previewKind === "parent" ? (
                <>
                  <h2 style={{ fontSize: `${currentTitleSize}pt` }}>{project.grade}读写综合能力提升</h2>
                  <p className="parent-slogan">—— 真读书 · 有深度 · 用得上 ——</p>
                  <h3>🤝 双师陪伴｜主讲老师＋班主任老师</h3>
                  <section className="lesson-callout"><p>{teacher?.formalName ?? "主讲"}老师负责课程讲解、阅读方法和表达写作训练；班主任老师负责直播跟课、日常答疑、阶段反馈、薄弱点跟踪和学习规划，两位老师共同陪伴一个孩子。</p></section>
                  <h3>五讲课程带来的能力提升</h3>
                  <p>五讲合起来，孩子练习的是：读懂故事 → 找到证据 → 学会方法 → 说清楚 → 写完整。</p>
                  <h3>🎯 {project.grade}阶段，最需要关注什么？</h3>
                  <p>基础：从“会认字”走向“会用字词”；阅读：从“听故事”走向“读懂故事”；表达：从“说一句话”走向“完整表达”。</p>
                  <h3>五讲学习安排</h3>
                  {lessons.map((lesson) => <section key={lesson.lessonNumber}><b>第{lesson.lessonNumber}讲 {lesson.title}</b><p>课堂方法：{lesson.technique}</p><p>课后交流：{lesson.conversationTopics[0]?.question ?? "请孩子复述今天学到的方法。"}</p></section>)}
                  <h3>💡 家长怎么配合？</h3>
                  <section className="lesson-callout"><p>正课时间：19:00-19:40。课前10分钟＋课后10分钟由班主任老师统一带领预习、复习，无需家长提前筹备。</p><p>课业紧张时，按第五部分口头框架录1分钟复习视频；学有余力时，完成第四部分书面练习并提交老师批改。</p></section>
                </>
              ) : previewKind === "answers" ? (
                <>
                  <h2 style={{ fontSize: `${currentTitleSize}pt` }}>第{currentLesson.lessonNumber}讲参考答案</h2>
                  <h3>交流话题参考</h3>
                  {currentLesson.conversationTopics.map((item, index) => <section key={item.question}><b>{index + 1}. {item.question}</b><p>参考：{item.referenceAnswer}</p></section>)}
                  <h3>真题带练参考</h3>
                  {currentLesson.practice.map((item, index) => <section key={item.prompt}><b>{index + 1}. {item.prompt}</b><p>参考答案：{item.answer}</p></section>)}
                </>
              ) : pageIndex === 0 ? (
                <>
                  <h2 className="lesson-book-title" style={{ fontSize: `${currentTitleSize}pt` }}>{bookTitle(currentLesson.title)}</h2>
                  <p className="lesson-technique">— “{currentLesson.technique.replace(/[—“”]/g, "").trim()}” —</p>
                  <p className="lesson-subtitle">{currentLesson.subtitle}</p>
                  <h3>🎯 一、本讲要学什么</h3>
                  <section className="lesson-callout"><b>本讲对标</b><p>{visibleCourseAlignment(currentLesson.courseAlignment)}</p><b>学习目标：</b>{currentLesson.learningGoals.map((goal, index) => <p key={index}>{index + 1}. {printableLearningGoal(goal)}</p>)}</section>
                </>
              ) : pageIndex === 1 ? (
                <>
                  <h2 style={{ fontSize: `${currentTitleSize}pt` }}>下课后，建议家长可以和孩子交流的话题</h2>
                  {currentLesson.conversationTopics.map((item, index) => (
                    <section key={item.question}>
                      <h3>
                        {index + 1}. {item.question}
                      </h3>
                      <p>
                        <b>参考：</b>
                        {item.referenceAnswer}
                      </p>
                    </section>
                  ))}
                </>
              ) : pageIndex === 2 ? (
                <>
                  <h2 style={{ fontSize: `${currentTitleSize}pt` }}>阅读文段</h2>
                  <p className="reading-preview">
                    {currentLesson.readingExcerpt.text}
                  </p>
                  <h3>精读思考</h3>
                  <ol>
                    {currentLesson.closeReadingQuestions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ol>
                  {!noteOwnPage && <section className="note-preview"><b>📖 笔记</b><p> </p><p> </p><p> </p></section>}
                </>
              ) : pageIndex === 3 ? (
                <>
                  <h2 style={{ fontSize: `${currentTitleSize}pt` }}>🌟 四、{teacher?.nickname ?? "主讲"}老师课堂 · 真题带练</h2>
                  <h3>方法小结</h3>
                  <p>{currentLesson.methodSummary}</p>
                  <h3>练一练</h3>
                  {currentLesson.practice.map((item, index) => (
                    <section key={item.prompt}>
                      <p>
                        <b>
                          {index + 1}. {item.prompt}
                        </b>
                      </p>
                      {item.imageSourceFileId ? <img className="practice-question-image" src={`/api/assets/source-file/${item.imageSourceFileId}`} alt={`真题带练第${index + 1}题题图`} /> : null}
                      <p>我的作答：＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿</p>
                    </section>
                  ))}
                </>
              ) : (
                <>
                  <h2 style={{ fontSize: `${currentTitleSize}pt` }}>🎤 五、我是小老师</h2>
                  <h3>🎯 作答步骤</h3>
                  <ol>
                    {currentLesson.littleTeacherSteps.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ol>
                  <h3>🎤 口头表达示范框架</h3>
                  <p>{currentLesson.oralFramework}</p>
                </>
              )}
            </div>
            {previewKind === "student" && pageIndex === 2 && noteOwnPage ? <section className="note-own-page"><b>📖 笔记</b><p>在此记录阅读发现、好词好句或自己的问题。</p></section> : null}
            {footerText ? <div className="preview-running-footer" style={{ fontFamily, fontSize: `${footerSize}pt` }}>{footerText}　·　第{pageIndex + 1}页</div> : null}
            {previewKind === "student" && pageIndex === 3 ? (
              <img
                className="floating-teacher"
                src={teacherPreviewSrc}
                alt="主讲老师课堂表情"
                draggable={false}
                onPointerDown={(event) => {
                  dragging.current = true;
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                style={{
                  left: `${position.x}%`,
                  top: `${position.y}%`,
                  width: `${position.width}%`,
                  height: `${position.height}%`,
                }}
              />
            ) : null}
          </div>
          {previewKind === "student" && pageIndex === 2 ? <label className="note-own-page-toggle"><input type="checkbox" checked={noteOwnPage} onChange={(event) => setNoteOwnPage(event.target.checked)} /> 笔记框单独成页（阅读文段较长时使用）</label> : null}
          <div className="review-actions">
            <span>{message}</span>
            <button className="secondary-button" onClick={() => void save()}>
              <Save size={16} /> 保存版式审核
            </button>
          </div>
        </section>
        <aside className="export-panel" id="export">
          <h2>导出Word</h2>
          <p>导出前仍会执行全部审核门禁。</p>
          {[
            ["combined_student", "五讲合订学生版"],
            ["combined_answers", "合订版参考答案"],
            ["parent_manual", "家长使用手册"],
            ["combined_parent_student", "合并：家长手册＋学生合集"],
          ].map(([kind, label]) => (
            <button
              type="button"
              key={kind}
              disabled={downloading !== null}
              onClick={() => void download(kind)}
            >
              <Download size={15} />
              {downloading === kind ? "正在生成…" : label}
            </button>
          ))}
          <Link
            className="publish-button"
            href={`/projects/${project.id}/flipbook-preview`}
          >
            配置微信翻页书
          </Link>
          <p className="export-note">
            单讲学生版/答案可在课程审核页按讲次输出。
          </p>
        </aside>
      </div>
    </main>
  );
}
