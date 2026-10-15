# ADR 004 — Disponibilités et fuseau Europe/Paris

- Statut : Acceptée, conception non implémentée.
- Date : 2026-10-15.
- Portée : J3–J6 ; PR-03, PR-04, PR-05, PR-14.

## Contexte

La saisie doit être rapide sans inventer des horaires et rester exacte lors des nuits traversant minuit ou des changements d'heure. Copier une semaine signifie conserver une intention horaire locale.

## Décision

Modéliser une réponse par membre et date locale : sans réponse, indisponible ou disponible. Une ligne absente équivaut à sans réponse. Le mode rapide matérialise 20 h–23 h ; le mode détaillé le remplace par des intervalles. Les modifications futures du réglage rapide ne réécrivent pas les réponses enregistrées.

Utiliser Europe/Paris, la date du lundi comme identité de semaine, des intervalles semi-ouverts et des bornes persistées en `timestamptz`. Une couche temporelle commune utilise `@js-temporal/polyfill`. Grille de quinze minutes ; semaines éditables : courante plus trois suivantes.

Découper une plage nocturne à minuit local et enregistrer les journées affectées atomiquement. Copier des heures locales, jamais des instants augmentés de 168 heures. Refuser les heures inexistantes ; faire choisir l'occurrence d'une heure répétée. Fournir un aperçu de copie, remplir par défaut les réponses manquantes et exiger un choix explicite pour remplacer celles existantes.

## Alternatives écartées

- Une journée « disponible » sans horaire : ne permet pas de produire un chevauchement exact.
- Disponible toute la journée : trop large par rapport à l'intention retenue pour le mode rapide.
- UTC seul et ajout d'une semaine en millisecondes : décale les horaires locaux au changement d'heure.
- Fuseau implicite du navigateur : résultats différents selon l'appareil ou le voyage d'un membre.

## Conséquences

La copie est une transformation avec prévisualisation et conflits, pas une duplication de lignes. La base doit vérifier l'accord entre état et intervalles et éviter les chevauchements. Une journée locale peut avoir 23 ou 25 heures ; les contrôles ne supposent pas 24 heures fixes.

## Vérification

T-AVAIL, T-COPY et T-TIME : bornes contiguës, minuit, années ISO, Paris mars/octobre, sources/cibles modifiées après aperçu, horizon et transaction multi-journées. Référence : [modèle temporel](../database.md#disponibilites-et-temps).
