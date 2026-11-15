import { describe, expect, it } from "vitest";

describe("P0 — socle du monorepo", () => {
  it("T0-01 : les scripts racine sont présents", async () => {
    const pkg = (await import("../package.json", { with: { type: "json" } })) as {
      default: Record<string, unknown>;
    };
    expect(pkg.default.scripts).toHaveProperty("build");
    expect(pkg.default.scripts).toHaveProperty("test");
    expect(pkg.default.scripts).toHaveProperty("boundaries");
  });

  it("T0-08 : TypeScript est en mode strict", async () => {
    const ts = (await import("../tsconfig.base.json", { with: { type: "json" } })) as {
      default: { compilerOptions: { strict: boolean } };
    };
    expect(ts.default.compilerOptions.strict).toBe(true);
  });
});
