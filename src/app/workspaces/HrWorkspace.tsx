import EmployeeImportPanel from "../EmployeeImportPanel";
import HrIssueCorrectionPanel from "../HrIssueCorrectionPanel";
import HrRequestWorkbench from "../HrRequestWorkbench";
import ReplenishmentPanel from "../ReplenishmentPanel";
import ReturnCorrectionPanel from "../ReturnCorrectionPanel";
import ReturnPanel from "../ReturnPanel";

export default function HrWorkspace() {
  return (
    <div className="workspace-sections">
      <section className="workspace-section" aria-labelledby="hr-request-title">
        <div className="workspace-section-heading">
          <div>
            <p className="eyebrow">REQUEST WORKBENCH</p>
            <h2 id="hr-request-title">需求與發放準備</h2>
          </div>
          <p>人資決定發放量與增庫量；送出後由系統依兩倉合計可申請量建立預留。</p>
        </div>
        <HrRequestWorkbench />
        <div className="workspace-panel-grid workspace-panel-grid--balanced">
          <ReplenishmentPanel />
          <ReturnPanel />
        </div>
      </section>

      <section className="workspace-section" aria-labelledby="hr-correction-title">
        <div className="workspace-section-heading">
          <div>
            <p className="eyebrow">CORRECTIONS &amp; IMPORT</p>
            <h2 id="hr-correction-title">人資更正與員工主檔</h2>
          </div>
          <p>正式過帳後使用後續更正單追蹤，不直接改寫原始單據。</p>
        </div>
        <div className="workspace-panel-grid workspace-panel-grid--balanced">
          <HrIssueCorrectionPanel />
          <ReturnCorrectionPanel />
        </div>
        <EmployeeImportPanel />
      </section>
    </div>
  );
}
