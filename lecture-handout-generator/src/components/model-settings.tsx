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
  const [testingId, setTestingId] = useState<string | null>(null);
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
    if (testingId) return;
    setTestingId(id);
    setMessage("正在测试接口…");
    const controller = new AbortController();
    // 用短请求轮询 Railway，避免移动网络或代理中断长连接后界面一直显示“正在测试”。
    const timeout = window.setTimeout(() => controller.abort(), 45_000);
    try {
      const queuedResponse = await fetch(`/api/ai-providers/${id}/test`, {
        method: "POST",
        headers: { "x-model-test-async": "1" },
        signal: controller.signal,
      });
      const queued = await queuedResponse.json().catch(() => ({})) as { jobId?: string; error?: string };
      if (!queuedResponse.ok || !queued.jobId) throw new Error(queued.error ?? "无法创建接口测试任务");

      while (!controller.signal.aborted) {
        await new Promise((resolve) => window.setTimeout(resolve, 1_000));
        const response = await fetch(`/api/ai-providers/${id}/test?jobId=${encodeURIComponent(queued.jobId)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await response.json().catch(() => ({})) as { pending?: boolean; latencyMs?: number; error?: string };
        if (response.status === 202 && result.pending) continue;
        if (!response.ok) throw new Error(result.error ?? "连接失败");
        setMessage(`连接成功，已确认公司团队 GPT-5.4，耗时 ${result.latencyMs ?? 0} ms`);
        return;
      }
    } catch (error) {
      setMessage(error instanceof DOMException && error.name === "AbortError"
        ? "测试已在45秒后停止：本机公司模型桥尚未返回，请确认桥接程序和公司网络。"
        : error instanceof Error ? error.message : "接口测试请求失败，请检查网络后重试。");
    } finally {
      window.clearTimeout(timeout);
      setTestingId(null);
    }
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
              <button disabled={testingId !== null} onClick={() => testProvider(provider.id)}>{testingId === provider.id ? <Loader2 className="spin" size={14} /> : <TestTube2 size={14} />}{testingId === provider.id ? "正在测试…" : "测试连接"}</button>
            </article>
          ))}
        </section>
        <section className="panel">
          <div className="panel-title"><span><KeyRound size={16} /></span><div><h3>接入集团模型</h3><p>系统已预设集团网关与模型，只需要填写你的 Token Plan Key</p></div></div>
          <form className="provider-form" onSubmit={submit}>
            <div className="group-model-preset"><strong>团队应用 GPT-5.4</strong><span>使用未来云团队 APPID 下已开通的模型权限</span><small>接口：ai-service.tal.com/openai-compatible/v1；认证：Bearer APPID:API Key</small></div>
            <label><span>应用 API Key</span><input name="apiKey" type="password" autoComplete="new-password" placeholder="粘贴未来云“账号管理”中的 APPID:API Key" required /></label>
            <p className="key-help">这里必须填写团队应用的完整 <b>APPID:API Key</b>（包含冒号），不是 WorkBuddy 的个人 Key。WorkBuddy 使用的是本机内网中的 <b>/claw + 个人 Key</b>；本系统使用团队应用的 <b>/openai-compatible/v1 + GPT-5.4</b>。</p>
            <button disabled={saving}><Save size={16} />{saving ? "正在保存…" : "覆盖并启用"}</button>
            {message && <p className="settings-message">{message}</p>}
          </form>
        </section>
      </div>
    </main>
  );
}
