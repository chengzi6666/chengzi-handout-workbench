"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ employeeNumber, name })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "登录失败，请稍后重试");
      setLoading(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <form className="login-card" onSubmit={submit}>
      <div className="login-icon"><BadgeCheck size={28} /></div>
      <p className="eyebrow">教研工作台</p>
      <h2>欢迎回来</h2>
      <p className="login-description">使用工号和姓名进入讲义生产系统</p>
      <label><span>工号</span><input autoComplete="username" value={employeeNumber} onChange={(event) => setEmployeeNumber(event.target.value)} placeholder="请输入工号" required /></label>
      <label><span>姓名</span><input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="请输入真实姓名" required /></label>
      {error && <p className="form-error">{error}</p>}
      <button disabled={loading}>{loading ? "正在登录…" : "进入工作台"}<ArrowRight size={17} /></button>
      <small>首次登录将自动创建教研账号，所有账号权限一致。</small>
    </form>
  );
}

