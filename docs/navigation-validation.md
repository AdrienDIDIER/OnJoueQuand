# Recette — Navigation et cache en mémoire

Rapport historique de l’ADR 019. Le contrôle bloquant décrit ici a été remplacé, après accord explicite, par l’[ADR 024](decisions/024-navigation-immediate-et-commandes-legeres.md) ; voir les [nouvelles mesures](instant-navigation-validation.md).

## Périmètre

L’[ADR 019](decisions/019-cache-navigation-privee.md) décrit le cache des quatre onglets, son contrôle d’accès et son invalidation. Aucune migration, modification de compte réel ou activation de cron. Le service worker conserve uniquement sa liste publique existante.

L’interface conserve ses couleurs chaudes et ses écrans courts. Le jour courant possède un repère discret dans Dispos ; l’accueil montre sept repères de complétude. Le bouton d’actualisation reste disponible près de la marque, sans réintroduire les réglages dans les écrans quotidiens.

## Mesure contrôlée

Application compilée pour la stack locale synthétique J8Validation ; Chromium, deux travailleurs Playwright. Après ouverture de l’accueil et préchargement terminé, trois cycles Dispos → Sessions → Groupe → Accueil. Délai artificiel de 120 ms sur chaque requête RSC et `/api/session-status`, identique avant et après. Les assertions attendent le contenu utile, pas seulement l’URL.

| Indicateur | Avant | Avec cache |
| --- | --- | --- |
| Médiane des 12 déplacements | 365,5 ms | 248,5 ms |
| Requêtes de contenu hors préchargement par déplacement | 1 | 0 |
| Contrôles d’accès dédiés par déplacement | 0 | 1 |

Gain observé : environ 32 %. Une première passe avec cache mesurait 239,5 ms ; la passe finale utilise le benchmark versionné ci-dessous. Avant, le contrôle était inclus dans le rendu serveur ; après, le contrôle dédié reste obligatoire. Ces mesures excluent le coût du préchargement initial et ne prédisent pas la latence réelle sur iPhone. Les données ne persistent pas dans le stockage local ni dans le cache du worker.

## Vérifications automatisées

`tests/e2e/navigation-cache.spec.ts` couvre réutilisation du contenu avec contrôle frais, invalidation de l’accueil après saisie, retrait de rôle, révocation, contrôle indisponible, retour navigateur, changement de compte, déconnexion et actualisation des modifications externes. Les tests utilisent uniquement des comptes de recette identifiés et nettoyés.

Exécuter sur une stack Supabase **synthétique dédiée**, jamais sur la base personnelle à conserver : build avec les variables de cette stack, puis Playwright avec le même environnement et `navigation-cache.spec.ts`. La CI lance ce fichier avec les autres parcours. Sur ce poste, les copies ignorées `.tools/j8-tests` pointent exclusivement vers J8Validation ; le lanceur habituel de la racine cible une autre stack et ne doit pas servir à cette recette locale.

Validation locale : 155 parcours Playwright réussis sur Chromium, Firefox, WebKit et profil mobile ; un test clavier WebKit ignoré sur Windows. Lint, typage strict et 53 tests Vitest réussis. Le benchmark séparé réussit également. Les captures utilisent des données synthétiques ; ces contrôles ne remplacent pas un essai sur appareil réel. La publication et la CI distante sont vérifiées séparément lors de la livraison.

Le benchmark est versionné séparément dans `tests/performance/navigation.spec.ts`, sans seuil dépendant de la machine. Sur un environnement synthétique configuré, compiler avec `node scripts/with-local-env.mjs node_modules/next/dist/bin/next build`, puis lancer `node scripts/with-local-env.mjs node_modules/@playwright/test/cli.js test --config tests/performance/playwright.config.ts`. Il affiche uniquement durées et compteurs. Le worker est bloqué dans cette simulation pour que le délai réseau soit effectivement appliqué sur tous les navigateurs ; ses propres tests restent séparés.

## Essai manuel après déploiement

1. Fermer puis rouvrir l’application installée, ouvrir Accueil et laisser les onglets se précharger quelques secondes.
2. Passer entre Dispos, Sessions, Groupe et Accueil. Le contenu doit apparaître plus vite après le contrôle d’accès, avec un retour visuel pendant l’attente.
3. Modifier une disponibilité, revenir à l’accueil et vérifier le compteur. Pour récupérer les modifications d’un ami, toucher le bouton d’actualisation près du nom de l’application.

En cas de latence persistante, relever l’appareil, le réseau, l’onglet et si c’est la première ouverture ou un retour. Une mesure authentifiée sur iPhone reste nécessaire pour quantifier le gain en production.
