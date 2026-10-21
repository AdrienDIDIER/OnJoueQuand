# J6 — Notifications, rappels et traitement

État au **21 octobre 2026**. J5 est commité dans `52f8c18`, J6 dans `19b6ce2`, puis poussés après confirmation explicite du dépôt public par l’utilisateur. La [CI distante J6 a réussi](https://github.com/AdrienDIDIER/OnJoueQuand/actions/runs/39583064447). Aucun déploiement, migration distante, service payant ou envoi Push externe. `.env.local` n’a pas été modifié. Le cron reste **désactivé** ; aucune réception réelle revendiquée. Ce rapport conserve la portée au terme de J6 ; les extensions PWA sont décrites dans le [rapport J7](j7-validation.md).

## Portée réalisée

PR-10 et PR-11 : boîte privée dans Accueil, vingt dernières notifications, compteur de non lues et marquage explicite ; préférences rappels/Push dans Groupe ; inscription volontaire et retrait d’appareils ; service worker Push/clic sans cache ni interception réseau. L’installation PWA reste en J7.

Les événements J5 sont consommés transactionnellement. L’auteur d’une publication/confirmation/annulation ne reçoit pas sa propre notification ; la clôture vise le créateur actif, ou les administrateurs s’il est révoqué. Les événements devenus obsolètes sont ignorés ; les libellés historiques et liens invitent à consulter l’état actuel. Les notifications internes de session restent disponibles sans Push.

Le rappel dimanche 18 h vise le lundi suivant. La relance lundi 18 h conserve ce lundi cible et ne touche que les semaines encore incomplètes. Rattrapage du dimanche jusqu’à lundi 18 h, puis lundi jusqu’à mardi 18 h : aucune double étape après panne. Les dates civiles et conversions de Paris sont utilisées, y compris DST et changement d’année ISO. La complétude, les préférences, l’adhésion et son époque sont revérifiées avant matérialisation et avant envoi.

Les RPC techniques assurent déduplication, réservations concurrentes, baux, reprises et acquittements conditionnels. Un ancien détenteur ne peut pas acquitter après reprise. Le réseau reste hors transaction. Cinq tentatives maximum ; `404/410` suppriment l’appareil à sa révision réservée ; réseau/`408/429/5xx` retentent avec recul, jitter et `Retry-After`. Les messages Push sont génériques, tagués de façon stable et dirigés vers la boîte privée.

La route POST exige un secret avec rotation et comparaison sur empreintes de longueur fixe. Un job global possède un bail de deux minutes, une livraison un bail de 90 secondes. Le worker réserve six appareils au plus, par vagues de trois, avec timeout réseau de six secondes. L’administrateur voit derniers passages et comptes d’attente/échec. Les endpoints acceptés sont strictement limités aux familles FCM, Mozilla et Apple ; aucune URL arbitraire, redirection ou proxy.

## Données et configuration

Les migrations [notifications](../supabase/migrations/202610210005_notifications.sql), [activation Push](../supabase/migrations/202610210006_push_activation.sql), [cron](../supabase/migrations/202610210007_notification_cron.sql) et [lecture révisée](../supabase/migrations/202610210008_notification_read.sql) sont appliquées au projet local par migration incrémentale, sans reset utilisateur. Types Supabase générés. Les tables publiques accordent SELECT sous RLS au seul propriétaire actif ; les mutations passent par sa session, sans clé privilégiée. Worker, outbox, livraisons, heartbeat et Vault restent techniques.

`web-push` **3.6.7**, stable vérifiée dans le registre et compatible avec le Node 24 retenu, et ses types **3.6.4** sont les seules dépendances ajoutées. `https.request` et l’absence de suivi des redirections ont été vérifiés dans le code installé. La clé privée VAPID et le secret du job ne sont jamais publics. Le script de génération écrit un fichier ignoré, refuse l’écrasement et n’imprime aucune clé.

La migration installe Cron, pg_net et Vault mais ne stocke aucune configuration et n’active aucun appel périodique. Voir [ADR 013](decisions/013-notifications-et-livraison-bornee.md) et [guide d’exploitation](notifications-operations.md). Sans VAPID, le traitement interne fonctionne et aucune tentative Push n’est lancée. Sans secret de job, la route retourne 503 ; un mauvais secret sur une installation configurée retourne 401.

## Vérifications effectuées

Windows, Node 24.22.0, npm 11.21.1, Supabase local/PostgreSQL 17.11. Les heures métier sont injectées ou contrôlées ; les acteurs applicatifs utilisent leurs JWT, pas `service_role`.

| Contrôle | Résultat |
| --- | --- |
| ESLint, TypeScript strict, build Next.js local | Passent. |
| Vitest | 50 tests passent : règles de rappel, endpoints, livraison simulée, retry, rotation et vérification cryptographique VAPID, en plus des domaines J1–J5. |
| Suite SQL/RLS J2–J6 sur base neuve isolée | 44 tests passent, parents inclus ; J6 9. |
| Playwright complet | 63 tests passent ; un test de focus WebKit Windows déjà exclu, aucun test J6 exclu. |
| Parcours J6 | Passe sur Chromium, Firefox, WebKit et mobile ; capture de boîte examinée et absence de débordement vérifiée. |
| pg_net + Vault | Un POST authentifié reçu par un récepteur local, HTTP 200 ; secrets temporaires retirés. |
| Audit des dépendances d’exécution | Zéro vulnérabilité avec `npm audit --omit=dev --audit-level=high`. |

Les [tests SQL](../tests/integration/notifications.test.mjs) contrôlent RLS anonyme/non-membre/propriétaire/révoqué, concurrence de matérialisation, propriété d’endpoint, révisions, marquage lu, informations obsolètes, préférence désactivée, complétude et heures de rappel, plafond de tentatives, reprise et fencing des baux, révocation des appareils, heartbeat et cron inactif. Le [domaine/livraison](../src/features/notifications/domain.test.ts) couvre été/hiver, printemps/automne, ISO, fenêtre de rattrapage, erreurs fournisseur, expiration et contenu générique. Le [test cryptographique](../src/features/notifications/infrastructure/web-push.test.ts) vérifie sans réseau la requête chiffrée et la signature du JWT VAPID produit par la bibliothèque installée.

Le [parcours navigateur](../tests/e2e/notifications.spec.ts) publie avec un compte, traite via POST authentifié, vérifie le refus des mauvais secrets, la déduplication et la lecture privée, puis modifie les préférences et vérifie leur persistance après rechargement. Sans VAPID, le bouton explique l’indisponibilité sans demander d’autorisation. Le worker servi n’intercepte aucun fetch et porte `Cache-Control: no-store`.

La base `OnJoueQuandJ6Validation`, ports 59320–59324, est indépendante du projet principal. Les migrations ont été rejouées depuis zéro puis la suite complète exécutée sur des données synthétiques ; les copies de tests n’ajustent que ports et noms de conteneurs. Les scénarios d’horloge ont d’abord révélé la nécessité de cette isolation : trois rappels artificiels futurs du projet principal ont été identifiés par UUID et heures de création, puis retirés spécifiquement. Le nettoyage large par date a été refusé par la revue automatique ; aucune suppression large n’a été exécutée. Les consignes exigent désormais une base dédiée pour toutes ces suites. La base principale n’a pas été réinitialisée.

La recette HTTP pg_net/Vault utilise un récepteur temporaire local, distinct de Next.js ; les parcours Playwright vérifient séparément la vraie route Next.js et le worker. Aucun appel fournisseur n’a été réalisé. L’expression cron est vérifiée en base ; aucun déclenchement périodique de production n’est déclaré validé. La base temporaire a été arrêtée après recette.

## Limites avant lancement et suite

Configurer dans l’environnement autorisé les secrets de job, la paire VAPID, son contact et Vault, puis activer explicitement le cron. Valider la réception, le clic et le retrait sur iPhone/iPad, Android et bureau réels ; le transport simulé et WebKit émulé ne prouvent pas cette réception. Un crash après envoi peut produire un doublon externe malgré le tag stable.

La CI distante a depuis réussi au commit J6, comme indiqué en tête du rapport. La réserve ESLint/dépendances de développement déjà documentée en J1/J3 demeure ; aucun correctif forcé ou changement de framework n’a été appliqué. Purges générales, sauvegardes restaurées et alertes externes restent des conditions J8. La limite technique de dix appareils par compte, les familles Push prises en charge et les étapes d’activation sont explicites dans ADR 013.

La suite est **J7 : PWA installable, manifeste et icônes, hors connexion générique, mise à jour du service worker et qualité transversale**, avec validation sur appareils réels. Ce jalon n’a pas été démarré dans cette livraison.
