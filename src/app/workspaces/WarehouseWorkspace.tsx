import InventoryCalculator from "../InventoryCalculator";
import StocktakeCorrectionPanel from "../StocktakeCorrectionPanel";
import StocktakePanel from "../StocktakePanel";
import WarehouseShipmentPanel from "../WarehouseShipmentPanel";
import WarehouseTransferCorrectionPanel from "../WarehouseTransferCorrectionPanel";

type Props = { activeModule: string };

export default function WarehouseWorkspace({ activeModule }: Props) {
  return (
    <div className="workspace-sections">
      <section className="workspace-section" id="workspace-module-panel-warehouse-control-title" role="tabpanel" aria-labelledby="workspace-module-tab-warehouse-control-title" hidden={activeModule !== "warehouse-control-title"}>
        <div className="workspace-section-heading">
          <div>
            <p className="eyebrow">WAREHOUSE CONTROL</p>
            <h2 id="warehouse-control-title">庫存與發貨</h2>
          </div>
          <p>庫存、預留與可申請量分開呈現；倉庫只填寫實際調庫量。</p>
        </div>
        <InventoryCalculator />
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
