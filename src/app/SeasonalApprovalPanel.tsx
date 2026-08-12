"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/src/lib/supabase-browser";

type Submission = { id: string; campaign_id: string; revision: number; demand_snapshot_hash: string; submitted_at: string };
type Campaign = { id: string; campaign_no: string; name: string };
type SubmissionLine = { item_id: string; item_code_snapshot: string; item_name_snapshot: string; size_snapshot: string | null; unit_snapshot: string; demand_quantity_snapshot: number };

export default function SeasonalApprovalPanel() {
  const client = getSupabaseBrowserClient();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [submissionId, setSubmissionId] = useState("");
  const [decision, setDecision] = useState<"APPROVE" | "RETURN">("APPROVE");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<SubmissionLine[]>([]);
  const reviewKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!client) return;
    const supabase = client;
    let active = true;
    async function load() {
      const [submissionResult, campaignResult] = await Promise.all([
        supabase.from("seasonal_approval_submissions").select("id,campaign_id,revision,demand_snapshot_hash,submitted_at").eq("status", "PENDING").order("submitted_at", { ascending: false }),
        supabase.from("seasonal_campaigns").select("id,campaign_no,name"),
      ]);
      if (!active) return;
      if (submissionResult.error || campaignResult.error) { setMessage("待核資料載入失敗，請確認 CEO 角色與 RLS 權限。"); return; }
      const loaded = (submissionResult.data ?? []) as Submission[];
      setSubmissions(loaded); setCampaigns((campaignResult.data ?? []) as Campaign[]); if (loaded[0]) setSubmissionId(loaded[0].id);
    }
    void load();
    return () => { active = false; };
  }, [client]);

  useEffect(() => {
    if (!client || !submissionId) return;
    let active = true;
    void client.from("seasonal_approval_submission_lines").select("item_id,item_code_snapshot,item_name_snapshot,size_snapshot,unit_snapshot,demand_quantity_snapshot").eq("submission_id", submissionId).order("item_code_snapshot").then(({ data, error }) => {
      if (!active) return;
      setLines(error ? [] : (data ?? []) as SubmissionLine[]);
      if (error) setMessage("送核明細載入失敗，為避免盲核請重新整理。");
    });
    return () => { active = false; };
  }, [client, submissionId]);

  async function review() {
    if (!client) { setMessage("預覽模式：登入 CEO 帳號後才能審核。"); return; }
    const submission = submissions.find((row) => row.id === submissionId);
    if (!submission || (decision === "RETURN" && !reason.trim())) { setMessage("退回時必須填寫理由。"); return; }
    setBusy(true); setMessage("");
    const reviewKey = reviewKeyRef.current ?? crypto.randomUUID();
    reviewKeyRef.current = reviewKey;
    const { error } = await client.rpc("review_seasonal_submission", {
      p_submission_id: submission.id, p_submission_revision: submission.revision,
      p_demand_snapshot_hash: submission.demand_snapshot_hash, p_decision: decision,
      p_reason: reason.trim() || null, p_idempotency_key: `REVIEW-SEASONAL-${reviewKey}`,
      p_request_fingerprint: JSON.stringify({ id: submission.id, revision: submission.revision, hash: submission.demand_snapshot_hash, decision, reason: reason.trim() }),
    });
    if (error) setMessage(`審核失敗：${error.message}`);
    else { setMessage(decision === "APPROVE" ? "已核准，採購可依核准量進行 MOQ 判斷。" : "已退回 HR 修正，退回理由已保留。"); setSubmissions((rows) => rows.filter((row) => row.id !== submission.id)); setReason(""); reviewKeyRef.current = null; }
    setBusy(false);
  }

  if (!client) return <section className="panel import-panel" aria-label="CEO 換季審核"><div className="panel-heading"><div><p className="eyebrow">10 / CEO REVIEW</p><h2>CEO 換季審核</h2></div><span className="status-pill">預覽模式</span></div><p className="auth-message">登入 CEO 帳號後可載入待核 revision/hash，核准或退回需求。</p></section>;
  const selected = submissions.find((row) => row.id === submissionId);
  const campaign = campaigns.find((row) => row.id === selected?.campaign_id);
  return <section className="panel import-panel" aria-label="CEO 換季審核">
    <div className="panel-heading"><div><p className="eyebrow">10 / CEO REVIEW</p><h2>CEO 換季審核</h2></div><span className="status-pill">待核 {submissions.length} 件</span></div>
    <p className="auth-message">系統會重驗畫面所見的 revision 與需求雜湊；資料被 HR 修改或版本已變更時，審核會拒絕並要求重新載入。</p>
    <div className="form-grid">
      <label className="field"><span>待核送核版本</span><select value={submissionId} onChange={(event) => { reviewKeyRef.current = null; setSubmissionId(event.target.value); }} disabled={busy}><option value="">請選擇</option>{submissions.map((row) => { const item = campaigns.find((campaignRow) => campaignRow.id === row.campaign_id); return <option key={row.id} value={row.id}>{item?.campaign_no ?? row.campaign_id}｜rev {row.revision}｜{new Date(row.submitted_at).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}</option>; })}</select></label>
      <label className="field"><span>決定</span><select value={decision} onChange={(event) => { reviewKeyRef.current = null; setDecision(event.target.value as "APPROVE" | "RETURN"); }} disabled={busy}><option value="APPROVE">核准</option><option value="RETURN">退回 HR</option></select></label>
    </div>
    {selected ? <p className="muted">{campaign?.name ?? "換季活動"}／rev {selected.revision}／snapshot {selected.demand_snapshot_hash}</p> : null}
    {selected && lines.length === 0 ? <p className="auth-message">送核明細尚未載入，暫停核准以避免盲核。</p> : null}
    {lines.length > 0 ? <div className="summary-list">{lines.map((line) => <div className="summary-row" key={line.item_id}><span><strong>{line.item_code_snapshot}｜{line.item_name_snapshot}</strong><small>{line.size_snapshot ? `尺寸 ${line.size_snapshot}｜` : ""}{line.unit_snapshot}</small></span><strong>{line.demand_quantity_snapshot}</strong></div>)}</div> : null}
    <label className="field"><span>退回理由（核准可留白）</span><input value={reason} onChange={(event) => { reviewKeyRef.current = null; setReason(event.target.value); }} maxLength={500} disabled={busy} placeholder="例如：請確認某機構需求數量" /></label>
    <div className="button-row"><button className="primary-button" type="button" onClick={() => void review()} disabled={busy || !selected || lines.length === 0}>{busy ? "送出中…" : decision === "APPROVE" ? "核准此版本" : "退回 HR"}</button></div>
    {message ? <p className={message.startsWith("已") ? "success-note" : "auth-message"} role="status">{message}</p> : null}
  </section>;
}
