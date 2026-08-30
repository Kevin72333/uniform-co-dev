"use client";

import { useState } from "react";
import MasterDataPanel, { type MasterEntityType } from "./MasterDataPanel";
import ProductCatalogPanel, { type ProductItemEditRequest } from "./ProductCatalogPanel";
import ProductMasterEditorPanel from "./ProductMasterEditorPanel";
import DurableImportPanel from "./DurableImportPanel";

const productEntityTypes: readonly MasterEntityType[] = ["UNIFORM_ITEMS", "SUPPLIERS", "SUPPLIER_ITEMS"];

export default function ProductManagementPanel() {
  const [itemEditRequest, setItemEditRequest] = useState<ProductItemEditRequest | null>(null);

  function editItem(item: ProductItemEditRequest) {
    setItemEditRequest(item);
    window.setTimeout(() => document.getElementById("product-master-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  return (
    <div className="workspace-sections">
      <ProductCatalogPanel onEditItem={editItem} />
      <ProductMasterEditorPanel key={itemEditRequest?.item_code ?? "new-product-editor"} itemEditRequest={itemEditRequest} />
      <div className="workspace-panel-grid workspace-panel-grid--balanced">
        <MasterDataPanel allowedEntityTypes={productEntityTypes} />
        <DurableImportPanel
          allowedImportTypes={["UNIFORM_ITEMS", "SUPPLIERS", "SUPPLIER_ITEMS"]}
          recoveryStorageKey="uniform-co:durable-import-product-recovery"
        />
        <section className="panel" aria-label="商品管理說明">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">PRODUCT CATALOG</p>
            <h2>商品主檔邊界</h2>
          </div>
          <span className="status-pill">MASTER DATA</span>
        </div>
        <div className="summary-list">
          <div className="summary-row">
            <span><strong>制服品號</strong><small>品號同時是鼎新 ERP 與庫存識別鍵；尺寸、季別與顏色保留在品號描述。</small></span>
          </div>
          <div className="summary-row">
            <span><strong>供應商</strong><small>維護供應商基本資料與啟用狀態；已被交易引用的資料只能停用。</small></span>
          </div>
          <div className="summary-row">
            <span><strong>供應商品號／MOQ</strong><small>MOQ 屬於供應商與品號的關係，不會被誤當成全域商品欄位。</small></span>
          </div>
        </div>
        <p className="auth-message">小批次可直接預覽 CSV／JSON；大批次使用耐久 CSV／XLSX worker。兩條匯入路徑都由 Supabase 執行正式驗證、唯一鍵、停用與歷史引用保護。</p>
        </section>
      </div>
    </div>
  );
}
