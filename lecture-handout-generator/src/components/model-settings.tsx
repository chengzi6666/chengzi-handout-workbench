"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Bot, CheckCircle2, Eye, Globe2, KeyRound, Loader2, Plus, Save, TestTube2 } from "lucide-react";

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
    setSaving(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/ai-providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: form.get("displayName"), kind: form.get("kind"), baseUrl: form.get("baseUrl"), model: form.get("model"), apiKey: form.get("apiKey"),
        supportsVision: form.get("supportsVision") === "on", supportsSearch: form.get("supportsSearch") === "on", supportsJson: true, isDefault: providers.length === 0
      })
    });
    setSaving(false);
    if (!response.ok) { setMessage((await response.json()).error ?? "保存失败"); return; }
    event.currentTarget.reset();
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
          <div className="panel-title"><span><Plus size={16} /></span><div><h3>添加模型接口</h3><p>支持OpenAI兼容及公司内部网关</p></div></div>
          <form className="provider-form" onSubmit={submit}>
            <label><span>显示名称</span><input name="displayName" placeholder="例如：公司 Qwen3.5 Plus" required /></label>
            <label><span>接口类型</span><select name="kind" defaultValue="INTERNAL"><option value="INTERNAL">公司内部接口</option><option value="OPENAI_COMPATIBLE">OpenAI兼容接口</option><option value="OPENAI">OpenAI官方</option></select></label>
            <label><span>Base URL</span><input name="baseUrl" type="url" placeholder="https://ai.company.com/v1" required /></label>
            <label><span>模型名称</span><input name="model" placeholder="qwen3.5-plus" required /></label>
            <label><span>API Key</span><input name="apiKey" type="password" autoComplete="new-password" placeholder="只会加密保存在服务端" required /></label>
            <div className="checkbox-row"><label><input name="supportsVision" type="checkbox" />支持图片/PDF视觉</label><label><input name="supportsSearch" type="checkbox" />支持联网搜索</label></div>
            <button disabled={saving}><Save size={16} />{saving ? "正在保存…" : "保存接口"}</button>
            {message && <p className="settings-message">{message}</p>}
          </form>
        </section>
      </div>
    </main>
  );
}
