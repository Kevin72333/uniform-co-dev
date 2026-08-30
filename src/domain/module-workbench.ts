export type ModuleWorkbenchTabDefinition = {
  id: string;
  label: string;
};

export function normalizeWorkbenchId(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}
export function resolveWorkbenchTabId(
  tabs: readonly ModuleWorkbenchTabDefinition[],
  requestedTabId: string | null | undefined,
  defaultTabId?: string,
): string {
  if (tabs.length === 0) throw new Error("Module workbench requires at least one tab.");
  if (requestedTabId && tabs.some((tab) => tab.id === requestedTabId)) return requestedTabId;
  if (defaultTabId && tabs.some((tab) => tab.id === defaultTabId)) return defaultTabId;
  return tabs[0].id;
}
