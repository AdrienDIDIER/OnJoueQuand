# ADR 014 — PWA, cache public et mises à jour volontaires

- Statut : Implémentée localement en J7 ; précise ADR 008 et ADR 013.
- Date : 2026-10-21.
- Portée : PR-12, PR-13, PR-15 ; installation et Push réels à valider.

## Contexte

Le groupe veut installer l’application, sans retrouver de calendriers privés dans un cache persistant. Une nouvelle version ne doit pas détruire une saisie, y compris lorsqu’un autre onglet active la mise à jour. Les navigateurs n’offrent pas tous le même parcours d’installation ou la même restauration de formulaires.

## Décision

Le manifeste utilise `id: /`, `start_url: /accueil`, `scope: /`, langue française et affichage autonome. Les icônes PNG 192/512, maskable et Apple 180 sont des assets publics issus du SVG original versionné ; aucun service d’image ou dépendance applicative ajouté. La zone principale de la marque tient dans le cercle sûr maskable.

Le worker conserve uniquement cinq URL exactes : `/offline.html` et les quatre PNG. Aucun cache de navigation, API, RSC, chunk, page authentifiée, cookie ou jeton. Les écritures POST ne sont jamais interceptées ni rejouées. Une navigation document utilise le réseau avec `cache: no-store` ; une erreur réseau produit le HTML générique public. Une erreur API/RSC ne reçoit jamais ce HTML. Les assets publics ont leur liste explicite ; l’activation supprime seulement les anciennes versions du préfixe `ojq-public-`.

Incrémenter le nom de cache lorsque les assets précachés changent. Un échec de précache empêche l’installation du nouveau worker, sans remplacer le worker actif. Le script reste servi sans cache HTTP et enregistré avec `updateViaCache: none`.

Pas de `skipWaiting` automatique. La première installation peut prendre le contrôle sans rechargement ; une version suivante attend fermeture des clients ou message volontaire `ACTIVATE_UPDATE`. Seul l’onglet qui demande cette activation se recharge. Les autres gardent leurs saisies et proposent leur propre actualisation. Les champs modifiés, autofournis ou restaurés sans événement `input` sont détectés ; l’actualisation exige alors une confirmation explicite d’enregistrement ou d’abandon. Une restauration native de champs après un rechargement volontaire peut varier selon le navigateur ; ce n’est pas un cache applicatif.

Le navigateur signale la perte de connexion : le formulaire reste en mémoire dans l’onglet, sa soumission est refusée sans file d’attente, les navigations internes deviennent des navigations document afin d’éviter un calendrier privé précédemment préchargé par le routeur. Ce dispositif n’est pas une sauvegarde de brouillon : fermer l’onglet ou naviguer peut perdre la saisie. Une panne serveur alors que le navigateur se croit en ligne ne constitue pas une garantie de conservation durable.

Au retour au premier plan, `/api/session-status` vérifie l’identité et l’adhésion active sous RLS, sans exposer d’identifiant. Réponses privées `no-store` ; 401/403 provoquent une navigation document vers la connexion, 503 conserve la page avec un message d’indisponibilité. Si l’accès reste valide, les lectures ne sont rafraîchies que sans saisie modifiée. Une page restaurée depuis le BFCache est rechargée pour recontrôler l’accès. La déconnexion ne supprime pas le worker ni le cache, puisqu’ils ne contiennent que des données publiques ; le Push partagé se désactive séparément selon ADR 013.

L’événement d’installation est conservé sans ouvrir de boîte automatiquement. Le bouton n’apparaît que lorsqu’un prompt est réellement fourni. L’aide iOS/iPadOS utilise Safari, partage et écran d’accueil ; les autres navigateurs présentent une aide conditionnelle, sans promettre un prompt ou un support uniforme. L’installation ne demande pas l’autorisation Push.

## Alternatives écartées

- Plugin de cache automatique : surface de risque et dépendances inutiles.
- Pages privées en cache pour le démarrage : permettrait une lecture sans revalidation d’accès.
- Activation et rechargement de tous les onglets : perte de saisies.
- Brouillons persistés ou synchronisation offline : arbitrages produit différés.
- Assimiler les tests WebKit à un iPhone installé : aucune preuve de réception Push ou de comportement système réel.

## Vérification et conséquences

Voir [tests PWA](../../tests/e2e/pwa.spec.ts), [contrôles ciblés d’accessibilité](../../tests/e2e/pwa-accessibility.spec.ts), [rapport J7](../j7-validation.md) et [recette appareils](../pwa-device-checklist.md). Les tests de mise à jour utilisent une origine HTTP locale distincte avec un vrai changement du script, sans modifier les fichiers ni désactiver une garde. Une panne du récepteur teste le repli même lorsque l’émulation offline d’un navigateur laisse le réseau du worker actif.

Sources vérifiées : [Next.js PWA](https://nextjs.org/docs/app/guides/progressive-web-apps), [cycle et skipWaiting](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/skipWaiting), [installation contextuelle](https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent). Les réglages de production HTTPS et la recette d’installation/Push sur appareils restent des portes de lancement.
