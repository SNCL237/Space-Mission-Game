// Amorçage : importe le catalogue et les scénarios dans la base, via l'API du serveur déjà démarré.
// Signe un jeton administrateur éphémère avec JWT_SECRET (le même que celui du serveur).
// Usage : node apps/server/scripts/amorcer.mjs   (variables : JWT_SECRET, API_URL facultatif)
import { SignJWT } from "jose";

const secret = process.env.JWT_SECRET;
const api = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 3000}/api`;
if (!secret || secret.length < 32) {
  console.error("JWT_SECRET manquant ou trop court (32 caractères minimum, le même que le serveur).");
  process.exit(1);
}
const jeton = await new SignJWT({ role: "admin" })
  .setProtectedHeader({ alg: "HS256" })
  .setSubject(crypto.randomUUID())
  .setIssuedAt()
  .setExpirationTime("10m")
  .sign(new TextEncoder().encode(secret));

for (const route of ["/catalogue/import", "/scenarios/import"]) {
  let reponse;
  try {
    reponse = await fetch(api + route, { method: "POST", headers: { Authorization: `Bearer ${jeton}` } });
  } catch {
    console.error(`Serveur injoignable sur ${api} : démarrez-le d'abord.`);
    process.exit(1);
  }
  console.log(route, reponse.status, await reponse.text());
  if (!reponse.ok) process.exit(1);
}
console.log("Amorçage terminé : catalogue 1.2.0 et scénarios importés.");
