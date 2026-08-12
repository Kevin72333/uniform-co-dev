"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/src/lib/supabase-browser";

type RequestRow = { id: string; request_no: string; distribution_date: string };
type IssueLine = { id: string; item_id: string; employee_no_snapshot: string; employee_name_snapshot: string; item_code_snapshot: string; item_name_snapshot: string; size_snapshot: string | null; unit_snapshot: string; quantity: number };
type ReturnNote = { id: string; return_no: string; status: "DRAFT" | "POSTED"; original_hr_request_id: string };

export default function ReturnPanel() {
  const client = getSupabaseBrowserClient();
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [issueLines, setIssueLines] = useState<IssueLine[]>([]);
  const [requestId, setRequestId] = useState("");
  const [selectedLineId, setSelectedLineId] = useState("");
  const [returnNo, setReturnNo] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [returnNote, setReturnNote] = useState<ReturnNote | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const createKeyRef = useRef<string | null>(null);
  const postKeyRef = useRef<string | null>(null);

  const selectedRequest = requests.find((request) => request.id === requestId);
  const selectedLine = issueLines.find((line) => line.id === selectedLineId);
  const maxQuantity = selectedLine?.quantity ?? 0;

  useEffect(() => {
    if (!client) return;
    const supabase = client;
    let active = true;
    async function load() {
      const result = await supabase.from("hr_requests")
        .select("id,request_no,distribution_date")
        .eq("status", "SHIPPED")
        .order("distribution_date", { ascending: false });
      if (!active) return;
      if (result.error) { setMessage("已發貨需求載入失敗，請確認 HR 角色與 RLS 權限。"); return; }
      const loaded = (result.data ?? []) as RequestRow[];
      setRequests(loaded);
      if (loaded[0]) setRequestId(loaded[0].id);
    }
    void load();
    return () => { active = false; };
  }, [client]);

  useEffect(() => {
    if (!client || !requestId || returnNote) return;
    const supabase = client;
    let active = true;
    async function loadLines() {
      const result = await supabase.from("hr_issue_lines")
        .select("id,item_id,employee_no_snapshot,employee_name_snapshot,item_code_snapshot,item_name_snapshot,size_snapshot,unit_snapshot,quantity")
        .eq("request_id", requestId).order("line_no");
      if (!active) return;
      if (result.error) { setMessage("發放明細載入失敗，請重新整理。"); return; }
      const loaded = (result.data ?? []) as IssueLine[];
      setIssueLines(loaded);
      setSelectedLineId(loaded[0]?.id ?? "");
      setQuantity(1);
    }
    void loadLines();
    return () => { active = false; };
  }, [client, requestId, returnNote]);

  function resetKeys() { createKeyRef.current = null; postKeyRef.current = null; }
  function chooseRequest(nextId: string) {
    if (returnNote) return;
    resetKeys(); setRequestId(nextId); setIssueLines([]); setSelectedLineId(""); setQuantity(1);
  }
  function chooseLine(nextId: string) {
    if (returnNote) return;
    resetKeys(); setSelectedLineId(nextId); setQuantity(1);
  }

  const fingerprint = useMemo(() => JSON.stringify({ requestId, returnNo: returnNo.trim(), reason: reason.trim(), note: note.trim(), lineId: selectedLineId, quantity }), [requestId, returnNo, reason, note, selectedLineId, quantity]);

  async function createDraft() {
    if (!client || !requestId || !selectedLine || !returnNo.trim() || !reason.trim() || quantity < 1 || quantity > maxQuantity) {
      setMessage("請選擇已發貨需求與發放明細，填寫退回單號、原因，且退回量不得超過原發放量。"); return;
    }
    setBusy(true); setMessage("");
    const key = createKeyRef.current ?? crypto.randomUUID();
    createKeyRef.current = key;
    const { data, error } = await client.rpc("create_return_note_draft", {
      p_return_no: returnNo.trim(), p_original_hr_request_id: requestId,
      p_reason: reason.trim(), p_note: note.trim() || null,
      p_lines: [{ originalIssueLineId: selectedLine.id, quantity }],
      p_idempotency_key: `CREATE-RETURN-${key}`, p_request_fingerprint: fingerprint,
    });
    if (error || !data?.id) setMessage(`退回草稿建立失敗：${error?.message ?? "未回傳退回單"}`);
    else { setReturnNote(data as ReturnNote); createKeyRef.current = null; setMessage(`已建立退回草稿 ${(data as ReturnNote).return_no}；請確認後 POST。`); }
    setBusy(false);
  }

  async function postReturn() {
    if (!client || !returnNote) return;
    setBusy(true); setMessage("");
    const key = postKeyRef.current ?? crypto.randomUUID();
    postKeyRef.current = key;
    const { data, error } = await client.rpc("post_return_note", {
      p_return_note_id: returnNote.id,
      p_idempotency_key: `POST-RETURN-${key}`,
      p_request_fingerprint: JSON.stringify({ returnNoteId: returnNote.id, returnNo: returnNote.return_no }),
    });
    if (error) setMessage(`退回 POST 失敗：${error.message}`);
    else { setReturnNote(data as ReturnNote); postKeyRef.current = null; setMessage("退回已 POST；人資倉已增加退回數量，原發放單與退回流水均已鎖定。"); }
    setBusy(false);
  }

  if (!client) return <section className="panel import-panel" aria-label="員工制服退回"><div className="panel-heading"><div><p className="eyebrow">09 / RETURN</p><h2>員工制服退回</h2></div><span className="status-pill">預覽模式</span></div><p className="auth-message">登入 HR 帳號後，選擇已發貨需求與原發放明細，建立退回草稿並 POST 回人資倉。</p></section>;
  return <section className="panel import-panel" aria-label="員工制服退回">
    <div className="panel-heading"><div><p className="eyebrow">09 / RETURN</p><h2>員工制服退回</h2></div><span className={`status-pill ${returnNote?.status === "POSTED" ? "success" : ""}`}>{returnNote?.status ?? "建立退回"}</span></div>
    <p className="auth-message">退回只接受已發貨需求，身份與歷史快照由原發放明細推導；POST 會在同一交易檢查有效發放餘量、鎖定品號並增加人資倉，不能直接修改原發放單。</p>
    <div className="form-grid">
      <label className="field"><span>已發貨需求</span><select value={requestId} onChange={(event) => chooseRequest(event.target.value)} disabled={busy || Boolean(returnNote)}><option value="">請選擇</option>{requests.map((request) => <option key={request.id} value={request.id}>{request.request_no}｜{request.distribution_date}</option>)}</select></label>
      <label className="field"><span>原發放明細</span><select value={selectedLineId} onChange={(event) => chooseLine(event.target.value)} disabled={busy || Boolean(returnNote) || !requestId}><option value="">請選擇</option>{issueLines.map((line) => <option key={line.id} value={line.id}>{line.employee_no_snapshot} {line.employee_name_snapshot}｜{line.item_code_snapshot}｜已發 {line.quantity}</option>)}</select></label>
      <label className="field"><span>退回單號</span><input value={returnNo} onChange={(event) => { resetKeys(); setReturnNo(event.target.value); }} disabled={busy || Boolean(returnNote)} maxLength={80} placeholder="例如 RET-2026-001" /></label>
      <label className="field"><span>退回數量（上限 {maxQuantity}）</span><input type="number" min={1} max={maxQuantity} value={quantity} onChange={(event) => { resetKeys(); setQuantity(Math.min(maxQuantity || 1, Math.max(1, Number(event.target.value) || 1))); }} disabled={busy || Boolean(returnNote)} /></label>
    </div>
    <label className="field reason-field"><span>退回原因</span><input value={reason} onChange={(event) => { resetKeys(); setReason(event.target.value); }} disabled={busy || Boolean(returnNote)} maxLength={1000} placeholder="例如：離職／尺寸不合／制服汰換" /></label>
    <label className="field reason-field"><span>備註（選填）</span><input value={note} onChange={(event) => { resetKeys(); setNote(event.target.value); }} disabled={busy || returnNote?.status === "POSTED"} maxLength={2000} /></label>
    {selectedLine ? <p className="success-note">{selectedRequest?.request_no}／{selectedLine.employee_no_snapshot} {selectedLine.employee_name_snapshot}／{selectedLine.item_code_snapshot}{selectedLine.size_snapshot ? `（${selectedLine.size_snapshot}）` : ""}，原發放 {selectedLine.quantity} {selectedLine.unit_snapshot}。</p> : null}
    <div className="button-row"><button className="primary-button" type="button" onClick={() => void createDraft()} disabled={busy || Boolean(returnNote) || !selectedLine}>{busy ? "建立中…" : "建立退回草稿"}</button>{returnNote ? <button className="secondary-button" type="button" onClick={() => void postReturn()} disabled={busy || returnNote.status === "POSTED"}>{busy ? "POST 中…" : returnNote.status === "POSTED" ? "已 POST" : "確認並 POST 退回"}</button> : null}</div>
    {returnNote?.status === "POSTED" ? <p className="success-note">退回單 {returnNote.return_no} 已 POST，原單維持不變且本次退回不可再修改。</p> : null}
    {message ? <p className={message.includes("已") ? "success-note" : "auth-message"} role="status">{message}</p> : null}
  </section>;
}
