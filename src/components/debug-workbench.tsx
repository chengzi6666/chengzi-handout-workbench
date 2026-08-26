"use client";

import Link from "next/link";
import { ChangeEvent, PointerEvent, useEffect, useRef, useState } from "react";
import { Bug, Camera, CheckCircle2, Loader2, MonitorDot, Send, SquareDashedMousePointer } from "lucide-react";

type Box = { x: number; y: number; width: number; height: number };
type Project = { id: string; name: string };
type Job = { id: string; kind: string; status: string; createdAt: string; startedAt?: string | null; finishedAt?: string | null; error?: string | null; result?: { stage?: string; pageNumber?: number; totalPages?: number; percent?: number } | null; project: { id: string; name: string; status: string } };

export function DebugWorkbench({ projects }: { projects: Project[] }) {
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [box, setBox] = useState<Box | null>(null);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [note, setNote] = useState("");
  const [projectId, setProjectId] = useState("");
  const [pageUrl, setPageUrl] = useState("http://localhost:3100/");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [reports, setReports] = useState<Array<{ id: string; note: string; status: string; createdAt: string; pageUrl?: string | null; imageKey?: string | null }>>([]);
  const canvas = useRef<HTMLDivElement>(null);

  const load = async () => {
    const [monitor, feedback] = await Promise.all([fetch("/api/debug-monitor"), fetch("/api/debug-reports")]);
    if (monitor.ok) setJobs((await monitor.json()).jobs ?? []);
    if (feedback.ok) setReports((await feedback.json()).reports ?? []);
  };
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 3000); return () => window.clearInterval(timer); }, []);
  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);

  function onImage(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImage(next); setImageUrl(next ? URL.createObjectURL(next) : ""); setBox(null);
  }
  function point(event: PointerEvent<HTMLDivElement>) {
    const rect = canvas.current!.getBoundingClientRect();
    return { x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)), y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)) };
  }
  function begin(event: PointerEvent<HTMLDivElement>) { if (!imageUrl) return; const p = point(event); setStart(p); setBox({ x: p.x, y: p.y, width: 0, height: 0 }); event.currentTarget.setPointerCapture(event.pointerId); }
  function move(event: PointerEvent<HTMLDivElement>) { if (!start) return; const p = point(event); setBox({ x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), width: Math.abs(p.x - start.x), height: Math.abs(p.y - start.y) }); }
  function finish() { setStart(null); }
  async function submit() {
    if (!note.trim()) { setMessage("请先写下要调整的问题。"); return; }
    setSaving(true); setMessage("");
    const form = new FormData(); form.set("note", note.trim()); form.set("pageUrl", pageUrl); if (projectId) form.set("projectId", projectId); if (box) form.set("selection", JSON.stringify(box)); if (image) form.set("image", image);
    const response = await fetch("/api/debug-reports", { method: "POST", body: form }); const payload = await response.json().catch(() => ({}));
    setSaving(false); if (!response.ok) { setMessage(payload.error ?? "提交失败"); return; }
    setMessage("已记录。该问题和框选区域已进入调试清单。"); setNote(""); await load();
  }
  const active = jobs.filter((job) => job.status === "RUNNING" || job.status === "QUEUED");
  return <main className="debug-page"><header className="debug-header"><Link href="/">← 返回工作台</Link><div><span>教研内部工具</span><h1>开发调试台</h1></div><button className="secondary-button" onClick={() => void load()}>刷新状态</button></header>
    <section className="debug-summary"><div><MonitorDot size={23}/><strong>{active.length ? `${active.length} 个任务正在运行` : "当前没有运行中的任务"}</strong><small>每 3 秒自动刷新；可直接看到模型、解析和导出任务的真实状态。</small></div><div><Bug size={23}/><strong>{reports.length} 条调试反馈</strong><small>截图、框选位置、页面地址和文字说明会一起保留。</small></div></section>
    <div className="debug-grid"><section className="debug-card"><div className="debug-card-title"><Camera size={19}/><div><h2>框选问题区域</h2><p>上传截图后，直接拖拽框出需要修改的位置。</p></div></div><input className="debug-file" type="file" accept="image/png,image/jpeg,image/webp" onChange={onImage}/>{imageUrl && <div className="debug-canvas" ref={canvas} onPointerDown={begin} onPointerMove={move} onPointerUp={finish}><img src={imageUrl} alt="待标注截图"/>{box && <i style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.width}%`, height: `${box.height}%` }}/>}</div>}<label>所属项目<select value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">不关联具体项目</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label>页面地址<input value={pageUrl} onChange={(event) => setPageUrl(event.target.value)} /></label><label>问题描述<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如：第4页右侧留白太大；希望标题移到左上，卡通再缩小一点。"/></label>{message && <p className="debug-message">{message}</p>}<button className="primary-button" disabled={saving} onClick={() => void submit()}>{saving ? <Loader2 className="spin" size={17}/> : <Send size={17}/>}提交调试反馈</button></section>
      <section className="debug-card"><div className="debug-card-title"><MonitorDot size={19}/><div><h2>实时任务监控</h2><p>88% 表示生成初稿；这里会显示真实任务结果与失败原因。</p></div></div><div className="debug-jobs">{jobs.slice(0, 12).map((job) => <article key={job.id} className={`debug-job ${job.status.toLowerCase()}`}><div><strong>{job.project.name}</strong><span>{job.kind === "CONTENT_GENERATE" ? "文字初稿生成" : job.kind === "PDF_PARSE" ? "主讲文件解析" : job.kind}</span></div><b>{job.status === "RUNNING" ? "运行中" : job.status === "QUEUED" ? "排队中" : job.status === "SUCCEEDED" ? "已完成" : "失败"}</b>{job.result?.percent !== undefined && <small>进度 {job.result.percent}% · {job.result.stage === "ocr" ? "图片识别" : job.result.stage ?? "处理中"}</small>}{job.error && <small className="debug-error">{job.error.split("\n")[0]}</small>}</article>)}</div><div className="debug-card-title feedback-title"><SquareDashedMousePointer size={19}/><div><h2>最近反馈</h2></div></div><div className="debug-feedback">{reports.slice(0, 6).map((report) => <article key={report.id}>{report.imageKey && <img src={`/api/debug-reports/${report.id}/image`} alt="反馈截图"/>}<div><strong>{report.note}</strong><span>{new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(report.createdAt))} · {report.status === "OPEN" ? "待处理" : report.status}</span></div></article>)}</div></section></div></main>;
}
