import ErpExportPanel from "../ErpExportPanel";
import PdfArtifactPanel from "../PdfArtifactPanel";
import ReportingPanel from "../ReportingPanel";

export default function ReportsWorkspace() {
  return (
    <div className="workspace-sections">
      <section className="workspace-section" aria-labelledby="reports-view-title">
        <div className="workspace-section-heading">
          <div>
            <p className="eyebrow">READ-ONLY VIEWS</p>
            <h2 id="reports-view-title">營運報表</h2>
          </div>
          <p>報表直接讀取 security-invoker views，不建立第二份庫存或採購數字。</p>
        </div>
        <ReportingPanel />
      </section>

      <section className="workspace-section" aria-labelledby="reports-artifact-title">
        <div className="workspace-section-heading">
          <div>
            <p className="eyebrow">FORMAL ARTIFACTS</p>
            <h2 id="reports-artifact-title">正式文件與 ERP</h2>
          </div>
          <p>只有在正式來源 snapshot 與授權角色符合時，才可請求 artifact 或 ERP 批次。</p>
        </div>
        <div className="workspace-panel-grid workspace-panel-grid--balanced">
          <PdfArtifactPanel />
          <ErpExportPanel />
        </div>
      </section>
    </div>
  );
}
