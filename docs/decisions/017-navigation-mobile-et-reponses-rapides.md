# ADR 017 — Usage mobile et réponses rapides

- Statut : Implémentée ; validation sur iPhone réel encore requise.
- Date : 2026-10-21.
- Portée : PR-03 et navigation ; amende l’ADR 011 pour les réponses rapides uniquement.

## Contexte et décision

La recette sur téléphone signale trop de réglages et de commandes simultanées. Les quatre onglets sont conservés. Accueil montre la prochaine session, les disponibilités de la semaine et les trois notifications récentes. Groupe présente les membres et les accès aux jeux, aux réglages personnels et à la gestion administrateur. Installation et déconnexion quittent les écrans quotidiens ; les protections de connexion et de mise à jour restent actives partout.

Une réponse rapide enregistre une seule journée en un geste. Les boutons affichent l’action et, pour la disponibilité, les horaires de Paris avant l’enregistrement. La Server Action vérifie l’identité, l’adhésion, la date, la révision et les horaires rapides affichés. Elle refuse de remplacer une journée détaillée ou de modifier plusieurs journées. Elle construit le même plan métier puis utilise la RPC `save_availability`, dont les autorisations, contraintes et contrôles concurrents restent inchangés.

L’aperçu signé reste obligatoire pour les horaires détaillés, la traversée de minuit et les copies. L’affirmation « chaque modification est prévisualisée » de l’ADR 011 est donc limitée à ces opérations. Une page périmée ne peut pas écraser une réponse plus récente, même par le raccourci.

## Alternatives et conséquences

Masquer seulement les réglages laisserait cinq manipulations pour une réponse simple. Enregistrer tous les horaires sans aperçu rendrait moins visibles les effets sur le lendemain. La séparation conserve une réponse quotidienne rapide et un parcours explicite pour les changements complexes, sans migration ni nouvelle dépendance.

Les fonctions sont conservées à leur emplacement dédié ; les sous-routes vérifient leurs autorisations côté serveur. Le calendrier collectif utilise une liste par journée sur téléphone et conserve le tableau sur grand écran. La recherche démarre avec ses critères par défaut, ses filtres restent disponibles à la demande.

Vérifications : parcours [mobile](../../tests/e2e/mobile-simplicity.spec.ts), [disponibilités](../../tests/e2e/availability.spec.ts), [sessions](../../tests/e2e/sessions.spec.ts), [PWA](../../tests/e2e/pwa.spec.ts) et [autorisations](../../tests/e2e/auth.spec.ts). Le service worker et sa liste de cache ne changent pas. Les tests navigateur ne remplacent pas le retour utilisateur sur iPhone installé.
