# THE LAST LIGHT — Front (P01 Menu principal)

React + TypeScript + Vite. Architecture **MVVM**, dépendances orientées vers le domaine.

```
View (React, sans logique) → ViewModel (Store observable) → Ports (domain/ports.ts) ← Adaptateurs (data/)
```

| Couche | Fichiers | Rôle |
|---|---|---|
| Model | `domain/campaign.ts`, `domain/ports.ts` | Types métier ; interfaces `CampaignRepository`, `CapabilitiesProvider`, `Navigator` |
| ViewModel | `features/menu/MenuViewModel.ts` | État et règles de l'écran (Continuer disponible ? confirmation d'écrasement ? erreurs) ; testable sans React ni DOM |
| View | `features/menu/MenuView.tsx` | Affichage, accessibilité, délégation des actions |
| Adaptateurs | `data/*` | HTTP (backend), local (démo/hors ligne), WebGL, navigation hash |
| Composition | `app/container.ts` | **Seul** endroit qui choisit les implémentations |

## Lancer
    npm install && cp .env.example .env && npm run dev

## Brancher le backend
1. Renseigner `VITE_API_URL` (ex. `http://localhost:3000/api`) et `VITE_USE_MOCK=0` dans `.env`.
2. Contrat attendu par `HttpCampaignRepository` (**à aligner avec les contrats du backend**) :

| Appel | Réponse |
|---|---|
| `GET {API}/campaigns/latest` | `200` `{ "id": string, "current_act": 0..6, "mode": "guided"\|"standard"\|"expert", "updated_at": ISO-8601 }` ; `404`/`204` = aucune sauvegarde |

3. Si les noms de champs diffèrent, ne modifier que `toDomain()` dans `HttpCampaignRepository.ts`.
4. Authentification : `credentials: 'include'` (cookies) ; pour un jeton, ajouter l'en-tête dans l'adaptateur.
5. CORS : le backend doit autoriser l'origine du front avec les cookies.

## Ajouter une page
Créer `features/<page>/<Page>ViewModel.ts` + `<Page>View.tsx`, déclarer ses ports dans `domain/ports.ts`, l'instancier dans `container.ts`, puis l'ajouter aux routes de `App.tsx`.

## Notes
- `src/styles.css` reprend les jetons de la section 14 du document d'architecture (CSS simple ; migration Tailwind possible via les variables).
- `.scene` est l'emplacement de la scène Three.js ; le fond CSS sert de repli 2D.
- Chaînes en français codées dans la View : à extraire vers `i18n/` (FR/EN) à l'ajout de la 2ᵉ page.

## P02 — Choix du mode (`features/mode/`)
`ModeSelectionViewModel` : sélection obligatoire avant « Confirmer », pas de double validation, erreurs réseau affichées. Navigation : `/mode` → `/campagne/prologue`.

| Appel | Corps / réponse |
|---|---|
| `POST {API}/campaigns` | corps `{ "mode": "guided"\|"standard"\|"expert" }` ; `201` même forme que `GET /campaigns/latest` (nouvelle campagne à l'acte 0) |

Les routes `/mode` et `/` créent un ViewModel neuf à chaque visite (l'écran se recharge au retour).
