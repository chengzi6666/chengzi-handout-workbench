"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Download, Grip, ImagePlus, Save } from "lucide-react";

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

export function LayoutWorkspace({
  project,
  backgrounds: initialBackgrounds,
  teachers,
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
}) {
  const initial = (project.layoutConfig as { teacherImage?: Position } | null)
    ?.teacherImage ?? { x: 67, y: 57, width: 25, height: 30 };
  const [position, setPosition] = useState<Position>(initial);
  const [teacherId, setTeacherId] = useState(
    project.teacherId ??
      teachers.find((teacher) => teacher.grade === project.grade)?.id ??
      teachers[0]?.id ??
      "",
  );
  const [backgrounds, setBackgrounds] = useState(initialBackgrounds);
  const [message, setMessage] = useState("");
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
  const previewBackground =
    backgrounds.find((asset) => asset.role === "PRACTICE") ??
    backgrounds.find((asset) => asset.role === "SIMPLE");
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
          fontFamily: "Microsoft YaHei",
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
          <p>简单模式上传一张；专业模式按页面用途分别上传。</p>
          {roles.map(([role, label]) => (
            <label className="asset-upload" key={role}>
              <span>
                <ImagePlus size={15} />
                {label}
              </span>
              <em>
                {backgrounds.some((item) => item.role === role)
                  ? "已上传，可替换"
                  : "选择图片"}
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
          <div className="layout-toolbar">
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
            style={
              previewBackground
                ? {
                    backgroundImage: `url(/api/assets/background/${previewBackground.id})`,
                  }
                : undefined
            }
          >
            <div className="canvas-copy">
              <h2>课堂方法与真题带练</h2>
              <h3>方法小结</h3>
              <p>
                这里展示可选择、可编辑的微软雅黑正文。导出后，正文仍是Word文字。
              </p>
              <h3>练一练</h3>
              <p>题目与参考答案将按审核后的内容排版。</p>
            </div>
            {activeAsset ? (
              <img
                className="floating-teacher"
                src={`/api/assets/teacher/${activeAsset.id}`}
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
            ) : (
              <div
                className="teacher-placeholder"
                style={{
                  left: `${position.x}%`,
                  top: `${position.y}%`,
                  width: `${position.width}%`,
                  height: `${position.height}%`,
                }}
              >
                <Grip />
                上传老师表情后可拖动
              </div>
            )}
          </div>
          <div className="review-actions">
            <span>{message}</span>
            <button className="secondary-button" onClick={() => void save()}>
              <Save size={16} /> 保存版式审核
            </button>
          </div>
        </section>
        <aside className="export-panel">
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
          <Link className="publish-button" href={`/projects/${project.id}/flipbook-preview`}>
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
