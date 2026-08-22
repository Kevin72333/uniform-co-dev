export const workspaceDefinitions = [
  {
    id: "overview",
    label: "總覽",
    icon: "grid",
    eyebrow: "OPERATIONS OVERVIEW",
    description: "集中處理帳號、主檔與匯入準備，讓正式作業使用同一份資料基礎。",
  },
  {
    id: "hr",
    label: "人資需求",
    icon: "people",
    eyebrow: "HR OPERATIONS",
    description: "從員工資料、制服需求、預留到退回與人資更正，串起完整發放流程。",
  },
  {
    id: "warehouse",
    label: "倉庫作業",
    icon: "warehouse",
    eyebrow: "WAREHOUSE OPERATIONS",
    description: "處理兩倉庫存、發貨、盤點與更正；倉庫名稱固定為人資倉與總倉。",
  },
  {
    id: "procurement",
    label: "採購與入庫",
    icon: "cart",
    eyebrow: "PROCUREMENT & RECEIPT",
    description: "管理換季採購決策、採購差異、入庫驗收與採購入庫更正。",
  },
  {
    id: "seasonal",
    label: "換季活動",
    icon: "refresh",
    eyebrow: "SEASONAL CAMPAIGN",
    description: "建立換季活動、凍結適用範圍、收集需求並送交 CEO 審核。",
  },
  {
    id: "reports",
    label: "報表",
    icon: "chart",
    eyebrow: "REPORTING & ARTIFACTS",
    description: "以唯讀報表檢視庫存與流程，並依授權請求正式 PDF 或 ERP artifact。",
  },
] as const;

export type WorkspaceId = (typeof workspaceDefinitions)[number]["id"];

export function isWorkspaceId(value: string): value is WorkspaceId {
  return workspaceDefinitions.some((workspace) => workspace.id === value);
}
