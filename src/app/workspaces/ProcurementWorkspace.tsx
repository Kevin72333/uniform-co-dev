import ProcurementReasonCodePanel from "../ProcurementReasonCodePanel";
import PurchaseReceiptCorrectionPanel from "../PurchaseReceiptCorrectionPanel";
import PurchaseReceiptPanel from "../PurchaseReceiptPanel";
import SeasonalProcurementPanel from "../SeasonalProcurementPanel";

export default function ProcurementWorkspace() {
  return (
    <div className="workspace-sections">
      <section className="workspace-section" aria-labelledby="procurement-decision-title">
        <div className="workspace-section-heading">
          <div>
            <p className="eyebrow">PURCHASE DECISION</p>
            <h2 id="procurement-decision-title">採購決策與差異</h2>
          </div>
          <p>依 CEO 核准量與供應商 MOQ 決定最後採購量，差異必須具名。</p>
        </div>
        <div className="workspace-panel-grid workspace-panel-grid--balanced">
          <SeasonalProcurementPanel />
          <ProcurementReasonCodePanel />
        </div>
      </section>

      <section className="workspace-section" aria-labelledby="procurement-receipt-title">
        <div className="workspace-section-heading">
          <div>
            <p className="eyebrow">RECEIPT POSTING</p>
            <h2 id="procurement-receipt-title">採購入庫與更正</h2>
          </div>
          <p>到貨、合格與拒收分開記錄，只有 POST 後的合格量增加總倉庫存。</p>
        </div>
        <div className="workspace-panel-grid workspace-panel-grid--balanced">
          <PurchaseReceiptPanel />
          <PurchaseReceiptCorrectionPanel />
        </div>
      </section>
    </div>
  );
}
