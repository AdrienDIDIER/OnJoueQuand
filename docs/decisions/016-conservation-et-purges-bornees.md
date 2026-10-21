# ADR 016 — Conservation, horodatages et purges bornées

- Statut : implémentée et vérifiée localement ; aucune purge de production.
- Date : 2026-10-21.
- Portée : J8, PR-16 ; applique les durées déjà approuvées dans le [modèle](../database.md#conservation-et-suppression).

## Contexte

Les durées de conservation étaient définies, mais aucun job ne les appliquait. Les sessions ne possédaient pas de date de dernière modification ou de terminalisation ; leur seule date de création ne permettait pas de préserver une annulation récente ou un brouillon récemment modifié.

## Décision

Ajouter `sessions.updated_at`, `sessions.terminal_at` et `invitations.terminal_at`, renseignés par triggers. Une fin de session utilise la fin du créneau confirmé ; annulation et expiration sont datées au changement d’état. L’expiration d’une invitation utilise son échéance. Une modification ultérieure ne décale pas le début de conservation d’un état terminal inchangé. Un brouillon modifié reçoit une nouvelle date serveur.

Pour les sessions historiques terminées, utiliser la fin connue du créneau. Pour les autres dates historiques inconnues, prendre la date de migration, afin de ne pas supprimer prématurément des données. Les invitations déjà acceptées disposent de `accepted_at` ; sinon reprise prudente à la migration. Cette première reprise peut prolonger la conservation de l’existant et devra être revue avant import de données réelles.

La RPC `purge_retained_data` est réservée à `service_role`, refusée aux utilisateurs, y compris administrateurs. Le job authentifié appelle la purge après les transitions de session et conserve ses compteurs agrégés. L’heure vient de PostgreSQL ; le paramètre d’horloge existe pour les tests internes uniquement et n’est jamais transmis depuis une requête HTTP utilisateur.

Chaque catégorie traite cent lignes au maximum par passage normal, avec plafond interne de cinq cents. Le verrou de groupe est pris avant les lignes, comme dans les autres commandes. `SKIP LOCKED` évite d’attendre sur les travaux réservés ; les passages suivants reprennent le reste. Les notifications possédant encore une livraison restent protégées, y compris pendant un claim concurrent qui modifie son bail sans verrou de groupe.

Calculer la frontière des douze semaines depuis le lundi local de Paris, et les douze mois en calendrier parisien. Les quatre-vingt-dix jours des journaux correspondent à 2 160 heures écoulées ; aucun calcul ne dépend du fuseau de connexion. Les compteurs de fréquence conservent vingt-quatre heures.

Les travaux expirés sont terminalisés avant suppression. Un bail vivant n’est pas supprimé. Les notifications internes restent quatre-vingt-dix jours après création ; leurs livraisons deviennent supprimables à expiration de la notification. Les outbox terminales sont conservées au plus quatre-vingt-dix jours depuis `available_at`, date disponible du travail. Les jobs terminés utilisent `finished_at`. Profils, adhésions, jeux et comptes Auth ne sont pas supprimés automatiquement.

Les liens de session incluent une sélection explicite par UUID soumise à RLS ; ils fonctionnent au-delà de la première page. Une session supprimée ou inaccessible produit la même explication française, sans révéler son existence.

## Alternatives écartées

- Purger les sessions selon leur création : peut effacer une session future ou une annulation récente.
- Une purge non bornée dans chaque job : allonge les verrous et risque de dépasser son bail.
- Une action d’administration permettant de choisir librement l’heure : inutile et dangereuse pour la conservation.
- Supprimer une notification en vérifiant seulement le statut courant d’un bail : une réservation concurrente peut changer ce statut pendant la suppression.

## Vérification et limites

Migrations depuis zéro, droits avec JWT, cascades, frontières Paris au changement d’heure, baux vivants, réexécution et deux connexions concurrentes testés sur J8Validation. Les scénarios de suppression sont annulés transactionnellement. Les suites J2–J8 sont rejouées sur cette même stack synthétique. L’application locale reçoit la migration sans exécution de purge sur sa base utilisateur ; le cron reste désactivé. Contrôler compteurs, sauvegarde et rythme de rattrapage avant toute activation de production.
