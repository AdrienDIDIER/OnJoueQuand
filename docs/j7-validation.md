# J7 — PWA et qualité transversale

État au **21 octobre 2026**. Les commits jusqu’à J6, `19b6ce2`, sont poussés sur le dépôt GitHub de l’utilisateur après confirmation explicite de sa visibilité publique. La [CI distante J6 a réussi](https://github.com/AdrienDIDIER/OnJoueQuand/actions/runs/39583064447). Le code J7 est réalisé localement, **non commité et non poussé**. Aucun déploiement, changement de production, migration, clé ou envoi réel ajouté ; `.env.local` est conservé.

## Portée réalisée et limites de clôture

PR-12 et contrôles ciblés PR-13/PR-15 : manifeste français à identité stable, icônes 192/512, maskable et Apple 180, affichage autonome et métadonnées iOS, aide à l’installation selon plateforme, vrai service worker, repli générique hors connexion et mises à jour volontaires. Aucun framework ni dépendance ajouté. Les icônes sont générées depuis le [SVG original](../public/icons/icon.svg) ; tailles et rendu ont été vérifiés. Les réglages de viewport et marges système sont préparés, sans déclarer un appareil à encoche validé.

Le cache applicatif contient **uniquement `/offline.html` et les quatre PNG**. La page de repli ne contient ni profil, ni session, ni disponibilité, ni jeton, ni formulaire. Les navigations passent par le réseau `no-store`, avec repli seulement sur erreur réseau. Les requêtes API/RSC, POST et chunks ne reçoivent aucun repli HTML et ne sont jamais ajoutés au cache ou à une file d’attente. L’activation retire seulement les anciens caches du préfixe applicatif, pas ceux d’une autre application.

Une nouvelle version attend fermeture des clients ou décision explicite. L’onglet demandeur se recharge ; les autres affichent une proposition sans perdre leurs saisies. Une saisie détectée exige de confirmer son enregistrement ou son abandon. Les champs restaurés ou autofournis sans événement `input` sont également reconnus. Firefox peut restaurer des champs après un rechargement volontaire : le test vérifie le rechargement réel et la conservation avant décision, sans imposer un comportement natif identique aux moteurs.

Quand le navigateur signale l’absence de réseau, une soumission est bloquée avec une explication française et garde la saisie en mémoire dans l’onglet. Aucune reprise d’écriture automatique. Naviguer ou fermer l’onglet peut perdre ce brouillon ; aucune persistance durable n’est promise, notamment lors d’une panne serveur alors que le navigateur se croit connecté.

Le retour au premier plan appelle `/api/session-status`, qui contrôle utilisateur Auth et adhésion active sous RLS. Aucun identifiant ou secret n’est renvoyé. Une session absente ou un accès révoqué entraîne une navigation document vers la connexion ; une panne temporaire ne provoque pas de déconnexion aveugle. Les lectures ne sont rafraîchies automatiquement que sans saisie modifiée. Une restauration BFCache déclenche une revalidation par rechargement.

**La recette d’installation, Push, lecteur d’écran et zones système sur iPhone/iPad, Android et bureau réels n’est pas exécutée.** La [fiche appareils](pwa-device-checklist.md) reste une condition avant clôture complète de J7 et lancement du pilote. L’émulation et le prompt simulé ne prouvent pas une installation au niveau du système.

## Vérifications locales

Windows, Node 24.22.0, npm 11.21.1, versions applicatives inchangées. Aucune modification SQL ; les 44 tests SQL/RLS livrés en J6 ne sont pas relancés sans changement de schéma. La nouvelle route de lecture est exercée avec de vrais JWT et révocations de comptes synthétiques.

| Vérification | Résultat |
| --- | --- |
| ESLint, TypeScript strict et build Next.js local | Passent. Manifeste statique, pages privées et route de session dynamiques. |
| Vitest | 51 tests passent, dont détection de plateforme/installation. |
| Régression Playwright complète | 83 tests passent, une exclusion de focus WebKit Windows déjà documentée ; aucun scénario J7 exclu. |
| Scénarios PWA | Passent sur Chromium, Firefox, WebKit et mobile : vrai worker, panne, cache, mise à jour réelle et deux onglets. |
| Accessibilité ciblée | Contraste minimal 4,5:1 pour texte principal, navigation active et aide ; réduction des transitions, français et absence de débordement. Navigation clavier couverte par le test existant, avec sa réserve WebKit Windows. |
| Rendu | Icône et captures de page hors connexion examinées ; le rendu sur écran système reste à vérifier. |

Les [tests PWA](../tests/e2e/pwa.spec.ts) contrôlent manifeste et dimensions PNG, installation déclenchée uniquement par action, report sans blocage, soumission offline non envoyée, contenu générique sans donnée du brouillon, liste exacte du cache, reconnexion, déconnexion et refus d’accès. Une origine HTTP locale de recette permet une vraie coupure du récepteur et un changement réel de script, sans modifier les fichiers ni dépendre du routage de requêtes d’un worker par Playwright. Cela couvre aussi Firefox, où l’émulation offline peut laisser le réseau du worker actif.

La mise à jour est testée avec deux onglets : version en attente, bouton protégé, saisie préservée dans le second, puis rechargement séparé volontaire et purge des seuls anciens caches de l’application. La route de session est vérifiée en 401 anonyme, 200 membre actif avec `no-store`, puis 403 après révocation ; le retour de focus conserve d’abord une saisie, puis retire l’accès.

Les [tests ciblés de présentation](../tests/e2e/pwa-accessibility.spec.ts) calculent les contrastes à partir des styles rendus et vérifient la préférence de réduction des animations. Ce contrôle n’est pas une certification WCAG exhaustive ni une recette avec lecteur d’écran.

Les [fixtures navigateur](../tests/e2e/fixtures.ts) créent désormais un compte synthétique par scénario, puis nettoient ses invitations, adhésion, profil et compte. Un logout ou un OTP concurrent ne peut plus révoquer la session réutilisée par un autre scénario. Aucune donnée utilisateur existante n’est supprimée. Aucune trace réseau, clé ou OTP n’est publiée.

## Exploitation et suite

Voir [ADR 014](decisions/014-pwa-cache-et-mises-a-jour.md) pour les frontières du cache et le protocole de mise à jour. Changer sa version lors d’une modification des assets publics précachés. Conserver le worker actif en cas d’échec du précache ; ne jamais ajouter de cache automatique privé.

Le cron J6 reste désactivé, les clés VAPID restent à configurer et la réception Push réelle reste à prouver. La CI distante citée concerne **J6 seulement** ; J7 est encore local. La suite J8 prépare domaine, environnements, SMTP, sauvegarde/restauration, surveillance et pilote privé, sans contourner la fiche appareils ou provisionner des services sans demande correspondante.
