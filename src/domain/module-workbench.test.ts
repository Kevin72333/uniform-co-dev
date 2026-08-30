import { describe, expect, it } from "vitest";
import { normalizeWorkbenchId, resolveWorkbenchTabId } from "./module-workbench";

describe("module workbench interface", () => {
  const tabs = [
    { id: "list", label: "清單" },
    { id: "form", label: "表單" },
  ];

  it("keeps a valid requested tab and falls back deterministically", () => {
    expect(resolveWorkbenchTabId(tabs, "form", "list")).toBe("form");
    expect(resolveWorkbenchTabId(tabs, "missing", "form")).toBe("form");
    expect(resolveWorkbenchTabId(tabs, null)).toBe("list");
  });

  it("normalizes DOM id fragments and rejects an empty interface", () => {
    expect(normalizeWorkbenchId(" HR / Corrections ")).toBe("hr-corrections");
    expect(() => resolveWorkbenchTabId([], null)).toThrow("at least one tab");
  });
});
