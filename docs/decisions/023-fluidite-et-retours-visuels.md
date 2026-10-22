# ADR 023 — Lectures autorisées en parallèle et retours visuels

- Date : 22 octobre 2026.
- Statut : implémentée ; résultats dans la [recette](../fluidity-validation.md).
- Complète les ADR 018 et 019, sans modifier leurs règles de cache.

## Contexte

Le groupe souhaite une interface mobile simple, une attente compréhensible et des transitions discrètes. Le préchargement réduit déjà les déplacements répétés ; les premières ouvertures passent encore par une vérification de compte puis une lecture d’adhésion successives. Une animation ne remplace pas une optimisation serveur.

## Décision

Un client Supabase est dédupliqué uniquement dans le rendu courant avec `React.cache`. `requireMember` obtient un sujet par `getClaims`, puis démarre ensemble `getUser` en direct et la lecture d’adhésion sous RLS. Aucun contexte autorisé n’est retourné avant les deux résultats ; le compte Auth doit correspondre au sujet signé et l’adhésion doit être active. Une erreur de lecture ne devient pas une absence d’adhésion. `requireAccount` conserve son contrôle Auth direct. Avec les JWT asymétriques hébergés, la vérification de signature permet de lancer ces lectures indépendantes sans attendre un premier aller-retour Auth. Le mode local peut utiliser un repli réseau pour `getClaims` : ce gain n’est pas garanti sur toutes les configurations.

Retoucher la destination déjà ouverte ne lance ni sonde ni navigation et annule une intention encore en attente ; une ancre conserve son comportement natif. Le bouton Actualiser reste la commande de lecture fraîche. Chaque véritable déplacement vers un onglet en cache garde sa sonde dédiée sans stockage ; une réponse à un clic dépassé par un autre est ignorée avant de modifier l’interface.

Les chargements utilisent des aperçus neutres, sans données privées, annoncés une seule fois aux lecteurs d’écran. Un indicateur apparaît dans l’onglet demandé. Le retour navigateur conserve son masquage jusqu’au contrôle d’accès et affiche le même aperçu neutre. Le bouton Actualiser indique son activité pendant la vérification et la transition de rafraîchissement ; il empêche les doubles demandes. Les formulaires de disponibilités et soirées signalent les soumissions occupées avec `aria-busy`.

Une enveloppe de page applique une entrée de 180 ms ; les dialogues ont une entrée courte et les boutons un retour tactile visuel. Les gestes ne sont jamais bloqués dans l’attente de l’animation. Les effets utilisent opacité et transformations ; le réglage système de réduction des animations les désactive, y compris les animations de chargement. Les indicateurs statiques restent visibles. Aucun paquet d’animation ajouté.

## Conséquences et limites

- Pas de migration, nouveau cache, stockage persistant privé ou changement du service worker.
- Les contrôles positifs conservent Auth direct, adhésion active et RLS. Les tests couvrent compte refusé, sujet incohérent, révocation et panne de lecture.
- Le clic sur l’onglet courant n’est plus une actualisation implicite. Utiliser Actualiser pour récupérer les changements des amis.
- Les mesures de navigation préchargée ne mesurent pas le gain de la nouvelle orchestration d’ouverture ; ne pas leur attribuer une accélération causale non démontrée.
- Aucun essai synthétique ne remplace une mesure sur le téléphone et le réseau réels.
