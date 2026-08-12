"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/src/lib/supabase-browser";

type RequestRow = {
  id: string;
  request_no: string;
  distribution_date: string;
  row_version: number;
};

type ShipmentLine = {
  id: string;
  item_id: string;
  requested_transfer_quantity_snapshot: number;
  maximum_transfer_quantity_snapshot: number;
  actual_transfer_quantity: number;
  short_ship_reason_code: string | null;
};

type Reason = { code: string; label: string };

export default function WarehouseShipmentPanel() {
  const client = getSupabaseBrowserClient();
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [requestId, setRequestId] = useState("");
  const [shipmentId, setShipmentId] = useState("");
  const [shipmentNo, setShipmentNo] = useState("");
  const [lines, setLines] = useState<ShipmentLine[]>([]);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [posted, setPosted] = useState(false);

  useEffect(() => {
    if (!client) return;
    const supabase = client;
    let active = true;
    async function load() {
      const [requestResult, reasonResult] = await Promise.all([
        supabase.from("hr_requests").select("id,request_no,distribution_date,row_version").eq("status", "SUBMITTED").order("distribution_date", { ascending: false }),
        supabase.from("transfer_short_ship_reasons").select("code,label").eq("is_active", true).order("sort_order"),
      ]);
      if (!active) return;
      if (requestResult.error || reasonResult.error) {
        setMessage("無法載入待發貨需求，請確認倉庫角色與 RLS 權限。");
        return;
      }
      const loaded = (requestResult.data ?? []) as RequestRow[];
      setRequests(loaded);
      setReasons((reasonResult.data ?? []) as Reason[]);
      if (loaded[0]) setRequestId(loaded[0].id);
    }
    void load();
    return () => { active = false; };
  }, [client]);

  async function createDraft() {
    if (!client) {
      setMessage("預覽模式：設定 Supabase env 並登入倉庫帳號後才能建立理貨草稿。");
      return;
    }
    if (!requestId) return;
    setBusy(true);
    setMessage("");
    const key = crypto.randomUUID();
    const selected = requests.find((request) => request.id === requestId);
    const { data, error } = await client.rpc("create_warehouse_shipment_draft", {
      p_shipment_no: shipmentNo.trim() || `SHIP-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`,
      p_hr_request_id: requestId,
      p_idempotency_key: `CREATE-SHIP-${key}`,
      p_request_fingerprint: JSON.stringify({ requestId, rowVersion: selected?.row_version ?? null }),
    });
    if (error || !data?.id) {
      setMessage(error?.message ?? "理貨草稿建立失敗");
      setBusy(false);
      return;
    }
    const lineResult = await client.from("warehouse_shipment_lines").select("id,item_id,requested_transfer_quantity_snapshot,maximum_transfer_quantity_snapshot,actual_transfer_quantity,short_ship_reason_code").eq("shipment_id", data.id).order("item_id");
    if (lineResult.error) {
      setMessage(lineResult.error.message);
    } else {
      setShipmentId(data.id);
      setLines((lineResult.data ?? []) as ShipmentLine[]);
      setPosted(false);
      setMessage(`已建立理貨草稿 ${data.shipment_no ?? ""}，請核對實際調庫量。`);
    }
    setBusy(false);
  }

  function updateLine(lineId: string, field: "actual_transfer_quantity" | "short_ship_reason_code", value: string) {
    setLines((current) => current.map((line) => line.id === lineId ? {
      ...line,
      [field]: field === "actual_transfer_quantity" ? Math.max(0, Number(value) || 0) : value || null,
    } : line));
  }

  async function postShipment() {
    if (!client || !shipmentId) return;
    const invalidShortShip = lines.some((line) => line.actual_transfer_quantity < line.requested_transfer_quantity_snapshot && !line.short_ship_reason_code);
    if (invalidShortShip) {
      setMessage("實際調庫量低於需求時，必須選擇短發原因。");
      return;
    }
    setBusy(true);
    setMessage("");
    for (const line of lines) {
      const { error } = await client.from("warehouse_shipment_lines").update({
        actual_transfer_quantity: line.actual_transfer_quantity,
        short_ship_reason_code: line.actual_transfer_quantity < line.requested_transfer_quantity_snapshot ? line.short_ship_reason_code : null,
      }).eq("id", line.id).eq("shipment_id", shipmentId);
      if (error) {
        setMessage(error.message);
        setBusy(false);
        return;
      }
    }
    const { data, error } = await client.rpc("post_warehouse_shipment", {
      p_shipment_id: shipmentId,
      p_idempotency_key: `POST-SHIP-${crypto.randomUUID()}`,
      p_request_fingerprint: JSON.stringify({ shipmentId, lines }),
    });
    if (error) {
      setMessage(error.message);
    } else {
      setPosted(true);
      setMessage(`已 POST ${data?.shipment_no ?? "發貨單"}；正式交付與庫存流水已完成。`);
    }
    setBusy(false);
  }

  if (!client) {
    return <section className="panel import-panel" aria-label="倉庫發貨"><div className="panel-heading"><div><p className="eyebrow">07 / WAREHOUSE</p><h2>倉庫發貨</h2></div><span className="status-pill">預覽模式</span></div><p className="auth-message">設定 Supabase env 並登入倉庫帳號後，這裡會載入已送出的需求，建立理貨草稿並在交付前 POST。</p></section>;
  }

  return (
    <section className="panel import-panel" aria-label="倉庫發貨">
      <div className="panel-heading">
        <div><p className="eyebrow">07 / WAREHOUSE</p><h2>理貨與發貨 POST</h2></div>
        <span className={`status-pill ${posted ? "success" : ""}`}>{posted ? "已鎖單" : "待理貨"}</span>
      </div>
      <div className="form-grid">
        <label className="field"><span>已送出需求</span><select value={requestId} onChange={(event) => setRequestId(event.target.value)} disabled={Boolean(shipmentId) || busy}><option value="">請選擇</option>{requests.map((request) => <option key={request.id} value={request.id}>{request.request_no}｜{request.distribution_date}</option>)}</select></label>
        <label className="field"><span>發貨單號（選填）</span><input value={shipmentNo} onChange={(event) => setShipmentNo(event.target.value)} disabled={Boolean(shipmentId) || busy} placeholder="SHIP-20260812-001" /></label>
      </div>
      <div className="button-row"><button className="secondary-button" type="button" onClick={() => void createDraft()} disabled={busy || Boolean(shipmentId) || !requestId}>建立理貨草稿</button></div>
      {lines.length > 0 ? <div className="summary-list">{lines.map((line) => <div className="summary-row" key={line.id}><span><strong>{line.item_id}</strong><small>需求 {line.requested_transfer_quantity_snapshot}／總倉當下上限 {line.maximum_transfer_quantity_snapshot}</small></span><label className="field"><span className="sr-only">實際調庫量</span><input type="number" min={0} max={line.maximum_transfer_quantity_snapshot} value={line.actual_transfer_quantity} disabled={posted || busy} onChange={(event) => updateLine(line.id, "actual_transfer_quantity", event.target.value)} /></label><label className="field"><span className="sr-only">短發原因</span><select value={line.short_ship_reason_code ?? ""} disabled={posted || busy || line.actual_transfer_quantity >= line.requested_transfer_quantity_snapshot} onChange={(event) => updateLine(line.id, "short_ship_reason_code", event.target.value)}><option value="">短發原因</option>{reasons.map((reason) => <option key={reason.code} value={reason.code}>{reason.label}</option>)}</select></label></div>)}</div> : null}
      <div className="button-row"><button className="primary-button" type="button" onClick={() => void postShipment()} disabled={busy || posted || !shipmentId}>{busy ? "處理中…" : "POST 並完成交付"}</button></div>
      {message ? <p className={message.startsWith("已") ? "success-note" : "auth-message"} role="status">{message}</p> : null}
    </section>
  );
}
