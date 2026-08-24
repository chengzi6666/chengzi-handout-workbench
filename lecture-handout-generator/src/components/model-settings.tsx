"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Bot, CheckCircle2, Eye, Globe2, KeyRound, Loader2, Save, TestTube2 } from "lucide-react";

interface ProviderRow {
  id: string;
  displayName: string;
  kind: string;
  baseUrl: string;
  model: string;
  apiKeyMask: string;
  supportsVision: boolean;
  supportsSearch: boolean;
  supportsJson: boolean;
  enabled: boolean;
  isDefault: boolean;
}

export function ModelSettings() {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/ai-providers");
    if (response.ok) setProviders((await response.json()).providers);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // React 会在异步请求后回收事件对象；先保存表单引用，避免保存成功时页面报错。
    const formElement = event.currentTarget;
    setSaving(true);
    setMessage("");
    const form = new FormData(formElement);
    const response = await fetch("/api/ai-providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        apiKey: form.get("apiKey"), isDefault: providers.length === 0
      })
    });
    setSaving(false);
    if (!response.ok) { setMessage((await response.json()).error ?? "保存失败"); return; }
    formElement.reset();
    setMessage("模型接口已安全保存");
    await load();
  }

  async function testProvider(id: string) {
    setMessage("正在测试接口…");
    const response = await fetch(`/api/ai-providers/${id}/test`, { method: "POST" });
    const result = await response.json();
    setMessage(response.ok ? `连接成功，耗时 ${result.latencyMs} ms` : result.error ?? "连接失败");
  }

  return (
    <main className="settings-page">
      <header className="settings-header"><a href="/"><ArrowLeft size={17} />返回项目</a><div><p className="eyebrow">系统设置</p><h1>AI模型与内部接口</h1></div></header>
      <div className="settings-grid">
        <section className="panel provider-list-panel">
          <div className="panel-title"><span><Bot size={16} /></span><div><h3>已配置模型</h3><p>Key只在服务端加密保存</p></div></div>
          {loading ? <p className="empty-state"><Loader2 className="spin" />正在读取…</p> : providers.length === 0 ? <p className="empty-state">还没有模型接口，请先添加公司内部模型。</p> : providers.map((provider) => (
            <article className="provider-card" key={provider.id}>
              <div><strong>{provider.displayName}</strong>{provider.isDefault && <em>默认</em>}<span>{provider.model}</span></div>
              <p>{provider.baseUrl}</p>
              <div className="capability-row"><span><KeyRound size={12} />{provider.apiKeyMask}</span>{provider.supportsVision && <span><Eye size={12} />图片</span>}{provider.supportsSearch && <span><Globe2 size={12} />联网</span>}{provider.supportsJson && <span><CheckCircle2 size={12} />JSON</span>}</div>
              <button onClick={() => testProvider(provider.id)}><TestTube2 size={14} />测试连接</button>
            </article>
          ))}
        </section>
        <section className="panel">
          <div className="panel-title"><span><KeyRound size={16} /></span><div><h3>接入集团模型</h3><p>系统已预设集团网关与模型，只需要填写你的 Token Plan Key</p></div></div>
          <form className="provider-form" onSubmit={submit}>
            <div className="group-model-preset"><strong>GPT-5.4（当前默认模型）</strong><span>集团应用已开通 · 长上下文 · 适合结构化讲义生成与审核</span><small>接口：ai-service.tal.com/openai-compatible/v1；认证：Bearer APPID:API Key</small></div>
            <label><span>应用 API Key</span><input name="apiKey" type="password" autoComplete="new-password" placeholder="粘贴未来云“账号管理”中的 APPID:API Key" required /></label>
            <p className="key-help">在未来云 → 星图应用开发平台 → <b>账号管理</b> 中复制 <b>APPID:API Key</b>（通常以 300… 开头）。系统会通过 OpenAI-compatible 接口以 Bearer 方式安全传递该 Key。保存会覆盖旧的集团模型配置，不会新增重复条目。</p>
            <button disabled={saving}><Save size={16} />{saving ? "正在保存…" : "覆盖并启用"}</button>
            {message && <p className="settings-message">{message}</p>}
          </form>
        </section>
      </div>
    </main>
  );
}
