"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/src/lib/supabase-browser";

type ProductRow = {
  id: string;
  item_code: string;
  item_name: string;
  unit: string;
  size: string | null;
  category: string | null;
  season: string | null;
  is_active: boolean;
  supplierSummary: string[];
};

type ItemSource = Omit<ProductRow, "supplierSummary">;
type SupplierSource = { id: string; supplier_code: string; name: string };
type SupplierItemSource = { item_id: string; supplier_id: string; minimum_order_quantity: number | null; supplier_item_code: string | null };

export type ProductItemEditRequest = ItemSource;

function textValue(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function buildProductRows(items: ItemSource[], suppliers: SupplierSource[], relations: SupplierItemSource[]): ProductRow[] {
  const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
  const relationByItem = new Map<string, SupplierItemSource[]>();
  relations.forEach((relation) => {
    const current = relationByItem.get(relation.item_id) ?? [];
    current.push(relation);
    relationByItem.set(relation.item_id, current);
  });
  return items.map((item) => ({
    ...item,
    supplierSummary: (relationByItem.get(item.id) ?? []).map((relation) => {
      const supplier = supplierById.get(relation.supplier_id);
      const supplierLabel = supplier ? `${supplier.supplier_code} ${supplier.name}` : relation.supplier_id;
      return `${supplierLabel}／MOQ ${relation.minimum_order_quantity ?? "—"}${relation.supplier_item_code ? `／${relation.supplier_item_code}` : ""}`;
    }),
  }));
}

type Props = { onEditItem?: (item: ProductItemEditRequest) => void };

export default function ProductCatalogPanel({ onEditItem }: Props) {
  const client = getSupabaseBrowserClient();
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState(() => client ? "正在讀取商品清單…" : "預覽模式：設定 Supabase env 並登入後，才能讀取受 RLS 保護的商品清單");
  const [busy, setBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!client) return;
    const supabase = client;
    let active = true;
    async function load() {
      setBusy(true);
      const [itemResult, supplierResult, relationResult] = await Promise.all([
        supabase.from("uniform_items").select("id,item_code,item_name,unit,size,category,season,is_active").order("item_code").limit(500),
        supabase.from("suppliers").select("id,supplier_code,name").eq("is_active", true).order("supplier_code").limit(500),
        supabase.from("supplier_uniform_items").select("item_id,supplier_id,minimum_order_quantity,supplier_item_code").eq("is_active", true).limit(2000),
      ]);
      if (!active) return;
      if (itemResult.error) {
        setRows([]);
        setMessage(`商品清單載入失敗：${itemResult.error.message}`);
      } else {
        const items = (itemResult.data ?? []) as ItemSource[];
        const suppliers = (supplierResult.data ?? []) as SupplierSource[];
        const relations = (relationResult.data ?? []) as SupplierItemSource[];
        setRows(buildProductRows(items, suppliers, relations));
        setMessage(supplierResult.error || relationResult.error
          ? `已載入 ${items.length} 個品號；目前角色無法讀取完整供應商關係，請依權限查看`
          : `已載入 ${items.length} 個品號；商品清單為主檔目前狀態`);
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
    return rows.filter((row) => !normalizedQuery || `${row.item_code} ${row.item_name} ${row.size ?? ""} ${row.category ?? ""} ${row.season ?? ""} ${row.supplierSummary.join(" ")}`.toLocaleLowerCase().includes(normalizedQuery));
  }, [query, rows]);

  return (
    <section className="panel" aria-label="商品清單">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">PRODUCT CATALOG</p>
          <h2>目前商品清單</h2>
        </div>
        <span className="status-pill">RLS / CATALOG</span>
      </div>
      <p className="auth-message">這裡集中檢視目前品號、供應商與 MOQ 關係；新增、修改、停用、匯入與匯出請使用本模組下方的操作入口。</p>
      <div className="catalog-toolbar">
        <label className="field">
          搜尋品號／品名／供應商
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如 U-001 或供應商名稱" />
        </label>
        <div className="catalog-toolbar-action"><button className="secondary-button" type="button" onClick={() => setReloadToken((value) => value + 1)} disabled={busy}>{busy ? "讀取中…" : "重新整理"}</button></div>
      </div>
      <p className="muted" role="status">{message}；目前顯示 {filteredRows.length} 個品號</p>
      {filteredRows.length > 0 ? (
        <div className="table-scroll">
          <table>
            <thead><tr><th>品號</th><th>品名／規格</th><th>分類／季別</th><th>單位</th><th>供應商／MOQ</th><th>狀態</th><th>操作</th></tr></thead>
            <tbody>{filteredRows.map((row) => <tr key={row.id}>
              <td><strong>{row.item_code || "—"}</strong></td>
              <td>{row.item_name || "—"}{row.size ? `／${row.size}` : ""}</td>
              <td>{[row.category, row.season].filter(Boolean).join("／") || "—"}</td>
              <td>{row.unit || "—"}</td>
              <td>{row.supplierSummary.length > 0 ? row.supplierSummary.join("；") : "尚未建立供應關係"}</td>
              <td><span className="status-pill success">{row.is_active ? "啟用" : "停用"}</span></td>
              <td>{onEditItem ? <button className="secondary-button" type="button" onClick={() => onEditItem(row)}>修改</button> : null}</td>
            </tr>)}</tbody>
          </table>
        </div>
      ) : <p className="empty-state">尚無符合條件的商品資料，或目前帳號沒有品號讀取權限。</p>}
    </section>
  );
}
