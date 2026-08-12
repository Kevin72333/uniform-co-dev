import InventoryCalculator from "./InventoryCalculator";
import HrRequestWorkbench from "./HrRequestWorkbench";
import AuthPanel from "./AuthPanel";
import EmployeeImportPanel from "./EmployeeImportPanel";
import MasterDataPanel from "./MasterDataPanel";
import WarehouseShipmentPanel from "./WarehouseShipmentPanel";
import ReplenishmentPanel from "./ReplenishmentPanel";
import SeasonalCampaignPanel from "./SeasonalCampaignPanel";
import SeasonalDemandPanel from "./SeasonalDemandPanel";
import SeasonalApprovalPanel from "./SeasonalApprovalPanel";
import SeasonalProcurementPanel from "./SeasonalProcurementPanel";
import ProcurementReasonCodePanel from "./ProcurementReasonCodePanel";
import PurchaseReceiptPanel from "./PurchaseReceiptPanel";
import PurchaseReceiptCorrectionPanel from "./PurchaseReceiptCorrectionPanel";
import StocktakePanel from "./StocktakePanel";
import ReturnPanel from "./ReturnPanel";
import PdfArtifactPanel from "./PdfArtifactPanel";
import ErpExportPanel from "./ErpExportPanel";
import AccountAdminPanel from "./AccountAdminPanel";
import DurableImportPanel from "./DurableImportPanel";

export default function Home() {
  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">UNIFORM-CO / MVP</p>
          <h1>制服需求與庫存試算</h1>
          <p className="lede">
            人資先登記發放量與增庫量，系統以人資倉、總倉合計可用量驗證；倉庫在交付前以實際調庫量 POST。
          </p>
        </div>
        <span className="status-pill">預覽模式</span>
      </header>
      <AuthPanel />
      <AccountAdminPanel />
      <InventoryCalculator />
      <HrRequestWorkbench />
      <EmployeeImportPanel />
      <MasterDataPanel />
      <DurableImportPanel />
      <ReplenishmentPanel />
      <SeasonalCampaignPanel />
      <SeasonalDemandPanel />
      <SeasonalApprovalPanel />
      <SeasonalProcurementPanel />
      <ProcurementReasonCodePanel />
      <PurchaseReceiptPanel />
      <PurchaseReceiptCorrectionPanel />
      <StocktakePanel />
      <ReturnPanel />
      <PdfArtifactPanel />
      <ErpExportPanel />
      <WarehouseShipmentPanel />
    </main>
  );
}
