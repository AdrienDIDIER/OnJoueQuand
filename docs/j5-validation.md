# J5 — Propositions, votes et participation

État au **21 octobre 2026**. J4 a été commité séparément dans `55aa56d`, J5 dans `52f8c18`. Aucun push, déploiement, service payant, migration distante ni invitation réelle. `.env.local` a été conservé sans modification. Ce rapport conserve les résultats au terme de J5 ; la suite est décrite dans le [rapport J6](j6-validation.md).

## Fonctionnalités livrées

PR-08 et PR-09 : tout membre actif peut créer et modifier un brouillon, avec titre, description facultative, jeu facultatif, objectif de joueurs, deux à six créneaux et échéance. L’échéance par défaut est le plus tôt entre 48 heures et le premier début. L’interface exige deux créneaux pour enregistrer ; SQL permet un brouillon incomplet, mais refuse sa publication. Les dates sont saisies et affichées à Paris ; les instants persistés sont UTC. Les heures inexistantes sont refusées et les occurrences répétées peuvent être précisées.

La publication fige les paramètres et rend la proposition accessible au groupe. Les bulletins contiennent zéro, un ou plusieurs choix. Absence de bulletin et réponse « Aucun créneau ne me convient » sont distinguées. Créateur ou administrateur peut clore, confirmer un candidat futur sans quorum bloquant, ou annuler. Le seuil souhaité et le nombre de votes sont visibles ; un avertissement signale les candidats insuffisamment soutenus.

Une confirmation ne crée aucun RSVP. Chaque membre répond explicitement jusqu’au début. Les réponses obsolètes et les participations incompatibles sont refusées, y compris en concurrence. L’annulation libère les engagements sans supprimer l’historique. Un administrateur peut reprendre une proposition dont le créateur est révoqué. Un brouillon annulé sans publication reste privé.

L’onglet Sessions affiche propositions et historique par pages de vingt. L’accueil présente la prochaine session confirmée du groupe, avec la réponse personnelle. Le matching soustrait réellement les RSVP positifs aux sessions confirmées, pour les adhésions actives à leur époque actuelle. Une réinvitation exige de renouveler les anciennes réponses ; voir [ADR 012](decisions/012-sessions-transactions-et-retour-membre.md). Un RSVP n’est jamais présenté comme une présence constatée.

## Données et sécurité

Les migrations [sessions](../supabase/migrations/202610210002_sessions.sql), [gardes](../supabase/migrations/202610210003_session_guards.sql) et [purge des enfants](../supabase/migrations/202610210004_session_retention.sql) ont été appliquées sur le projet local existant avec `migration up --local`, sans reset. Elles ont aussi été rejouées depuis zéro dans un projet isolé.

Les tables exposées utilisent RLS et SELECT seulement pour les clients ordinaires. Les RPC extraient l’acteur du JWT, fixent `search_path`, contrôlent les droits, états, parents et révisions. Le verrou commun du groupe, puis ceux de session et d’adhésion, sérialisent les transitions avec les révocations et RSVP intersessions. Les clés étrangères composites empêchent les choix d’une autre proposition ; un trigger interdit les modifications isolées des créneaux publiés. Les types Supabase sont régénérés depuis le schéma final.

Les échéances sont opposables selon PostgreSQL, même sans cron. Les lectures utilisent l’heure de la base et l’état effectif ; `advance_sessions`, réservé au backend, matérialise clôtures, expirations et fins sur les seuls travaux échus, en lots bornés. Audit et outbox sont écrits avec les événements métier, dans la transaction. **Aucune notification ni aucun Push n’est livré en J5.** Le cron, le consommateur, les préférences et les rappels restent à réaliser en J6.

## Vérifications locales

Environnement : Windows, Node 24.22.0, npm 11.21.1, PostgreSQL 17.11 dans Supabase local. Les dépendances applicatives sont inchangées.

| Vérification | Résultat |
| --- | --- |
| ESLint et TypeScript strict | Passent. |
| Vitest | 40 tests passent, dont cinq tests J5 couvrant les propositions, défauts d’échéance, DST et états temporels. |
| Suite SQL/RLS J2–J5 sur base neuve isolée | 35 tests passent, parents inclus : J2 9, J3 10, J4 6, J5 10. |
| Tests J5 sur base locale existante | 10 tests passent, avec JWT de comptes synthétiques et requêtes concurrentes. |
| Build Next.js avec configuration locale injectée | Passe ; routes privées dynamiques. |
| Régression Playwright complète | 59 tests passent, un test de focus WebKit Windows déjà exclu ; aucun test J5 exclu. |
| Parcours J5 ciblé | Passe sur Chromium, Firefox, WebKit et mobile ; captures de carte confirmée examinées, absence de débordement vérifiée. |

Les [tests de domaine](../src/features/sessions/domain.test.ts) contrôlent les propositions invalides, créneaux passés, doublons, fins et échéances incohérentes, transitions d’heure et états à la borne exacte. Les [tests SQL](../tests/integration/sessions.test.mjs) exercent les accès anonymes/non membres/révoqués, brouillons privés, idempotence, édition concurrente, jeu archivé, immutabilité, bulletins multiples/vides, ressources étrangères, vote/clôture, double confirmation, absence de RSVP implicite, deux engagements concurrents, frontières contiguës, déclinaison, annulation, réactivation et reprise administrative. Des fixtures privilégiées de temps passé vérifient refus après début, fin et expiration ; les acteurs métier utilisent leurs JWT ordinaires.

Le [parcours multi-comptes](../tests/e2e/sessions.spec.ts) crée, publie, vote plusieurs choix, soumet un bulletin vide, vote à nouveau, clôture, confirme et répond explicitement avec deux comptes. Il vérifie le calendrier occupé, puis sa libération après annulation, l’accueil collectif et l’absence de débordement mobile. Les comptes et ressources synthétiques sont nettoyés ; aucune trace réseau/OTP n’est enregistrée.

La base isolée `OnJoueQuandJ5Validation` utilise les ports 58320–58324, une copie de la configuration/migrations du dépôt et des données synthétiques. Les copies des tests ne changent que les ports et noms de conteneurs nécessaires. Elle a été créée, réinitialisée pour la recette finale puis arrêtée ; le projet principal 55320–55324 n’a pas été réinitialisé. L’exécution initiale de la suite générale sur la base déjà initialisée a refusé le bootstrap J2, comme prévu ; la validation complète a donc été effectuée sur la base neuve isolée.

Pour reproduire sur une base locale de test dédiée : appliquer les migrations, exécuter `npm run test:integration`, puis construire avec `node scripts/with-local-env.mjs node_modules/next/dist/bin/next build` et lancer `npm run test:e2e`. La suite d’identité exige une base sans adhésions initiales ; ne pas réinitialiser une base contenant des données à conserver. La CI reconstruit désormais avec la configuration Supabase locale avant Playwright.

## Limites et suite

La CI GitHub distante et les appareils réels ne sont pas déclarés validés. Le test clavier WebKit Windows exclu reste requis sur Linux dans la CI ; installation et Push sur iOS/Android réels relèvent de J7. La réserve déjà documentée sur ESLint et ses dépendances de développement reste celle de J1/J3 ; aucune dépendance ajoutée en J5.

Le prochain jalon est **J6 : centre de notifications, préférences, consommateur d’outbox, Web Push et rappels dimanche/lundi**, avec cron authentifié et reprise des traitements. Aucun de ces envois n’est implémenté ou activé dans cette livraison.
