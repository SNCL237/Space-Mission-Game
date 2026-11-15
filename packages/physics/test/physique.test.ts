import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  G_SI,
  LUNE,
  MASSE_LUNE,
  capaciteBatterieMin,
  contactSol,
  dureeEclipseMaxMin,
  echantillonnerOrbiteCirculaire,
  fractionEclipseMax,
  muDepuisGxM,
  periode,
  positionOrbiteCirculaire,
  tsiolkovski,
  vitesseCirculaire,
} from "../src/index.js";
import type { PositionOrbiteKm } from "../src/orbite.js";

// Les références de l'annexe B vérifient les formules de conception ; T7-08
// compare séparément la propagation à une fixture générée par GMAT.

describe("physics — valeurs de référence (annexe B)", () => {
  it("T1-04 : μ constant vs G × M de la fiche NSSDC (écart ≤ 0,05 %)", () => {
    const gm = muDepuisGxM();
    const ecartRelatif = Math.abs(gm - LUNE.muKm3s2) / LUNE.muKm3s2;
    expect(ecartRelatif).toBeLessThanOrEqual(0.0005); // critère : ≤ 0,05 %
    expect(ecartRelatif).toBeLessThan(0.0001); // valeur calculée : 0,003 %
    expect(gm).toBeCloseTo(4902.94, 2); // annexe B : 4 902,94 km³/s²
    expect(G_SI.source).not.toBe("");
    expect(MASSE_LUNE.urlSource).toContain("nssdc.gsfc.nasa.gov");
  });

  it("T1-05 : periode(Lune, 50 km) entre 105 et 125 min (≈ 2 h, cohérent LRO)", () => {
    const minutes = periode(50) / 60;
    expect(minutes).toBeGreaterThanOrEqual(105);
    expect(minutes).toBeLessThanOrEqual(125);
    expect(minutes).toBeCloseTo(113.0, 0); // valeur calculée : 113,0 min
  });

  it("T1-06 : periode(Lune, 100 km) = 7 065,7 s ± 0,5 % ; vitesse circulaire annexe B", () => {
    // HYPOTHESE (Q-05) : sans GMAT, on garde la tolérance provisoire du PLAN (± 0,5 %) ;
    // la tolérance fixtures GMAT (provisoire : 1 km sur une position) s'appliquera en P7.
    const t = periode(100);
    expect(Math.abs(t - 7065.7)).toBeLessThanOrEqual(7065.7 * 0.005);
    expect(vitesseCirculaire(100)).toBeCloseTo(1.6336, 3); // annexe B : 1,6336 km/s
  });

  it("T1-07 : fraction d'éclipse géométrique maximale (soleil dans le plan orbital)", () => {
    const f100 = fractionEclipseMax(100);
    expect(Math.abs(f100 - 0.3945)).toBeLessThanOrEqual(0.002);
    expect(Math.abs(dureeEclipseMaxMin(100) - 46.5)).toBeLessThanOrEqual(0.2);

    const f50 = fractionEclipseMax(50);
    expect(Math.abs(f50 - 0.4245)).toBeLessThanOrEqual(0.002);
    expect(Math.abs(dureeEclipseMaxMin(50) - 48.0)).toBeLessThanOrEqual(0.2);

    expect(Math.abs(fractionEclipseMax(200) - 0.3541)).toBeLessThanOrEqual(0.002);
  });

  it("T1-08 : capaciteBatterieMin (valeurs de test, pas du catalogue)", () => {
    // 96 W, fractionEclipse 0,35, T à 100 km (7 065,7 s), DoD 0,5, η 0,9 → 146,5 Wh.
    const capacite = capaciteBatterieMin(96, 0.35, 7065.7, 0.5, 0.9);
    expect(Math.abs(capacite - 146.5)).toBeLessThanOrEqual(0.1);
  });

  it("T1-09 : contactSol avec ε = 10° à 100 km (A4 tel qu'écrit)", () => {
    const contact = contactSol(100, 10);
    expect(Math.abs(contact.lambdaDeg - 11.38)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(contact.dureeMaxMin - 7.44)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(contact.dureeMoyenneMin - 4.47)).toBeLessThanOrEqual(0.02);

    // Contrôle annexe B à 50 km : contact max 4,28 min ; moyen ≈ 2,6 min → écart A4 vs
    // LRO (~6 passes d'~1 h/jour) consigné en Q-01 (T1-10).
    const contact50 = contactSol(50, 10);
    expect(Math.abs(contact50.dureeMaxMin - 4.28)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(contact50.dureeMoyenneMin - 2.6)).toBeLessThanOrEqual(0.1);
  });

  it("T1-11 : tsiolkovski(200 kg, 1 000 m/s, Isp 300 s, marge 0) = 80,96 kg", () => {
    const carburant = tsiolkovski(200, 1000, 300, 0);
    expect(Math.abs(carburant - 80.96)).toBeLessThanOrEqual(0.01);
    expect(tsiolkovski(200, 0, 300, 0)).toBe(0); // Δv = 0 ⇒ 0
    expect(tsiolkovski(200, 1000, 300, 0.2)).toBeGreaterThan(carburant); // croissant en margeDv
    expect(tsiolkovski(200, 1500, 300, 0)).toBeGreaterThan(carburant); // croissant en Δv
  });

  it("T7-07 : propage et échantillonne une orbite circulaire périodique", () => {
    const tempsPeriode = periode(100);
    const depart = positionOrbiteCirculaire(100, 90, 0);
    const apresPeriode = positionOrbiteCirculaire(100, 90, tempsPeriode);
    const points = echantillonnerOrbiteCirculaire(100, 90, 360);

    expect(Math.hypot(depart.xKm, depart.yKm, depart.zKm)).toBeCloseTo(LUNE.rayonKm + 100, 8);
    expect(apresPeriode.xKm).toBeCloseTo(depart.xKm, 8);
    expect(apresPeriode.yKm).toBeCloseTo(depart.yKm, 8);
    expect(apresPeriode.zKm).toBeCloseTo(depart.zKm, 8);
    expect(points).toHaveLength(360);
  });

  it("T7-08 : reste à moins d'un kilomètre de la référence GMAT après un tour", () => {
    const reference = JSON.parse(
      readFileSync(new URL("./fixtures/orbite-circulaire-gmat.json", import.meta.url), "utf8"),
    ) as { tempsS: number; positionKm: PositionOrbiteKm; toleranceKm: number };
    const calculee = positionOrbiteCirculaire(100, 90, reference.tempsS);
    const ecartKm = Math.hypot(
      calculee.xKm - reference.positionKm.xKm,
      calculee.yKm - reference.positionKm.yKm,
      calculee.zKm - reference.positionKm.zKm,
    );

    expect(ecartKm).toBeLessThan(reference.toleranceKm);
  });
});
