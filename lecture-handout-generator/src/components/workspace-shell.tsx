"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpenCheck, CheckCircle2, ChevronDown, FileText, FileUp, Loader2, LogOut, Search, Settings2, Sparkles } from "lucide-react";
import { ProjectSidebar } from "./project-sidebar";
import { OUTPUT_OPTIONS, type HandoutProject, type OutputKind } from "@/lib/domain";

interface WorkspaceShellProps {
  initialProjects: HandoutProject[];
  user: { employeeNumber: string; name: string };
}

export function WorkspaceShell({ initialProjects, user }: WorkspaceShellProps) {
  const [projects, setProjects] = useState(initialProjects);
  const [selectedId, setSelectedId] = useState(initialProjects[0]?.id ?? "");
  const [outputs, setOutputs] = useState<OutputKind[]>(["lesson_student", "combined_student"]);
  const [sourceFiles, setSourceFiles] = useState<Array<{ id: string; originalName: string; size: number }>>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [processing, setProcessing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [processMessage, setProcessMessage] = useState("");
  const [parseProgress, setParseProgress] = useState<{ percent: number; label: string } | null>(null);
  const selected = useMemo(() => projects.find((project) => project.id === selectedId) ?? projects[0], [projects, selectedId]);

  useEffect(() => {
    if (!selectedId) { setSourceFiles([]); return; }
    const project = projects.find((item) => item.id === selectedId);
    if (project) setOutputs(project.outputKinds);
    fetch(`/api/projects/${selectedId}/files`).then(async (response) => {
      if (response.ok) setSourceFiles((await response.json()).files);
    });
    fetch(`/api/projects/${selectedId}/jobs`).then(async (response) => {
      if (!response.ok) return;
      const { jobs } = await response.json() as { jobs: Array<{ status: string }> };
      if (jobs.some((job) => job.status === "QUEUED" || job.status === "RUNNING")) {
        setProcessing(true);
        setProcessMessage("正在恢复解析进度…");
      }
    });
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || !processing) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/projects/${selectedId}/jobs`);
      if (!response.ok) return;
      const { jobs } = await response.json() as { jobs: Array<{ status: string; error?: string | null; result?: { stage?: string; pageNumber?: number; totalPages?: number; percent?: number } | null }> };
      if (jobs.some((job) => job.status === "FAILED")) {
        setProcessing(false);
        setParseProgress(null);
        setProcessMessage(jobs.find((job) => job.status === "FAILED")?.error?.split("\n")[0] ?? "解析失败，请检查PDF");
      } else if (jobs.length > 0 && jobs.every((job) => job.status === "SUCCEEDED")) {
        setProcessing(false);
        setParseProgress({ percent: 100, label: "解析完成" });
        setProcessMessage("PDF解析完成，已进入文字审核阶段");
      } else {
        const active = jobs.find((job) => job.status === "RUNNING" && job.result?.percent !== undefined);
        const completed = jobs.filter((job) => job.status === "SUCCEEDED").length;
        if (active?.result) {
          const { percent = 0, pageNumber = 0, totalPages = 0, stage } = active.result;
          const stageLabel = stage === "saving" ? "正在保存原图" : stage === "writing" ? "正在写入解析内容" : "正在提取课件";
          const overallPercent = Math.min(99, Math.round(((completed + percent / 100) / jobs.length) * 100));
          setParseProgress({ percent: overallPercent, label: `${stageLabel}：第 ${pageNumber}/${totalPages} 页` });
          setProcessMessage(`正在解析 ${completed + 1}/${jobs.length} 个PDF…`);
        } else {
          setParseProgress({ percent: Math.round((completed / jobs.length) * 100), label: `正在等待解析第 ${completed + 1} 个PDF` });
          setProcessMessage(`正在解析 ${completed}/${jobs.length} 个PDF…`);
        }
      }
    }, 1800);
    return () => window.clearInterval(timer);
  }, [processing, selectedId]);

  async function togglePinned(id: string) {
    const project = projects.find((item) => item.id === id);
    if (!project) return;
    setProjects((items) => items.map((item) => item.id === id ? { ...item, pinned: !item.pinned } : item));
    const response = await fetch(`/api/projects/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ pinned: !project.pinned }) });
    if (!response.ok) setProjects((items) => items.map((item) => item.id === id ? project : item));
  }

  async function renameProject(id: string, name: string) {
    const previous = projects.find((item) => item.id === id);
    setProjects((items) => items.map((item) => item.id === id ? { ...item, name } : item));
    const response = await fetch(`/api/projects/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
    if (!response.ok && previous) setProjects((items) => items.map((item) => item.id === id ? previous : item));
  }

  async function createProject() {
    const name = window.prompt("请输入项目名称", `${new Date().getFullYear()}年秋季五讲`);
    if (!name?.trim()) return;
    const grade = window.prompt("请输入年级，例如：1升2", "1升2");
    if (!grade?.trim()) return;
    const yearValue = window.prompt("请输入本课程适用的教材年份，例如：2026", String(new Date().getFullYear()));
    const teachingYear = Number(yearValue);
    if (!Number.isInteger(teachingYear) || teachingYear < 2022 || teachingYear > 2100) {
      window.alert("请输入 2022—2100 之间的四位年份");
      return;
    }
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim(), grade: grade.trim(), teachingYear, season: "秋季", lessonCount: 5 })
    });
    if (!response.ok) return;
    const { project } = await response.json();
    const next: HandoutProject = { id: project.id, name: project.name, grade: project.grade, lessonCount: project.lessonCount, teachingYear: project.teachingYear, teachingYearConfirmed: false, outputKinds: ["lesson_student", "combined_student"], status: "draft", pinned: project.pinned, updatedAt: "刚刚" };
    setProjects((items) => [next, ...items]);
    setSelectedId(next.id);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  function toggleOutput(id: OutputKind) {
    setOutputs((items) => {
      const next = items.includes(id) ? items.filter((item) => item !== id) : [...items, id];
      setProjects((projectItems) => projectItems.map((project) => project.id === selectedId ? { ...project, outputKinds: next } : project));
      if (selectedId) void fetch(`/api/projects/${selectedId}/outputs`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ kinds: next.map((kind) => ({ lesson_student: "LESSON_STUDENT", combined_student: "COMBINED_STUDENT", combined_answers: "COMBINED_ANSWERS", parent_manual: "PARENT_MANUAL", lesson_answers: "LESSON_ANSWERS" })[kind]) }) });
      return next;
    });
  }

  async function uploadPdfs(files: FileList | null) {
    if (!files?.length || !selectedId) return;
    setUploading(true);
    setUploadMessage("");
    let uploaded = 0;
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch(`/api/projects/${selectedId}/files`, { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) { setUploadMessage(`${file.name}：${payload.error ?? "上传失败"}`); continue; }
      uploaded += 1;
      setSourceFiles((items) => items.some((item) => item.id === payload.file.id) ? items : [payload.file, ...items]);
    }
    if (uploaded > 0) setUploadMessage(`已成功保存 ${uploaded} 个主讲PDF`);
    setUploading(false);
  }

  async function confirmYear() {
    if (!selected || selected.teachingYearConfirmed) return true;
    if (!window.confirm(`请确认：本项目按 ${selected.teachingYear} 年最新教材与课标口径检索。确认后才能开始解析。`)) return false;
    const response = await fetch(`/api/projects/${selected.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmTeachingYear: true })
    });
    if (!response.ok) return false;
    setProjects((items) => items.map((item) => item.id === selected.id ? { ...item, teachingYearConfirmed: true } : item));
    return true;
  }

  async function changeTeachingYear() {
    if (!selected) return;
    const value = window.prompt("请输入本课程适用的教材年份", String(selected.teachingYear));
    if (value === null) return;
    const teachingYear = Number(value);
    if (!Number.isInteger(teachingYear) || teachingYear < 2022 || teachingYear > 2100) {
      window.alert("请输入 2022—2100 之间的四位年份");
      return;
    }
    if (teachingYear === selected.teachingYear) return;
    const response = await fetch(`/api/projects/${selected.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ teachingYear })
    });
    if (!response.ok) return;
    setProjects((items) => items.map((item) => item.id === selected.id ? { ...item, teachingYear, teachingYearConfirmed: false } : item));
    setProcessMessage(`已切换为 ${teachingYear} 年教材口径，请在解析前重新确认。`);
  }

  async function startParsing() {
    if (!selected || sourceFiles.length === 0 || outputs.length === 0) return;
    setProcessMessage("");
    setParseProgress({ percent: 0, label: "正在创建解析任务" });
    if (!(await confirmYear())) return;
    const response = await fetch(`/api/projects/${selected.id}/parse`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok) { setProcessMessage(payload.error ?? "无法开始解析"); return; }
    setProcessing(true);
    setProcessMessage(`已创建 ${payload.jobCount} 个解析任务`);
  }

  async function generateContent() {
    if (!selected) return;
    setGenerating(true);
    setProcessMessage("正在调用模型生成讲义初稿；多讲课程可能需要几分钟…");
    const response = await fetch(`/api/projects/${selected.id}/generate-content`, { method: "POST" });
    const payload = await response.json();
    setGenerating(false);
    if (!response.ok) { setProcessMessage(payload.error ?? "生成失败"); return; }
    setProcessMessage(`已生成 ${payload.lessonIds.length} 讲文字初稿，请进入文字审核`);
  }

  return (
    <main className="app-shell">
      <ProjectSidebar
        projects={projects}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onTogglePinned={togglePinned}
        onRename={renameProject}
        onCreate={createProject}
      />

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">讲义项目</p>
            <h1>{selected?.name ?? "新建讲义项目"}</h1>
          </div>
          <div className="topbar-actions">
            <button className="model-picker"><Sparkles size={16} /> 公司内部模型 <ChevronDown size={15} /></button>
            <button className="icon-button" aria-label="搜索"><Search size={18} /></button>
            <button className="profile-button" onClick={logout} title="退出登录"><span>{user.employeeNumber}</span><strong>{user.name}</strong><LogOut size={14} /></button>
          </div>
        </header>

        <div className="workspace-scroll">
          <section className="hero-card">
            <div>
              <span className="step-badge">新建生成任务</span>
              <h2>从主讲PDF生成可审核、可编辑的Word讲义</h2>
              <p>先审核文字与阅读文段，再审核版式、背景和主讲表情，最后输出DOCX。</p>
            </div>
            <div className="hero-illustration"><BookOpenCheck size={54} /></div>
          </section>

          <div className="content-grid">
            <section className="panel upload-panel">
              <div className="panel-title"><span>01</span><div><h3>上传主讲PDF</h3><p>支持一次上传一讲或多讲</p></div></div>
              <label className="dropzone">
                {uploading ? <Loader2 className="spin" size={30} /> : <FileUp size={30} />}
                <strong>{uploading ? "正在安全上传…" : "点击选择或拖入PDF"}</strong>
                <span>系统将识别讲次、阅读文段、课堂方法和练习题</span>
                <input type="file" accept="application/pdf" multiple onChange={(event) => void uploadPdfs(event.target.files)} disabled={uploading || !selectedId} />
              </label>
              {sourceFiles.length > 0 && <div className="uploaded-files">{sourceFiles.map((file) => <div key={file.id}><FileText size={14} /><span>{file.originalName}</span><small>{(file.size / 1024 / 1024).toFixed(1)} MB</small><CheckCircle2 size={14} /></div>)}</div>}
              {uploadMessage && <p className="upload-message">{uploadMessage}</p>}
              <div className="rule-note"><strong>阅读文段保护</strong><span>原文允许纠正识别错误，但不得压缩或改写；输出文字版不自动添加拼音。</span></div>
            </section>

            <section className="panel">
              <div className="panel-title"><span>02</span><div><h3>选择输出内容</h3><p>可以同时生成多种Word文档</p></div></div>
              <div className="output-list">
                {OUTPUT_OPTIONS.map((option) => (
                  <label className={`output-option ${outputs.includes(option.id) ? "selected" : ""}`} key={option.id}>
                    <input type="checkbox" checked={outputs.includes(option.id)} onChange={() => toggleOutput(option.id)} />
                    <span className="custom-check">✓</span>
                    <span><strong>{option.label}</strong><small>{option.detail}</small></span>
                  </label>
                ))}
              </div>
            </section>
          </div>

          <section className="panel workflow-panel">
            <div className="panel-title"><span>03</span><div><h3>生成与双重审核</h3><p>所有步骤均可保存并稍后继续</p></div></div>
            <div className="workflow-steps">
              {[
                ["解析PDF", "提取无拼音文字"],
                ["文字审核", "核对原文与答案"],
                ["设计排版", "微软雅黑与背景"],
                ["版式审核", "拖动、缩放、换表情"],
                ["生成Word", "可编辑DOCX"]
              ].map(([title, detail], index) => (
                <div className="workflow-step" key={title}><b>{index + 1}</b><strong>{title}</strong><span>{detail}</span></div>
              ))}
            </div>
            <div className="action-row">
              <button className="secondary-button"><Settings2 size={16} /> 生成设置</button>
              {selected && <Link className="secondary-button" href={`/projects/${selected.id}/review`}>文字审核</Link>}
              {selected?.grade.replace(/\s/g, "") === "1升2" && <Link className="secondary-button" href={`/projects/${selected.id}/pinyin`}>拼音审核</Link>}
              {selected && <Link className="secondary-button" href={`/projects/${selected.id}/layout`}>版式与导出</Link>}
              <button className="secondary-button" onClick={() => void generateContent()} disabled={processing || generating || sourceFiles.length === 0}>
                {generating ? <Loader2 className="spin" size={16} /> : <FileText size={16} />} 生成文字初稿
              </button>
              <button className={`year-confirm ${selected?.teachingYearConfirmed ? "confirmed" : ""}`} onClick={() => void changeTeachingYear()} title="点击修改教材年份">
                {selected?.teachingYearConfirmed ? <CheckCircle2 size={15} /> : null}
                {selected ? `${selected.teachingYear}年口径${selected.teachingYearConfirmed ? "已确认" : "待确认"}` : ""} <small>修改</small>
              </button>
              <button className="primary-button" onClick={() => void startParsing()} disabled={processing || outputs.length === 0 || sourceFiles.length === 0}>
                {processing ? <Loader2 className="spin" size={17} /> : <Sparkles size={17} />} {processing ? "解析中" : "开始解析"}
              </button>
            </div>
            {processMessage && <p className="process-message">{processMessage}</p>}
            {parseProgress && <div className="parse-progress" aria-live="polite">
              <div className="parse-progress-meta"><span>{parseProgress.label}</span><strong>{parseProgress.percent}%</strong></div>
              <div className="parse-progress-track"><span style={{ width: `${parseProgress.percent}%` }} /></div>
            </div>}
          </section>
        </div>
      </section>
    </main>
  );
}
