# Domaine IDE

IDE conserve les profils minimaux C8 et les comptes dans le schéma `ide`.
L'inscription accepte un courriel facultatif ; un invité est créé côté serveur
sans courriel. Les mots de passe sont hachés avec bcryptjs et ne sont jamais
retournés dans les profils.

Les connexions acceptent un pseudo ou un courriel normalisé. Les erreurs de
connexion ne distinguent pas un compte absent d'un mot de passe erroné. Après
cinq échecs par minute pour la paire adresse IP + identifiant normalisé, le
service répond 429. Les échecs expirés sont purgés au prochain essai.

Les jetons HS256 sont signés par le port d'émission fourni par le serveur :
une heure pour un compte et trente jours pour un invité. La limitation de débit
est actuellement en mémoire du processus ; un déploiement multi-instance doit
la partager avant d'être considéré comme strictement conforme.

Commandes :

- `pnpm --filter @smdg/identite test`
- `pnpm --filter @smdg/identite typecheck`
- `pnpm --filter @smdg/identite build`
