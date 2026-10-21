# ADR 020 — Soirées simples, repères quotidiens et test Push

- Statut : implémentée et validée localement ; migrations 011/012 appliquées au projet hébergé le 21 octobre 2026 après accord utilisateur.
- Date : 2026-10-21.
- Décision produit approuvée ; remplace la création de nouvelles propositions prévue par les ADR 006 et 012. Les données et parcours historiques restent compatibles.

## Soirées

L’onglet **Sessions** devient **Soirées** ; `/sessions` reste stable pour les liens existants. Le formulaire demande une date et une heure de début à Paris ; nom et jeu sont facultatifs. La fin prévue, affichée avant validation, vaut 23 h et reste modifiable dans les détails. Si elle ne dépasse pas le début, elle désigne le lendemain. Maximum : 25 heures réelles, pour permettre le passage à l’heure d’hiver sans invalider une journée civile.

`create_evening` crée et confirme un rendez-vous à horaire unique dans une transaction : adhésion active, verrou du groupe et du membre, jeu actif, instants futurs et idempotence. Un double envoi concurrent donne une seule soirée et un seul événement d’outbox. Aucun vote, brouillon ou quorum pour ce nouveau parcours. Chacun, y compris l’organisateur, répond explicitement **Je viens** ou **Sans moi**. Les révisions, chevauchements et annulations gardent leurs contrôles SQL existants.

Les suggestions proposent le formulaire prérempli avec leur date. Elles ne garantissent pas une disponibilité au-delà de l’intervalle affiché et ne créent pas de participation. Les anciennes propositions restent accessibles et terminables, sans conversion ni suppression.

## Accueil

Les sept traits représentent les dates réelles du lundi au dimanche, plutôt qu’une jauge remplie de gauche à droite. Vert : disponible ; rouge : indisponible ; trait discontinu neutre : sans réponse. Une description accessible nomme les dates et états ; le compteur compte les réponses, sans assimiler indisponibilité et absence de réponse. L’invalidation de l’ADR 019 met les repères à jour après saisie.

## Test Push

Dans Groupe → Mes réglages, **Tester les notifications** cible seulement l’appareil courant, déjà activé et appartenant au membre connecté. Aucune demande de permission implicite. La préférence Push est respectée. `reserve_push_test` vérifie adhésion, appareil et une limite d’un essai par minute, durable et protégée par verrou. Sa table privée n’est pas accessible aux clients.

Le serveur valide l’endpoint et les clés puis utilise VAPID pour un message générique valable 60 secondes. Ce test ne lance ni cron ni rappels collectifs. Une acceptation fournisseur ne démontre pas l’affichage sur iPhone ; le mode Concentration peut notamment le masquer. Les abonnements expirés sont retirés et les erreurs sont expliquées sans exposer les clés.

## Migrations et livraison

`202610210011_evenings.sql` et `202610210012_push_test.sql` sont additives ; les tables et RLS publiques existantes restent inchangées. Les types sont régénérés depuis la base synthétique. L’utilisateur a autorisé la migration le 21 octobre 2026 ; un dry-run a confirmé les deux seuls fichiers attendus, puis `db push --linked` les a appliqués à `catspvwwtoyhwgnjhrix`. La liste distante confirme les quatorze versions alignées. Aucun seed, rôle, invitation ou traitement collectif ajouté. Les migrations précèdent la publication applicative par GitHub/Vercel.

Tests : domaine temporel sous Vitest ; PostgreSQL réel pour atomicité, idempotence, accès anonyme/non-membre/révoqué, participations concurrentes, propriété d’appareil, préférences et limitation ; Playwright pour le parcours à deux comptes, le formulaire court et les repères après modification. La réception Push reste à essayer sur l’iPhone installé.
