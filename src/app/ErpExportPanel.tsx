"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/src/lib/supabase-browser";

type Institution = { id: string; code: string; name: string };
type Batch = { id: string; batch_no: string; distribution_date: string; institution_code_snapshot: string; institution_name_snapshot: string; status: string; source_snapshot_version: number; source_snapshot_hash: string; current_artifact_id: string | null };
type Artifact = { id: string; revision: number; status: string; format_version: string; storage_object_key: string | null };

export default function ErpExportPanel() {
  const client = getSupabaseBrowserClient();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [institutionId, setInstitutionId] = useState("");
  const [distributionDate, setDistributionDate] = useState(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date()));
  const [batch, setBatch] = useState<Batch | null>(null);
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [batchKey, setBatchKey] = useState<string | null>(null);
  const [artifactKey, setArtifactKey] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    void client.from("institutions").select("id,code,name").eq("is_active", true).order("code").then((result) => {
      if (result.error) setMessage("機構載入失敗，請確認 HR 角色與 RLS 權限。");
      else { const rows = (result.data ?? []) as Institution[]; setInstitutions(rows); setInstitutionId(rows[0]?.id ?? ""); }
    });
  }, [client]);

  async function createBatch() {
    if (!client || !institutionId || !distributionDate) return;
    setBusy(true); setMessage("");
    const key = batchKey ?? crypto.randomUUID(); setBatchKey(key);
    const { data, error } = await client.rpc("create_erp_export_batch", {
      p_distribution_date: distributionDate, p_institution_id: institutionId,
      p_idempotency_key: `CREATE-ERP-${key}`,
      p_request_fingerprint: JSON.stringify({ distributionDate, institutionId }),
    });
    if (error || !data?.id) setMessage(`ERP 批次結果尚未確認：${error?.message ?? "請使用相同操作重試"}`);
    else { setBatch(data as Batch); setBatchKey(null); setMessage("已建立不可變 ERP logical batch；尚未產生鼎新正式檔案。"); }
    setBusy(false);
  }

  async function requestArtifact() {
    if (!client || !batch) return;
    setBusy(true); setMessage("");
    const key = artifactKey ?? crypto.randomUUID(); setArtifactKey(key);
    const { data, error } = await client.rpc("request_erp_artifact", {
      p_batch_id: batch.id, p_format_version: "UNIFORM-ERP-SALES-v0",
      p_idempotency_key: `REQUEST-ERP-ARTIFACT-${key}`,
      p_request_fingerprint: JSON.stringify({ batchId: batch.id, formatVersion: "UNIFORM-ERP-SALES-v0", sourceSnapshotVersion: batch.source_snapshot_version, sourceSnapshotHash: batch.source_snapshot_hash }),
    });
    if (error || !data?.id) setMessage(`ERP artifact 結果尚未確認：${error?.message ?? "請使用相同操作重試"}`);
    else { setArtifact(data as Artifact); setArtifactKey(null); setMessage("已建立 ERP artifact revision；正式鼎新欄位仍需以成功匯入樣本完成驗證。"); }
    setBusy(false);
  }

  if (!client) return <section className="panel import-panel" aria-label="鼎新 ERP 匯出"><div className="panel-heading"><div><p className="eyebrow">11 / ERP</p><h2>鼎新 ERP 銷貨匯出</h2></div><span className="status-pill">預覽模式</span></div><p className="auth-message">登入 HR 帳號並提供鼎新成功匯入樣本後，才能建立不可變 logical batch 與 artifact revision。</p></section>;
  return <section className="panel import-panel" aria-label="鼎新 ERP 匯出"><div className="panel-heading"><div><p className="eyebrow">11 / ERP</p><h2>鼎新 ERP 銷貨匯出</h2></div><span className={`status-pill ${artifact ? "success" : ""}`}>{artifact?.status ?? batch?.status ?? "待建立"}</span></div><p className="auth-message">系統只把已發貨且尚未匯出的來源凍結成日期＋機構 logical batch；沒有成功匯入樣本前，不宣稱 `UNIFORM-ERP-SALES-v0` 就是正式鼎新格式。</p><div className="form-grid"><label className="field"><span>發放日期</span><input type="date" value={distributionDate} onChange={(event) => { setBatchKey(null); setDistributionDate(event.target.value); }} disabled={busy || Boolean(batch)} /></label><label className="field"><span>機構</span><select value={institutionId} onChange={(event) => { setBatchKey(null); setInstitutionId(event.target.value); }} disabled={busy || Boolean(batch)}><option value="">請選擇</option>{institutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.code}｜{institution.name}</option>)}</select></label></div><div className="button-row"><button className="primary-button" type="button" onClick={() => void createBatch()} disabled={busy || Boolean(batch) || !institutionId}>{busy ? "建立中…" : "建立 ERP logical batch"}</button>{batch ? <button className="secondary-button" type="button" onClick={() => void requestArtifact()} disabled={busy || Boolean(artifact)}>{busy ? "請求中…" : artifact ? "已請求 artifact" : "請求 ERP artifact"}</button> : null}</div>{batch ? <p className="success-note">{batch.batch_no}／{batch.institution_code_snapshot}／{batch.distribution_date}／來源 hash {batch.source_snapshot_hash}。{artifact ? ` artifact revision ${artifact.revision}／${artifact.status}。` : "可接續請求 artifact。"}</p> : null}{message ? <p className={message.includes("已") ? "success-note" : "auth-message"} role="status">{message}</p> : null}</section>;
}
