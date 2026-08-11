"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/src/lib/supabase-browser";

export default function AuthPanel() {
  const client = getSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!client) {
      return;
    }

    let active = true;
    void client.auth.getUser().then(({ data }) => {
      if (active) {
        setUser(data.user);
      }
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  if (!client) {
    return (
      <section className="auth-panel panel" aria-label="登入設定">
        <div>
          <p className="eyebrow">ACCOUNT / OFFLINE</p>
          <h2>預覽模式</h2>
          <p className="auth-message">
            尚未設定 Supabase URL 與 anon key；目前只提供離線試算。部署前請填入 `.env.local`，再用受邀帳號登入。
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

  async function signOut() {
    setBusy(true);
    const { error } = await supabase.auth.signOut();
    setMessage(error ? error.message : "已登出");
    setBusy(false);
  }

  if (user) {
    return (
      <section className="auth-panel panel" aria-label="帳號狀態">
        <div>
          <p className="eyebrow">ACCOUNT / SIGNED IN</p>
          <h2>已登入</h2>
          <p className="auth-message">{user.email}</p>
        </div>
        <button className="secondary-button" type="button" onClick={signOut} disabled={busy}>
          登出
        </button>
      </section>
    );
  }

  return (
    <section className="auth-panel panel" aria-label="帳號登入">
      <div>
        <p className="eyebrow">ACCOUNT / INVITED USERS</p>
        <h2>登入後使用正式資料</h2>
        <p className="auth-message">僅受邀 Supabase Auth 帳號可登入；角色與需求窗口範圍由資料庫 RLS 控制。</p>
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
