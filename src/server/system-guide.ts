import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  parseSystemGuideMarkdown,
  type SystemGuideDocument,
  type SystemGuideDocumentId,
} from "@/src/domain/system-guide";

const DOCUMENT_DIRECTORY = join(process.cwd(), "docs", "system-guide");

const documentDefinitions: ReadonlyArray<{
  id: SystemGuideDocumentId;
  fileName: string;
  title: string;
  audience: string;
}> = [
  { id: "user", fileName: "user-guide.md", title: "使用者操作說明", audience: "日常作業與各業務角色" },
  { id: "admin", fileName: "admin-guide.md", title: "管理者設定說明", audience: "SYSTEM_ADMIN 與平台維運者" },
  { id: "agent", fileName: "agent-guide.md", title: "AI Agent 交接說明", audience: "開發、維護與 DevOps Agent" },
];

export async function loadSystemGuideDocuments(): Promise<SystemGuideDocument[]> {
  return Promise.all(documentDefinitions.map(async (definition) => {
    const source = await readFile(join(DOCUMENT_DIRECTORY, definition.fileName), "utf8");
    return {
      id: definition.id,
      title: definition.title,
      audience: definition.audience,
      blocks: parseSystemGuideMarkdown(source),
    };
  }));
}
