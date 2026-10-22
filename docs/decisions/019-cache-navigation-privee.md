# ADR 019 — Cache de navigation en mémoire avec contrôle d’accès frais

Le contrôle bloquant de cette décision est supersédé par l’[ADR 024](024-navigation-immediate-et-commandes-legeres.md), après accord explicite de l’utilisateur. Le préchargement, les contrôles serveur et l’abandon des contextes périmés restent en place.

- Statut : implémentée ; validation détaillée dans la [recette](../navigation-validation.md).
- Date : 2026-10-21.
- Remplace les décisions de l’ADR 018 concernant l’absence de cache de pages et le layout sans contrôle initial. Ne change pas les règles du service worker des ADR 008 et 014.

## Contexte et décision

Les déplacements répétés entre les quatre onglets restent trop lents. Le besoin est de réutiliser leur contenu sans prolonger les droits d’un compte révoqué ou remplacé. Utiliser le Router Cache stable de Next.js, avec `prefetch={true}` sur les quatre liens principaux seulement. Ce cache de rendu reste en mémoire dans le navigateur ; aucun Redis, Data Cache partagé, stockage local ou cache privé du service worker n’est ajouté. Le [préchargement Next.js](https://nextjs.org/docs/app/guides/prefetching) déplace une partie du travail avant le clic ; il ne supprime pas le coût du premier chargement.

Le layout établit une empreinte opaque du compte, de l’adhésion, du rôle, de sa révision et de son époque de participation. Cette empreinte n’est pas un jeton d’accès. Avant une navigation vers un onglet préchargé, un nouvel appel non stocké à `/api/session-status` contrôle le compte auprès d’Auth et l’adhésion active sous RLS. Le sujet vérifié par `getClaims` permet de lancer ces deux lectures en parallèle ; `getUser` reste obligatoire avant une réponse positive. Aucun résultat d’autorisation n’est mémorisé. Les vérifications de reprise simultanées peuvent partager leur requête en cours ; un clic de navigation lance sa propre vérification.

Un changement de contexte déclenche une navigation complète et abandonne les vues du contexte précédent. Un accès refusé renvoie à la connexion ; une erreur temporaire conserve l’écran courant avec une explication, sans afficher la destination en cache. Le retour navigateur masque la destination jusqu’au contrôle. Les pages, sous-routes et commandes continuent toutes leurs propres contrôles serveur ; RLS reste inchangée.

## Fraîcheur et invalidation

- Une mutation réussie invalide le layout racine avec `revalidatePath`, donc aussi les écrans préchargés dépendant de cette mutation.
- Les modifications faites par un autre membre ne sont pas diffusées en temps réel. Le bouton Actualiser et le retour depuis l’arrière-plan rafraîchissent les données ; une saisie modifiée reste protégée.
- Le simple focus ne déclenche plus systématiquement un nouveau rendu serveur. Il contrôle toujours les droits.
- La durée de réutilisation dépend du Router Cache de Next.js ; ce n’est pas une garantie de fraîcheur métier. Les échéances, révisions, droits et invariants restent opposables côté serveur lors des commandes.
- Déconnexion, remplacement de compte et changement de rôle sont couverts par des parcours directs et par l’historique. La restauration d’une page via le back-forward cache déclenche un rechargement.

## Alternatives et conséquences

Un cache serveur partagé de données privées imposerait des clés et invalidations supplémentaires sans résoudre seul la navigation. Un cache hors connexion accroîtrait la persistance de données privées. Les deux sont écartés. Retirer les contrôles d’accès est exclu.

Le préchargement consomme quelques lectures à l’ouverture et une navigation exige toujours une requête d’autorisation. Un réseau lent reste perceptible ; le chargement froid, la réception Push sur appareil réel et la latence iPhone en production ne sont pas démontrés par la recette locale. Aucun coût de service supplémentaire ni migration n’est nécessaire.

## Vérification

Le scénario reproductible compare les mêmes douze changements d’onglet avec un délai artificiel identique de 120 ms sur les requêtes de rendu et de contrôle. Les tests vérifient aussi invalidation, révocation, changement de rôle/compte, déconnexion, historique et panne du contrôle. Les résultats et limites sont consignés dans la [recette de navigation](../navigation-validation.md).
