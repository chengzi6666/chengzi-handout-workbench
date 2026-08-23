"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
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
      if (response.ok) setUnits(payload.units);
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
    setMessage("拼音已人工审核并保存，请继续审核下一讲");
  }
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
        <aside className="lesson-tabs">
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
              onClick={() => void approve()}
              disabled={loading || units.length === 0}
            >
              <CheckCircle2 size={16} /> 完成拼音审核
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
