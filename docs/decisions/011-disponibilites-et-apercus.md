# ADR 011 — Disponibilités transactionnelles et aperçus signés

- Statut : Acceptée et implémentée en J3.
- Date : 2026-10-21.
- Portée : PR-03, PR-04, PR-05 ; précise ADR 004.

## Décision

Le domaine construit un plan de journées à partir de dates/heures locales, d'un instant injecté et des révisions lues. L'adaptateur commun utilise `@js-temporal/polyfill` 0.5.1 pour Europe/Paris. Les chevauchements et contiguïtés sont fusionnés ; une nuit est découpée aux minuits locaux réels. La portion du lendemain est fusionnée avec ses intervalles disponibles existants, ou remplace sa réponse non disponible : cet effet est explicite dans l'aperçu.

Chaque modification est prévisualisée avant confirmation. L'aperçu est signé par HMAC avec séparation de contexte, expire après dix minutes et est lié au compte vérifié. La signature utilise le secret serveur de limitation déjà configuré ; sa rotation invalide les aperçus en cours. Le navigateur reçoit uniquement le plan et sa signature, jamais la clé. Aucun stockage de brouillon ni cache persistant n'est nécessaire.

La copie conserve les heures locales. Une heure inexistante exige une correction explicite ; une heure répétée exige une occurrence par borne. Le nouvel aperçu montre les horaires retenus avant toute écriture. Les journées sources sans réponse ne suppriment pas les réponses cibles. La copie conserve par défaut les journées déjà renseignées ; le remplacement exige une case explicite puis la confirmation de l'aperçu.

La RPC `save_availability` déduit l'adhésion du JWT, prend le verrou groupe puis adhésion et applique les journées dans l'ordre. Les sept révisions sources et les révisions des journées cibles affectées sont contrôlées sous le même verrou. Une absence a une révision attendue `null` ; une remise sans réponse conserve une ligne et incrémente sa révision. La base refuse tout conflit et toute incohérence atomiquement.

RLS protège les lectures ; les clients ne peuvent pas modifier directement les tables. FK composites, exclusion GiST, contrôle des bornes et pas de quinze minutes, puis triggers différés garantissent l'accord entre état et intervalles. Une journée disponible doit avoir des intervalles ; une autre réponse ne doit pas en avoir. Les bornes sont semi-ouvertes.

## Alternatives et conséquences

Un verrou groupe est plus large qu'un verrou par date, mais traite simplement la concurrence sur les journées absentes et partage l'ordre de verrouillage des révocations J2. Pour quinze membres et des transactions courtes sans réseau, ce coût est acceptable. Mesurer avant de le remplacer.

Une vérification d'interface seule ou une lecture suivie d'écritures séparées ne garantit ni la copie atomique ni l'absence d'écrasement. Une table de brouillons ajouterait conservation et nettoyage sans bénéfice au MVP. La signature ne remplace pas les autorisations SQL : une RPC appelée directement reste limitée au propriétaire actif, aux révisions et aux contraintes.

Le calendrier est un tableau accessible des membres actifs, consultable sur seize semaines : douze précédentes et quatre éditables. Les changements apparaissent après mutation, navigation ou rechargement ; Realtime reste différé. Les purges automatiques de conservation restent à brancher sur J6.

Preuves : [rapport J3](../j3-validation.md), tests du [domaine](../../src/features/availability/domain.test.ts), d'[intégration](../../tests/integration/availability.test.mjs) et de [parcours](../../tests/e2e/availability.spec.ts).
