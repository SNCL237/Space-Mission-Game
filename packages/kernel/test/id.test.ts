import { describe, expect, it } from "vitest";
import { estId, nouvelId, REGEX_ID_V4, versId } from "../src/id.js";

describe("kernel — identifiants (Id)", () => {
  it("nouvelId() produit un UUID v4 unique", () => {
    const a = nouvelId();
    const b = nouvelId();
    expect(REGEX_ID_V4.test(a)).toBe(true);
    expect(a).not.toBe(b);
  });

  it("estId() accepte un UUID v4 et refuse tout autre texte", () => {
    expect(estId(nouvelId())).toBe(true);
    expect(estId("pas-un-uuid")).toBe(false);
    expect(estId("2468a1c2-1234-1321-8765-fedcba987654")).toBe(false); // version ≠ 4
    expect(estId(42)).toBe(false);
  });

  it("versId() convertit un UUID v4 valide et lève une erreur sinon", () => {
    const id = nouvelId();
    expect(versId(id)).toBe(id);
    expect(() => versId("invalide")).toThrow(/UUID v4/);
  });
});
