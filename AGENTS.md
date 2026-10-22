# Consignes de contribution — OnJoueQuand

## État et portée

La préparation initiale J8 est commitée dans `40f6abb`. Une suite locale ajoute conservation/purges bornées et liens de sessions sélectionnées ; voir l’[ADR 016](docs/decisions/016-conservation-et-purges-bornees.md). Les tests de purge doivent rester sur une stack synthétique dédiée, avec rollback ; les parcours HTTP du worker exécutent maintenant une vraie purge selon l’heure de la base et ne doivent pas cibler une base utilisateur à conserver. Ne pas confondre cette validation locale avec un lancement du pilote.

J0 à J7 sont commités (J7 `0980d66`) ; J0–J6 sont poussés et la CI J6 est verte. J8 prépare sauvegarde chiffrée, restauration synthétique et exploitation, sans lancement ; voir le [rapport J8](docs/j8-validation.md) et le [guide](docs/operations.md). Ne jamais sauvegarder des données réelles dans les artefacts de ce dépôt public : le workflow dédié refuse les dépôts publics. La répétition de restauration exige une stack synthétique JxValidation et refuse le conteneur principal. Le worker PWA cache seulement la page générique et quatre icônes ; toute modification exige une revue de confidentialité et une nouvelle version de cache. Une mise à jour ne recharge que l’onglet demandeur. Installation/Push réels restent à valider dans la [fiche](docs/pwa-device-checklist.md). Cron inactif par défaut ; voir le [guide notifications](docs/notifications-operations.md). Chaque page et commande vérifie identité/adhésion ; `(prive)` ne protège rien seul. Références : [PRD](docs/product-requirements.md), [architecture](docs/architecture.md), [données](docs/database.md), [roadmap](docs/roadmap.md).

Ne pas démarrer les jalons applicatifs à partir d'une demande documentaire seule. Une demande explicite de réalisation d'un jalon ou d'une fonctionnalité autorise le travail correspondant ; ne pas redemander une autorisation déjà donnée. Ne pas provisionner de services payants, publier, migrer une production ou envoyer des invitations réelles sans autorisation correspondante.

## Produit et langue

- Toute interface, erreur utilisateur, notification, instruction d'installation et communication e-mail est en français. Les identifiants techniques peuvent être en anglais.
- Préserver les quatre onglets : Accueil, Dispos, Soirées, Groupe. `/sessions` reste stable. Les nouvelles soirées sont directement confirmées avec un horaire unique ; les anciennes propositions restent compatibles. Voir [ADR 020](docs/decisions/020-soirees-simples-et-test-push.md).
- Un groupe privé unique ; 6 à 15 personnes est la cible, pas un quota métier.
- Utiliser Europe/Paris comme fuseau métier et la date locale du lundi comme identité de semaine.
- Ne jamais assimiler absence de réponse à indisponibilité, vote favorable à RSVP, ni RSVP à présence réelle.
- Les décisions nouvelles qui changent le produit doivent être explicitées ; ne pas ajouter silencieusement statistiques, sondages, paiements ou intégrations au MVP.

## Architecture

La revue mobile précharge les quatre onglets dans le Router Cache en mémoire. L’utilisateur a explicitement accepté leur réaffichage immédiat avec contrôle d’accès en arrière-plan : ne pas réintroduire une attente de sonde avant `router.push`. Une révocation ou un changement de contexte ferme les anciennes vues ; toute nouvelle lecture et commande vérifie toujours compte et adhésion. Le layout établit le contexte initial ; un changement d’empreinte reçu dans un rendu abandonne aussi les snapshots. Le proxy utilise `getClaims` ; les contrôles positifs gardent `getUser` et RLS. Toute mutation réussie invalide les vues privées via `revalidatePrivateViews`. La réponse rapide utilise une Route Handler JSON, sans rendu global, avec origine, contexte et révision vérifiés. Ses confirmations restent dans un contexte React du membre, borné à 56 journées, sans écraser une révision plus récente ni les données d’un autre membre. Aucun stockage persistant privé. Vercel cible Dublin (`dub1`) près de Supabase `eu-west-1`. Utiliser `loadOwnWeek` pour les disponibilités personnelles. Voir [ADR 024](docs/decisions/024-navigation-immediate-et-commandes-legeres.md) et [recette](docs/instant-navigation-validation.md).

