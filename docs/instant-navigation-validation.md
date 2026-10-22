# Recette — Suppression de l’attente réseau à chaque onglet

Date : 22 octobre 2026. Référence : `a150770` et sa [recette précédente](fluidity-validation.md). Décision : [ADR 024](decisions/024-navigation-immediate-et-commandes-legeres.md), après accord explicite sur le contrôle des vues reçues en arrière-plan.

## Diagnostic et corrections

Deux coûts évitables étaient dans le chemin du clic : la sonde d’accès avant `router.push`, et le rendu React renvoyé par une réponse rapide suivie de l’invalidation du layout racine. Les onglets reçus se réaffichent maintenant avant leur contrôle ; les réponses rapides utilisent une petite commande JSON et une réconciliation locale des journées confirmées.

Les nouvelles lectures gardent `getUser`, l’adhésion et RLS. Le nouvel endpoint vérifie aussi origine, format, taille, empreinte du contexte et révision. Les réponses dépassées ou provenant d’un composant démonté ne changent pas le contexte actif. Le service worker reste inchangé.

## Mesures contrôlées

Build de production local, stack synthétique J8Validation, Chromium, un travailleur. Les benchmarks affichent uniquement durées, types de réponse et compteurs. Aucun contenu, jeton ou identifiant personnel n’est journalisé.

| Mesure | Avant | Après |
| --- | --- | --- |
| Médiane de douze changements d’onglet préchargé | 234,5 ms | 65,5 ms |
| Contrôles d’accès par changement | 1 bloquant | 1 en arrière-plan |
| Requêtes de contenu par changement, hors préchargement | 0 | 0 |
| Médiane de six réponses Dispo/Non jusqu’à confirmation | 216 ms | 190 ms |
| Réponse à Dispo/Non | `text/x-component` | `application/json`, moins de 1 Ko |

Navigation : protocole identique à la recette précédente, avec 120 ms ajoutées aux requêtes RSC et de contrôle. Le résultat attend le contenu utile ; le préchargement initial est exclu. Différence observée : environ 72 % de temps en moins sur ce scénario. Une sonde volontairement retenue sans échéance ne bloque plus l’affichage des onglets dans les tests fonctionnels.

Réponses rapides : six modifications successives, 120 ms ajoutées à chaque POST, même poste et même base synthétique. Différence observée : environ 12 % jusqu’à l’accusé serveur. Le changement de sélection est visible pendant l’attente, mais le compteur n’annonce une sauvegarde qu’après succès. Les durées internes locales de l’endpoint sont de quelques millisecondes à quelques dizaines de millisecondes ; elles ne prédisent pas les délais Supabase/Vercel en production. Le découpage Auth/commande est disponible dans `Server-Timing` sans donnée métier.

Ces petites séries ne sont ni un percentile de production ni un engagement de latence sur iPhone. Le principal résultat structurel est vérifié indépendamment des durées : le réseau de contrôle n’est plus une condition préalable à l’affichage d’une vue déjà reçue, et une réponse rapide ne provoque plus de rendu global.

## Tests et limites

Lint, typage strict, build et 70 tests Vitest réussis. Les protections d’origine couvrent l’URL interne d’un proxy, le HTTPS public, les origines étrangères et les en-têtes transférés non fiables. Le nouveau parcours HTTP couvre anonymes, révoqués, corps invalides, taille, contexte périmé, révisions concurrentes et correspondance avec PostgreSQL.

Les parcours navigateur vérifient aussi les compteurs et couleurs après confirmation, les vues reçues de l’accueil et du calendrier, l’annulation d’un affichage optimiste refusé, un jour lent pendant qu’un autre est enregistré, la navigation pendant une écriture et la mise à jour après changement d’onglet. Rôle, changement de compte, déconnexion, historique et sous-routes protégées conservent leurs scénarios.

Passe générale de 260 cas : 258 réussites, un test clavier WebKit ignoré sur Windows et un échec Firefox sur les favoris. Cet échec a révélé un défaut réel : la confirmation recréait la carte et fermait les options ouvertes pendant l’attente. Les clés de cartes ne dépendent plus du seul favori ou RSVP ; les huit parcours jeux/sessions ont ensuite réussi sur les quatre profils. Après le bornage de lecture en flux, les vingt tests du nouvel endpoint et de ses interactions réussissent également, y compris un corps trop grand sans `Content-Length`. Les résultats ne sont pas présentés comme une unique passe générale finale verte ; la CI rejouera les 260 cas sur Linux.

La stack synthétique porte exclusivement le projet J8Validation sur les ports 60321/60322. Aucun reset personnel, migration distante, e-mail réel, Push externe ou activation de cron. Les suites SQL existantes n’ont pas été modifiées ; la nouvelle concurrence est aussi exercée par deux requêtes HTTP réelles vers la RPC existante.

Les scénarios d’origine ont d’abord révélé la différence entre URL interne et Host public de Next ; le contrôle a été corrigé et testé. Les premières assertions de test ont également été corrigées pour comparer les instants UTC, et non les notations équivalentes `Z` et `+00:00`, et pour envoyer un JSON réellement mal formé depuis Playwright.

Pour reproduire : les deux fichiers dans `tests/performance` utilisent le lanceur et la configuration décrits dans la [recette de navigation](navigation-validation.md). Sur ce poste, utiliser exclusivement les copies ignorées pointant sur J8Validation. Un démarrage non encore préchargé et la réception Push sur appareil réel restent des validations séparées.
