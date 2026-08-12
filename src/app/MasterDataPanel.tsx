"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/src/lib/supabase-browser";
import { masterRowsToCsv, parseMasterDataCsv, parseMasterDataJson } from "@/src/domain/master-data";

const entityOptions = [
  ["INSTITUTIONS", "機構"],
  ["DEPARTMENTS", "部門"],
  ["UNIFORM_ITEMS", "制服品號"],
  ["SUPPLIERS", "供應商"],
  ["SUPPLIER_ITEMS", "供應商品號 MOQ"],
] as const;

export default function MasterDataPanel() {
  const [entityType, setEntityType] = useState<(typeof entityOptions)[number][0]>("INSTITUTIONS");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<unknown[]>([]);
  const [message, setMessage] = useState("尚未載入檔案");
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    try {
      if (file.size > 10_000_000) throw new Error("檔案超過 10 MB 上限");
      const text = await file.text();
      const result = file.name.toLowerCase().endsWith(".csv") ? parseMasterDataCsv(text) : parseMasterDataJson(text);
      if (result.errors.length > 0) throw new Error(`第 ${result.errors[0].row} 列：${result.errors[0].message}`);
      setRows(result.rows);
      setMessage(`已預覽 ${result.rows.length} 列；尚未寫入資料庫`);
    } catch (error) {
      setRows([]);
      setMessage(error instanceof Error ? error.message : "JSON 無法解析");
    }
  }

  async function applyImport() {
    if (rows.length === 0) return;
    const client = getSupabaseBrowserClient();
    if (!client) {
      setMessage("預覽模式：設定 Supabase env 並登入後，才會呼叫整批驗證／原子 upsert RPC");
      return;
    }
    setBusy(true);
    const { data, error } = await client.rpc("apply_master_import", {
      p_entity_type: entityType,
      p_source_filename: fileName,
      p_rows: rows,
      p_idempotency_key: `master-${crypto.randomUUID()}`,
      p_request_fingerprint: `${entityType}:${fileName}:${rows.length}`,
    });
    setBusy(false);
    setMessage(error ? error.message : `批次 ${data?.id ?? ""} 已交由伺服器驗證`);
  }

  async function exportMasterData() {
    const client = getSupabaseBrowserClient();
    if (!client) {
      setMessage("預覽模式：登入並設定 Supabase env 後才能匯出受權限保護的主檔");
      return;
    }
    setBusy(true);
    const exportKey = `master-export-${crypto.randomUUID()}`;
    const { data, error } = await client.rpc("export_master_data", {
      p_entity_type: entityType,
      p_idempotency_key: exportKey,
      p_request_fingerprint: `${entityType}:csv:v1`,
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    const exportPayload = data as { batchId?: string; rows?: unknown[] } | unknown[] | null;
    const exportRows = Array.isArray(exportPayload)
      ? exportPayload as Record<string, unknown>[]
      : Array.isArray(exportPayload?.rows)
        ? exportPayload.rows as Record<string, unknown>[]
        : [];
    const blob = new Blob([masterRowsToCsv(exportRows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${entityType.toLowerCase()}-export.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    if (!Array.isArray(exportPayload) && exportPayload?.batchId) {
      await client.rpc("record_master_export_download", { p_batch_id: exportPayload.batchId });
    }
    setMessage("匯出完成；下載事件應由後端／稽核流程另行記錄");
  }

  return (
    <section className="panel import-panel" aria-label="主檔匯入匯出">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">06 / MASTER DATA</p>
          <h2>主檔整批匯入／匯出</h2>
        </div>
        <span className={`status-pill ${rows.length > 0 ? "success" : ""}`}>{rows.length > 0 ? "可送伺服器驗證" : "尚未選檔"}</span>
      </div>
      <p className="auth-message">支援機構、部門、制服品號、供應商與供應商 MOQ。瀏覽器只做預覽，正式驗證、冪等與原子發布由 Supabase RPC 執行。</p>
      <div className="form-grid master-tools">
        <label className="field">
          <span>主檔類型</span>
          <select value={entityType} onChange={(event) => setEntityType(event.target.value as typeof entityType)}>
            {entityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="file-picker">
          <span>選擇 CSV／JSON</span>
          <input type="file" accept="text/csv,.csv,application/json,.json" onChange={(event) => void handleFile(event.target.files?.[0])} />
        </label>
      </div>
      {fileName ? <p className="file-name">{fileName}／{rows.length} 列</p> : null}
      <div className="button-row">
        <button className="primary-button" type="button" disabled={busy || rows.length === 0} onClick={() => void applyImport()}>確認整批匯入</button>
        <button className="secondary-button" type="button" disabled={busy} onClick={() => void exportMasterData()}>匯出目前主檔</button>
      </div>
      <p className="success-note">{message}</p>
    </section>
  );
}
