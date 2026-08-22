import SeasonalApprovalPanel from "../SeasonalApprovalPanel";
import SeasonalCampaignPanel from "../SeasonalCampaignPanel";
import SeasonalDemandPanel from "../SeasonalDemandPanel";

export default function SeasonalWorkspace() {
  return (
    <div className="workspace-sections">
      <section className="workspace-section" aria-labelledby="seasonal-campaign-title">
        <div className="workspace-section-heading">
          <div>
            <p className="eyebrow">CAMPAIGN SETUP</p>
            <h2 id="seasonal-campaign-title">活動與需求窗口</h2>
          </div>
          <p>先建立活動並凍結員工／制服範圍，再開放需求窗口填寫。</p>
        </div>
        <div className="workspace-panel-grid workspace-panel-grid--balanced">
          <SeasonalCampaignPanel />
          <SeasonalDemandPanel />
        </div>
      </section>

      <section className="workspace-section" aria-labelledby="seasonal-approval-title">
        <div className="workspace-section-heading">
          <div>
            <p className="eyebrow">CEO REVIEW</p>
            <h2 id="seasonal-approval-title">換季送核</h2>
          </div>
          <p>CEO 核准完整送核版本或退回並填寫理由；人資修正會建立新版本。</p>
        </div>
        <SeasonalApprovalPanel />
      </section>
    </div>
  );
}
