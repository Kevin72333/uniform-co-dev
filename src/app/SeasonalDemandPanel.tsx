"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/src/lib/supabase-browser";

type Campaign = { id: string; campaign_no: string; name: string; closes_at: string };
type Employee = { employee_id: string; employee_no_snapshot: string; employee_name_snapshot: string };
type Item = { item_id: string; item_code_snapshot: string; item_name_snapshot: string; size_snapshot: string | null; unit_snapshot: string };

export default function SeasonalDemandPanel() {
  const client = getSupabaseBrowserClient();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [note, setNote] = useState("");
  const [accountId, setAccountId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const operationKeyRef = useRef<string | null>(null);

  function resetOperation() { operationKeyRef.current = null; }

  useEffect(() => {
    if (!client) return;
    const supabase = client;
    let active = true;
    async function load() {
      const [{ data: userData }, campaignResult, accountResult] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("seasonal_campaigns").select("id,campaign_no,name,closes_at").eq("status", "OPEN").order("closes_at"),
        supabase.from("app_accounts").select("id").limit(1).maybeSingle(),
      ]);
      if (!active) return;
      if (campaignResult.error || accountResult.error || !userData.user) { setMessage("無法載入開放中的換季活動，請確認窗口帳號與 RLS 權限。"); return; }
      setCampaigns((campaignResult.data ?? []) as Campaign[]);
      setAccountId(accountResult.data?.id ?? "");
      if (campaignResult.data?.[0]) setCampaignId(campaignResult.data[0].id);
    }
    void load();
    return () => { active = false; };
  }, [client]);

  useEffect(() => {
    if (!client || !campaignId) return;
    const supabase = client;
    let active = true;
    async function loadScope() {
      const [employeeResult, itemResult] = await Promise.all([
        supabase.from("seasonal_campaign_employees").select("employee_id,employee_no_snapshot,employee_name_snapshot").eq("campaign_id", campaignId).order("employee_no_snapshot"),
        supabase.from("seasonal_campaign_items").select("item_id,item_code_snapshot,item_name_snapshot,unit_snapshot").eq("campaign_id", campaignId).order("item_code_snapshot"),
      ]);
      if (!active) return;
      if (employeeResult.error || itemResult.error) { setMessage("活動範圍載入失敗，請確認窗口是否在授權機構/部門。"); return; }
      const employeeRows = (employeeResult.data ?? []) as Employee[];
      const itemRows = (itemResult.data ?? []) as Item[];
      setEmployees(employeeRows); setItems(itemRows);
      setEmployeeId(employeeRows[0]?.employee_id ?? ""); setItemId(itemRows[0]?.item_id ?? "");
    }
    void loadScope();
    return () => { active = false; };
  }, [client, campaignId]);

  const selectedItem = useMemo(() => items.find((item) => item.item_id === itemId), [items, itemId]);

  async function saveDemand() {
    if (!client) { setMessage("預覽模式：設定 Supabase env 並登入需求窗口帳號後才能登記。"); return; }
    if (!accountId || !campaignId || !employeeId || !itemId || quantity < 0) { setMessage("請選擇活動、員工、品號並輸入不小於 0 的數量。"); return; }
    setBusy(true); setMessage("");
    const employee = employees.find((row) => row.employee_id === employeeId);
    const item = selectedItem;
    const operationKey = operationKeyRef.current ?? crypto.randomUUID();
    operationKeyRef.current = operationKey;
    const { error } = await client.rpc("upsert_seasonal_demand_line", {
      p_campaign_id: campaignId, p_employee_id: employeeId, p_item_id: itemId, p_quantity: quantity,
      p_note: note.trim() || null, p_idempotency_key: `DEMAND-${operationKey}`,
      p_request_fingerprint: JSON.stringify({ campaignId, employeeId, itemId, quantity, note: note.trim() }),
    });
    setMessage(error ? `需求登記失敗：${error.message}；若修正欄位後重試會使用新的冪等鍵。` : `已登記 ${employee?.employee_name_snapshot ?? "員工"}／${item?.item_code_snapshot ?? "品號"} ${quantity} ${item?.unit_snapshot ?? ""}。`);
    if (!error) setNote("");
    if (!error) operationKeyRef.current = null;
    setBusy(false);
  }

  if (!client) return <section className="panel import-panel" aria-label="換季需求登記"><div className="panel-heading"><div><p className="eyebrow">09 / DEMAND ENTRY</p><h2>換季需求登記</h2></div><span className="status-pill">預覽模式</span></div><p className="auth-message">需求窗口登入後，這裡只會顯示所屬活動與授權員工範圍；送核由 HR 彙整後執行。</p></section>;

  return <section className="panel import-panel" aria-label="換季需求登記">
    <div className="panel-heading"><div><p className="eyebrow">09 / DEMAND ENTRY</p><h2>換季需求登記</h2></div><span className="status-pill">窗口填寫</span></div>
    <p className="auth-message">只能登記目前 OPEN 且在授權範圍內的員工與品號；HR 後續修改會留下異動紀錄。</p>
    <div className="form-grid">
      <label className="field"><span>開放活動</span><select value={campaignId} onChange={(event) => { resetOperation(); setCampaignId(event.target.value); }} disabled={busy}><option value="">請選擇</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.campaign_no}｜{campaign.name}（截止 {new Date(campaign.closes_at).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}）</option>)}</select></label>
      <label className="field"><span>員工</span><select value={employeeId} onChange={(event) => { resetOperation(); setEmployeeId(event.target.value); }} disabled={busy}><option value="">請選擇</option>{employees.map((employee) => <option key={employee.employee_id} value={employee.employee_id}>{employee.employee_no_snapshot}｜{employee.employee_name_snapshot}</option>)}</select></label>
      <label className="field"><span>制服品號</span><select value={itemId} onChange={(event) => { resetOperation(); setItemId(event.target.value); }} disabled={busy}><option value="">請選擇</option>{items.map((item) => <option key={item.item_id} value={item.item_id}>{item.item_code_snapshot}｜{item.item_name_snapshot}{item.size_snapshot ? `｜${item.size_snapshot}` : ""}</option>)}</select></label>
      <label className="field"><span>需求數量</span><input type="number" min={0} max={999999999} value={quantity} onChange={(event) => { resetOperation(); setQuantity(Math.max(0, Number(event.target.value) || 0)); }} disabled={busy} /></label>
    </div>
    <label className="field"><span>備註（選填）</span><input value={note} onChange={(event) => { resetOperation(); setNote(event.target.value); }} maxLength={2000} disabled={busy} placeholder="例如：新進人員／尺寸特殊" /></label>
    <div className="button-row"><button className="primary-button" type="button" onClick={() => void saveDemand()} disabled={busy || !campaignId || !employeeId || !itemId}>{busy ? "儲存中…" : "儲存需求"}</button></div>
    {message ? <p className={message.startsWith("已") ? "success-note" : "auth-message"} role="status">{message}</p> : null}
  </section>;
}
