import ErpExportPanel from "../ErpExportPanel";
import ModuleWorkbench from "../ModuleWorkbench";
import PdfArtifactPanel from "../PdfArtifactPanel";
import ReportingPanel from "../ReportingPanel";

type Props = { activeModule: string };

export default function ReportsWorkspace({ activeModule }: Props) {
  return (
    <div className="workspace-sections">
      <section className="workspace-section" id="workspace-module-panel-reports-view-title" role="tabpanel" aria-labelledby="workspace-module-tab-reports-view-title" hidden={activeModule !== "reports-view-title"}>
        <div className="workspace-section-heading">
          <div>
            <p className="eyebrow">READ-ONLY VIEWS</p>
            <h2 id="reports-view-title">營運報表</h2>
          </div>
          <p>報表直接讀取 security-invoker views，不建立第二份庫存或採購數字。</p>
        </div>
        <ReportingPanel />
      </section>

      <section className="workspace-section" id="workspace-module-panel-reports-artifact-title" role="tabpanel" aria-labelledby="workspace-module-tab-reports-artifact-title" hidden={activeModule !== "reports-artifact-title"}>
        <ModuleWorkbench
          idPrefix="formal-artifacts"
          eyebrow="FORMAL ARTIFACTS"
          title="正式文件與 ERP"
          headingId="reports-artifact-title"
          description="PDF 與 ERP 是不同 artifact 流程；只有正式來源 snapshot 與授權角色符合時才可提出請求。"
          tabs={[
            { id: "pdf", label: "正式 PDF", content: <PdfArtifactPanel /> },
            { id: "erp", label: "鼎新 ERP", content: <ErpExportPanel /> },
          ]}
        />
      </section>
    </div>
  );
}
