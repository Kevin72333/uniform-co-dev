import { describe, expect, it } from "vitest";
import {
  inventoryAvailabilityStatus,
  inventoryAvailabilityStatusLabel,
  normalizeInventoryAvailabilityRow,
} from "./inventory-availability";

describe("inventory availability", () => {
  it("normalizes the read-only availability view without creating a second quantity source", () => {
    const row = normalizeInventoryAvailabilityRow({
      item_id: "item-1",
      item_code: "U-001",
      item_name: "夏季上衣",
      unit: "件",
      size: "M",
      category: "上衣",
      season: "夏",
      is_active: true,
      hr_on_hand_quantity: "5",
      general_on_hand_quantity: 15,
      combined_on_hand_quantity: "20",
      active_reserved_quantity: "3",
      available_to_request_quantity: "17",
    });

    expect(row).toMatchObject({ itemCode: "U-001", hrOnHand: 5, generalOnHand: 15, combinedOnHand: 20, activeReserved: 3, availableToRequest: 17 });
    expect(inventoryAvailabilityStatus(row)).toBe("AVAILABLE");
  });

  it("marks zero availability and inactive items explicitly", () => {
    const out = normalizeInventoryAvailabilityRow({ is_active: true, available_to_request_quantity: 0 });
    const inactive = normalizeInventoryAvailabilityRow({ is_active: false, available_to_request_quantity: 100 });

    expect(inventoryAvailabilityStatus(out)).toBe("OUT_OF_STOCK");
    expect(inventoryAvailabilityStatus(inactive)).toBe("INACTIVE");
    expect(inventoryAvailabilityStatusLabel("OUT_OF_STOCK")).toBe("無可申請量");
  });

  it("surfaces impossible negative values as a data error", () => {
    const row = normalizeInventoryAvailabilityRow({ is_active: true, available_to_request_quantity: -1 });
    expect(inventoryAvailabilityStatus(row)).toBe("DATA_ERROR");
  });
});
