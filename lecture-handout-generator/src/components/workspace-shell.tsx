"use client";

import { useMemo, useState } from "react";
import { BookOpenCheck, ChevronDown, FileUp, LogOut, Search, Settings2, Sparkles } from "lucide-react";
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
  const selected = useMemo(() => projects.find((project) => project.id === selectedId) ?? projects[0], [projects, selectedId]);

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
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim(), grade: grade.trim(), teachingYear: new Date().getFullYear(), season: "秋季", lessonCount: 5 })
    });
    if (!response.ok) return;
    const { project } = await response.json();
    const next: HandoutProject = { id: project.id, name: project.name, grade: project.grade, lessonCount: project.lessonCount, status: "draft", pinned: project.pinned, updatedAt: "刚刚" };
    setProjects((items) => [next, ...items]);
    setSelectedId(next.id);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  function toggleOutput(id: OutputKind) {
    setOutputs((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
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
                <FileUp size={30} />
                <strong>点击选择或拖入PDF</strong>
                <span>系统将识别讲次、阅读文段、课堂方法和练习题</span>
                <input type="file" accept="application/pdf" multiple />
              </label>
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
              <button className="primary-button" disabled={outputs.length === 0}><Sparkles size={17} /> 开始解析</button>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
