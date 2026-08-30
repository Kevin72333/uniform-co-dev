"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/src/lib/supabase-browser";
import {
  inventoryAvailabilityStatus,
  inventoryAvailabilityStatusLabel,
  normalizeInventoryAvailabilityRow,
  type InventoryAvailabilityRow,
  type InventoryAvailabilityStatus,
} from "@/src/domain/inventory-availability";

type StatusFilter = "ALL" | InventoryAvailabilityStatus;

function statusTone(status: InventoryAvailabilityStatus): string {
  if (status === "AVAILABLE") return "success";
  if (status === "DATA_ERROR") return "danger";
  return "";
}

export default function InventoryAvailabilityPanel() {
  const client = getSupabaseBrowserClient();
  const [rows, setRows] = useState<InventoryAvailabilityRow[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [message, setMessage] = useState(() => client ? "正在讀取兩倉庫存…" : "預覽模式：設定 Supabase env 並登入後，才能讀取受 RLS 保護的兩倉庫存");
  const [busy, setBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!client) return;
    const supabase = client;
    let active = true;
    async function load() {
      setBusy(true);
      const result = await supabase
        .from("v_item_availability")
        .select("item_id,item_code,item_name,unit,size,category,season,is_active,hr_on_hand_quantity,general_on_hand_quantity,combined_on_hand_quantity,active_reserved_quantity,available_to_request_quantity")
        .order("item_code")
        .limit(500);
      if (!active) return;
      if (result.error) {
        setRows([]);
        setMessage(`庫存清單載入失敗：${result.error.message}`);
      } else {
        setRows(((result.data ?? []) as Array<Record<string, unknown>>).map(normalizeInventoryAvailabilityRow));
        setMessage(`已載入 ${(result.data ?? []).length} 個品號；數量由 v_item_availability 即時計算`);
      }
      setBusy(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [client, reloadToken]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return rows.filter((row) => {
      const status = inventoryAvailabilityStatus(row);
      const matchesStatus = statusFilter === "ALL" || status === statusFilter;
      const searchable = `${row.itemCode} ${row.itemName} ${row.size ?? ""} ${row.category ?? ""} ${row.season ?? ""}`.toLocaleLowerCase();
      return matchesStatus && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [query, rows, statusFilter]);

  return (
    <section className="panel" aria-label="兩倉庫存可用量">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">INVENTORY MANAGEMENT</p>
          <h2>兩倉庫存與可申請量</h2>
        </div>
        <span className="status-pill">RLS / READ ONLY</span>
      </div>
      <p className="auth-message">分別顯示人資倉、總倉帳面量與品號層級預留。可申請量只在兩倉合計層計算，不推算不存在的逐倉預留。</p>
      <div className="inventory-toolbar">
        <label className="field">
          搜尋品號／品名
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如 U-001 或上衣" />
        </label>
        <label className="field">
          庫存狀態
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
            <option value="ALL">全部</option>
            <option value="AVAILABLE">可申請</option>
            <option value="OUT_OF_STOCK">無可申請量</option>
            <option value="INACTIVE">已停用</option>
            <option value="DATA_ERROR">資料異常</option>
          </select>
        </label>
        <div className="inventory-toolbar-action"><button className="secondary-button" type="button" onClick={() => setReloadToken((value) => value + 1)} disabled={busy}>
            {busy ? "讀取中…" : "重新整理"}
          </button></div>
      </div>
      <p className="muted" role="status">{message}；目前顯示 {filteredRows.length} 個品號</p>
      {filteredRows.length > 0 ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr><th>品號</th><th>品名／規格</th><th>人資倉</th><th>總倉</th><th>兩倉合計</th><th>有效預留</th><th>可申請量</th><th>狀態</th></tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const status = inventoryAvailabilityStatus(row);
                return (
                  <tr key={row.itemId || row.itemCode}>
                    <td><strong>{row.itemCode || "—"}</strong></td>
                    <td>{row.itemName || "—"}{row.size ? `／${row.size}` : ""}{row.category ? `／${row.category}` : ""}</td>
                    <td>{row.hrOnHand} {row.unit}</td>
                    <td>{row.generalOnHand} {row.unit}</td>
                    <td>{row.combinedOnHand} {row.unit}</td>
                    <td>{row.activeReserved} {row.unit}</td>
                    <td>{row.availableToRequest} {row.unit}</td>
                    <td><span className={`status-pill ${statusTone(status)}`}>{inventoryAvailabilityStatusLabel(status)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <p className="empty-state">尚無符合條件的庫存資料，或目前帳號沒有此報表的讀取權限。</p>}
    </section>
  );
}
