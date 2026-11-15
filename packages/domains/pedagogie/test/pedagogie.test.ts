import { CODES_EXPLICATION_TOUTES } from "@smdg/contracts";
import { describe, expect, it } from "vitest";

import { rendreExplication, verifierCouvertureExplications } from "../src/domain/explications.js";

describe("PED — registre bilingue", () => {
  it("couvre tous les codes référencés par les contrats", () => {
    expect(verifierCouvertureExplications()).toEqual([]);
    for (const code of CODES_EXPLICATION_TOUTES) {
      for (const langue of ["fr", "en"] as const) {
        const rendu = rendreExplication(code, langue);
        expect(Object.values(rendu).every((texte) => texte.length > 0)).toBe(true);
        expect(Object.values(rendu).some((texte) => /\{[^}]+\}/.test(texte))).toBe(false);
        expect(Object.values(rendu).some((texte) => /undefined/i.test(texte))).toBe(false);
        expect(Object.values(rendu).every((texte) => texte.split(/\s+/).length <= 25)).toBe(true);
        for (const texte of Object.values(rendu)) {
          if (/\b\d+(?:[.,]\d+)?\b/.test(texte)) {
            expect(texte).toMatch(/(?:\b(?:kg|g|m|km|s|h|W|Wh|MUSD|Gbit)\b|°|%)/i);
          }
        }
      }
    }
  });

  it("fournit une explication et une action courtes dans les deux langues", () => {
    for (const langue of ["fr", "en"] as const) {
      const rendu = rendreExplication("MASSE_DEPASSE", langue);
      expect(rendu.explication.split(/\s+/).length).toBeLessThanOrEqual(25);
      expect(rendu.piste.split(/\s+/).length).toBeLessThanOrEqual(25);
    }
  });
});
