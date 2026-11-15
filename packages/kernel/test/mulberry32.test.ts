import { describe, expect, it } from "vitest";
import { mulberry32, tirerMulberry32 } from "../src/mulberry32.js";

function suite(graine: number, n: number): number[] {
  const rng = mulberry32(graine);
  return Array.from({ length: n }, () => rng());
}

describe("kernel — mulberry32 (A6, RG3)", () => {
  it("T1-12 : même graine ⇒ mêmes 1 000 premières valeurs", () => {
    expect(suite(20261114, 1000)).toEqual(suite(20261114, 1000));
  });

  it("T1-12 : graines différentes ⇒ suites différentes", () => {
    expect(suite(1, 1000)).not.toEqual(suite(2, 1000));
  });

  it("T1-12 : toutes les valeurs sont dans [0 ; 1[", () => {
    const valeurs = suite(42, 1000);
    expect(valeurs.every((v) => v >= 0 && v < 1)).toBe(true);
  });

  it("la suite reste déterministe après re-création du générateur", () => {
    const premier = mulberry32(7);
    const second = mulberry32(7);
    for (let i = 0; i < 50; i += 1) expect(premier()).toBe(second());
  });

  it("l’état explicite produit la même suite que le générateur", () => {
    const generateur = mulberry32(17);
    let etat = 17;
    for (let index = 0; index < 100; index += 1) {
      const tirage = tirerMulberry32(etat);
      expect(tirage.valeur).toBe(generateur());
      etat = tirage.etat;
    }
  });
});
