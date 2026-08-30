import ModuleWorkbench from "../ModuleWorkbench";
import ProcurementReasonCodePanel from "../ProcurementReasonCodePanel";
import PurchaseReceiptCorrectionPanel from "../PurchaseReceiptCorrectionPanel";
import PurchaseReceiptPanel from "../PurchaseReceiptPanel";
import SeasonalProcurementPanel from "../SeasonalProcurementPanel";

type Props = { activeModule: string };

export default function ProcurementWorkspace({ activeModule }: Props) {
  return (
    <div className="workspace-sections">
      <section className="workspace-section" id="workspace-module-panel-procurement-decision-title" role="tabpanel" aria-labelledby="workspace-module-tab-procurement-decision-title" hidden={activeModule !== "procurement-decision-title"}>
        <ModuleWorkbench
          idPrefix="procurement-decision"
          eyebrow="PURCHASE DECISION"
          title="採購決策與差異"
          headingId="procurement-decision-title"
          description="日常採購決策與系統管理用的差異原因碼分開操作；採購量仍受 CEO 核准量、供應商與 MOQ 契約限制。"
          tabs={[
            { id: "decision", label: "採購決策", content: <SeasonalProcurementPanel /> },
            { id: "reason-codes", label: "差異原因碼", content: <ProcurementReasonCodePanel /> },
          ]}
        />
      </section>

      <section className="workspace-section" id="workspace-module-panel-procurement-receipt-title" role="tabpanel" aria-labelledby="workspace-module-tab-procurement-receipt-title" hidden={activeModule !== "procurement-receipt-title"}>
        <ModuleWorkbench
          idPrefix="procurement-receipt"
          eyebrow="RECEIPT POSTING"
          title="採購入庫與更正"
          headingId="procurement-receipt-title"
          description="新到貨使用採購入庫草稿；已 POST 的到貨、合格或拒收數量只能由獨立更正流程調整。"
          tabs={[
            { id: "receipt", label: "採購入庫", content: <PurchaseReceiptPanel /> },
            { id: "correction", label: "入庫更正", content: <PurchaseReceiptCorrectionPanel /> },
          ]}
        />
      </section>
    </div>
  );
}
