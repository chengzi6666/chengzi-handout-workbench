import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  if (await readSession()) redirect("/");
  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="login-brand-mark">橙</div>
        <p>AI教研生产力</p>
        <h1>把主讲PDF变成<br />真正可用的Word讲义</h1>
        <ul>
          <li>严格保护阅读原文</li>
          <li>文字与版式两次审核</li>
          <li>可编辑Word与微信翻页书</li>
        </ul>
      </section>
      <section className="login-form-panel">
        <LoginForm />
      </section>
    </main>
  );
}

