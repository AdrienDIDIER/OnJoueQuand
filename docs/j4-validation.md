# J4 — Jeux, favoris et créneaux communs

État au **21 octobre 2026**. J2 est commité dans `5cac4e7`, J3 dans `b62d4b7`, séparément. J4 est commité dans `55aa56d`. Aucun push, déploiement, migration distante ni envoi réel. Ce rapport conserve les résultats au terme de J4 ; le raccordement ultérieur des RSVP figure dans le [rapport J5](j5-validation.md).

## Portée livrée

PR-06 et PR-07 : catalogue manuel dans Groupe, création par tout membre actif, modification/archivage par le créateur ou un administrateur, favoris personnels et compteur des préférences des membres actifs. Les jeux archivés restent consultables via un filtre et conservent leur ligne et leurs favoris historiques ; ils ne sont plus proposés aux nouvelles recherches. Un favori ne garantit pas la possession d'un jeu.

Dans Dispos, la recherche part de la semaine affichée, des membres actifs, de deux joueurs et de soixante minutes. Les filtres couvrent période, durée par pas de quinze minutes, seuil, membres et jeu facultatif. Les critères sont conservés après recherche. Le serveur vérifie à nouveau dates, horizon, membres actifs et jeu non archivé. Les résultats sont expliqués, limités à dix et ne créent aucune session.

## Calcul et contrats

La fonction pure [findMatches](../src/features/matching/domain.ts) reçoit intervalles, engagements, favoris et instant de référence. Elle normalise les intervalles par membre, soustrait leurs engagements occupés, balaie les bornes en conservant les identités, puis évalue chaque départ sur la grille de quinze minutes. L'intersection des membres est calculée sur toute la fenêtre ; aucun membre présent seulement sur une portion n'est compté.

Les candidats sont triés par effectif décroissant, puis nombre de favoris du jeu choisi décroissant, puis début croissant. Les favoris ne constituent pas un filtre excluant les autres membres. Les plages sont semi-ouvertes ; des candidats peuvent se chevaucher entre eux. Les départs passés, les trous et les périodes sans réponse ne sont pas proposés.

Les conversions passent par l'adaptateur Paris. La grille avance sur les instants : elle énumère les deux occurrences d'automne et saute les heures inexistantes du printemps. La durée est une durée réellement écoulée. Les offsets des bornes répétées sont affichés pour les distinguer. Le code ne lit ni réseau ni horloge globale ; aucune recommandation n'est persistée.

Les lectures utilisent les contrats publics [availability/queries.ts](../src/features/availability/queries.ts) et [games/queries.ts](../src/features/games/queries.ts). Le [contrat des engagements](../src/features/matching/contracts.ts) est défini ; son [adaptateur J4](../src/features/matching/infrastructure/commitments.ts) retourne un ensemble vide, car les sessions n'existent pas encore en base. **J5 doit le brancher aux RSVP positifs des sessions confirmées, en tenant compte des membres révoqués et des annulations.** La soustraction est déjà exercée dans le domaine avec des fixtures, sans revendiquer une lecture réelle des RSVP.

## Données et autorisations

La [migration J4](../supabase/migrations/202610210001_games.sql) crée `games`, `game_favorites`, les FK composites, index, policies RLS et quatre RPC étroites. Les clients ordinaires n'ont aucun droit DML direct sur ces tables. Les RPC déduisent l'adhésion du JWT, verrouillent groupe puis adhésion, vérifient activité, rôle, parent et état, et fixent leur `search_path`.

La création est idempotente par identifiant de requête. La modification et l'archivage exigent la révision attendue ; une modification concurrente ne peut pas être écrasée silencieusement. Un favori compare son état binaire attendu avant d'être changé et ne peut appartenir qu'à l'acteur. Le retrait d'un favori archivé reste possible. Les noms font de 1 à 80 caractères ; les descriptions, facultatives, au plus 1 000 caractères. Le texte utilisateur est rendu comme texte React.

## Vérifications effectuées

