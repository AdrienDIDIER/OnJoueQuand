# J3 — Disponibilités et calendrier

État au **21 octobre 2026**. J3 est livré dans un commit distinct à la suite de J2 (`5cac4e7`). Aucun push, déploiement, migration distante ni envoi réel n'a été effectué.

## Portée livrée

PR-03, PR-04 et PR-05 : trois états de réponse distincts, mode rapide 20 h–23 h, plusieurs intervalles détaillés, aperçu et confirmation, découpage nocturne atomique, complétude sur sept jours, navigation hebdomadaire, copie et calendrier des membres actifs. Les douze semaines précédentes sont consultables ; la semaine courante et les trois suivantes sont modifiables.

La copie préserve les horaires locaux ; seules les réponses manquantes sont remplies par défaut. Le remplacement est explicite. Une source sans réponse ne supprime pas une réponse cible. Les heures répétées exigent un choix par borne ; les heures inexistantes exigent une correction explicite, montrée dans le nouvel aperçu. Les réponses déjà enregistrées conservent leurs instants et leur occurrence lors d'une nouvelle édition. Le calendrier indique l'offset pour désambiguïser les horaires répétés.

L'adaptateur commun [paris.ts](../src/lib/time/paris.ts) utilise `@js-temporal/polyfill` **0.5.1**, version stable vérifiée et verrouillée. Le [domaine](../src/features/availability/domain.ts) n'importe ni React, ni Next.js, ni Supabase et reçoit l'heure en paramètre. Les bornes persistées sont des instants ; les identités de semaine et de journée restent des dates civiles de Paris.

## Sécurité et concurrence

La [migration J3](../supabase/migrations/202610200001_availability.sql) ajoute les deux tables RLS, leurs clés étrangères composites, l'exclusion GiST, le contrôle des bornes locales et du pas de quinze minutes, les triggers différés état/intervalles et la RPC `save_availability`. Les types Supabase sont régénérés depuis ce schéma.

Le propriétaire provient exclusivement du JWT. La RPC prend le verrou groupe puis adhésion, contrôle activité, horizon et révisions, et traite les journées dans l'ordre. Une copie vérifie aussi les sept révisions sources, y compris les journées absentes. Une création concurrente ou une édition après aperçu ne peut donc pas écraser une réponse. L'échec d'une journée annule toute la transaction.

L'aperçu signé est lié au compte et expire après dix minutes. Sa signature HMAC utilise le secret serveur existant avec un contexte distinct. Une altération, un autre acteur ou une expiration est refusé. La confirmation recontrôle la session et les droits, puis les contraintes SQL. Aucun brouillon privé n'est persisté côté navigateur. Voir [ADR 011](decisions/011-disponibilites-et-apercus.md).

## Vérifications effectuées

| Contrôle | Résultat |
| --- | --- |
| Migration sur la base J2 existante | Réussie avec `supabase migration up --local`, sans reset. |
| Installation neuve isolée | Les deux migrations sont appliquées dans `OnJoueQuandJ3Validation` sur ports 56320–56324 ; six tables publiques RLS, exclusion des chevauchements présente, zéro compte précréé. Projet temporaire arrêté après contrôle. |
| Lint, typage strict et build | Réussis. |
| Vitest | 24 tests réussis au total, dont règles temporelles, disponibilités/copie et intégrité de l'aperçu. |
| Fuseau hôte différent | `npm run check` réussi avec `TZ=Pacific/Honolulu`. Les cas Paris gardent les mêmes résultats. |
| Intégration SQL/RLS J3 | Neuf scénarios, dix tests Node en comptant le parent, réussis. |
| Playwright J3 | Parcours complet réussi sur Chromium, Firefox, WebKit et mobile. |
| Régression navigateur J2/J3 | 51 réussis, un test de focus WebKit Windows ignoré pour la limitation déjà documentée en J1/J2. |
| Revue visuelle | Captures bureau et mobile des disponibilités examinées ; calendrier défilant dans son conteneur, cases et contrôles utilisables, absence de débordement de page. |
| Audit de production | `npm audit --omit=dev --audit-level=high` : aucune vulnérabilité signalée. |
| CI distante | Workflow étendu, non exécuté sur GitHub. |

Les tests de domaine couvrent les changements d'heure de Paris du 29 mars et du 25 octobre 2026, les deux occurrences répétées, le refus des heures inexistantes et leur correction explicite de copie, l'année ISO, le pas de quinze minutes, la fusion des plages, minuit, l'horizon et la copie partielle. La copie à travers l'automne conserve 20 h local sans ajouter mécaniquement 168 heures UTC.

Les appels SQL utilisent de vrais JWT de membres et non-membres. Ils couvrent lecture collective, écritures directes interdites, isolation des propriétaires, double création concurrente, échec de la seconde journée annulant la première, contraintes de chevauchement/borne/état/pas, horizon de la base, source et cible modifiées après aperçu, remise sans réponse, calendrier de quinze membres et révocation avec jeton encore valide. Les fixtures J3 sont nettoyées à la fin ; les données préexistantes ne sont pas réinitialisées.

Le parcours navigateur saisit un mode rapide, une nuit sur deux dates et une indisponibilité ; vérifie les compteurs et le calendrier ; copie vers une semaine partiellement renseignée ; active le remplacement ; modifie la source après aperçu par une autre requête ; constate le refus puis réussit avec un nouvel aperçu. Les traces réseau restent désactivées pour ne pas conserver les cookies ou codes Auth.

## Reproduire et exploiter

```sh
npm run db:start
npm run db:migrate
npm run check
npm run test:availability
npm run test:e2e
```

La suite J3 dédiée fonctionne sur la base locale existante avec ses propres comptes synthétiques. La suite complète `test:integration` comprend aussi J2 et exige une base de test neuve : ne pas lancer de reset sur des données locales à conserver. Les scripts refusent les projets distants. Les parcours J2 utilisent l'administrateur synthétique attendu par leurs fixtures ; utiliser une base dédiée pour une recette intégrale.

Les aperçus exigent `AUTH_RATE_LIMIT_SECRET` déjà introduit en J2. Aucun nouveau secret n'est requis ; sa rotation invalide les aperçus ouverts. Pour une installation existante, appliquer les migrations manquantes puis redémarrer le serveur de développement. Les commandes et le parcours utilisateur sont dans le [README](../README.md).

## Limites et suite

La conservation visible est bornée, mais les purges automatiques seront branchées sur les traitements J6. Le calendrier est actualisé après mutation, navigation ou rechargement ; Realtime et édition hors connexion restent différés. L'installation PWA et le Push sur appareils réels ne sont pas des fonctionnalités J3. La réserve sur les dépendances de développement de [J1](j1-validation.md#réserves-techniques) reste suivie ; l'audit de production est distinct.

Le matching, les jeux et favoris arrivent en J4 ; ils ne sont pas simulés dans cette livraison. Le prochain jalon reste soumis à une demande explicite de réalisation.
