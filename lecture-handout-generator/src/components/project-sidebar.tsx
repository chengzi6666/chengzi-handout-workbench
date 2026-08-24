"use client";

import { useMemo, useState } from "react";
import { ArchiveRestore, FileText, MoreHorizontal, PanelLeftClose, Pencil, Pin, Plus, Search, Settings, SlidersHorizontal, Trash2 } from "lucide-react";
import type { HandoutProject } from "@/lib/domain";

interface ProjectSidebarProps {
  projects: HandoutProject[];
  selectedId: string;
  onSelect(id: string): void;
  onTogglePinned(id: string): void;
  onRename(id: string, name: string): void;
  onDelete(id: string): void;
  onOpenTrash(): void;
  onCreate(): void;
}

export function ProjectSidebar({ projects, selectedId, onSelect, onTogglePinned, onRename, onDelete, onOpenTrash, onCreate }: ProjectSidebarProps) {
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const filtered = useMemo(() => projects
    .filter((project) => project.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned)), [projects, query]);

  return (
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">橙</div><div><strong>橙子讲义工坊</strong><span>教研工作台</span></div><button aria-label="收起侧边栏"><PanelLeftClose size={18} /></button></div>
      <button className="new-project" onClick={onCreate}><Plus size={18} /> 新建讲义项目</button>
      <label className="sidebar-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索项目" /></label>
      <div className="sidebar-section-title"><span>项目</span><SlidersHorizontal size={14} /></div>
      <nav className="project-list">
        {filtered.map((project) => (
          <div className={`project-item ${selectedId === project.id ? "active" : ""}`} key={project.id} onClick={() => onSelect(project.id)}>
            <FileText size={17} />
            <div className="project-copy">
              {editingId === project.id ? (
                <input autoFocus defaultValue={project.name} onClick={(event) => event.stopPropagation()} onBlur={(event) => { onRename(project.id, event.target.value.trim() || project.name); setEditingId(null); }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
              ) : <strong>{project.name}</strong>}
              <span>{project.grade} · {project.lessonCount}讲 · {project.updatedAt}</span>
            </div>
            {project.pinned && <Pin className="pinned" size={13} fill="currentColor" />}
            <details className="project-menu" onClick={(event) => event.stopPropagation()}>
              <summary aria-label="项目菜单"><MoreHorizontal size={16} /></summary>
              <div><button onClick={() => onTogglePinned(project.id)}><Pin size={14} />{project.pinned ? "取消置顶" : "置顶项目"}</button><button onClick={() => setEditingId(project.id)}><Pencil size={14} />修改名称</button><button className="danger-menu-item" onClick={() => onDelete(project.id)}><Trash2 size={14} />移入回收站</button></div>
            </details>
          </div>
        ))}
      </nav>
      <div className="sidebar-footer"><p>系统设置</p><button onClick={onOpenTrash}><ArchiveRestore size={18} /><span><strong>项目回收站</strong><small>恢复或彻底删除项目</small></span></button><button onClick={() => { window.location.href = "/settings/teachers"; }}><Settings size={18} /><span><strong>教师资料库</strong><small>姓名、昵称、介绍与头像</small></span></button><button onClick={() => { window.location.href = "/settings/models"; }}><SlidersHorizontal size={18} /><span><strong>模型与接口</strong><small>配置 Token Plan Key</small></span></button></div>
    </aside>
  );
}
