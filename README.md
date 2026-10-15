# OnJoueQuand

Application web progressive privée pour aider un groupe de 6 à 15 amis et collègues à organiser ses sessions de jeu : renseigner ses disponibilités, trouver un créneau commun, voter, puis confirmer sa participation.

**État du projet : cadrage documentaire J0 livré.** L'application, les migrations, les tests et les workflows de déploiement ne sont pas encore implémentés. Le plan produit et technique est approuvé ; les jalons applicatifs nécessitent une demande distincte.

## Le produit

- Un seul groupe privé, sur invitation nominative, avec comptes individuels et connexion par code e-mail.
- Disponibilités hebdomadaires rapides ou détaillées, copie des semaines et calendrier collectif.
- Suggestions de créneaux communs, catalogue de jeux manuel et favoris personnels.
- Propositions à plusieurs créneaux, votes multiples, confirmation manuelle et RSVP explicites.
- Rappels ciblés le dimanche et le lundi à 18 h, notifications internes et Web Push.
- Installation sur iOS, Android et ordinateur ; interface française, sombre, avec des accents violets discrets.

Les quatre onglets sont **Accueil**, **Dispos**, **Sessions** et **Groupe**. Le fuseau de référence est **Europe/Paris**. « Premium » désigne l'expérience visuelle, sans abonnement ni paiement.

Les statistiques et sondages sont prévus après le MVP. Les groupes multiples, le matchmaking public et la facturation sont hors périmètre.

## Documentation

| Document | Rôle |
| --- | --- |
| [Exigences produit](docs/product-requirements.md) | Parcours, exigences identifiées, MVP, règles métier et critères de réussite. |
| [Architecture](docs/architecture.md) | Stack, structure cible, interfaces, matching, notifications, PWA, tests et exploitation. |
| [Modèle de données](docs/database.md) | Relations, contraintes, transactions, états et autorisations RLS. |
| [Feuille de route](docs/roadmap.md) | Jalons J0–J9, dépendances, acceptation, tests et conditions de lancement. |
| [Décisions d'architecture](docs/decisions/README.md) | Neuf ADR acceptées, leur contexte et leurs conséquences. |
| [Consignes de contribution](AGENTS.md) | Règles applicables aux futurs changements du dépôt. |

## Stack retenue

Monolithe modulaire Next.js App Router, TypeScript strict, Tailwind CSS et shadcn/ui ; Supabase Auth, PostgreSQL et RLS ; Web Push/VAPID ; Vercel ; Vitest, Playwright et GitHub Actions.

Les repères de versions du plan approuvé sont Node.js 24 LTS, Next.js 16.4, React 19.3 et Tailwind CSS 4.3. **Ce ne sont pas des dépendances installées ou une matrice de compatibilité testée.** J1 vérifiera les versions stables, les correctifs et les contraintes de compatibilité avant de les verrouiller avec npm. Voir la [politique de versions](docs/architecture.md#stack-et-versions).

## Développement local — à venir en J1

Il n'existe actuellement ni `package.json`, ni commande de lancement, ni environnement Supabase dans ce dépôt. Ne pas lancer une installation en supposant le socle déjà présent.

J1 documentera les commandes réellement créées pour :

1. Installer les dépendances avec `npm ci` depuis le lockfile versionné.
2. Configurer un fichier d'environnement local à partir d'un exemple sans secrets.
3. Démarrer Supabase local avec Docker et appliquer les migrations et données synthétiques.
4. Démarrer Next.js et consulter les e-mails de test dans la boîte locale.
5. Exécuter lint, typage, tests, tests RLS et build.

Les données métier seront privées ; aucun secret serveur ni export de données personnelles ne doit être commité. Les réglages de production, sauvegardes et procédures de restauration seront vérifiés avant le pilote J8.

## Prochaine étape

La [feuille de route](docs/roadmap.md) constitue le contrat de livraison. J1 prépare le socle ; J2 démarre les fonctionnalités de comptes et de groupe. Le périmètre de cette livraison reste documentaire.
