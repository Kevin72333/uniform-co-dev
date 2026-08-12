"use client";

import { useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/src/lib/supabase-browser";

const reportOptions = [
  ["v_item_availability", "品號可用量"],
  ["v_hr_request_item_totals", "人資需求品號合計"],
  ["v_pending_warehouse_shipments", "待處理發貨差異"],
  ["v_inventory_history", "庫存流水"],
  ["v_employee_distribution_history", "員工發放／更正／退回"],
  ["v_seasonal_demand_summary", "換季需求彙總"],
  ["v_purchase_order_receipt_progress", "採購入庫進度"],
  ["v_erp_export_candidates", "ERP 發放候選"],
  ["v_audit_event_history", "稽核事件"],
] as const;

type ReportName = (typeof reportOptions)[number][0];
type ReportRow = Record<string, unknown>;

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function ReportingPanel() {
  const [reportName, setReportName] = useState<ReportName>("v_item_availability");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [message, setMessage] = useState("選擇報表後按重新整理；結果受登入角色與資料表 RLS 保護");
  const [busy, setBusy] = useState(false);

  const columns = useMemo(() => {
    const keys = new Set<string>();
    rows.forEach((row) => Object.keys(row).forEach((key) => keys.add(key)));
    return [...keys];
  }, [rows]);

  async function refresh() {
    const client = getSupabaseBrowserClient();
    if (!client) {
      setRows([]);
      setMessage("預覽模式：設定 Supabase env 並登入後，才能讀取受 RLS 保護的報表");
      return;
    }
    setBusy(true);
    const { data, error } = await client.from(reportName).select("*").limit(200);
    setBusy(false);
    if (error) {
      setRows([]);
      setMessage(error.message);
      return;
    }
    const nextRows = (data ?? []) as ReportRow[];
    setRows(nextRows);
    setMessage(`已載入 ${nextRows.length} 筆（最多顯示 200 筆）；報表為即時計算，不保存另一份數字`);
  }

  return (
    <section className="panel" aria-label="只讀報表">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">REPORTS / READ ONLY</p>
          <h2>庫存、發放、換季、採購與稽核報表</h2>
        </div>
        <span className="status-pill">RLS</span>
      </div>
      <div className="toolbar">
        <label>
          報表
          <select value={reportName} onChange={(event) => setReportName(event.target.value as ReportName)}>
            {reportOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <button type="button" onClick={refresh} disabled={busy}>{busy ? "讀取中…" : "重新整理"}</button>
      </div>
      <p className="muted">{message}</p>
      {rows.length > 0 && columns.length > 0 ? (
        <div className="table-scroll">
          <table>
            <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${reportName}-${index}`}>
                  {columns.map((column) => <td key={column}>{formatValue(row[column])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="empty-state">尚無資料或目前帳號沒有此報表的讀取權限。</p>}
    </section>
  );
}
