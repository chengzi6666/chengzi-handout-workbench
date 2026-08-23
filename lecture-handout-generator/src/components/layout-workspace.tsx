"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Download, ImagePlus, Save } from "lucide-react";

const roles = [
  ["SIMPLE", "简单模式·全文"],
  ["COVER", "封面"],
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
  learningGoals: string[];
  conversationTopics: Array<{ question: string; referenceAnswer: string }>;
  readingExcerpt: { text: string };
  closeReadingQuestions: string[];
  methodSummary: string;
  practice: Array<{ prompt: string; answer: string }>;
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
const defaultBackgrounds: Record<(typeof pageRoles)[number], string> = {
  LESSON_HOME: "/handout-backgrounds/butter-school.png",
  CONVERSATION: "/handout-backgrounds/blush-school.png",
  READING: "/handout-backgrounds/mint-school.png",
  PRACTICE: "/handout-backgrounds/butter-school.png",
  LITTLE_TEACHER: "/handout-backgrounds/blush-school.png",
};

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
  const [fontFamily, setFontFamily] = useState((project.layoutConfig as { fontFamily?: string } | null)?.fontFamily ?? "Microsoft YaHei");
  const [teacherId, setTeacherId] = useState(
    project.teacherId ??
      teachers.find((teacher) => teacher.grade === project.grade)?.id ??
      teachers[0]?.id ??
      "",
  );
  const [backgrounds, setBackgrounds] = useState(initialBackgrounds);
  const [message, setMessage] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [lessonIndex, setLessonIndex] = useState(0);
  const [previewKind, setPreviewKind] = useState<"student" | "answers" | "parent">("student");
  const canvas = useRef<HTMLDivElement>(null);
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
          fontFamily, fontSize,
        }),
      }),
    ]);
    setMessage(
      projectResponse.ok && layoutResponse.ok
        ? "版式审核结果已保存"
        : "保存失败",
    );
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
              正文字号
              <select value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))}>
                {[10, 11, 12, 13, 14, 15, 16, 17, 18].map((size) => <option key={size} value={size}>{size} 号</option>)}
              </select>
            </label>
            {previewKind === "student" && pageIndex === 3 && (
              <>
                <label>
                  课堂表情
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
            <div className="canvas-copy" style={{ fontFamily, fontSize: `${fontSize}pt` }}>
              {!currentLesson ? (
                <>
                  <h2>尚无已审核内容</h2>
                  <p>完成文字审核后，这里会自动显示真实讲义。</p>
                </>
              ) : previewKind === "parent" ? (
                <>
                  <h2>{project.grade}读写综合能力提升</h2>
                  <p>家长使用手册 · 真读书 · 有深度 · 用得上</p>
                  <h3>五讲课程带来的能力提升</h3>
                  <p>五讲合起来，孩子练习的是：读懂故事 → 找到证据 → 学会方法 → 说清楚 → 写完整。</p>
                  <h3>五讲学习安排</h3>
                  {lessons.map((lesson) => <section key={lesson.lessonNumber}><b>第{lesson.lessonNumber}讲 {lesson.title}</b><p>课堂方法：{lesson.technique}</p><p>课后交流：{lesson.conversationTopics[0]?.question ?? "请孩子复述今天学到的方法。"}</p></section>)}
                </>
              ) : previewKind === "answers" ? (
                <>
                  <h2>第{currentLesson.lessonNumber}讲参考答案</h2>
                  <h3>交流话题参考</h3>
                  {currentLesson.conversationTopics.map((item, index) => <section key={item.question}><b>{index + 1}. {item.question}</b><p>参考：{item.referenceAnswer}</p></section>)}
                  <h3>真题带练参考</h3>
                  {currentLesson.practice.map((item, index) => <section key={item.prompt}><b>{index + 1}. {item.prompt}</b><p>参考答案：{item.answer}</p></section>)}
                </>
              ) : pageIndex === 0 ? (
                <>
                  <h2>
                    第{currentLesson.lessonNumber}讲 {currentLesson.title}
                  </h2>
                  <p>{currentLesson.subtitle}</p>
                  <h3>今天学什么</h3>
                  <ol>
                    {currentLesson.learningGoals.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ol>
                  <h3>核心方法</h3>
                  <p>{currentLesson.technique}</p>
                </>
              ) : pageIndex === 1 ? (
                <>
                  <h2>下课后，建议家长可以和孩子交流的话题</h2>
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
                  <h2>阅读文段</h2>
                  <p className="reading-preview">
                    {currentLesson.readingExcerpt.text}
                  </p>
                  <h3>精读思考</h3>
                  <ol>
                    {currentLesson.closeReadingQuestions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ol>
                </>
              ) : pageIndex === 3 ? (
                <>
                  <h2>课堂方法与真题带练</h2>
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
                      <p>参考答案：{item.answer}</p>
                    </section>
                  ))}
                </>
              ) : (
                <>
                  <h2>我是小老师</h2>
                  <h3>讲解步骤</h3>
                  <ol>
                    {currentLesson.littleTeacherSteps.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ol>
                  <h3>表达小支架</h3>
                  <p>{currentLesson.oralFramework}</p>
                </>
              )}
            </div>
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
          ].map(([kind, label]) => (
            <a
              key={kind}
              href={`/api/projects/${project.id}/export?kind=${kind}`}
            >
              <Download size={15} />
              {label}
            </a>
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
