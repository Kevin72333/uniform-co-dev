import DurableImportPanel from "../DurableImportPanel";
import MasterDataPanel from "../MasterDataPanel";
import OverviewDashboard from "../OverviewDashboard";
import type { WorkspaceId } from "./workspace-config";

type Props = { activeModule: string; onNavigate: (workspaceId: WorkspaceId, anchor: string) => void };

export default function OverviewWorkspace({ activeModule, onNavigate }: Props) {
  return (
    <div className="workspace-sections">
      <div id="workspace-module-panel-overview-dashboard-title" role="tabpanel" aria-labelledby="workspace-module-tab-overview-dashboard-title" hidden={activeModule !== "overview-dashboard-title"}>
        <OverviewDashboard onNavigate={onNavigate} />
      </div>

      <section className="workspace-section" id="workspace-module-panel-overview-access-title" role="tabpanel" aria-labelledby="workspace-module-tab-overview-access-title" hidden={activeModule !== "overview-access-title"}>
        <div className="workspace-section-heading">
          <div>
            <p className="eyebrow">ACCESS &amp; FOUNDATION</p>
            <h2 id="overview-access-title">主檔與資料基礎</h2>
          </div>
          <p>所有業務工作區共用這裡的機構、部門、制服品號與供應商主檔；帳號與角色請至左側帳號管理。</p>
        </div>
        <MasterDataPanel />
      </section>

      <section className="workspace-section" id="workspace-module-panel-overview-import-title" role="tabpanel" aria-labelledby="workspace-module-tab-overview-import-title" hidden={activeModule !== "overview-import-title"}>
        <div className="workspace-section-heading">
          <div>
            <p className="eyebrow">DURABLE IMPORT</p>
            <h2 id="overview-import-title">耐久匯入</h2>
          </div>
          <p>大檔案匯入保留批次、差異與確認狀態，不繞過 worker 與資料庫防線。</p>
        </div>
        <DurableImportPanel />
      </section>
    </div>
  );
}
