"use client";

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { SystemGuideBlock, SystemGuideDocument, SystemGuideDocumentId } from "@/src/domain/system-guide";
import { accountLabelFromUser } from "@/src/lib/account-login";
import AuthPanel from "../AuthPanel";
import { appearanceThemes, useAppearanceTheme } from "../use-appearance-theme";
import { useAuthSession } from "../use-auth-session";

type GuideResponse = { ok: true; documents: SystemGuideDocument[] } | { ok: false; error: string };
type LoadedGuideState = {
  userId: string;
  documents: SystemGuideDocument[];
  message: string;
  forbidden: boolean;
};

function inlineParts(text: string): ReactNode[] {
  const tokenPattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  const result: ReactNode[] = [];
  let offset = 0;
  for (const match of text.matchAll(tokenPattern)) {
    const index = match.index ?? 0;
    if (index > offset) result.push(text.slice(offset, index));
    const token = match[0];
    if (token.startsWith("**")) result.push(<strong key={`${index}-strong`}>{token.slice(2, -2)}</strong>);
    else result.push(<code key={`${index}-code`}>{token.slice(1, -1)}</code>);
    offset = index + token.length;
  }
  if (offset < text.length) result.push(text.slice(offset));
  return result;
}

function blockId(text: string, index: number): string {
  const normalized = text.toLocaleLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-+|-+$/g, "");
  return `guide-${normalized || "section"}-${index}`;
}

function GuideBlock({ block, index }: { block: SystemGuideBlock; index: number }) {
  if (block.type === "heading") {
    const id = blockId(block.text, index);
    if (block.level === 1) return <h1 id={id}>{inlineParts(block.text)}</h1>;
    if (block.level === 2) return <h2 id={id}>{inlineParts(block.text)}</h2>;
    if (block.level === 3) return <h3 id={id}>{inlineParts(block.text)}</h3>;
    return <h4 id={id}>{inlineParts(block.text)}</h4>;
  }
  if (block.type === "paragraph") return <p>{inlineParts(block.text)}</p>;
  if (block.type === "code") return <pre data-language={block.language || undefined}><code>{block.text}</code></pre>;
  if (block.type === "list") {
    const List = block.ordered ? "ol" : "ul";
    return <List>{block.items.map((item, itemIndex) => <li key={`${itemIndex}-${item}`}>{inlineParts(item)}</li>)}</List>;
  }
  return <div className="system-guide-table-wrap"><table><thead><tr>{block.headers.map((header) => <th key={header}>{inlineParts(header)}</th>)}</tr></thead><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{inlineParts(cell)}</td>)}</tr>)}</tbody></table></div>;
}

function AccessPanel({ title, message }: { title: string; message: string }) {
  return (
    <main className="system-guide-gate">
      <section className="panel system-guide-gate-card">
        <p className="eyebrow">SYSTEM GUIDE / PROTECTED</p>
        <h1>{title}</h1>
        <p>{message}</p>
        <Link className="secondary-button system-guide-back-link" href="/#overview">返回制服資產作業台</Link>
      </section>
    </main>
  );
}

export default function SystemGuidePageClient() {
  const { client, user, loading } = useAuthSession();
  const { theme, setTheme } = useAppearanceTheme();
  const [guideState, setGuideState] = useState<LoadedGuideState | null>(null);
  const [activeDocumentId, setActiveDocumentId] = useState<SystemGuideDocumentId>("user");

  useEffect(() => {
    if (!client || !user) return;
    const activeClient = client;
    const activeUserId = user.id;
    const controller = new AbortController();
    let active = true;
    async function load() {
      const { data } = await activeClient.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        if (active) setGuideState({ userId: activeUserId, documents: [], message: "登入工作階段不存在或已過期。", forbidden: false });
        return;
      }
      try {
        const response = await fetch("/api/system-guide", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json() as GuideResponse;
        if (!active) return;
        if (!response.ok || !payload.ok) {
          setGuideState({
            userId: activeUserId,
            documents: [],
            forbidden: response.status === 403,
            message: payload.ok ? "系統說明目前無法讀取。" : payload.error,
          });
          return;
        }
        setGuideState({
          userId: activeUserId,
          documents: payload.documents,
          message: `已載入 ${payload.documents.length} 份同源說明`,
          forbidden: false,
        });
      } catch {
        if (active && !controller.signal.aborted) {
          setGuideState({ userId: activeUserId, documents: [], message: "系統說明載入失敗，請稍後重試。", forbidden: false });
        }
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [client, user]);

  const currentGuideState = user && guideState?.userId === user.id ? guideState : null;
  const documents = currentGuideState?.documents ?? [];
  const message = currentGuideState?.message ?? "正在驗證 SYSTEM_ADMIN 權限並載入說明…";
  const forbidden = currentGuideState?.forbidden ?? false;
  const activeDocument = documents.find((document) => document.id === activeDocumentId) ?? documents[0];
  const sections = useMemo(() => activeDocument?.blocks.flatMap((block, index) => block.type === "heading" && block.level === 2
    ? [{ id: blockId(block.text, index), text: block.text }]
    : []) ?? [], [activeDocument]);

  if (!client) return <AccessPanel title="尚未連接登入服務" message="請先由管理員完成 Supabase 環境設定。" />;
  if (loading) return <AccessPanel title="正在確認登入狀態" message="工作階段確認完成後才會載入受保護文件。" />;
  if (!user) return <main className="system-guide-gate"><div className="system-guide-login"><AuthPanel /></div></main>;
  if (forbidden) return <AccessPanel title="無法查看 System Guide" message="這個頁面暫時只開放有效的 SYSTEM_ADMIN 帳號。" />;

  return (
    <main className="system-guide-page">
      <header className="system-guide-hero">
        <div>
          <p className="eyebrow">SYSTEM GUIDE / ADMIN ONLY</p>
          <h1>制服管理系統說明中心</h1>
          <p>使用者操作、管理設定與 AI Agent 交接共用同一組版本化 Markdown 來源。</p>
        </div>
        <div className="system-guide-hero-actions">
          <label className="system-guide-theme"><span>介面風格</span><select value={theme} onChange={(event) => setTheme(event.target.value as typeof theme)}>{appearanceThemes.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
          <Link className="secondary-button system-guide-back-link" href="/#overview">返回作業台</Link>
          <button className="secondary-button" type="button" onClick={() => void client.auth.signOut()}>登出</button>
        </div>
      </header>

      <div className="system-guide-shell">
        <aside className="system-guide-sidebar">
          <div className="system-guide-account"><span>{(accountLabelFromUser(user)[0] ?? "A").toUpperCase()}</span><div><strong>{accountLabelFromUser(user)}</strong><small>SYSTEM_ADMIN 文件權限</small></div></div>
          <nav aria-label="System Guide 文件">
            {documents.map((document) => <button key={document.id} className={document.id === activeDocument?.id ? "active" : ""} type="button" onClick={() => setActiveDocumentId(document.id)}><strong>{document.title}</strong><small>{document.audience}</small></button>)}
          </nav>
          {sections.length ? <div className="system-guide-toc"><p>本頁章節</p>{sections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.text}</a>)}</div> : null}
        </aside>

        <article className="system-guide-document" aria-live="polite">
          <div className="system-guide-document-meta"><span className="status-pill">READ ONLY</span><span>{message}</span></div>
          {activeDocument ? activeDocument.blocks.map((block, index) => <Fragment key={`${block.type}-${index}`}><GuideBlock block={block} index={index} /></Fragment>) : <p>{message}</p>}
        </article>
      </div>
    </main>
  );
}
