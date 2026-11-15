# Domaine PED

PED rend les codes d'explication C7 en français et en anglais, sans placer de
texte joueur dans les moteurs. Les gabarits indiquent une cause et une piste
de correction ; les valeurs chiffrées restent dans les paramètres structurés.

`CODES_EXPLICATION_TOUTES` est le registre source. Le test du domaine vérifie
que chaque code possède un rendu bilingue sans paramètre non résolu et que les
phrases restent courtes. Le domaine expose également un glossaire bilingue.

Commandes :

- `pnpm --filter @smdg/pedagogie test`
- `pnpm --filter @smdg/pedagogie typecheck`
- `pnpm --filter @smdg/pedagogie build`
