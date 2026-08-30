import MasterDataPanel, { type MasterEntityType } from "./MasterDataPanel";
import ProductCatalogPanel from "./ProductCatalogPanel";

const productEntityTypes: readonly MasterEntityType[] = ["UNIFORM_ITEMS", "SUPPLIERS", "SUPPLIER_ITEMS"];

export default function ProductManagementPanel() {
  return (
    <div className="workspace-sections">
      <ProductCatalogPanel />
      <div className="workspace-panel-grid workspace-panel-grid--balanced">
        <MasterDataPanel allowedEntityTypes={productEntityTypes} />
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
        <p className="auth-message">本模組只使用既有主檔匯入／匯出 RPC；匯入先預覽，正式驗證、唯一鍵、停用與歷史引用保護由 Supabase 執行。</p>
        </section>
      </div>
    </div>
  );
}