- Monolithe modulaire, organisation par fonctionnalité. Suivre la structure cible de l'architecture sans créer de dossiers vides inutiles.
- Domaine pur : pas d'import React, Next.js, Supabase, réseau ou horloge globale. Injecter l'heure dans les règles testables.
- Les couches application orchestrent ; infrastructure adapte PostgreSQL, Auth et Push ; UI présente et collecte.
- Privilégier les Server Components pour les lectures, les Server Actions validées pour les commandes et les transactions SQL/RPC pour les invariants concurrents.
- Les imports entre fonctionnalités passent par des contrats publics ; pas de dépendance à leurs composants ou dépôts internes.
- Pas de microservices, ORM, Redis, bus externe ou cache de données privées sans ADR motivée.
- Cadrage PWA : conserver `viewport-fit=auto` et la barre système Apple `black` ; voir [ADR 025](docs/decisions/025-viewport-ios-sans-superposition.md). Ne pas réintroduire une compensation de hauteur ni un scroll forcé pour masquer la bande de lancement iOS. La validation native nécessite une nouvelle installation et un retour appareil.
- npm et lockfile ; versions stables compatibles, aucun canary applicatif. Vérifier les versions et correctifs officiels au démarrage de J1 ; ne pas traiter les repères documentaires comme des paquets déjà installés.

## Sécurité et données

- Vérifier la session et l'appartenance active côté serveur pour chaque lecture ou mutation protégée. L'acteur vient de la session, jamais d'un identifiant client faisant autorité.
- Activer RLS sur toute table exposée. Tester les accès directs avec des utilisateurs réels de test, sans clé privilégiée.
- Ne pas contourner RLS pour les opérations ordinaires. La clé secrète Supabase reste réservée au provisionnement Auth et aux traitements internes justifiés.
- Chaque RPC privilégiée doit contrôler l'acteur, le rôle, les relations et l'état ; fixer son `search_path` et limiter ses droits d'exécution. Ne pas faire confiance aux métadonnées utilisateur pour les rôles.
- Les mutations complexes, leur audit et l'outbox sont transactionnels. Ne pas envoyer un Push à l'intérieur d'une transaction SQL.
- Utiliser des clés étrangères, contraintes et verrous pour les invariants. Un contrôle UI ou une lecture avant écriture ne protège pas contre deux requêtes concurrentes.
- Versionner les migrations ; ne pas modifier une migration déjà appliquée à un environnement partagé. Régénérer les types Supabase après modification du schéma.
- Aucun secret, OTP, jeton, clé Push ou donnée personnelle dans les commits, captures et journaux. Ne jamais affecter de secret serveur à une variable publique.
- Ne pas mettre en cache persistant des pages authentifiées ou données privées dans le service worker.

## Temps et concurrence

- Conversions temporelles uniquement via l'adaptateur commun `@js-temporal/polyfill` prévu ; pas de conversions au fuseau implicite du serveur ou du navigateur.
- Intervalles semi-ouverts `[début, fin[`, instants en UTC, regroupement par date locale. Copier les horaires locaux, pas une durée UTC d'une semaine.
- Refuser les heures inexistantes ; demander l'occurrence des heures répétées. Tester les deux transitions d'heure de Paris et le passage d'année ISO.
- Une échéance de vote est opposable selon l'horloge PostgreSQL, même si le cron est en retard.
- Vérifier les révisions attendues sur les mutations exposées aux éditions concurrentes et fournir une erreur française permettant de recharger.

## Vérification et livraison

- Pour une modification documentaire : vérifier les liens locaux, la traçabilité des exigences, la cohérence des valeurs/états et `git diff --check`. Ne pas installer de framework de test pour cela.
- Pour du domaine : Vitest et cas métier significatifs, avec horloge contrôlée.
- Pour des règles SQL/RLS : Supabase/PostgreSQL local, comptes anonymes, non membres, membres, administrateurs et révoqués ; tests concurrents lorsque l'invariant l'exige.
- Exécuter les suites SQL sur une base synthétique dédiée : Auth exige un bootstrap neuf et les tests de rappels simulent l’heure pour tout le groupe. Ne pas les lancer sur une base utilisateur à conserver. Nettoyer uniquement les UUID de fixtures identifiés.
- Pour les parcours : Playwright ; les tests navigateur ne remplacent pas la validation d'installation et de Push sur appareils iOS/Android réels.
- Exécuter lint, typage, tests pertinents et build lorsque le socle les fournit. Ne pas annoncer un test exécuté s'il est seulement prévu.
- Ne pas ajouter des tests qui ne font que recopier l'implémentation. Ne pas lancer une batterie sans rapport pour une modification de texte.
- Mettre à jour les documents qui définissent le comportement modifié et ajouter/superséder une ADR en cas de changement structurel.
- Rapporter le résultat, les vérifications réellement effectuées et les limites restantes. Ne pas faire passer un jalon prévu pour livré.
