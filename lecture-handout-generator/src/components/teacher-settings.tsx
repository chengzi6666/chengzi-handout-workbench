"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, GraduationCap, ImagePlus, Loader2, Pencil, Plus, Save, UserRound } from "lucide-react";

interface TeacherRow {
  id: string;
  formalName: string;
  nickname: string;
  grade: string | null;
  introduction: string;
  enabled: boolean;
  assets: Array<{ id: string; kind: string; label: string | null; objectKey: string }>;
}

export function TeacherSettings() {
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<TeacherRow | null>(null);
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/teachers");
    if (response.ok) setTeachers((await response.json()).teachers);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/teachers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
    const payload = await response.json();
    setMessage(response.ok ? "教师资料已添加" : payload.error ?? "添加失败");
    if (response.ok) { event.currentTarget.reset(); await load(); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/teachers/${editing.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
    const payload = await response.json();
    setMessage(response.ok ? "教师资料已更新" : payload.error ?? "更新失败");
    if (response.ok) { setEditing(null); await load(); }
  }

  return (
    <main className="settings-page">
      <header className="settings-header"><a href="/"><ArrowLeft size={17} />返回项目</a><div><p className="eyebrow">系统设置</p><h1>主讲老师资料库</h1></div></header>
      <div className="teacher-layout">
        <section className="panel teacher-list-panel">
          <div className="panel-title"><span><GraduationCap size={16} /></span><div><h3>内置与自定义教师</h3><p>家长手册用正式姓名，课堂页面用昵称</p></div></div>
          {loading ? <p className="empty-state"><Loader2 className="spin" />正在读取…</p> : <div className="teacher-grid">
            {teachers.map((teacher) => <article className="teacher-card" key={teacher.id}>
              <div className="teacher-avatar"><UserRound size={24} /></div>
              <div><strong>{teacher.formalName}老师</strong><em>{teacher.nickname}</em><span>{teacher.grade ?? "未指定年级"}</span></div>
              <p>{teacher.introduction}</p>
              <footer><span><ImagePlus size={13} />{teacher.assets.length}项图片素材</span><button onClick={() => setEditing(teacher)}><Pencil size={13} />编辑</button></footer>
            </article>)}
          </div>}
        </section>
        <section className="panel teacher-form-panel">
          <div className="panel-title"><span>{editing ? <Pencil size={16} /> : <Plus size={16} />}</span><div><h3>{editing ? "编辑教师" : "添加教师"}</h3><p>头像和表情包将在素材上传模块中关联</p></div></div>
          <form className="provider-form" key={editing?.id ?? "new"} onSubmit={editing ? save : create}>
            <label><span>正式姓名</span><input name="formalName" defaultValue={editing?.formalName} placeholder="例如：高远" required /></label>
            <label><span>课堂昵称</span><input name="nickname" defaultValue={editing?.nickname} placeholder="例如：哈哈老师" required /></label>
            <label><span>默认年级</span><input name="grade" defaultValue={editing?.grade ?? ""} placeholder="例如：1升2" /></label>
            <label><span>教师介绍</span><textarea name="introduction" defaultValue={editing?.introduction} rows={8} placeholder="用于家长使用手册" required /></label>
            <button><Save size={16} />{editing ? "保存修改" : "添加教师"}</button>
            {editing && <button className="cancel-edit" type="button" onClick={() => setEditing(null)}>取消编辑</button>}
            {message && <p className="settings-message">{message}</p>}
          </form>
        </section>
      </div>
    </main>
  );
}
