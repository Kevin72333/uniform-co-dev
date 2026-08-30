import EmployeeImportPanel from "../EmployeeImportPanel";
import HrIssueCorrectionPanel from "../HrIssueCorrectionPanel";
import HrRequestWorkbench from "../HrRequestWorkbench";
import ModuleWorkbench from "../ModuleWorkbench";
import ReplenishmentPanel from "../ReplenishmentPanel";
import ReturnCorrectionPanel from "../ReturnCorrectionPanel";
import ReturnPanel from "../ReturnPanel";

type Props = { activeModule: string };

export default function HrWorkspace({ activeModule }: Props) {
  return (
    <div className="workspace-sections">
      <section className="workspace-section" id="workspace-module-panel-hr-request-title" role="tabpanel" aria-labelledby="workspace-module-tab-hr-request-title" hidden={activeModule !== "hr-request-title"}>
        <ModuleWorkbench
          idPrefix="hr-request"
          eyebrow="REQUEST WORKBENCH"
          title="需求與發放準備"
          headingId="hr-request-title"
          description="依任務切換需求單、補庫或員工退回；送出與正式過帳仍由各自受保護 RPC 依兩倉數量與來源單據驗證。"
          tabs={[
            { id: "request", label: "制服需求", content: <HrRequestWorkbench /> },
            { id: "replenishment", label: "額外補庫", content: <ReplenishmentPanel /> },
            { id: "return", label: "員工退回", content: <ReturnPanel /> },
          ]}
        />
      </section>

      <section className="workspace-section" id="workspace-module-panel-hr-correction-title" role="tabpanel" aria-labelledby="workspace-module-tab-hr-correction-title" hidden={activeModule !== "hr-correction-title"}>
        <ModuleWorkbench
          idPrefix="hr-correction"
          eyebrow="CORRECTIONS & IMPORT"
          title="人資更正與員工主檔"
          headingId="hr-correction-title"
          description="正式過帳後以來源明細建立後續更正，不直接改寫原始單據；員工主檔匯入保留在獨立批次頁。"
          tabs={[
            { id: "issue-correction", label: "發放更正", content: <HrIssueCorrectionPanel /> },
            { id: "return-correction", label: "退回更正", content: <ReturnCorrectionPanel /> },
            { id: "employee-import", label: "員工匯入", content: <EmployeeImportPanel /> },
          ]}
        />
      </section>
    </div>
  );
}
