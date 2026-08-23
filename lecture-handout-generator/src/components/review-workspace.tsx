"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Download, FileCheck2, Save } from "lucide-react";
import type { LessonContent } from "@/lib/handout/content-schema";

type LessonRow = { id: string; lessonNumber: number; title: string; content: unknown; textApproved: boolean; pinyinApproved: boolean };

export function ReviewWorkspace({ project, initialLessons }: { project: { id: string; name: string; grade: string }; initialLessons: LessonRow[] }) {
  const [lessons, setLessons] = useState(initialLessons);
  const [selectedId, setSelectedId] = useState(initialLessons[0]?.id ?? "");
  const [draft, setDraft] = useState(() => JSON.stringify(initialLessons[0]?.content ?? {}, null, 2));
  const [message, setMessage] = useState("");
  const selected = useMemo(() => lessons.find((lesson) => lesson.id === selectedId), [lessons, selectedId]);

  function selectLesson(lesson: LessonRow) { setSelectedId(lesson.id); setDraft(JSON.stringify(lesson.content ?? {}, null, 2)); setMessage(""); }

  async function save(approve = false) {
    if (!selected) return;
    setMessage("");
    try {
      const content = JSON.parse(draft) as LessonContent;
      const response = await fetch(`/api/lessons/${selected.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ content, approveText: approve }) });
      const payload = await response.json();
      if (!response.ok) { setMessage(payload.error ?? "保存失败"); return; }
      setLessons((items) => items.map((item) => item.id === selected.id ? { ...item, title: content.title, content, textApproved: approve || item.textApproved } : item));
      setMessage(approve ? "本讲文字审核已通过" : "已保存文字修改");
    } catch { setMessage("JSON格式不正确，请检查逗号和引号"); }
  }

  function confirmEvidence() {
    try {
      const content = JSON.parse(draft) as LessonContent;
      content.readingExcerpt.approved = true;
      content.curriculumAlignment = content.curriculumAlignment.map((item) => ({ ...item, confirmed: true }));
      setDraft(JSON.stringify(content, null, 2));
      setMessage("已标记阅读原文及联网来源为人工确认，请保存或通过审核");
    } catch { setMessage("当前内容格式不正确"); }
  }

  async function uploadQuestionImage(files: FileList | null) {
    const file = files?.[0]; if (!file || !selected) return; const form = new FormData(); form.set("file", file); form.set("kind", "QUESTION_IMAGE"); form.set("lessonNumber", String(selected.lessonNumber));
    const response = await fetch(`/api/projects/${project.id}/files`, { method: "POST", body: form }); const payload = await response.json();
    if (!response.ok) { setMessage(payload.error ?? "题图上传失败"); return; }
    try { const content = JSON.parse(draft) as LessonContent; if (!content.practice[0]) throw new Error(); content.practice[0].imageSourceFileId = payload.file.id; delete content.practice[0].imageSourcePageId; setDraft(JSON.stringify(content, null, 2)); setMessage("人工题图已关联到第1道练习；可在JSON中移动到其他练习"); } catch { setMessage("内容格式错误，暂无法关联题图"); }
  }

  return <main className="review-page">
    <header className="review-header"><Link href="/"><ArrowLeft size={17} /> 返回工作台</Link><div><span>第一次人工审核</span><h1>{project.name}</h1></div><strong>{project.grade}</strong></header>
    <div className="review-layout">
      <aside className="lesson-tabs"><h2>课程目录</h2>{lessons.map((lesson) => <button key={lesson.id} className={lesson.id === selectedId ? "active" : ""} onClick={() => selectLesson(lesson)}><span>第{lesson.lessonNumber}讲</span><b>{lesson.title}</b>{lesson.textApproved && <CheckCircle2 size={15} />}</button>)}</aside>
      <section className="review-editor">
        {selected ? <>
          <div className="review-toolbar"><div><h2>第{selected.lessonNumber}讲文字内容</h2><p>所有字段均可修改；阅读文段只能纠正PDF识别错误，不能压缩改写。</p></div><label className="secondary-button question-upload">人工替代题图<input type="file" accept="image/*" onChange={(event) => void uploadQuestionImage(event.target.files)} /></label><button className="secondary-button" onClick={confirmEvidence}><FileCheck2 size={16} /> 确认原文与来源</button></div>
          <textarea className="json-editor" value={draft} onChange={(event) => setDraft(event.target.value)} spellCheck={false} />
          <div className="review-actions"><span>{message}</span>{selected.textApproved && <><a className="secondary-button" href={`/api/projects/${project.id}/export?kind=lesson_student&lesson=${selected.lessonNumber}`}><Download size={16} /> 学生版</a><a className="secondary-button" href={`/api/projects/${project.id}/export?kind=lesson_answers&lesson=${selected.lessonNumber}`}><Download size={16} /> 独立答案</a></>}<button className="secondary-button" onClick={() => void save(false)}><Save size={16} /> 保存修改</button><button className="primary-button" onClick={() => void save(true)} disabled={selected.textApproved}><CheckCircle2 size={16} /> {selected.textApproved ? "已审核" : "通过本讲文字审核"}</button></div>
        </> : <div className="empty-state">PDF解析后，请在工作台生成文字初稿。</div>}
      </section>
    </div>
  </main>;
}
