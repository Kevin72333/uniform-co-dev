import AccountAdminPanel from "../AccountAdminPanel";

type Props = { activeModule: string };

export default function AccountWorkspace({ activeModule }: Props) {
  return (
    <div className="workspace-sections">
      <section className="workspace-section" id="workspace-module-panel-accounts-admin-title" role="tabpanel" aria-labelledby="workspace-module-tab-accounts-admin-title" hidden={activeModule !== "accounts-admin-title"}>
        <div className="workspace-section-heading">
          <div>
            <p className="eyebrow">ACCOUNT &amp; ACCESS</p>
            <h2 id="accounts-admin-title">帳號與權限管理</h2>
          </div>
          <p>直接管理業務帳號、登入身份、角色、狀態與需求窗口範圍；帳號歷史資料不因停用而刪除。</p>
        </div>
        <AccountAdminPanel />
      </section>
    </div>
  );
}
