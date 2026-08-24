"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import type { PinyinUnit } from "@/lib/handout/pinyin";

type LessonItem = {
  id: string;
  lessonNumber: number;
  title: string;
  approved: boolean;
};
export function PinyinWorkspace({
  project,
  lessons: initialLessons,
}: {
  project: { id: string; name: string };
  lessons: LessonItem[];
}) {
  const [lessons, setLessons] = useState(initialLessons);
  const [selectedId, setSelectedId] = useState(initialLessons[0]?.id ?? "");
  const [units, setUnits] = useState<PinyinUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    setMessage("");
    fetch(`/api/lessons/${selectedId}/pinyin`).then(async (response) => {
      const payload = await response.json();
      if (response.ok) {
        setUnits(payload.units);
        setLessons((items) => items.map((item) => item.id === selectedId ? { ...item, approved: Boolean(payload.approved) } : item));
      }
      else setMessage(payload.error ?? "读取失败");
      setLoading(false);
    });
  }, [selectedId]);
  async function approve() {
    const response = await fetch(`/api/lessons/${selectedId}/pinyin`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ units }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "审核失败");
      return;
    }
    const nextLessons = lessons.map((item) => item.id === selectedId ? { ...item, approved: true } : item);
    setLessons(nextLessons);
    if (nextLessons.every((item) => item.approved)) { window.location.href = `/projects/${project.id}/layout`; return; }
    const currentIndex = nextLessons.findIndex((item) => item.id === selectedId);
    const next = nextLessons.slice(currentIndex + 1).find((item) => !item.approved) ?? nextLessons.find((item) => !item.approved);
    if (next) setSelectedId(next.id);
    setMessage("已保存，已自动进入下一讲拼音审核");
  }
  async function revoke() {
    const response = await fetch(`/api/lessons/${selectedId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ revokePinyinApproval: true }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "撤回失败");
      return;
    }
    setLessons((items) => items.map((item) => item.id === selectedId ? { ...item, approved: false } : item));
    setMessage("已撤回本讲拼音审核，可以继续修改");
  }
  const currentLesson = lessons.find((item) => item.id === selectedId);
  return (
    <main className="review-page">
      <header className="review-header">
        <Link href="/">
          <ArrowLeft size={17} /> 返回工作台
        </Link>
        <div>
          <span>二年级阅读文段专用</span>
          <h1>{project.name} · 拼音审核</h1>
        </div>
      </header>
      <div className="review-layout">
        <aside className="lesson-nav">
          <h2>课程目录</h2>
          {lessons.map((lesson) => (
            <button
              key={lesson.id}
              className={lesson.id === selectedId ? "active" : ""}
              onClick={() => setSelectedId(lesson.id)}
            >
              <span>第{lesson.lessonNumber}讲</span>
              <b>{lesson.title}</b>
              {lesson.approved && <CheckCircle2 size={15} />}
            </button>
          ))}
        </aside>
        <section className="review-editor">
          <div className="review-toolbar">
            <div>
              <h2>逐字校对拼音</h2>
              <p>只有【阅读文段】会注音。请重点核对多音字，非汉字不加拼音。</p>
            </div>
          </div>
          {loading ? (
            <div className="empty-state">
              <Loader2 className="spin" /> 正在准备拼音草稿
            </div>
          ) : (
            <div className="pinyin-grid">
              {units.map((unit, index) =>
                /[\u3400-\u9fff]/u.test(unit.char) ? (
                  <label key={`${index}-${unit.char}`}>
                    <input
                      value={unit.pinyin}
                      onChange={(event) =>
                        setUnits((items) =>
                          items.map((item, i) =>
                            i === index
                              ? { ...item, pinyin: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                    <b>{unit.char}</b>
                  </label>
                ) : (
                  <span key={`${index}-${unit.char}`} className="plain-char">
                    {unit.char}
                  </span>
                ),
              )}
            </div>
          )}
          <div className="review-actions">
            <span>{message}</span>
            <button
              className="primary-button"
              onClick={() => void (currentLesson?.approved ? revoke() : approve())}
              disabled={loading || units.length === 0}
            >
              {currentLesson?.approved ? <RotateCcw size={16} /> : <CheckCircle2 size={16} />}
              {currentLesson?.approved ? "撤回完成拼音审核" : "完成拼音审核"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
