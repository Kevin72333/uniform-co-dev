import InventoryAvailabilityPanel from "./InventoryAvailabilityPanel";
import InventoryCalculator from "./InventoryCalculator";

export default function InventoryManagementPanel() {
  return (
    <div className="workspace-sections">
      <InventoryAvailabilityPanel />
      <InventoryCalculator />
    </div>
  );
}
