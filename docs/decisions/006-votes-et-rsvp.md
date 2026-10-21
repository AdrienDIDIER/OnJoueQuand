# ADR 006 — Votes multiples, confirmation et RSVP

- Statut : Implémentée localement en J5 ; précisée par [ADR 012](012-sessions-transactions-et-retour-membre.md). Voir le [rapport J5](../j5-validation.md).
- Date : 2026-10-15.
- Portée : J5 ; PR-08, PR-09, PR-15.

## Contexte

Un créneau acceptable n'est pas un engagement définitif. L'organisateur doit pouvoir prendre une décision même lorsque tous les membres n'ont pas répondu, tout en évitant les doubles confirmations et participations incompatibles.

## Décision

Tout membre actif crée une proposition avec deux à six candidats futurs. Publication fige candidats, jeu et échéance. Chaque membre possède un bulletin mutable pendant le vote, contenant zéro ou plusieurs choix. Une liste vide exprime « Aucun créneau ne me convient » ; l'absence de bulletin reste « Sans réponse ».

Créateur actif ou administrateur confirme un seul candidat futur, avant ou après clôture. Pas de quorum bloquant ; afficher un avertissement sous le seuil recherché. La base contrôle les échéances même si le cron est en retard.

La confirmation ne crée aucun RSVP positif. Tout membre actif peut répondre explicitement jusqu'au début. Un engagement positif chevauchant une autre session confirmée est refusé. Verrouiller la session pour les transitions/votes et l'adhésion pour sérialiser les RSVP intersessions. Une annulation libère l'engagement par l'état de session, sans effacer l'historique.

## Alternatives écartées

- Confirmation automatique au meilleur score : arbitrages de quorum et égalité non souhaités dans le MVP.
- Inscription automatique des votants : confond acceptabilité et engagement.
- Absence de lignes de votes pour représenter toutes les réponses négatives : ne distingue pas abstention et refus explicite.
- Contrôles de concurrence exclusivement dans l'UI : insuffisants face à deux requêtes simultanées.

## Conséquences

Une replanification exige annulation et nouvelle proposition. La session terminée indique un horaire passé, pas une présence constatée. Les états et transitions sont protégés par des commandes transactionnelles, avec audit et outbox dans le même commit.

## Vérification

T-SESSION/T-CONCURRENCY/T-RLS : bulletin vide, vote après échéance, candidat étranger, confirmations simultanées, RSVP concurrents et annulation. Référence : [machines à états](../database.md#machines-a-etats).
