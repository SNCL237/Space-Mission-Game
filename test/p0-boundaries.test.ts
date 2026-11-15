import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bin = path.join(racine, "node_modules", "dependency-cruiser", "bin", "dependency-cruise.mjs");

function depcruise(sousArbre: string): { code: number; sortie: string } {
  try {
    const sortie = execFileSync(
      process.execPath,
      [bin, "--config", "dependency-cruiser.config.cjs", "--no-cache", sousArbre],
      {
        cwd: racine,
        encoding: "utf8",
        env: { ...process.env, SMDG_CRUISE_SCOPE: sousArbre },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    return { code: 0, sortie };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return {
      code: err.status ?? 1,
      sortie: `${err.stdout ?? ""}${err.stderr ?? ""}`,
    };
  }
}

describe("P0 — frontières d'architecture (dependency-cruiser)", () => {
  // Marge de temps (P2) : `depcruise` est un sous-processus node — jusqu'à ~16 s
  // à froid une fois les suites PostgreSQL du lot parallélisées.
  it("T0-02 : l'arbre valide passe sans aucune violation", { timeout: 60_000 }, () => {
    const r = depcruise("test/fixtures/boundaries/ok");
    expect(r.code).toBe(0);
    expect(r.sortie).not.toMatch(/severity:\s*error/);
  });

  it("T0-03 : le noyau qui importe un domaine est rejeté (RI2)", { timeout: 60_000 }, () => {
    const r = depcruise("test/fixtures/boundaries/violations");
    expect(r.code).not.toBe(0);
    expect(r.sortie).toContain("noyau-vers-domaine");
  });

  it("T0-04 : une règle pure qui importe NestJS est rejetée (RI3)", { timeout: 60_000 }, () => {
    const r = depcruise("test/fixtures/boundaries/violations");
    expect(r.code).not.toBe(0);
    expect(r.sortie).toContain("pas-de-nestjs-dans-le-pur");
  });

  it(
    "T0-05 : un domaine qui importe un autre domaine est rejeté (RI1)",
    { timeout: 60_000 },
    () => {
      const r = depcruise("test/fixtures/boundaries/violations");
      expect(r.code).not.toBe(0);
      expect(r.sortie).toContain("domaines-isoles");
    },
  );
});
