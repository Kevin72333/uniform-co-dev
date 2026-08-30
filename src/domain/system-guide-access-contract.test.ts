import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("System Guide access contract", () => {
  it("authorizes both discovery and document reads on the server", () => {
    const route = source("../app/api/system-guide/route.ts");
    expect(route).toContain("authorizeSystemAdmin(client)");
    expect(route).toContain("export async function HEAD");
    expect(route).toContain("export async function GET");
    expect(route.indexOf("await authorize(request)")).toBeLessThan(route.indexOf("await loadSystemGuideDocuments()"));
    expect(route).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("loads only the three allowlisted Markdown sources", () => {
    const loader = source("../server/system-guide.ts");
    expect(loader).toContain('fileName: "user-guide.md"');
    expect(loader).toContain('fileName: "admin-guide.md"');
    expect(loader).toContain('fileName: "agent-guide.md"');
    expect(loader).not.toMatch(/fileName\s*:\s*(request|params|searchParams)/);
  });

  it("renders typed blocks and never injects Markdown as HTML", () => {
    const page = source("../app/system-guide/SystemGuidePageClient.tsx");
    expect(page).toContain("function GuideBlock");
    expect(page).toContain("guideState?.userId === user.id");
    expect(page).not.toContain("dangerouslySetInnerHTML");
  });

  it("shows navigation only after the protected access probe succeeds", () => {
    const shell = source("../app/WorkspaceShell.tsx");
    const accessHook = source("../app/use-system-guide-access.ts");
    expect(shell).toContain("systemGuideAvailable ?");
    expect(shell).toContain("useSystemGuideAccess(client, user)");
    expect(accessHook).toContain('method: "HEAD"');
    expect(accessHook).toContain("access?.userId === user.id");
  });

  it("includes the Markdown files in the standalone route bundle", () => {
    const nextConfig = source("../../next.config.ts");
    expect(nextConfig).toContain('"/api/system-guide"');
    expect(nextConfig).toContain('"./docs/system-guide/*.md"');
  });
});
