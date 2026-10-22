# Recette complète — Fluidité et interface mobile

Date : 22 octobre 2026. Référence avant modification : `bc10f9a`.

## Changements

- Vérification du compte et lecture RLS de l’adhésion en parallèle, avec les deux validations obligatoires : [ADR 023](decisions/023-fluidite-et-retours-visuels.md).
- Aucun aller-retour quand on retouche l’onglet courant ; cela annule également une destination encore en attente. Les anciennes réponses de navigation sont ignorées après un clic plus récent.
- Aperçus de chargement sur les pages et sections de l’accueil, indicateur d’onglet et activité du bouton Actualiser. Les formulaires de disponibilités et soirées exposent leur attente.
- Entrées courtes des pages et dialogues, retours sur les boutons, état sans soirée plus accueillant. Réduction des animations respectée ; pas de dépendance supplémentaire.

## Environnement et sécurité de la recette

Build de production local, Node 24, stack Supabase **OnJoueQuandJ8Validation** sur les ports 60321/60322. La recréation nécessaire au bootstrap des tests Auth a ciblé exclusivement cette stack synthétique. Aucun effacement de la base personnelle, aucune migration distante, invitation réelle ou activation du cron.

Les copies ignorées `.tools/j8-tests` adaptent les ports et conteneurs des tests versionnés à cette stack. Le lanceur synthétique fournit une clé VAPID publique de recette et désactive les identifiants privés d’envoi. Les scénarios Push simulent les API de l’appareil et enregistrent les abonnements de test sous RLS ; ils ne constituent pas une réception réelle sur téléphone.

## Mesure reproductible

Benchmark versionné : `tests/performance/navigation.spec.ts`. Chromium, un travailleur, trois cycles de quatre onglets après préchargement ; délai artificiel de 120 ms sur RSC et sonde d’accès, identique avant/après. Le contenu utile est attendu. Aucun seuil dépendant de la machine.

| Indicateur | Référence | Version revue |
| --- | --- | --- |
| Médiane des douze changements d’onglet | 244,5 ms | 234,5 ms |
| Requêtes de contenu hors préchargement par déplacement | 0 | 0 |
| Contrôles d’accès par déplacement | 1 | 1 |

Cette différence de 10 ms sur deux passes est faible et compatible avec la variation de mesure : **aucun gain important en navigation préchargée n’est revendiqué**. La nouvelle orchestration concerne les rendus serveur ; son bénéfice en production reste à mesurer. Le test d’autorisation avec Auth retenu vérifie que la lecture d’adhésion démarre sans attendre Auth, mais qu’aucun droit ne sort avant sa validation. Le clic sur l’onglet courant est vérifié sans requête RSC ni sonde. Les améliorations de retour visuel sont distinctes du temps réseau.

## Vérifications

- Lint, typage strict et 67 tests Vitest réussis, dont six cas dédiés à l’autorisation en parallèle.
- SQL/RLS : les 49 autres cas et sous-cas ont réussi ; les deux suites d’exploitation et conservation, initialement refusées par leurs garde-fous faute de variable explicite, ont ensuite réussi avec `OPS_TEST_WORKDIR=.tools/j8-retention`.
- Huit tests des outils d’exploitation réussis, dont chiffrement réel avec age et refus des archives altérées. Le binaire age local a été ajouté au PATH de la recette après un premier échec de détection.
- Passe générale incluant l’actualisation : 231 réussites, un test clavier WebKit ignoré sur Windows. Après la dernière correction du retour sur l’onglet courant, 60 tests ciblés de navigation, autorisation et attente réussissent sur les quatre profils. La suite versionnée compte désormais 236 cas ; la CI en exécutera l’ensemble sur Linux.
- `npm audit --omit=dev --audit-level=high` : aucune vulnérabilité signalée pour les dépendances de production.
- Captures des quatre écrans quotidiens et des attentes contrôlées, largeur téléphone 390 px ; vérification des débordements, dialogues et réduction des animations.

Les parcours couvrent OTP et invitations, saisie et copie, matching, favoris, soirées et RSVP à deux comptes, notifications et préférences, installation, hors connexion, mise à jour multi-onglets, révocations, changement de rôle et de compte, historique navigateur et invalidation de l’accueil.

La recette ne valide pas une réception Push, une installation physique iOS/Samsung ou le temps de réponse authentifié sur le réseau mobile réel. Le [contrôle appareils](pwa-device-checklist.md) reste nécessaire.
