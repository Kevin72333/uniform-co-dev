import { describe, expect, it } from "vitest";
import {
  emptyProductEditorForm,
  productEditorImportRow,
  productEditorKey,
  validateProductEditor,
} from "./product-management";

describe("product management editor contract", () => {
  it("builds stable item and supplier-item keys", () => {
    expect(productEditorKey("UNIFORM_ITEMS", { ...emptyProductEditorForm, itemCode: " U-001 " })).toBe("U-001");
    expect(productEditorKey("SUPPLIER_ITEMS", { ...emptyProductEditorForm, supplierCode: " S-1 ", itemCode: " U-001 " })).toBe("S-1:U-001");
  });

  it("builds a master import row without changing the server contract", () => {
    const row = productEditorImportRow("UNIFORM_ITEMS", {
      ...emptyProductEditorForm,
      itemCode: " U-001 ",
      itemName: "短袖上衣",
      size: " M ",
      isActive: false,
    });
    expect(row).toEqual({ code: "U-001", name: "短袖上衣", unit: "件", size: "M", category: "", season: "", isActive: false });
  });

  it("requires the fields enforced by apply_master_import", () => {
    expect(validateProductEditor("UNIFORM_ITEMS", emptyProductEditorForm)).toBe("品號、品名與單位為必填。");
    expect(validateProductEditor("SUPPLIER_ITEMS", { ...emptyProductEditorForm, supplierCode: "S-1", itemCode: "U-1", minimumOrderQuantity: "x" })).toBe("MOQ 必須是 0 或正整數。");
    expect(validateProductEditor("SUPPLIER_ITEMS", { ...emptyProductEditorForm, supplierCode: "S-1", itemCode: "U-1", minimumOrderQuantity: "0" })).toBeNull();
  });
});
