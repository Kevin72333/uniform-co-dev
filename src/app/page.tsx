import InventoryCalculator from "./InventoryCalculator";
import HrRequestWorkbench from "./HrRequestWorkbench";
import AuthPanel from "./AuthPanel";
import EmployeeImportPanel from "./EmployeeImportPanel";

export default function Home() {
  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">UNIFORM-CO / MVP</p>
          <h1>制服需求與庫存試算</h1>
          <p className="lede">
            人資先登記發放量與增庫量，系統以人資倉、總倉合計可用量驗證；倉庫在交付前以實際調庫量 POST。
          </p>
        </div>
        <span className="status-pill">預覽模式</span>
      </header>
      <AuthPanel />
      <InventoryCalculator />
      <HrRequestWorkbench />
      <EmployeeImportPanel />
    </main>
  );
}
