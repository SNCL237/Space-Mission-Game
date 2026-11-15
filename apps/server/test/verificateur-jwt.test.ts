import { UnauthorizedException } from "@nestjs/common";
import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";

import { validerConfiguration } from "../src/infra/config.zod.js";
import { VerificateurJwt } from "../src/infra/verificateur-jwt.js";

const SECRET = "a-test-secret-long-enough-for-hs256";
const UTILISATEUR_ID = "11111111-1111-4111-8111-111111111111";

function verifier(secret = SECRET): VerificateurJwt {
  return new VerificateurJwt(
    validerConfiguration({
      CORS_ORIGINS: "http://localhost:5173",
      JWT_SECRET: secret,
    }),
  );
}

async function signer(
  charges: Record<string, unknown> = { role: "joueur" },
  cle = new TextEncoder().encode(SECRET),
): Promise<string> {
  return new SignJWT(charges)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(UTILISATEUR_ID)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(cle);
}

describe("VerificateurJwt", () => {
  it("requires a sufficiently long HMAC secret", () => {
    expect(() =>
      validerConfiguration({
        CORS_ORIGINS: "http://localhost:5173",
        JWT_SECRET: "trop-court",
      }),
    ).toThrow(/JWT_SECRET/);
  });

  it("verifies the signature and required identity claims", async () => {
    const jeton = await signer();

    await expect(verifier().verifier(jeton)).resolves.toEqual({
      utilisateurId: UTILISATEUR_ID,
      role: "joueur",
    });
  });

  it("rejects expired, wrongly signed, or unsupported-role tokens", async () => {
    const cle = new TextEncoder().encode(SECRET);
    const expire = await new SignJWT({ role: "joueur" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(UTILISATEUR_ID)
      .setIssuedAt(1)
      .setExpirationTime(2)
      .sign(cle);
    const mauvaisRole = await signer({ role: "root" });

    await expect(verifier().verifier(expire)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      verifier("a-different-long-secret-for-hs256").verifier(await signer()),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(verifier().verifier(mauvaisRole)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
