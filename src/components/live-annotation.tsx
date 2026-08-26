"use client";

import html2canvas from "html2canvas";
import { Bug, MessageSquarePlus, Send, X } from "lucide-react";
import { PointerEvent, useRef, useState } from "react";

type Selection = { x: number; y: number; width: number; height: number };

export function LiveAnnotation({ projectId }: { projectId?: string }) {
  const [active, setActive] = useState(false);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const overlay = useRef<HTMLDivElement>(null);

  function reset() { setActive(false); setStart(null); setSelection(null); setNote(""); setMessage(""); }
  function point(event: PointerEvent<HTMLDivElement>) { return { x: event.clientX, y: event.clientY }; }
  function begin(event: PointerEvent<HTMLDivElement>) { const next = point(event); setStart(next); setSelection({ x: next.x, y: next.y, width: 0, height: 0 }); event.currentTarget.setPointerCapture(event.pointerId); }
  function move(event: PointerEvent<HTMLDivElement>) { if (!start) return; const next = point(event); setSelection({ x: Math.min(start.x, next.x), y: Math.min(start.y, next.y), width: Math.abs(next.x - start.x), height: Math.abs(next.y - start.y) }); }
  async function submit() {
    if (!selection || selection.width < 8 || selection.height < 8) { setMessage("请先拖出需要修改的区域。"); return; }
    if (!note.trim()) { setMessage("请描述希望怎样修改。\n"); return; }
    setSaving(true); setMessage("正在自动截取标注区域…");
    try {
      const canvas = await html2canvas(document.body, { backgroundColor: "#f7f5f2", scale: 1, useCORS: true, ignoreElements: (element) => element.getAttribute("data-html2canvas-ignore") === "true" });
      const crop = document.createElement("canvas");
      crop.width = Math.max(1, Math.round(selection.width)); crop.height = Math.max(1, Math.round(selection.height));
      crop.getContext("2d")!.drawImage(canvas, Math.round(selection.x + window.scrollX), Math.round(selection.y + window.scrollY), crop.width, crop.height, 0, 0, crop.width, crop.height);
      const blob = await new Promise<Blob | null>((resolve) => crop.toBlob(resolve, "image/png"));
      const form = new FormData(); form.set("note", note.trim()); form.set("pageUrl", window.location.href); form.set("selection", JSON.stringify({ ...selection, scrollX: window.scrollX, scrollY: window.scrollY })); if (projectId) form.set("projectId", projectId); if (blob) form.set("image", new File([blob], "live-annotation.png", { type: "image/png" }));
      const response = await fetch("/api/debug-reports", { method: "POST", body: form }); const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "提交失败");
      setMessage("已提交到实时问题流。开发者可直接查看框选区域、页面地址和你的说明。");
    } catch (error) { setMessage(error instanceof Error ? error.message : "自动标注提交失败"); }
    finally { setSaving(false); }
  }
  return <>
    <button className="annotation-trigger" onClick={() => { setActive(true); setMessage(""); }}><MessageSquarePlus size={16} /> 标注问题</button>
    {active && <div className="annotation-layer" ref={overlay} data-html2canvas-ignore="true" onPointerDown={begin} onPointerMove={move} onPointerUp={() => setStart(null)}>
      <div className="annotation-hint"><Bug size={17} /> 在页面上拖拽框选需要调整的区域 <button onClick={(event) => { event.stopPropagation(); reset(); }}><X size={18}/></button></div>
      {selection && <i className="annotation-box" style={{ left: selection.x, top: selection.y, width: selection.width, height: selection.height }} />}
      {selection && selection.width > 8 && selection.height > 8 && <aside className="annotation-composer" style={{ left: Math.min(selection.x + selection.width + 14, window.innerWidth - 360), top: Math.min(selection.y, window.innerHeight - 270) }} onPointerDown={(event) => event.stopPropagation()}>
        <strong>已标注 1 个区域</strong><span>这条反馈会携带自动截图和当前页面位置。</span>
        <textarea autoFocus value={note} onChange={(event) => setNote(event.target.value)} placeholder="描述你希望怎样调整，例如：这块文字太小，请整体放大两级。" />
        {message && <p>{message}</p>}<div><button className="secondary-button" onClick={reset}>取消</button><button className="primary-button" disabled={saving} onClick={() => void submit()}><Send size={15}/>{saving ? "提交中" : "发送给开发者"}</button></div>
      </aside>}
    </div>}
  </>;
}
