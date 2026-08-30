import AccountAdminPanel from "../AccountAdminPanel";

type Props = { activeModule: string };

export default function AccountWorkspace({ activeModule }: Props) {
  return (
    <div className="workspace-sections">
      <section className="workspace-section" id="workspace-module-panel-accounts-admin-title" role="tabpanel" aria-labelledby="workspace-module-tab-accounts-admin-title" hidden={activeModule !== "accounts-admin-title"}>
        <AccountAdminPanel headingId="accounts-admin-title" />
      </section>
    </div>
  );
}
