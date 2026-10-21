# ADR 012 — Transactions des sessions et retour d’un membre

- Statut : Implémentée localement en J5 ; précise les ADR 002, 005, 006 et 007.
- Date : 2026-10-21.
- Portée : PR-08, PR-09, PR-15 ; J5 et raccordement J6.

## Contexte

Les votes, confirmations, révocations et RSVP doivent rester cohérents lorsque plusieurs commandes arrivent ensemble. Réactiver une adhésion ne doit pas recréer silencieusement des engagements historiques. Le volume de quinze membres permet une sérialisation simple.

## Décision

Les commandes verrouillent d’abord la ligne du groupe, puis la session et l’adhésion active, dans cet ordre. Ce verrou de groupe est commun aux commandes d’identité, de disponibilités et de jeux. Les révisions de session, bulletin et RSVP détectent les modifications concurrentes. Les votes et RSVP ne changent pas la révision de la proposition ; leurs lignes possèdent leur propre révision.

`memberships.participation_epoch` augmente à chaque changement de statut, via un trigger qui interdit de choisir sa valeur. Un RSVP enregistre cette époque. Seuls les RSVP positifs dont l’époque correspond à l’adhésion active comptent comme engagements et participants courants. L’historique reste intact ; le retour dans le groupe exige une nouvelle réponse explicite. Les changements de rôle seuls ne périment pas les réponses.

La publication fige les créneaux, le jeu et l’échéance. Les écritures ordinaires passent exclusivement par les RPC étroites ; les tables exposées n’accordent que SELECT avec RLS. Un brouillon annulé sans publication reste privé. Les FK composites empêchent les votes et confirmations sur un autre parent. Une purge du parent supprime les enfants, tandis qu’un trigger refuse les modifications isolées de créneaux publiés.

L’horloge PostgreSQL décide des échéances. Une commande contrôle la révision attendue avant de calculer ses propres transitions temporelles. Les lectures utilisent `session_clock()` et une fonction pure d’état effectif pour afficher clôture, expiration et fin sans attendre le cron. `advance_sessions` est réservé au backend et ne réserve que les lignes effectivement arrivées à échéance, avec un lot borné à 200. Son invocation périodique arrive en J6.

Publication, clôture nécessitant une relance de l’organisateur, confirmation et annulation publiée écrivent audit et outbox dans la transaction. Une confirmation ou annulation à échéance évite une nouvelle notification de clôture devenue inutile. Les événements ont une clé stable par session/type. Aucun envoi réseau n’est effectué dans SQL ; le consommateur et les notifications visibles arrivent en J6.

## Alternatives écartées

- Verrous distincts sophistiqués : complexité sans gain utile pour ce groupe ; mesurer avant de réduire la granularité.
- Réactiver tous les anciens RSVP : risque d’engagements incompatibles et absence de consentement actuel.
- Effacer les RSVP à la révocation : détruit l’historique.
- Autoriser UPDATE depuis le navigateur avec contrôles UI : contourne les invariants entre tables.

## Conséquences et vérification

Les mutations du groupe sont sérialisées ; le faible débit attendu rend ce compromis acceptable. Le rôle technique privilégié demeure réservé aux fixtures, migrations et traitements internes, jamais aux commandes ordinaires.

Voir les [tests SQL/RLS](../../tests/integration/sessions.test.mjs), le [parcours multi-comptes](../../tests/e2e/sessions.spec.ts), les [tests de domaine](../../src/features/sessions/domain.test.ts) et le [rapport J5](../j5-validation.md). Le scheduling, les préférences et les livraisons Push restent à réaliser en J6.
