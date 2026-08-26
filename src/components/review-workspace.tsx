"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, RefreshCw, RotateCcw, Save } from "lucide-react";
import type { LessonContent } from "@/lib/handout/content-schema";
import { normalizeLessonSubtitle } from "@/lib/handout/subtitle";
import { normalizeStudentFacingContent } from "@/lib/handout/student-format";

type LessonRow = {
  id: string;
  lessonNumber: number;
  title: string;
  content: unknown;
  textApproved: boolean;
  pinyinApproved: boolean;
};
const copy = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as LessonContent;
const normalizedCopy = (value: unknown) => {
  const next = copy(value);
  next.subtitle = normalizeLessonSubtitle(next.subtitle, next.technique, next.learningGoals);
  return normalizeStudentFacingContent(next);
};
const lines = (items: string[]) => items.join("\n");
const parseLines = (value: string) =>
  value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

export function ReviewWorkspace({
  project,
  initialLessons,
}: {
  project: { id: string; name: string; grade: string; lessonCount: number };
  initialLessons: LessonRow[];
}) {
  const [lessons, setLessons] = useState(initialLessons);
  const [selectedId, setSelectedId] = useState(initialLessons[0]?.id ?? "");
  const [draft, setDraft] = useState<LessonContent>(() =>
    normalizedCopy(initialLessons[0]?.content ?? {}),
  );
  const [message, setMessage] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [draggingQuestionImage, setDraggingQuestionImage] = useState(false);
  const questionImageInput = useRef<HTMLInputElement>(null);
  const selected = useMemo(
    () => lessons.find((lesson) => lesson.id === selectedId),
    [lessons, selectedId],
  );
  const update = (fn: (next: LessonContent) => void) =>
    setDraft((value) => {
      const next = copy(value);
      fn(next);
      return next;
    });
  const select = (lesson: LessonRow) => {
    setSelectedId(lesson.id);
    setDraft(normalizedCopy(lesson.content));
    setMessage("");
  };
  async function save(approve = false, revoke = false) {
    if (!selected) return;
    const contentForSave = copy(draft);
    // “通过本讲文字审核”就是唯一的最终确认动作：同时确认原文来源和课程对标。
    if (approve) {
      contentForSave.readingExcerpt.approved = true;
      contentForSave.curriculumAlignment.forEach((item) => { item.confirmed = true; });
    }
    const response = await fetch(`/api/lessons/${selected.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: contentForSave, approveText: approve, revokeTextApproval: revoke }),
    });
    const payload = await response.json();
    if (!response.ok) return setMessage(payload.error ?? "保存失败");
    const nextLessons = lessons.map((item) =>
        item.id === selected.id
          ? {
              ...item,
              title: draft.title,
              content: contentForSave,
              textApproved: revoke ? false : approve || item.textApproved,
            }
          : item,
      );
    setLessons(nextLessons);
    if (approve && nextLessons.every((item) => item.textApproved)) {
      window.location.href = project.grade === "1升2" ? `/projects/${project.id}/pinyin` : `/projects/${project.id}/layout`;
      return;
    }
    if (approve) {
      const next = nextLessons.find((item) => item.lessonNumber === selected.lessonNumber + 1 && !item.textApproved);
      if (next) { select(next); setMessage(`第${selected.lessonNumber}讲已通过，已进入第${next.lessonNumber}讲审核。`); return; }
    }
    setMessage(revoke ? "已撤回本讲文字审核，可继续修改后重新通过。" : approve ? "本讲文字审核已通过" : "已保存文字修改");
  }
  async function uploadQuestionImage(files: FileList | null) {
    const file = files?.[0];
    if (!file || !selected) return;
    const form = new FormData();
    form.set("file", file);
    form.set("kind", "QUESTION_IMAGE");
    form.set("lessonNumber", String(selected.lessonNumber));
    const response = await fetch(`/api/projects/${project.id}/files`, {
      method: "POST",
      body: form,
    });
    const payload = await response.json();
    if (!response.ok) return setMessage(payload.error ?? "题图上传失败");
    const contentForSave = copy(draft);
    if (!contentForSave.practice[questionIndex]) return;
    contentForSave.practice[questionIndex].imageSourceFileId = payload.file.id;
    delete contentForSave.practice[questionIndex].imageSourcePageId;
    // 上传不是“暂存操作”：题图必须立即写回本讲，进入版式/翻页预览时才能找到它。
    const saveResponse = await fetch(`/api/lessons/${selected.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: contentForSave }),
    });
    const saved = await saveResponse.json().catch(() => ({}));
    if (!saveResponse.ok) return setMessage(saved.error ?? "题图已上传，但关联保存失败");
    setDraft(contentForSave);
    setLessons((items) => items.map((item) => item.id === selected.id ? { ...item, content: contentForSave } : item));
    setMessage(`题图已上传并关联到真题带练第${questionIndex + 1}题，版式预览会立即显示。`);
  }
  async function regenerateAllLessons() {
    setMessage(`正在根据主讲文件重新生成${project.lessonCount}讲初稿…`);
    const response = await fetch(`/api/projects/${project.id}/generate-content`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok) return setMessage(payload.error ?? "重新生成失败");
    window.location.reload();
  }
  if (!selected)
    return (
      <main className="review-page">
        <div className="empty-state">系统正在生成文字初稿。</div>
      </main>
    );
  return (
    <main className="review-page">
      <header className="review-header">
        <Link href="/">
          <ArrowLeft size={17} /> 返回工作台
        </Link>
        <div>
          <span>第一次人工审核</span>
          <h1>{project.name}</h1>
        </div>
        <strong>{project.grade}</strong>
      </header>
      <div className="review-layout">
        <aside className="lesson-nav">
          <h2>课程目录</h2>
          {lessons.map((lesson) => (
            <button
              type="button"
              key={lesson.id}
              className={lesson.id === selectedId ? "active" : ""}
              onClick={() => select(lesson)}
            >
              <span>第{lesson.lessonNumber}讲</span>
              <b>{lesson.title}</b>
              {lesson.textApproved && <CheckCircle2 size={15} />}
            </button>
          ))}
        </aside>
        <section className="review-editor">
          <div className="review-toolbar">
            <div>
              <h2>第{selected.lessonNumber}讲文字内容</h2>
              <p>
                这里是对外展示的中文内容；阅读文段只能纠正识别错误，不能压缩改写。
              </p>
            </div>
          <div
            className={`question-upload${draggingQuestionImage ? " is-dragging" : ""}`}
            onDragEnter={(event) => { event.preventDefault(); setDraggingQuestionImage(true); }}
            onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }}
            onDragLeave={(event) => {
              const nextTarget = event.relatedTarget as Node | null;
              if (!nextTarget || !event.currentTarget.contains(nextTarget)) setDraggingQuestionImage(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDraggingQuestionImage(false);
              void uploadQuestionImage(event.dataTransfer.files);
            }}
          >
            <span>放入真题带练第</span>
            <select aria-label="选择真题带练题号" value={questionIndex} onChange={(event) => setQuestionIndex(Number(event.target.value))}>{draft.practice.map((_, index) => <option value={index} key={index}>{index + 1} 题</option>)}</select>
            <button type="button" className="secondary-button" onClick={() => questionImageInput.current?.click()}>上传人工替代题图</button>
            <input ref={questionImageInput} type="file" accept="image/*" onChange={(event) => void uploadQuestionImage(event.target.files)} />
          </div>
            {lessons.length < project.lessonCount && <button className="secondary-button" onClick={() => void regenerateAllLessons()}><RefreshCw size={16} /> 从合订文件重建{project.lessonCount}讲</button>}
          </div>
          <div className="content-editor">
            <section>
              <h3>课程信息</h3>
              <label>
                课程标题
                <input
                  value={draft.title}
                  onChange={(e) =>
                    update((x) => {
                      x.title = e.target.value;
                    })
                  }
                />
              </label>
              <label>
                课程副标题
                <input
                  value={draft.subtitle ?? ""}
                  onChange={(e) =>
                    update((x) => {
                      x.subtitle = e.target.value;
                    })
                  }
                />
              </label>
              <label>
                核心方法
                <textarea
                  value={draft.technique}
                  onChange={(e) =>
                    update((x) => {
                      x.technique = e.target.value;
                    })
                  }
                />
              </label>
            </section>
            <section>
              <h3>学习目标</h3>
              <p>一行一条。</p>
              <textarea
                value={lines(draft.learningGoals)}
                onChange={(e) =>
                  update((x) => {
                    x.learningGoals = parseLines(e.target.value);
                  })
                }
              />
            </section>
            <section>
              <h3>💬 下课后交流话题（每题均含参考答案）</h3>
              {draft.conversationTopics.map((item, index) => (
                <div className="topic-editor" key={index}>
                  <label>
                    问题 {index + 1}
                    <textarea
                      value={item.question}
                      onChange={(e) =>
                        update((x) => {
                          x.conversationTopics[index].question = e.target.value;
                        })
                      }
                    />
                  </label>
                  <label>
                    参考答案
                    <textarea
                      value={item.referenceAnswer}
                      onChange={(e) =>
                        update((x) => {
                          x.conversationTopics[index].referenceAnswer =
                            e.target.value;
                        })
                      }
                    />
                  </label>
                </div>
              ))}
            </section>
            <section>
              <h3>阅读文段</h3>
              <p className="source-lock">
                来自主讲文件原文摘抄；仅允许修正识别错误。
              </p>
              <textarea
                className="reading-editor"
                value={draft.readingExcerpt.text}
                onChange={(e) =>
                  update((x) => {
                    x.readingExcerpt.text = e.target.value;
                  })
                }
              />
              <h4>精读思考</h4>
              <textarea
                value={lines(draft.closeReadingQuestions)}
                onChange={(e) =>
                  update((x) => {
                    x.closeReadingQuestions = parseLines(e.target.value);
                  })
                }
              />
            </section>
            <section>
              <h3>课堂方法与真题带练</h3>
              <label>
                方法小结
                <textarea
                  value={draft.methodSummary}
                  onChange={(e) =>
                    update((x) => {
                      x.methodSummary = e.target.value;
                    })
                  }
                />
              </label>
              {draft.practice.map((item, index) => (
                <div className="topic-editor" key={index}>
                  <label>
                    练习 {index + 1}
                    <textarea
                      value={item.prompt}
                      onChange={(e) =>
                        update((x) => {
                          x.practice[index].prompt = e.target.value;
                        })
                      }
                    />
                  </label>
                  <label>
                    参考答案
                    <textarea
                      value={item.answer}
                      onChange={(e) =>
                        update((x) => {
                          x.practice[index].answer = e.target.value;
                        })
                      }
                    />
                  </label>
                </div>
              ))}
            </section>
            <section>
              <h3>我是小老师</h3>
              <label>
                讲解步骤（每行一步）
                <textarea
                  value={lines(draft.littleTeacherSteps)}
                  onChange={(e) =>
                    update((x) => {
                      x.littleTeacherSteps = parseLines(e.target.value);
                    })
                  }
                />
              </label>
              <label>
                学生版表达题干
                <textarea
                  value={draft.oralFramework}
                  onChange={(e) =>
                    update((x) => {
                      x.oralFramework = e.target.value;
                    })
                  }
                />
              </label>
            </section>
          </div>
          <div className="review-actions">
            <span>{message}</span>
            <button
              className="secondary-button"
              onClick={() => void save(false)}
            >
              <Save size={16} /> 保存修改
            </button>
            <button
              className="primary-button"
              onClick={() => void save(selected.textApproved ? false : true, selected.textApproved)}
            >
              {selected.textApproved ? <RotateCcw size={16} /> : <CheckCircle2 size={16} />}{" "}
              {selected.textApproved ? "撤回本讲文字审核" : "通过本讲文字审核"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
