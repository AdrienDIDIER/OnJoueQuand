# Décisions d'architecture

Ces ADR consignent le plan approuvé le **15 octobre 2026**. Leur statut « Acceptée » porte sur la conception ; il ne signifie pas que toutes les fonctionnalités existent. Les rapports [J1](../j1-validation.md), [J2](../j2-validation.md), [J3](../j3-validation.md), [J4](../j4-validation.md), [J5](../j5-validation.md), [J6](../j6-validation.md) et [J7](../j7-validation.md) précisent les fonctionnalités réellement livrées et leurs limites.

| ADR | Décision | Statut | Jalons concernés |
| --- | --- | --- | --- |
| [001](001-monolithe-et-stack.md) | Monolithe modulaire, stack et politique de versions | Acceptée | J1–J8 |
| [002](002-groupe-unique-et-autorisations.md) | Groupe unique, rôles et autorisations serveur/RLS | Acceptée | J2–J8 |
| [003](003-invitations-et-otp.md) | Invitations nominatives et OTP e-mail | Acceptée | J2, J8 |
| [004](004-disponibilites-et-fuseau.md) | Disponibilités, copie et Europe/Paris | Acceptée | J3–J6 |
| [005](005-matching.md) | Matching déterministe par intersection de disponibilités | Implémentée J4–J5 | J4–J5 |
| [006](006-votes-et-rsvp.md) | Propositions, votes multiples et RSVP explicites | Implémentée localement | J5 |
| [007](007-notifications-et-ordonnanceur.md) | Outbox, Supabase Cron et Web Push | Implémentée localement ; activation et appareils à valider | J6, J8 |
| [008](008-pwa-et-cache.md) | PWA installable et absence de cache privé hors connexion | Code vérifié localement ; appareils à valider | J7 |
| [009](009-deploiement-et-sauvegardes.md) | Hébergement économique, CI et restauration | Acceptée | J1, J8 |
| [010](010-premier-code-et-invitation-smtp.md) | Premier code de confirmation et invitation via SMTP Auth ; précise 003 | Implémentée localement | J2 |
| [011](011-disponibilites-et-apercus.md) | Disponibilités transactionnelles, copie et aperçus signés ; précise 004 | Implémentée localement | J3 |
| [012](012-sessions-transactions-et-retour-membre.md) | Sessions transactionnelles, époque de participation et outbox | Implémentée localement | J5–J6 |
| [013](013-notifications-et-livraison-bornee.md) | Notifications, baux, endpoints et ordonnancement désactivé par défaut | Implémentée localement ; réception réelle à valider | J6–J8 |
| [014](014-pwa-cache-et-mises-a-jour.md) | PWA, cache public, mises à jour et retour au premier plan | Code vérifié localement ; appareils à valider | J7 |
| [015](015-sauvegardes-privees-et-recette-exploitation.md) | Sauvegardes privées et répétition de récupération | Outils validés localement ; activation distante non effectuée | J8 |
| [016](016-conservation-et-purges-bornees.md) | Conservation, dates fiables et purges bornées | Vérifiée localement ; aucune purge de production | J8 |
| [017](017-navigation-mobile-et-reponses-rapides.md) | Écrans mobiles et réponses rapides | Implémentée | Revue mobile |
| [018](018-interface-chaleureuse-et-latence.md) | Interface chaleureuse et exécution à Dublin | Implémentée ; cache précisé par 019 | Revue mobile |
| [019](019-cache-navigation-privee.md) | Cache des onglets en mémoire, contrôles frais et invalidation | Implémentée ; voir recette | Revue mobile |
| [020](020-soirees-simples-et-test-push.md) | Soirée à horaire unique, états quotidiens et test Push personnel | Validée localement ; migrations distantes appliquées | Simplification produit |
| [021](021-invitation-installation-au-demarrage.md) | Invitation au démarrage et installation native si disponible | Validée localement ; aucune migration supplémentaire | Installation PWA |
| [022](022-notifications-au-lancement-installe.md) | Invitation Push après lancement depuis l’icône et connexion | Validée localement ; aucune migration | Notifications PWA |

Chaque ADR contient contexte, décision, alternatives, conséquences et vérification. Une modification structurelle crée une nouvelle ADR qui remplace explicitement l'ancienne ; ne pas effacer l'historique d'une décision appliquée. Les détails normatifs évoluent dans le [PRD](../product-requirements.md), l'[architecture](../architecture.md) et le [modèle de données](../database.md) avec la même modification.
