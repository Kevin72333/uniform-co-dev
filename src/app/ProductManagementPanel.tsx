"use client";

import { useState } from "react";
import MasterDataPanel, { type MasterEntityType } from "./MasterDataPanel";
import ProductCatalogPanel, { type ProductItemEditRequest } from "./ProductCatalogPanel";
import ProductMasterEditorPanel from "./ProductMasterEditorPanel";
import DurableImportPanel from "./DurableImportPanel";

const productEntityTypes: readonly MasterEntityType[] = ["UNIFORM_ITEMS", "SUPPLIERS", "SUPPLIER_ITEMS"];
type ProductScreen = "CATALOG" | "EDITOR" | "SUPPLIERS" | "IMPORT_EXPORT";
type EditorIntent = "EDIT" | "DEACTIVATE";

const tabs: Array<{ value: Exclude<ProductScreen, "EDITOR">; label: string }> = [
  { value: "CATALOG", label: "商品清單" },
  { value: "SUPPLIERS", label: "供應商與 MOQ" },
  { value: "IMPORT_EXPORT", label: "匯入／匯出" },
];

export default function ProductManagementPanel() {
  const [screen, setScreen] = useState<ProductScreen>("CATALOG");
  const [itemEditRequest, setItemEditRequest] = useState<ProductItemEditRequest | null>(null);
  const [editorIntent, setEditorIntent] = useState<EditorIntent>("EDIT");
  const [catalogRefreshToken, setCatalogRefreshToken] = useState(0);
  const [notice, setNotice] = useState("");

  function openCatalog() {
    setScreen("CATALOG");
    setItemEditRequest(null);
    setEditorIntent("EDIT");
  }

  function createItem() {
    setItemEditRequest(null);
    setEditorIntent("EDIT");
    setScreen("EDITOR");
    setNotice("");
  }

  function editItem(item: ProductItemEditRequest, intent: EditorIntent = "EDIT") {
    setItemEditRequest(item);
    setEditorIntent(intent);
    setScreen("EDITOR");
    setNotice("");
  }

  function finishItem(message: string) {
    setCatalogRefreshToken((value) => value + 1);
    setNotice(message);
    openCatalog();
  }

  function selectScreen(nextScreen: Exclude<ProductScreen, "EDITOR">) {
    setScreen(nextScreen);
    setItemEditRequest(null);
    setEditorIntent("EDIT");
    setNotice("");
  }

  const activeTab = screen === "EDITOR" ? "CATALOG" : screen;

  return (
    <div className="workspace-sections product-management-workbench">
      <section className="panel product-management-header" aria-label="商品管理工具列">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">PRODUCT MANAGEMENT</p>
            <h2>{screen === "EDITOR" ? itemEditRequest ? "編輯商品" : "新增商品" : "商品管理"}</h2>
            <p className="auth-message">集中管理商品、供應商、MOQ 與批次資料；商品編輯使用獨立表單，保存仍由 Supabase 權限與稽核契約控管。</p>
          </div>
          <div className="product-action-bar">
            {screen === "EDITOR"
              ? <button className="secondary-button" type="button" onClick={openCatalog}>返回商品清單</button>
              : <>
                <button className="primary-button" type="button" onClick={createItem}>＋ 新增商品</button>
                <button className="secondary-button" type="button" onClick={() => selectScreen("IMPORT_EXPORT")}>匯入／匯出</button>
              </>}
          </div>
        </div>
        <nav className="product-module-tabs" aria-label="商品管理功能" role="tablist">
          {tabs.map((tab) => <button
            key={tab.value}
            className={activeTab === tab.value ? "active" : ""}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.value}
            onClick={() => selectScreen(tab.value)}
          >{tab.label}</button>)}
        </nav>
      </section>

      {notice ? <p className="success-note product-management-notice" role="status">{notice}</p> : null}

      {screen === "CATALOG" ? <ProductCatalogPanel
        refreshToken={catalogRefreshToken}
        onEditItem={(item) => editItem(item)}
        onDeactivateItem={(item) => editItem(item, "DEACTIVATE")}
      /> : null}

      {screen === "EDITOR" ? <ProductMasterEditorPanel
        key={`${itemEditRequest?.item_code ?? "new"}-${editorIntent}`}
        allowedEntityTypes={["UNIFORM_ITEMS"]}
        itemEditRequest={itemEditRequest}
        intent={editorIntent}
        onCancel={openCatalog}
        onSaved={(key, isActive) => finishItem(isActive ? `商品 ${key} 已保存並重新載入清單。` : `商品 ${key} 已停用；既有交易與庫存歷史仍保留。`)}
      /> : null}

      {screen === "SUPPLIERS" ? <ProductMasterEditorPanel allowedEntityTypes={["SUPPLIERS", "SUPPLIER_ITEMS"]} /> : null}

      {screen === "IMPORT_EXPORT" ? <div className="workspace-panel-grid workspace-panel-grid--balanced product-import-grid">
        <MasterDataPanel allowedEntityTypes={productEntityTypes} />
        <DurableImportPanel
          allowedImportTypes={["UNIFORM_ITEMS", "SUPPLIERS", "SUPPLIER_ITEMS"]}
          recoveryStorageKey="uniform-co:durable-import-product-recovery"
        />
        <section className="panel product-boundary-card" aria-label="商品資料管理說明">
          <div className="panel-heading">
            <div><p className="eyebrow">DATA CONTRACT</p><h2>匯入與停用規則</h2></div>
            <span className="status-pill">MASTER DATA</span>
          </div>
          <div className="summary-list">
            <div className="summary-row"><span><strong>制服品號</strong><small>品號是 ERP 與庫存穩定識別鍵；匯入同一品號會更新，不會建立重複商品。</small></span></div>
            <div className="summary-row"><span><strong>供應商與 MOQ</strong><small>MOQ 維護在供應商與品號關係，不是商品的全域欄位。</small></span></div>
            <div className="summary-row"><span><strong>停用代替刪除</strong><small>保留採購、發放與庫存歷史；停用商品不再出現在新的業務選單。</small></span></div>
          </div>
        </section>
      </div> : null}
    </div>
  );
}
