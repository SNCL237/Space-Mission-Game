# Space Mission Design Game — backend (monorepo pnpm)

Serveur NestJS (`apps/server`) et domaines (`packages/domains/*`) de THE LAST LIGHT.

```bash
pnpm install
docker compose up -d          # PostgreSQL 16 sur le port 5433
pnpm build && pnpm test
CORS_ORIGINS=http://localhost:5173 JWT_SECRET=<au moins 32 caractères> pnpm --filter @smdg/server start
```

Documentation du serveur et des routes : `apps/server/README.md` · OpenAPI : `/docs`.
Audit d'intégration avec le frontend : `AUDIT_FRONT_BACK.md`.

> Les fichiers de l'ancien frontend P01/P02, mélangés à la racine de ce dépôt, ont été déplacés dans
> `_ancien-frontend/` (à supprimer : le frontend vit dans son propre projet).

## Démarrage sous Windows (invite de commandes)

Prérequis : Node.js 20 ou plus récent, et Docker Desktop.

```bat
corepack enable
corepack prepare pnpm@10.28.0 --activate
pnpm install
docker compose up -d
pnpm build
```

1. Ouvrez `demarrer-serveur.cmd` et `amorcer.cmd`, puis mettez **la même** valeur de `JWT_SECRET` dans les deux (32 caractères minimum).
2. Lancez `demarrer-serveur.cmd`. Le serveur écoute sur http://localhost:3000, la documentation est sur http://localhost:3000/docs.
3. **Une seule fois**, dans une deuxième fenêtre : `amorcer.cmd` (importe le catalogue et les scénarios).
4. Frontend : dans son dossier, créez `.env` avec `VITE_API_URL=http://localhost:3000/api`, puis lancez `npm install` et `npm run dev`.

Tests : `pnpm test` (exige PostgreSQL démarré ; sans base, les tests qui en ont besoin sont ignorés).
