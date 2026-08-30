import { describe, expect, it } from "vitest";
import { searchWorkspaceModules, workspaceDefinitions } from "./workspace-config";

describe("workspace module index", () => {
  it("exposes product management as a dedicated overview module", () => {
    expect(workspaceDefinitions.find((workspace) => workspace.id === "overview")?.modules).toContainEqual({
      anchor: "overview-products-title",
      label: "商品管理",
      keywords: "商品 制服品號 品名 尺寸 季別 供應商 MOQ 供應商品號",
    });
    expect(searchWorkspaceModules("MOQ")[0]?.anchor).toBe("overview-products-title");
  });

  it("exposes inventory management separately from fulfillment", () => {
    const warehouse = workspaceDefinitions.find((workspace) => workspace.id === "warehouse");
    expect(warehouse?.modules[0]).toMatchObject({ anchor: "warehouse-inventory-title", label: "庫存管理" });
    expect(warehouse?.modules[1]).toMatchObject({ anchor: "warehouse-control-title", label: "發貨作業" });
    expect(searchWorkspaceModules("庫存清單")[0]?.anchor).toBe("warehouse-inventory-title");
  });
});
