import { randomUUID } from "node:crypto";
import { hashSync } from "bcryptjs";

import { describe, expect, it } from "vitest";

import { DepotIdentiteTypeorm, creerDataSourceIdentite } from "../src/index.js";
import type { CompteIdentite } from "../src/domain/types.js";

function codeErreur(cause: unknown): string | undefined {
  if (typeof cause !== "object" || cause === null) return undefined;
  const detail = "driverError" in cause ? cause.driverError : cause;
  if (
    typeof detail !== "object" ||
    detail === null ||
    !("code" in detail) ||
    typeof detail.code !== "string"
  ) {
    return undefined;
  }
  return detail.code;
}

async function postgresDisponible(): Promise<boolean> {
  const source = creerDataSourceIdentite();
  try {
    await source.initialize();
    await source.query("SELECT 1");
    return true;
  } catch (cause) {
    if (
      ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EHOSTUNREACH"].includes(codeErreur(cause) ?? "")
    ) {
      return false;
    }
    throw cause;
  } finally {
    if (source.isInitialized) await source.destroy();
  }
}

const pg = await postgresDisponible();

describe.skipIf(!pg)("IDE — persistance PostgreSQL", () => {
  it("crée, relit et met à jour un profil C8 sans stocker de secret en clair", async () => {
    const depot = new DepotIdentiteTypeorm();
    const source = creerDataSourceIdentite();
    const id = randomUUID();
    const pseudo = `inv-${id.slice(0, 8)}`;
    const compte: CompteIdentite = {
      id,
      pseudo,
      identifiantNormalise: pseudo.toLowerCase(),
      motDePasseHash: hashSync("secret-test-only", 4),
      langue: "fr",
      invite: false,
    };
    try {
      expect(await depot.creer(compte)).toBe(true);
      expect(await depot.creer(compte)).toBe(false);
      expect(await depot.trouverParIdentifiant(pseudo.toLowerCase())).toMatchObject({
        id,
        motDePasseHash: compte.motDePasseHash,
      });
      expect(await depot.definirLangue(id, "en")).toBe(true);
      expect(await depot.trouverParId(id)).toMatchObject({
        langue: "en",
        pseudo,
      });
    } finally {
      await depot.onModuleDestroy();
      await source.initialize();
      await source.query(`DELETE FROM "ide"."compte" WHERE "utilisateur_id" = $1`, [id]);
      await source.destroy();
    }
  });
});
