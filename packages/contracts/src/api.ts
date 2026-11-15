// Clés de métadonnées des routes API (Agent.md §11) — couche transverse,
// ajoutée en P2 pour les routes d'administration (F2.10, T2-16). Aucune
// dépendance NestJS ici : `Reflector` lit cette clé de littéral.

/** Clé de métadonnée portant les rôles requis par une route (`@SetMetadata`). */
export const ROLES_KEY = "smdg_roles";

/**
 * Rôles de l'API. HYPOTHESE (P2) : en-tête de test `x-role: admin|joueur`
 * — substitut provisoire de l'authentification JWT (P6) ; seul `lireRole()`
 * de la garde sera remplacé alors.
 */
export type RoleApi = "admin" | "joueur";
