"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/src/lib/supabase-browser";

type Reason = { code: string; name: string; is_active: boolean };

export default function ProcurementReasonCodePanel() {
  const client = getSupabaseBrowserClient();
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const operationKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!client) return;
    void client.from("procurement_difference_reasons").select("code,name,is_active").order("code").then(({ data, error }) => {
      if (error) setMessage("原因碼載入失敗；只有 SYSTEM_ADMIN 可維護，請確認帳號角色。");
      else setReasons((data ?? []) as Reason[]);
    });
  }, [client]);

  async function save() {
    if (!client || !code.trim() || !name.trim()) { setMessage("請輸入原因碼與名稱。"); return; }
    setBusy(true); setMessage("");
    const key = operationKeyRef.current ?? crypto.randomUUID();
    operationKeyRef.current = key;
    const { data, error } = await client.rpc("maintain_procurement_difference_reason", {
      p_code: code.trim().toUpperCase(), p_name: name.trim(), p_is_active: isActive,
      p_idempotency_key: `PROCUREMENT-REASON-${key}`,
      p_request_fingerprint: JSON.stringify({ code: code.trim().toUpperCase(), name: name.trim(), isActive }),
    });
    if (error) setMessage(`原因碼維護失敗：${error.message}`);
    else {
      const saved = data as Reason;
      setReasons((rows) => [...rows.filter((row) => row.code !== saved.code), saved].sort((a, b) => a.code.localeCompare(b.code)));
      setMessage(`原因碼 ${saved.code} 已${saved.is_active ? "啟用／保存" : "停用"}。`);
      operationKeyRef.current = null; setCode(""); setName(""); setIsActive(true);
    }
    setBusy(false);
  }

  if (!client) return null;
  return <section className="panel import-panel" aria-label="採購差異原因碼維護">
    <div className="panel-heading"><div><p className="eyebrow">12 / REASON CODES</p><h2>採購差異原因碼</h2></div><span className="status-pill">SYSTEM_ADMIN 維護</span></div>
    <p className="auth-message">原因碼停用不會影響歷史採購決策；採購量與核准量不同時，必須使用啟用中的原因碼。</p>
    <div className="form-grid">
      <label className="field"><span>原因碼</span><input value={code} onChange={(event) => { operationKeyRef.current = null; setCode(event.target.value.toUpperCase()); }} maxLength={40} disabled={busy} placeholder="例如 MOQ" /></label>
      <label className="field"><span>名稱</span><input value={name} onChange={(event) => { operationKeyRef.current = null; setName(event.target.value); }} maxLength={120} disabled={busy} placeholder="例如 符合最低採購量" /></label>
      <label className="field"><span>狀態</span><select value={isActive ? "ACTIVE" : "INACTIVE"} onChange={(event) => { operationKeyRef.current = null; setIsActive(event.target.value === "ACTIVE"); }} disabled={busy}><option value="ACTIVE">啟用</option><option value="INACTIVE">停用</option></select></label>
    </div>
    <div className="button-row"><button className="secondary-button" type="button" onClick={() => void save()} disabled={busy || !code.trim() || !name.trim()}>{busy ? "保存中…" : "保存原因碼"}</button></div>
    {reasons.length > 0 ? <div className="summary-list">{reasons.map((reason) => <div className="summary-row" key={reason.code}><span><strong>{reason.code}</strong><small>{reason.name}</small></span><span className={`status-pill ${reason.is_active ? "success" : "danger"}`}>{reason.is_active ? "啟用" : "停用"}</span></div>)}</div> : null}
    {message ? <p className={message.includes("已") ? "success-note" : "auth-message"} role="status">{message}</p> : null}
  </section>;
}
