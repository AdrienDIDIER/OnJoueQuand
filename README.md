# OnJoueQuand

Application web progressive privée pour aider un groupe de 6 à 15 amis et collègues à organiser ses sessions de jeu.

**J0 à J5 sont commités séparément ; J5 porte le commit `52f8c18`. J6 ajoute notifications privées, préférences, Web Push et rappels dimanche/lundi.** J6 reste non commité. Le cron est désactivé par défaut ; les clés et la réception Push sur appareils réels restent à configurer/valider. Voir le [rapport J6](docs/j6-validation.md) et le [guide d’exploitation](docs/notifications-operations.md).

## Démarrer

Prérequis : **Node.js 24 LTS**, **npm 11.21.1** et, pour Supabase uniquement, Docker Desktop avec moteur Linux démarré. La version Node est déclarée dans `.nvmrc` et `package.json`. Les versions exactes et résultats figurent dans le [rapport J1](docs/j1-validation.md).

```sh
npm ci
npm run db:start
npm run db:migrate
npm run env:local
npm run dev
```

Ouvrir [l'application locale](http://127.0.0.1:3000). Sans session, les quatre onglets redirigent vers `/connexion`. Le script `env:local` crée `.env.local` depuis la configuration locale sans afficher les clés ; il refuse d'écraser un fichier existant.

Pour initialiser une base locale neuve, définir `BOOTSTRAP_EMAIL` avec une adresse synthétique en `@example.test` et `BOOTSTRAP_NAME`, puis lancer `npm run bootstrap:local`. Exemple PowerShell :

```powershell
$env:BOOTSTRAP_EMAIL = 'admin@example.test'
$env:BOOTSTRAP_NAME = 'Administrateur local'
npm run bootstrap:local
```

Demander ensuite un code sur `/connexion` et le consulter dans la boîte e-mail locale. Le bootstrap refuse une installation possédant déjà des adhésions. Il ne confirme pas l'adresse et n'envoie aucun message réel. Après des tests d'intégration, la base contient des comptes synthétiques : utiliser une base locale réinitialisée pour ce bootstrap (la réinitialisation efface les données locales).

Les variables serveur `SUPABASE_SECRET_KEY` et `AUTH_RATE_LIMIT_SECRET` ne doivent jamais recevoir de préfixe `NEXT_PUBLIC`. La seconde contient au moins 32 caractères aléatoires. Sans configuration Supabase, seule une page de connexion indisponible est présentée : aucun accès de secours au groupe.

## Supabase local

```sh
npm run db:start
npm run db:status
```

| Service | Adresse locale |
| --- | --- |
| API | http://127.0.0.1:55321 |
| PostgreSQL | Port 55322 |
| Studio | http://127.0.0.1:55323 |
| Boîte e-mail de test | http://127.0.0.1:55324 |

Les ports 55320–55324 évitent un conflit constaté avec un autre projet local utilisant les ports standards. Copier uniquement l'URL locale et la clé **publiable** dans les variables `NEXT_PUBLIC_SUPABASE_*` du fichier ignoré `.env.local`. Ne jamais y mettre la clé secrète ou `service_role`, ni copier la sortie complète de status dans les logs/commits.

`npm run db:reset` réinitialise exclusivement la base locale de ce projet ; cette commande efface ses données locales. La migration J2 crée groupe, profils, adhésions, invitations et fonctions sécurisées ; le seed ne crée aucun compte. Les inscriptions publiques sont désactivées ; le fournisseur e-mail reste actif pour connecter les comptes provisionnés.

Pour mettre à jour une installation J2 existante, lancer `npm run db:migrate` : cette commande applique les migrations locales manquantes en conservant les données. J3 ajoute les journées, intervalles, contraintes et RPC de disponibilités. Ne pas utiliser `db:reset` pour une simple mise à jour.

La migration J4 ajoute les jeux, favoris et commandes sécurisées avec la même procédure, sans supprimer les données existantes.

Les migrations J5 ajoutent sessions, créneaux, bulletins, votes, RSVP, époque de participation et outbox privée. J6 ajoute notifications, préférences, appareils, livraisons et traitement avec bail. Appliquer avec `npm run db:migrate`, sans effacer les données. Le cron créé reste inactif jusqu’à configuration et activation explicites. `npm run test:sessions` et `npm run test:notifications` exigent des comptes et une base de recette synthétiques.

`npm run db:stop` arrête les services locaux du projet en conservant leurs données. Aucun projet Supabase distant, SMTP réel ou déploiement n'est configuré.

## Vérifier

La suite SQL exige une **base de recette dédiée** : elle initialise Auth et simule des dates de rappel. Les commandes de reset ci-dessous effacent les données de cette base. Ne pas les exécuter sur votre installation utilisateur à conserver. Les rapports de validation décrivent les bases isolées utilisées pour la recette.

```sh
npm run check
npm run db:reset
npm run test:integration
npx playwright install chromium firefox webkit
npm run test:e2e
```

`check` exécute le lint sans avertissement, le typage strict, Vitest et le build de production. La suite d'intégration exige une base locale neuve et crée des comptes synthétiques ; elle interrompt brièvement puis redémarre le SMTP local pour tester une panne. Playwright réutilise l'administrateur de cette suite, injecte uniquement les clés locales en mémoire et démarre le build sur le port **3100**, puis arrête son serveur. Sous Linux, installer les dépendances système avec `npx playwright install --with-deps chromium firefox webkit`. Aucun de ces scripts de test n'accepte un projet distant.

| Commande | Fonction |
| --- | --- |
| `npm run lint` | Règles Next.js/TypeScript. |
| `npm run typecheck` | Génération des types de routes et contrôle TypeScript. |
| `npm test` | Validation des variables et refus des configurations dangereuses. |
| `npm run test:watch` | Vitest interactif. |
| `npm run build` | Build de production. |
| `npm run start` | Serveur local de production après build. |
| `npm run test:e2e` | Navigation, OTP, invitation, profil et révocation sur quatre projets navigateur. |
| `npm run test:integration` | Auth, RLS, transactions concurrentes et panne SMTP sur Supabase local. |
| `npm run test:availability` | Scénarios SQL/RLS J3 avec fixtures isolées et nettoyées ; compatible avec une base locale existante. |
| `npm run test:games` | Droits, archivage, favoris et concurrence J4 avec fixtures isolées et nettoyées. |
| `npm run db:migrate` | Appliquer les migrations locales manquantes en préservant les données. |
| `npm run db:types` | Générer les types depuis la base locale ; enregistrer la sortie dans `src/lib/supabase/database.types.ts`. |

La [CI](.github/workflows/ci.yml) exécute qualité, démarrage/réinitialisation Supabase, intégration et parcours, puis arrête les services même en cas d'échec. Elle ne déploie rien et n'utilise aucun secret de production. Son exécution distante reste à vérifier après un push autorisé.

## Renseigner ses disponibilités

Dans **Dispos**, choisir la semaine puis ouvrir une journée. Le mode rapide « Disponible » matérialise **20 h–23 h**, heure de Paris. Le mode détaillé accepte plusieurs intervalles par pas de quinze minutes ; « Fin le lendemain » découpe la nuit sur les deux journées. L'aperçu indique chaque réponse remplacée avant confirmation. Les journées « Indisponible » et « Sans réponse » restent distinctes ; sept réponses explicites rendent la semaine complète.

La semaine courante et les trois suivantes sont modifiables ; les douze semaines précédentes sont consultables et copiables. Pour copier, afficher la semaine cible, choisir une source et prévisualiser : les réponses existantes sont conservées par défaut. Cocher le remplacement pour les écraser explicitement. Les horaires locaux sont conservés à travers les changements d'heure. Une heure inexistante doit être corrigée et une heure répétée désambiguïsée avant confirmation. Un aperçu expiré ou une source/cible modifiée exige un nouvel aperçu.

Le calendrier collectif affiche les réponses des membres actifs. La mise à jour intervient après enregistrement, navigation ou rechargement ; la synchronisation temps réel reste différée.

## Jeux et créneaux communs

Dans **Groupe**, chaque membre peut ajouter un jeu personnalisé et gérer ses favoris. Le créateur ou un administrateur peut modifier ou archiver un jeu ; l'archivage conserve l'historique. Une préférence ne garantit pas la possession du jeu. Les jeux archivés restent consultables via le filtre dédié et sont retirés des nouvelles recherches.

Dans **Dispos**, le lien **Créneaux communs** rejoint la recherche. Valeurs initiales : semaine affichée, membres actifs, deux joueurs, une heure. Ajuster période, durée, seuil, membres et jeu facultatif, puis lancer le calcul. Les critères restent affichés après recherche. Au plus dix propositions sont classées par nombre de joueurs disponibles pendant toute la durée, puis favoris du jeu choisi, puis horaire. Aucune session n'est confirmée automatiquement. Les RSVP positifs de sessions confirmées sont soustraits des disponibilités ; une annulation libère ce temps.

## Proposer et rejoindre une session

Dans **Sessions**, ouvrir **Proposer une session**, choisir de deux à six horaires futurs à Paris, puis enregistrer le brouillon et le publier. Chaque membre peut sélectionner tous les créneaux acceptables ; un bulletin vide signifie explicitement qu’aucun ne convient. Le créateur ou un administrateur choisit un créneau, avant ou après clôture. Un vote favorable ne devient jamais automatiquement une participation.

Après confirmation, répondre dans **Ma participation**. Les réponses restent modifiables jusqu’au début ; un engagement chevauchant une autre participation est refusé. L’accueil affiche la prochaine session du groupe. L’annulation conserve l’historique et libère les engagements. Après révocation puis nouvelle invitation, les anciennes réponses doivent être renouvelées.

## Notifications et rappels

Dans **Accueil**, la boîte affiche les vingt dernières notifications et permet de les marquer comme lues. Dans **Groupe → Mes notifications**, régler rappels et Push, puis activer volontairement les appareils personnels. Les messages Push restent génériques ; leur clic ouvre la boîte privée après connexion. Le service worker J6 ne met aucune donnée en cache et ne constitue pas encore la PWA installable de J7.

Le dimanche à 18 h vise la semaine suivante ; le lundi à 18 h relance la même semaine, uniquement si elle est encore incomplète. Le traitement recontrôle les préférences et réponses avant envoi, déduplique la boîte interne et reprend les baux interrompus. Aucun envoi ne démarre tant que le cron n’est pas activé ou la route interne appelée avec son secret. Sans VAPID, seules les notifications internes sont produites. Configuration et recette : [guide d’exploitation](docs/notifications-operations.md).

## Produit et documentation

Quatre onglets : **Accueil**, **Dispos**, **Sessions**, **Groupe**. Fuseau : **Europe/Paris**. Le mode rapide correspond à 20 h–23 h. Les suggestions partent de deux joueurs pendant une heure ; vote favorable et RSVP sont distincts.

| Document | Contenu |
| --- | --- |
| [Exigences produit](docs/product-requirements.md) | Parcours, MVP, règles et fonctions différées. |
| [Architecture](docs/architecture.md) | Organisation, contrats, matching, notifications, PWA et exploitation. |
| [Modèle de données](docs/database.md) | Relations, contraintes, états et matrice RLS ; état livré explicite. |
| [Feuille de route](docs/roadmap.md) | J0–J9, dépendances, acceptation et tests. |
| [Décisions](docs/decisions/README.md) | Choix acceptés, dont l'adaptation du premier code en J2. |
| [Validation J1](docs/j1-validation.md) | Versions installées, preuves et réserves. |
| [Validation J2](docs/j2-validation.md) | Sécurité, tests Auth/RLS, exploitation et limites. |
| [Validation J3](docs/j3-validation.md) | Disponibilités, temps de Paris, copie, concurrence et preuves. |
| [Validation J4](docs/j4-validation.md) | Catalogue, favoris, matching, benchmark et sécurité. |
| [Validation J5](docs/j5-validation.md) | Sessions, votes, confirmation, RSVP, concurrence et branchement du matching. |
| [Validation J6](docs/j6-validation.md) | Notifications privées, rappels, baux, transport Push et limites de recette. |
| [Consignes de contribution](AGENTS.md) | Règles de changement et sécurité. |

La PWA installable et la validation des appareils restent en J7. Aucune facturation : « premium » décrit l'expérience. Les statistiques et sondages sont différés après le MVP.
