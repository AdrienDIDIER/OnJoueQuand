# OnJoueQuand

Application web progressive privée pour aider un groupe de 6 à 15 amis et collègues à organiser ses sessions de jeu.

**J0 est commité. Le socle J1 est implémenté : Next.js, quatre onglets en français, thème sombre, environnement Supabase local, tests et CI.** Les écrans de ce socle sont publics et ne contiennent aucune donnée personnelle. L'authentification et les fonctionnalités métier commencent en J2 : ne pas connecter des données privées avant leurs contrôles serveur et RLS.

## Démarrer

Prérequis : **Node.js 24 LTS**, **npm 11.21.1** et, pour Supabase uniquement, Docker Desktop avec moteur Linux démarré. La version Node est déclarée dans `.nvmrc` et `package.json`. Les versions exactes et résultats figurent dans le [rapport J1](docs/j1-validation.md).

```sh
npm ci
npm run dev
```

Ouvrir [l'application locale](http://127.0.0.1:3000). La racine redirige vers `/accueil`. Les onglets Dispos, Sessions et Groupe présentent les capacités à venir, sans faux membres, statistiques ou actions métier simulées.

Le shell fonctionne sans Supabase. Pour personnaliser l'origine ou préparer sa connexion, copier `.env.example` vers `.env.local` (PowerShell : `Copy-Item .env.example .env.local`). Les deux variables publiques Supabase sont facultatives ensemble pour J1, mais une paire partielle ou une clé secrète est refusée. La future couche de données devra appeler `requireSupabaseConfig` pour les exiger.

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

`npm run db:reset` réinitialise exclusivement la base locale de ce projet ; cette commande efface ses données locales. Le seed J1 ne crée aucun compte ni table métier. Les inscriptions ouvertes sont désactivées. Les migrations et tests RLS seront ajoutés avec J2.

`npm run db:stop` arrête les services locaux du projet en conservant leurs données. Aucun projet Supabase distant, SMTP réel ou déploiement n'est configuré.

## Vérifier

```sh
npm run check
npx playwright install chromium firefox webkit
npm run test:e2e
```

`check` exécute le lint sans avertissement, le typage strict, Vitest et le build de production. Playwright démarre automatiquement ce build sur le port **3100**, puis arrête son serveur ; ce port doit être libre. Sous Linux, installer les dépendances système avec `npx playwright install --with-deps chromium firefox webkit`.

| Commande | Fonction |
| --- | --- |
| `npm run lint` | Règles Next.js/TypeScript. |
| `npm run typecheck` | Génération des types de routes et contrôle TypeScript. |
| `npm test` | Validation des variables et refus des configurations dangereuses. |
| `npm run test:watch` | Vitest interactif. |
| `npm run build` | Build de production. |
| `npm run start` | Serveur local de production après build. |
| `npm run test:e2e` | Navigation, français, responsive, clavier, page 404 et captures. |

La [CI](.github/workflows/ci.yml) sépare qualité/parcours et démarrage/réinitialisation Supabase. Elle ne déploie rien et n'utilise aucun secret de production. Le [rapport J1](docs/j1-validation.md) distingue les vérifications locales de l'exécution GitHub distante, non encore réalisée.

## Produit et documentation

Quatre onglets : **Accueil**, **Dispos**, **Sessions**, **Groupe**. Fuseau : **Europe/Paris**. Le mode rapide prévu correspond à 20 h–23 h. Les futures suggestions partent de deux joueurs pendant une heure ; vote favorable et RSVP resteront distincts.

| Document | Contenu |
| --- | --- |
| [Exigences produit](docs/product-requirements.md) | Parcours, MVP, règles et fonctions différées. |
| [Architecture](docs/architecture.md) | Organisation, contrats, matching, notifications, PWA et exploitation. |
| [Modèle de données](docs/database.md) | Relations, contraintes, états et matrice RLS à implémenter. |
| [Feuille de route](docs/roadmap.md) | J0–J9, dépendances, acceptation et tests. |
| [Décisions](docs/decisions/README.md) | Neuf ADR acceptées. |
| [Validation J1](docs/j1-validation.md) | Versions installées, preuves et réserves. |
| [Consignes de contribution](AGENTS.md) | Règles de changement et sécurité. |

La PWA installable, les notifications et les données privées sont prévues aux jalons suivants. Aucune facturation : « premium » décrit l'expérience. Les statistiques et sondages sont différés après le MVP.
