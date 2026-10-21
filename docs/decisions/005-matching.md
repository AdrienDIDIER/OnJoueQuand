# ADR 005 — Matching déterministe

- Statut : Implémentée en J4 ; branchement réel des RSVP livré en J5. Voir les preuves [J4](../j4-validation.md) et [J5](../j5-validation.md).
- Date : 2026-10-15.
- Portée : J4–J5 ; PR-06, PR-07, PR-09.

## Contexte

Le groupe veut des suggestions explicables de créneaux communs, pas une confirmation automatique. Les membres disponibles doivent être les mêmes pendant toute la durée recherchée. Le faible volume ne justifie pas un service de calcul séparé.

## Décision

Calculer à la demande côté serveur avec une fonction TypeScript pure. Paramètres initiaux : semaine affichée, membres actifs, seuil de deux joueurs et durée de soixante minutes. Le filtre de jeu est facultatif.

Normaliser les disponibilités, soustraire les engagements RSVP confirmés, balayer les bornes et conserver l'ensemble des membres sur chaque segment. Pour chaque départ sur la grille de quinze minutes, calculer l'intersection des membres pendant toute la durée réelle de la fenêtre.

Trier par effectif décroissant, nombre de favoris du jeu choisi décroissant, puis horaire croissant ; retourner au plus dix candidats et leurs participants. Un favori n'est pas une preuve de possession. Sans réponse ne signifie jamais disponible. Les candidats n'ont pas besoin d'être persistés.

## Alternatives écartées

- Somme ou moyenne des présences : peut proposer des membres présents successivement mais pas ensemble.
- IA ou score opaque : non nécessaire pour les règles retenues et difficile à vérifier.
- Calcul nocturne préenregistré : résultats périmés après modification ou RSVP.
- Moteur externe : coût et complexité sans bénéfice pour quinze membres.

## Conséquences

Le résultat est déterministe pour une entrée et un instant de référence donnés. Les créneaux suggérés restent indicatifs : un vote et un RSVP sont des actions séparées. La lecture des engagements est un contrat défini en J4, branché à la base en J5. Le benchmark concerne le calcul seul, pas la latence réseau globale.

## Vérification

T-MATCH : oracle simple sur petits cas, absence de fausse intersection, trous et membres changeant en cours de fenêtre, sessions occupées, seuil et tri. Cible p95 < 100 ms après échauffement pour quinze membres/quatre semaines, fixture et environnement consignés. Référence : [algorithme](../architecture.md#modele-temporel-et-matching).
