export type InventoryAvailabilityRow = {
  itemId: string;
  itemCode: string;
  itemName: string;
  unit: string;
  size: string | null;
  category: string | null;
  season: string | null;
  isActive: boolean;
  hrOnHand: number;
  generalOnHand: number;
  combinedOnHand: number;
  activeReserved: number;
  availableToRequest: number;
};

export type InventoryAvailabilityStatus = "AVAILABLE" | "OUT_OF_STOCK" | "INACTIVE" | "DATA_ERROR";

function textValue(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function nullableTextValue(value: unknown): string | null {
  const text = textValue(value).trim();
  return text || null;
}

function quantityValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

export function normalizeInventoryAvailabilityRow(row: Record<string, unknown>): InventoryAvailabilityRow {
  return {
    itemId: textValue(row.item_id),
    itemCode: textValue(row.item_code),
    itemName: textValue(row.item_name),
    unit: textValue(row.unit),
    size: nullableTextValue(row.size),
    category: nullableTextValue(row.category),
    season: nullableTextValue(row.season),
    isActive: row.is_active === true || row.is_active === "true",
    hrOnHand: quantityValue(row.hr_on_hand_quantity),
    generalOnHand: quantityValue(row.general_on_hand_quantity),
    combinedOnHand: quantityValue(row.combined_on_hand_quantity),
    activeReserved: quantityValue(row.active_reserved_quantity),
    availableToRequest: quantityValue(row.available_to_request_quantity),
  };
}

export function inventoryAvailabilityStatus(row: InventoryAvailabilityRow): InventoryAvailabilityStatus {
  if (!row.isActive) return "INACTIVE";
  if ([row.hrOnHand, row.generalOnHand, row.combinedOnHand, row.activeReserved, row.availableToRequest].some((value) => value < 0)) {
    return "DATA_ERROR";
  }
  return row.availableToRequest > 0 ? "AVAILABLE" : "OUT_OF_STOCK";
}

export function inventoryAvailabilityStatusLabel(status: InventoryAvailabilityStatus): string {
  const labels: Record<InventoryAvailabilityStatus, string> = {
    AVAILABLE: "可申請",
    OUT_OF_STOCK: "無可申請量",
    INACTIVE: "已停用",
    DATA_ERROR: "資料異常",
  };
  return labels[status];
}
