import InventoryManagementPanel from "../InventoryManagementPanel";
import StocktakeCorrectionPanel from "../StocktakeCorrectionPanel";
import StocktakePanel from "../StocktakePanel";
import WarehouseShipmentPanel from "../WarehouseShipmentPanel";
import WarehouseTransferCorrectionPanel from "../WarehouseTransferCorrectionPanel";
import type { WorkspaceId } from "./workspace-config";

type Props = { activeModule: string; onNavigate: (workspaceId: WorkspaceId, anchor: string) => void };

export default function WarehouseWorkspace({ activeModule, onNavigate }: Props) {
  return (
    <div className="workspace-sections">
      <section className="workspace-section" id="workspace-module-panel-warehouse-inventory-title" role="tabpanel" aria-labelledby="workspace-module-tab-warehouse-inventory-title" hidden={activeModule !== "warehouse-inventory-title"}>
        <div className="workspace-section-heading">
          <div>
            <p className="eyebrow">INVENTORY MANAGEMENT</p>
            <h2 id="warehouse-inventory-title">庫存管理</h2>
          </div>
          <p>集中檢視、匯出與啟動兩倉庫存作業；正式數量只能由期初、入庫、發貨、盤點、退回或更正流水更新。</p>
        </div>
        <InventoryManagementPanel onNavigate={onNavigate} />
      </section>

      <section className="workspace-section" id="workspace-module-panel-warehouse-control-title" role="tabpanel" aria-labelledby="workspace-module-tab-warehouse-control-title" hidden={activeModule !== "warehouse-control-title"}>
        <div className="workspace-section-heading">
          <div>
            <p className="eyebrow">FULFILLMENT</p>
            <h2 id="warehouse-control-title">發貨作業</h2>
          </div>
          <p>依需求單處理倉庫發貨；倉庫只填寫實際調庫量，正式庫存異動由受保護 RPC 完成。</p>
        </div>
        <WarehouseShipmentPanel />
      </section>

      <section className="workspace-section" id="workspace-module-panel-warehouse-stocktake-title" role="tabpanel" aria-labelledby="workspace-module-tab-warehouse-stocktake-title" hidden={activeModule !== "warehouse-stocktake-title"}>
        <div className="workspace-section-heading">
          <div>
            <p className="eyebrow">STOCKTAKE &amp; CORRECTION</p>
            <h2 id="warehouse-stocktake-title">盤點與倉庫更正</h2>
          </div>
          <p>盤點依帳面版本進行 fencing，所有正式更正都保留來源與理由。</p>
        </div>
        <div className="workspace-panel-grid workspace-panel-grid--balanced">
          <StocktakePanel />
          <WarehouseTransferCorrectionPanel />
        </div>
        <StocktakeCorrectionPanel />
      </section>
    </div>
  );
}
