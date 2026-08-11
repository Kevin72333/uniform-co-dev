import { describe, expect, it } from "vitest";
import {
  assertPurchaseAllocationWithinLimit,
  SeasonalProcurementValidationError,
  summarizeReceiptProgress,
  validatePurchaseDecision,
  validateReceipt,
} from "./seasonal-procurement";

describe("seasonal procurement rules", () => {
  it("requires a reason when MOQ changes the approved quantity", () => {
    expect(() =>
      validatePurchaseDecision({
        approvedQuantity: 100,
        minimumOrderQuantity: 120,
        finalPurchaseQuantity: 120,
      }),
    ).toThrow(SeasonalProcurementValidationError);

    expect(() =>
      validatePurchaseDecision({
        approvedQuantity: 100,
        minimumOrderQuantity: 120,
        finalPurchaseQuantity: 120,
        differenceReason: "供應商最低採購量",
      }),
    ).not.toThrow();
  });

  it("rejects an allocation that exceeds the current purchase limit", () => {
    expect(() =>
      assertPurchaseAllocationWithinLimit({
        currentPurchaseLimit: 120,
        existingAllocatedQuantity: 80,
        newOrderQuantity: 41,
      }),
    ).toThrow(/exceeds/);
    expect(() =>
      assertPurchaseAllocationWithinLimit({
        currentPurchaseLimit: 120,
        existingAllocatedQuantity: 80,
        newOrderQuantity: 40,
      }),
    ).not.toThrow();
  });

  it("requires a reason for rejected goods and returns accepted quantity for inventory", () => {
    expect(() => validateReceipt({ deliveredQuantity: 10, acceptedQuantity: 8, rejectedQuantity: 2 })).toThrow(
      /rejectionReason/,
    );
    expect(validateReceipt({ deliveredQuantity: 10, acceptedQuantity: 8, rejectedQuantity: 2, rejectionReason: "破損" })).toBe(8);
  });

  it("summarizes split receipts and keeps short quantity open", () => {
    expect(
      summarizeReceiptProgress(100, [
        { deliveredQuantity: 60, acceptedQuantity: 60, rejectedQuantity: 0 },
        { deliveredQuantity: 20, acceptedQuantity: 18, rejectedQuantity: 2, rejectionReason: "瑕疵" },
      ]),
    ).toEqual({ deliveredQuantity: 80, acceptedQuantity: 78, rejectedQuantity: 2, remainingToAccept: 22 });
  });
});
