import InventoryAvailabilityPanel from "./InventoryAvailabilityPanel";
import InventoryCalculator from "./InventoryCalculator";
import DurableImportPanel from "./DurableImportPanel";
import InventoryHistoryExportPanel from "./InventoryHistoryExportPanel";
import InventoryOperationHub from "./InventoryOperationHub";
import type { WorkspaceId } from "./workspaces/workspace-config";

type Props = { onNavigate: (workspaceId: WorkspaceId, anchor: string) => void };

export default function InventoryManagementPanel({ onNavigate }: Props) {
  return (
    <div className="workspace-sections">
      <InventoryAvailabilityPanel />
      <InventoryOperationHub onNavigate={onNavigate} />
      <div id="inventory-opening-import"><DurableImportPanel allowedImportTypes={["OPENING_BALANCE"]} recoveryStorageKey="uniform-co:durable-import-opening-recovery" /></div>
      <InventoryHistoryExportPanel />
      <InventoryCalculator />
    </div>
  );
}