| Contrôle | Résultat |
| --- | --- |
| Commits séparés | Instantané J2 extrait de l'index : typage et 11 tests unitaires réussis avant commit ; J3 livré dans le commit suivant. |
| Migration sur la base existante | Réussie sans réinitialisation ; types Supabase régénérés. |
| Installation neuve isolée | Trois migrations appliquées à `OnJoueQuandJ4Validation`, ports 57320–57324 ; huit tables publiques RLS. Projet temporaire arrêté après recette. |
| Lint, typage strict, build | Réussis. |
| Vitest | 35 tests réussis, dont dix cas matching et un cas de validation des jeux ajoutés en J4. |
| Fuseau du processus | `npm run check` réussi avec `TZ=Pacific/Honolulu`. |
| SQL/RLS J4 | Cinq scénarios, six tests Node en comptant le parent, réussis avec de vrais JWT. |
| Intégration complète J2–J4 | 25 tests réussis sur la base neuve isolée. Seuls endpoints et noms des conteneurs de test sont adaptés ; le SMTP et la base de développement ne sont pas réinitialisés. |
| Playwright J4 | Création, renommage, favoris, filtres conservés, suggestions, aucun résultat et archivage sur les navigateurs cibles. |
| Régression navigateur complète | 55 tests réussis ; seul le test de focus WebKit Windows déjà documenté est ignoré. |
| CI distante | Configurée pour les nouvelles suites ; non exécutée sur GitHub. |

Le domaine est comparé à un oracle indépendant sur quarante petites grilles déterministes. Les autres cas couvrent membres changeant en milieu de fenêtre, contiguïtés, doublons, trous, absence de réponses, engagements occupés, ordre de classement, limite de dix, seuil impossible, instant présent avec fraction de seconde et changements d'heure de Paris. Une heure réellement écoulée peut commencer à 02:30 première occurrence et finir à 02:30 seconde occurrence.

Les tests SQL vérifient création idempotente, accès anonymes/non membres/révoqués refusés, DML direct interdit, auteur/admin, révisions périmées, contraintes de texte, favoris propres au JWT, deux ajouts concurrents, édition concurrente à l'archivage et conservation de l'historique. Les fixtures J4 sont synthétiques et nettoyées à la fin.

Le parcours navigateur utilise deux membres aux disponibilités 20 h–23 h et 21 h–23 h. Pour une heure, les cinq candidats vont de 21 h–22 h à 22 h–23 h ; une durée de trois heures ne donne aucun résultat. Les contrôles vérifient également que le jeu, les membres et la durée restent sélectionnés après soumission. Les traces réseau sont désactivées.

## Benchmark reproductible

Fixture dans [domain.test.ts](../src/features/matching/domain.test.ts) : quinze membres sur vingt-huit journées, 420 intervalles avec départs variables de 16 h à 20 h et fin à 23 h, seuil deux, durée soixante minutes. Cinq échauffements puis trente mesures du calcul seul, sans réseau ni rendu. La mesure p95 observée est **3,37 ms**, sous la cible de 100 ms.

Environnement : Node **24.22.0**, Windows x64, **Intel Core i7-13700K**. Le résultat détaillé du dernier passage est écrit dans `.tools/j4-benchmark.json`, ignoré par Git. Le test vérifie le seuil, mais cette mesure n'est pas une garantie de latence réseau ou de cold start. Aucune dépendance applicative nouvelle n'a été ajoutée pour J4.

## Reproduire et poursuivre

```sh
npm run db:start
npm run db:migrate
npm run check
npm run test:games
npm run test:e2e
```

`test:games` nettoie ses propres fixtures et peut être utilisé sur une base locale existante. La suite complète `test:integration` inclut J2 et exige une base de test neuve. Ne pas utiliser un reset sur des données à conserver. La dernière recette complète a utilisé un projet Supabase temporaire distinct, désormais arrêté.

La lecture des engagements RSVP persistés, les propositions, les votes, la confirmation et les réponses de participation relèvent de J5. Le Push, le temps réel et les appareils PWA réels ne sont pas revendiqués. Les réserves de dépendances de développement de [J1](j1-validation.md#réserves-techniques) restent suivies ; les dépendances de production n'ont pas changé depuis J3.
