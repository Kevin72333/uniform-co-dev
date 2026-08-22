"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/src/lib/supabase-browser";

export default function AuthPanel() {
  const client = getSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  if (!client) {
    return (
      <section className="auth-panel panel" aria-label="登入設定" data-auth-state="configuration-required">
        <div>
          <p className="eyebrow">ACCOUNT / CONFIGURATION REQUIRED</p>
          <h2>尚未連接登入服務</h2>
          <p className="auth-message">
            尚未設定 Supabase URL 與 anon key；正式工作區已鎖定，請先在 Vercel Environment Variables 設定部署環境，再用受邀帳號登入。
          </p>
        </div>
        <span className="status-pill">未連接 Supabase</span>
      </section>
    );
  }
  const supabase = client;

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setMessage(error ? error.message : "登入成功");
    setBusy(false);
  }

  return (
    <section className="auth-panel panel" aria-label="帳號登入" data-auth-state="signed-out">
      <div>
        <p className="eyebrow">ACCOUNT / INVITED USERS</p>
        <h2>登入後使用正式資料</h2>
        <p className="auth-message">請使用已建立的 Supabase Auth 帳號登入。登入前不會載入任何工作區；角色與需求窗口範圍由資料庫 RLS 控制。</p>
      </div>
      <form className="auth-form" onSubmit={signIn}>
        <label className="field">
          <span>電子信箱</span>
          <input autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label className="field">
          <span>密碼</span>
          <input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        <button className="primary-button" type="submit" disabled={busy}>
          {busy ? "處理中…" : "登入"}
        </button>
        {message ? <p className="auth-message" role="status">{message}</p> : null}
      </form>
    </section>
  );
}
