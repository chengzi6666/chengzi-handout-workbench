"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BookOpenCheck, CheckCircle2, FileText, FileUp, Loader2, LogOut, Settings2, Sparkles } from "lucide-react";
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
  const [generationSettingsOpen, setGenerationSettingsOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectGrade, setNewProjectGrade] = useState("1升2");
  const [newProjectYear, setNewProjectYear] = useState(String(new Date().getFullYear()));
  const [createProjectMessage, setCreateProjectMessage] = useState("");
  const [settingsYear, setSettingsYear] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const autoNavigateToReviewFor = useRef<string | null>(null);
  const [processMessage, setProcessMessage] = useState("");
  const [parseProgress, setParseProgress] = useState<{ percent: number; label: string } | null>(null);
  const selected = useMemo(() => projects.find((project) => project.id === selectedId) ?? projects[0], [projects, selectedId]);

  useEffect(() => {
    if (!selectedId) { setSourceFiles([]); setProcessing(false); setParseProgress(null); return; }
    let active = true;
    const controller = new AbortController();
    setSourceFiles([]);
    setProcessing(false);
    setParseProgress(null);
    setProcessMessage("");
    autoNavigateToReviewFor.current = null;
    const project = projects.find((item) => item.id === selectedId);
    if (project) setOutputs(project.outputKinds);
    fetch(`/api/projects/${selectedId}/files`, { signal: controller.signal }).then(async (response) => {
      if (active && response.ok) setSourceFiles((await response.json()).files);
    }).catch(() => undefined);
    fetch(`/api/projects/${selectedId}/jobs`, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) return;
      const { jobs } = await response.json() as { jobs: Array<{ status: string }> };
      if (active && jobs.some((job) => job.status === "QUEUED" || job.status === "RUNNING")) {
        setProcessing(true);
        setProcessMessage("正在恢复解析进度…");
      }
    }).catch(() => undefined);
    return () => { active = false; controller.abort(); };
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || !processing) return;
    let active = true;
    const poll = async () => {
      const response = await fetch(`/api/projects/${selectedId}/jobs`).catch(() => null);
      if (!active || !response) return;
      if (!response.ok) return;
      const { jobs } = await response.json() as { jobs: Array<{ kind: string; status: string; error?: string | null; result?: { stage?: string; pageNumber?: number; totalPages?: number; percent?: number } | null }> };
      if (jobs.length === 0) {
        setProcessing(false);
        setParseProgress(null);
        setProcessMessage("");
        return;
      }
      if (jobs.some((job) => job.status === "FAILED")) {
        setProcessing(false);
        setParseProgress(null);
        const failed = jobs.find((job) => job.status === "FAILED");
        setProcessMessage(failed?.kind === "CONTENT_GENERATE" ? `文字初稿生成失败：${failed.error?.split("\n")[0] ?? "请检查模型 Key 与权限"}` : failed?.error?.split("\n")[0] ?? "解析失败，请检查PDF");
      } else {
        const contentJob = jobs.find((job) => job.kind === "CONTENT_GENERATE");
        const parseJobs = jobs.filter((job) => job.kind === "PDF_PARSE");
        if (contentJob?.status === "SUCCEEDED") {
          setProcessing(false);
          setParseProgress({ percent: 100, label: "文字初稿已生成" });
          setProcessMessage("文字初稿已生成，正在进入文字审核…");
          if (autoNavigateToReviewFor.current !== selectedId) {
            autoNavigateToReviewFor.current = selectedId;
            window.location.href = `/projects/${selectedId}/review`;
          }
          return;
        }
        if (contentJob?.status === "QUEUED" || contentJob?.status === "RUNNING") {
          setParseProgress({ percent: contentJob.status === "RUNNING" ? 88 : 82, label: contentJob.status === "RUNNING" ? "正在生成文字初稿" : "文字初稿正在排队生成" });
          setProcessMessage("主讲文件解析完成，系统正在自动生成文字初稿…");
          return;
        }
        if (parseJobs.length > 0 && parseJobs.every((job) => job.status === "SUCCEEDED")) {
          setParseProgress({ percent: 80, label: "解析完成，正在创建文字初稿任务" });
          setProcessMessage("主讲文件解析完成，系统正在自动生成文字初稿…");
          return;
        }
        const active = parseJobs.find((job) => job.status === "RUNNING" && job.result?.percent !== undefined);
        const completed = parseJobs.filter((job) => job.status === "SUCCEEDED").length;
        if (active?.result) {
          const { percent = 0, pageNumber = 0, totalPages = 0, stage } = active.result;
          const stageLabel = stage === "saving" ? "正在保存原图" : stage === "writing" ? "正在写入解析内容" : "正在提取课件";
          const overallPercent = Math.min(79, Math.round(((completed + percent / 100) / parseJobs.length) * 80));
          setParseProgress({ percent: overallPercent, label: `${stageLabel}：第 ${pageNumber}/${totalPages} 页` });
          setProcessMessage(`正在解析 ${completed + 1}/${parseJobs.length} 个主讲文件…`);
        } else {
          setParseProgress({ percent: Math.round((completed / parseJobs.length) * 80), label: `正在等待解析第 ${completed + 1} 个主讲文件` });
          setProcessMessage(`正在解析 ${completed}/${parseJobs.length} 个主讲文件…`);
        }
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 1800);
    return () => { active = false; window.clearInterval(timer); };
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

  function openCreateProject() {
    setNewProjectName(`${new Date().getFullYear()}年秋季五讲`);
    setNewProjectGrade("1升2");
    setNewProjectYear(String(new Date().getFullYear()));
    setCreateProjectMessage("");
    setCreateProjectOpen(true);
  }

  async function createProject() {
    const teachingYear = Number(newProjectYear);
    if (!Number.isInteger(teachingYear) || teachingYear < 2022 || teachingYear > 2100) {
      setCreateProjectMessage("请输入 2022—2100 之间的四位年份。");
      return;
    }
    if (!newProjectName.trim() || !newProjectGrade.trim()) { setCreateProjectMessage("请填写项目名称和年级。"); return; }
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: newProjectName.trim(), grade: newProjectGrade.trim(), teachingYear, season: "秋季", lessonCount: 5 })
    });
    if (!response.ok) { setCreateProjectMessage("新建失败，请稍后重试。"); return; }
    const { project } = await response.json();
    const next: HandoutProject = { id: project.id, name: project.name, grade: project.grade, lessonCount: project.lessonCount, teachingYear: project.teachingYear, teachingYearConfirmed: false, outputKinds: ["lesson_student", "combined_student"], status: "draft", pinned: project.pinned, updatedAt: "刚刚" };
    setProjects((items) => [next, ...items]);
    setSelectedId(next.id);
    setCreateProjectOpen(false);
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
    if (uploaded > 0) setUploadMessage(`已成功保存 ${uploaded} 个主讲文件`);
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

  function openGenerationSettings() {
    if (!selected) return;
    setSettingsYear(String(selected.teachingYear));
    setSettingsMessage("");
    setGenerationSettingsOpen(true);
  }

  async function saveGenerationSettings() {
    if (!selected) return;
    const teachingYear = Number(settingsYear);
    if (!Number.isInteger(teachingYear) || teachingYear < 2022 || teachingYear > 2100) {
      setSettingsMessage("请输入 2022—2100 之间的四位年份。");
      return;
    }
    const response = await fetch(`/api/projects/${selected.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ teachingYear })
    });
    if (!response.ok) { setSettingsMessage("保存失败，请稍后重试。"); return; }
    setProjects((items) => items.map((item) => item.id === selected.id ? { ...item, teachingYear, teachingYearConfirmed: teachingYear === item.teachingYear ? item.teachingYearConfirmed : false } : item));
    setProcessMessage(teachingYear === selected.teachingYear ? "生成设置已保存。" : `已切换为 ${teachingYear} 年教材口径，请在解析前重新确认。`);
    setGenerationSettingsOpen(false);
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

  async function generateContent(navigateToReview = false) {
    if (!selected) return;
    setGenerating(true);
    setProcessMessage("正在调用模型生成讲义初稿；多讲课程可能需要几分钟…");
    const response = await fetch(`/api/projects/${selected.id}/generate-content`, { method: "POST" });
    const payload = await response.json();
    setGenerating(false);
    if (!response.ok) { setProcessMessage(payload.error ?? "生成失败"); return; }
    setProcessMessage(`已生成 ${payload.lessonIds.length} 讲文字初稿，正在进入文字审核…`);
    if (navigateToReview) window.location.href = `/projects/${selected.id}/review`;
  }

  return (
    <main className="app-shell">
      <ProjectSidebar
        projects={projects}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onTogglePinned={togglePinned}
        onRename={renameProject}
        onCreate={openCreateProject}
      />

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">讲义项目</p>
            <h1>{selected?.name ?? "新建讲义项目"}</h1>
          </div>
          <div className="topbar-actions">
            <div className="model-status" title="在左侧底部的“模型与接口”中管理 Key"><Sparkles size={16} /><span>当前模型</span><strong>GPT-5.3 Codex</strong></div>
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
              <div className="panel-title"><span>01</span><div><h3>上传主讲文件</h3><p>支持 PDF 或 DOCX，一次可上传多讲</p></div></div>
              <label className="dropzone">
                {uploading ? <Loader2 className="spin" size={30} /> : <FileUp size={30} />}
                <strong>{uploading ? "正在安全上传…" : "点击选择或拖入 PDF / DOCX"}</strong>
                <span>DOCX 优先快速提取文字；PDF 会按需保留原始页面图片</span>
                <input type="file" accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx" multiple onChange={(event) => void uploadPdfs(event.target.files)} disabled={uploading || !selectedId} />
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
              <button className="workflow-step" onClick={() => void startParsing()} disabled={processing || outputs.length === 0 || sourceFiles.length === 0}><b>1</b><strong>{processing ? "正在解析" : "解析主讲文件"}</strong><span>{sourceFiles.length === 0 ? "请先上传 PDF 或 DOCX" : "点击开始，完成后自动生成初稿"}</span></button>
              {selected ? <Link className={`workflow-step ${generating ? "disabled" : ""}`} aria-disabled={generating} href={`/projects/${selected.id}/review`} onClick={(event) => { if (generating) event.preventDefault(); }}><b>2</b><strong>{generating ? "正在生成初稿" : "文字审核"}</strong><span>核对原文与答案</span></Link> : <span className="workflow-step disabled"><b>2</b><strong>文字审核</strong><span>解析后自动进入</span></span>}
              {selected ? <Link className="workflow-step" href={`/projects/${selected.id}/layout`}><b>3</b><strong>设计排版</strong><span>微软雅黑与背景</span></Link> : <span className="workflow-step disabled"><b>3</b><strong>设计排版</strong><span>文字审核后进行</span></span>}
              {selected ? <Link className="workflow-step" href={`/projects/${selected.id}/layout`}><b>4</b><strong>版式审核</strong><span>拖动、缩放、换表情</span></Link> : <span className="workflow-step disabled"><b>4</b><strong>版式审核</strong><span>确认版式效果</span></span>}
              {selected ? <Link className="workflow-step" href={`/projects/${selected.id}/layout`}><b>5</b><strong>生成 Word</strong><span>下载可编辑 DOCX</span></Link> : <span className="workflow-step disabled"><b>5</b><strong>生成 Word</strong><span>完成后下载 DOCX</span></span>}
            </div>
            <div className="action-row">
              <button className="secondary-button" onClick={openGenerationSettings}><Settings2 size={16} /> 生成设置</button>
              <button className={`year-confirm ${selected?.teachingYearConfirmed ? "confirmed" : ""}`} onClick={() => void changeTeachingYear()} title="点击修改教材年份">
                {selected?.teachingYearConfirmed ? <CheckCircle2 size={15} /> : null}
                {selected ? `${selected.teachingYear}年口径${selected.teachingYearConfirmed ? "已确认" : "待确认"}` : ""} <small>修改</small>
              </button>
            </div>
            {processMessage && <p className="process-message">{processMessage}</p>}
            {parseProgress && <div className="parse-progress" aria-live="polite">
              <div className="parse-progress-meta"><span>{parseProgress.label}</span><strong>{parseProgress.percent}%</strong></div>
              <div className="parse-progress-track"><span style={{ width: `${parseProgress.percent}%` }} /></div>
            </div>}
          </section>
        </div>
        {generationSettingsOpen && selected && <div className="settings-modal-backdrop" role="presentation" onMouseDown={() => setGenerationSettingsOpen(false)}>
          <section className="generation-settings-modal" role="dialog" aria-modal="true" aria-labelledby="generation-settings-title" onMouseDown={(event) => event.stopPropagation()}>
            <div><p className="eyebrow">本项目设置</p><h2 id="generation-settings-title">生成设置</h2><p>输出类型可直接在上方勾选；此处用于确认生成所依据的教材年份。</p></div>
            <label><span>教材年份</span><input aria-label="教材年份" value={settingsYear} inputMode="numeric" maxLength={4} onChange={(event) => setSettingsYear(event.target.value)} /></label>
            <p className="modal-note">修改年份后，系统会要求在下一次解析前重新确认教材口径。</p>
            {settingsMessage && <p className="settings-message">{settingsMessage}</p>}
            <div className="modal-actions"><button className="secondary-button" onClick={() => setGenerationSettingsOpen(false)}>取消</button><button className="primary-button" onClick={() => void saveGenerationSettings()}>保存设置</button></div>
          </section>
        </div>}
        {createProjectOpen && <div className="settings-modal-backdrop" role="presentation" onMouseDown={() => setCreateProjectOpen(false)}>
          <section className="generation-settings-modal" role="dialog" aria-modal="true" aria-labelledby="new-project-title" onMouseDown={(event) => event.stopPropagation()}>
            <div><p className="eyebrow">从这里开始</p><h2 id="new-project-title">新建讲义项目</h2><p>先填写课程信息，再上传一讲或多讲主讲文件。</p></div>
            <label><span>项目名称</span><input aria-label="项目名称" value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} /></label>
            <label><span>年级</span><input aria-label="年级" value={newProjectGrade} onChange={(event) => setNewProjectGrade(event.target.value)} placeholder="例如：1升2" /></label>
            <label><span>教材年份</span><input aria-label="教材年份" value={newProjectYear} inputMode="numeric" maxLength={4} onChange={(event) => setNewProjectYear(event.target.value)} /></label>
            {createProjectMessage && <p className="settings-message">{createProjectMessage}</p>}
            <div className="modal-actions"><button className="secondary-button" onClick={() => setCreateProjectOpen(false)}>取消</button><button className="primary-button" onClick={() => void createProject()}>创建并上传课件</button></div>
          </section>
        </div>}
      </section>
    </main>
  );
}
