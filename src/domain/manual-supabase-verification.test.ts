import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const verificationSql = readFileSync(
  join(process.cwd(), "supabase", "manual", "verify-production-setup.sql"),
  "utf8",
);

describe("manual Supabase verification SQL", () => {
  it("uses the app_accounts contact column defined by the migrations", () => {
    expect(verificationSql).toContain("a.email_snapshot");
    expect(verificationSql).not.toContain("a.contact_email");
  });
});
