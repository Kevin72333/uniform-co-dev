import AccountAdminPanel from "../AccountAdminPanel";
import DurableImportPanel from "../DurableImportPanel";
import MasterDataPanel from "../MasterDataPanel";

export default function OverviewWorkspace() {
  return (
    <div className="workspace-sections">
      <section className="workspace-section" aria-labelledby="overview-access-title">
        <div className="workspace-section-heading">
          <div>
            <p className="eyebrow">ACCESS &amp; FOUNDATION</p>
            <h2 id="overview-access-title">帳號與正式資料基礎</h2>
          </div>
          <p>所有業務工作區共用這裡的帳號角色、主檔與匯入結果。</p>
        </div>
        <div className="workspace-panel-grid workspace-panel-grid--wide">
          <AccountAdminPanel />
          <MasterDataPanel />
        </div>
      </section>

      <section className="workspace-section" aria-labelledby="overview-import-title">
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
