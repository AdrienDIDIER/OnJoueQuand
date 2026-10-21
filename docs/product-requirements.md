# Exigences produit — OnJoueQuand

Statut : J1–J6 réalisent socle, identité, disponibilités, jeux, sessions/RSVP et notifications. J7 réalise le code PR-12 et les contrôles ciblés PR-13 : PWA, repli public, installation contextuelle et mises à jour volontaires ; [preuves J7](j7-validation.md). Le cron reste désactivé ; installation/Push et accessibilité sur appareils réels restent à valider. J8 prépare exploitation et pilote. Voir aussi les preuves [J2](j2-validation.md), [J3](j3-validation.md), [J4](j4-validation.md), [J5](j5-validation.md), [J6](j6-validation.md).

## Vision et utilisateurs

OnJoueQuand aide un groupe privé de 6 à 15 amis et collègues à choisir quand jouer ensemble. La boucle centrale est : **renseigner → trouver → proposer → voter → confirmer → répondre présent**. Le parcours doit pouvoir être accompli sans outil de messagerie supplémentaire.

Le produit contient un seul groupe. L'accès est nominatif et sur invitation. « Premium » signifie une expérience soignée, pas une offre payante. Il n'existe pas de quota métier à quinze membres, mais le dimensionnement et les mesures du MVP portent sur cette taille.

| Acteur | Capacités |
| --- | --- |
| Visiteur/non-membre | Accéder à la connexion et à l'acceptation d'une invitation valide ; aucune donnée du groupe. |
| Membre actif | Renseigner ses disponibilités, consulter le groupe, gérer ses favoris, proposer une session, voter et répondre au RSVP. |
| Créateur d'une proposition | Gérer son brouillon, publier, clore le vote, confirmer ou annuler sa proposition. Ce n'est pas un rôle global. |
| Administrateur actif | Capacités membre, invitations, rôles, révocations, paramètres du groupe et gestion des propositions du groupe. |
| Membre révoqué | Aucun accès aux données privées ; aucun nouvel envoi Push. |

Les profils contiennent un nom d'affichage et des initiales, sans téléversement d'avatar au MVP. Les e-mails ne figurent pas dans l'annuaire partagé.

## Navigation et qualité d'expérience

| Onglet | Contenu |
| --- | --- |
| Accueil | Prochaine session et réponse attendue, complétude hebdomadaire, accès direct aux disponibilités et trois dernières notifications ; précédentes à la demande. |
| Dispos | Saisie personnelle, copie, calendrier collectif et recherche de créneaux. |
| Sessions | Brouillons autorisés, propositions, votes, confirmation, RSVP et historique. |
| Groupe | Membres et raccourcis vers les jeux/favoris, les réglages personnels et la gestion réservée aux administrateurs. |

Tous les contenus utilisateur sont en français : interface, e-mails, dates, erreurs, notifications et aide à l'installation. Une date ne doit pas dépendre du fuseau implicite du navigateur : les horaires sont ceux de Paris, avec indication du fuseau lorsque nécessaire.

Identité sombre, accents violets discrets, surfaces hiérarchisées et typographie lisible. Les trois états de disponibilité ont un libellé et un indicateur distinct de la couleur. Les composants sont utilisables au clavier, avec focus visible, réduction des animations et contrastes visant WCAG AA. L'interface s'adapte au téléphone, à la tablette et au bureau.

L’usage quotidien privilégie le téléphone : une action principale par carte et les commandes secondaires à la demande. Les réglages, le profil, l’aide à l’installation et la déconnexion se trouvent dans `/groupe/reglages`, le catalogue dans `/groupe/jeux`, les invitations et la gestion des accès dans `/groupe/gestion` (administrateurs uniquement). Ces écrans conservent l’onglet Groupe actif. Les disponibilités présentent d’abord les réponses personnelles ; copie et calendrier collectif sont repliés, avec une liste par journée sur mobile. La recherche fonctionne avec ses valeurs par défaut sans ouvrir ses filtres. Dans une proposition, voter reste visible, organiser nécessite d’ouvrir les commandes dédiées. Aucun droit ni règle métier n’est retiré par cette simplification.

Une réponse rapide « Dispo 20:00–23:00 » ou « Indispo » enregistre directement une seule journée, avec vérification de sa révision et des horaires affichés. Une journée détaillée ne propose pas ces raccourcis afin d’éviter de remplacer ses intervalles par erreur. Les horaires détaillés, les opérations traversant minuit et la copie conservent leur aperçu puis confirmation.

## Exigences et traçabilité

Les identifiants ci-dessous sont stables. Les scénarios de tests `T-*` et les jalons sont définis dans la [feuille de route](roadmap.md).

| ID | Exigence vérifiable | Livraison | Vérification |
| --- | --- | --- | --- |
| PR-01 | Groupe unique, accès privé par invitation ; aucune inscription publique donnant accès. | J2 | T-AUTH, T-RLS |
| PR-02 | Compte individuel, OTP e-mail, profil, révocation et protection du dernier administrateur. | J2 | T-AUTH, T-RLS |
| PR-03 | Journée sans réponse, indisponible ou disponible ; mode rapide 20 h–23 h et intervalles détaillés. | J3 | T-AVAIL, T-TIME |
| PR-04 | Copie d'une semaine avec aperçu, préservation de l'heure locale et protection des réponses existantes. | J3 | T-COPY, T-TIME |
| PR-05 | Calendrier collectif des disponibilités des membres actifs et complétude personnelle. | J3 | T-AVAIL, T-E2E |
| PR-06 | Suggestions de chevauchement exact, seuil et durée ajustables, classement explicable. | J4 | T-MATCH |
| PR-07 | Jeux personnalisés du groupe, archivage et favoris individuels. | J4 | T-GAMES, T-RLS |
| PR-08 | Propositions à deux à six créneaux et bulletins acceptant plusieurs choix. | J5 | T-SESSION |
| PR-09 | Confirmation manuelle, RSVP explicite et refus des engagements horaires incompatibles. | J5 | T-SESSION, T-CONCURRENCY |
| PR-10 | Rappels dimanche/lundi à 18 h ciblés sur les semaines incomplètes, désactivables. | J6 | T-JOBS, T-TIME |
| PR-11 | Notifications internes, préférences et Push facultatif par appareil. | J6 | T-NOTIFY |
| PR-12 | PWA installable, aide adaptée à la plateforme, fonctionnement explicite hors connexion. | J7 | T-PWA |
| PR-13 | Quatre onglets et expérience française sombre, responsive et accessible. | J1, J7 | T-UI, T-E2E |
| PR-14 | Fuseau Europe/Paris, dates civiles et instants non confondus, DST explicite. | J3–J6 | T-TIME |
| PR-15 | Autorisations serveur, RLS et contraintes transactionnelles indépendantes de l'UI. | J2–J8 | T-RLS, T-CONCURRENCY |
| PR-16 | Déploiement reproductible, sauvegardes restaurables et exploitation à coût minimal. | J8 | T-OPS |
| PR-17 | Statistiques définies sans assimiler RSVP à présence réelle. | J9, différé | T-STATS |
| PR-18 | Sondages légers simples ou multiples, échéance et résultats. | J9, différé | T-POLLS |

<a id="perimetre-de-livraison"></a>

## Périmètre de livraison

Le MVP comprend PR-01 à PR-16. Les profils simples font partie du MVP ; les statistiques et sondages PR-17/18 sont différés à J9.

Autres fonctionnalités différées sans engagement de livraison : Discord, Steam et calendriers externes, disponibilités récurrentes avancées, capacité de session et liste d'attente, synchronisation temps réel, téléversement d'images et écritures hors connexion.

Groupes multiples, matchmaking public et facturation sont hors périmètre du produit actuel. Aucun de ces éléments ne doit entrer indirectement dans le MVP via une dépendance ou un écran inachevé.

## Parcours principaux

1. **Rejoindre** : un administrateur invite une adresse ; le destinataire prouve sa maîtrise de l'adresse par OTP ; l'invitation est acceptée et le profil initialisé.
2. **Renseigner** : le membre ouvre Dispos, marque ses journées ou détaille ses heures, puis voit immédiatement la complétude et le calendrier mis à jour.
3. **Réutiliser** : il choisit une semaine source, examine les effets et anomalies, puis copie vers une semaine éditable sans écraser par défaut ses réponses existantes.
4. **Organiser** : il consulte les suggestions, choisit un jeu facultatif, crée deux à six candidats et publie sa proposition.
5. **Décider** : chacun sélectionne tous les créneaux acceptables ou répond qu'aucun ne convient ; le créateur ou un administrateur choisit un créneau futur.
6. **S'engager** : les membres reçoivent une demande de RSVP ; chacun répond explicitement. Les conflits avec un engagement existant sont signalés et refusés.
7. **Rester informé** : le membre consulte sa boîte interne et active, s'il le souhaite, le Push sur ses appareils ; il peut désactiver les rappels.

## Disponibilités et copie

- Une semaine va du lundi au dimanche et est identifiée par sa date de lundi dans Europe/Paris.
- Les semaines éditables sont la semaine courante et les trois suivantes. Les journées déjà passées de la semaine courante restent renseignables pour compléter la semaine ; elles ne produisent pas de suggestions passées.
- Une ligne absente signifie « sans réponse ». Une remise à zéro explicite produit le même état métier.
- « Disponible » en mode rapide matérialise 20 h–23 h. Le créneau est visible avant validation ; un changement du réglage de groupe ne modifie pas les réponses existantes.
- Le mode détaillé remplace le rapide. Une journée disponible comporte au moins un intervalle ; les autres états n'en comportent aucun.
- Les heures sont saisies par pas de quinze minutes. Les intervalles sont semi-ouverts `[début, fin[`, normalisés et sans chevauchement pour un même membre.
- Un intervalle nocturne est découpé à minuit local sur les deux journées. L'aperçu montre l'effet sur chacune ; aucune réponse existante n'est écrasée silencieusement. Les deux journées doivent être dans l'horizon éditable.
- Sept journées explicitement disponibles ou indisponibles rendent la semaine complète. Une semaine entièrement indisponible est complète.
- La copie porte sur des semaines conservées, de lundi à dimanche. Par défaut, seules les journées cibles sans réponse sont remplies ; un remplacement est explicitement demandé dans l'aperçu.
- Copier conserve les heures locales et le jour de semaine, pas les instants UTC ni une durée de 168 heures. Une source sans réponse ne transforme pas implicitement la cible en indisponible.
- Une heure inexistante est refusée. Une heure répétée doit être désambiguïsée par le membre. Les anomalies de copie sont résolues avant application atomique.

Les décisions temporelles et exemples techniques sont dans [le modèle de données](database.md#disponibilites-et-temps) et l'[ADR 004](decisions/004-disponibilites-et-fuseau.md).

## Suggestions et jeux

La recherche part de la semaine affichée, de tous les membres actifs, de deux joueurs minimum et de soixante minutes. Le membre peut ajuster la période dans l'horizon de planification, la liste de membres, le seuil, la durée et un jeu facultatif. La durée est positive, multiple de quinze minutes, au plus égale à la période recherchée ; le seuil ne dépasse pas le nombre de membres sélectionnés.

Un candidat inclut uniquement les membres disponibles pendant toute sa durée et sans RSVP positif à une session confirmée chevauchante. Une absence de réponse n'est jamais une disponibilité. Classement : nombre de membres décroissant, nombre de favoris du jeu décroissant si un jeu est choisi, puis horaire croissant. Dix résultats maximum ; pas de confirmation automatique.

Tout membre actif peut créer un jeu personnalisé ; son créateur ou un administrateur peut le modifier ou l'archiver. Les favoris appartiennent à leur utilisateur. Un jeu archivé disparaît des nouveaux choix sans casser l'historique. Un favori n'atteste pas que le membre possède le jeu. Le MVP ne limite pas la capacité des sessions selon le jeu.

## Sessions et participation

Une proposition comporte un titre, un jeu facultatif, deux à six créneaux distincts futurs et une échéance de vote. Une heure de début doit précéder sa fin ; la grille de quinze minutes et les règles DST s'appliquent également. L'échéance par défaut est le minimum entre maintenant + 48 heures et le début du premier créneau ; elle doit rester future et ne pas dépasser ce premier début.

Les créneaux deviennent immuables après publication. L'organisateur peut corriger le titre ou le texte sans modifier le sens du vote ; changer le jeu, l'échéance ou les créneaux exige une nouvelle proposition. Replanifier une session confirmée passe par annulation puis nouvelle proposition.

Le bulletin est modifiable jusqu'à la clôture effective. Une liste vide signifie « Aucun créneau ne me convient » ; l'absence de bulletin signifie « Sans réponse ». Les membres voient les réponses nominatives et résultats du groupe, hors brouillons privés. Les réponses des membres révoqués restent historiques mais ne contribuent plus au soutien courant affiché.

Le créateur actif ou un administrateur choisit un créneau futur. Aucun quorum ne bloque la confirmation ; un avertissement compare le soutien au seuil recherché conservé dans la proposition. Le vote favorable ne vaut pas inscription.

Après confirmation, tout membre actif peut répondre « Je participe » ou « Je ne participe pas », y compris sans avoir voté. L'absence de RSVP signifie « Réponse attendue ». Le RSVP est modifiable jusqu'au début. Deux engagements positifs qui se chevauchent sont interdits. Des bornes qui se touchent ne constituent pas un conflit.

La session devient terminée après son heure de fin, sans attester la présence. Les états, acteurs et gardes transactionnelles figurent dans [les machines à états](database.md#machines-a-etats).

## Rappels et notifications

Le dimanche à 18 h, les membres dont la semaine suivante est incomplète reçoivent un rappel. Le lundi à 18 h, les membres encore incomplets pour cette même semaine reçoivent une relance. La complétude et les préférences sont réévaluées juste avant envoi. Les rappels peuvent être désactivés par membre.

Les autres événements notifiés sont : publication d'une proposition, clôture du vote à son organisateur, confirmation et annulation. Il n'y a pas de notification collective par vote, favori ou modification de disponibilité. Les changements et annulations d'un brouillon ne sont pas diffusés.

La boîte interne est disponible sans permission Push. Le Push est facultatif, par appareil ; un refus ne bloque aucune fonctionnalité. Les e-mails du MVP sont limités à l'authentification et aux invitations. Les notifications système peuvent arriver en retard ou ne pas être délivrées : le centre interne reste la référence.

## Statistiques et sondages après MVP

Les statistiques seront calculées sur la période conservée et un intervalle explicitement affiché : nombre de sessions organisées, nombre de RSVP positifs à des sessions passées non annulées, taux de semaines complètes parmi les semaines entièrement vécues comme membre actif. Elles ne mesureront pas une présence observée. Aucune table d'agrégats n'est nécessaire initialement.

Les sondages permettront une question, des choix, un mode simple ou multiple, une échéance et des résultats. Leurs règles seront finalisées avant J9 ; ils ne réutiliseront pas les votes de créneaux comme substitut aux données de sondage.

## Réussite, conservation et contraintes

Le pilote doit permettre de renseigner une semaine en moins de deux minutes et d'accomplir le parcours de proposition à confirmation sans assistance. Les critères bloquants sont : aucune fausse disponibilité dans les suggestions, aucun accès non autorisé et aucun rappel envoyé à une semaine déjà complète au moment du contrôle d'envoi.

Conservation initiale : disponibilités passées douze semaines, sessions douze mois, notifications et audit métier quatre-vingt-dix jours. Les périmètres exacts de purge et les références historiques sont définis dans [le modèle de données](database.md#conservation-et-suppression). Le produit ne promet pas d'historique au-delà.

Les limites de l'hébergement gratuit, l'absence de SLA, le besoin d'un domaine d'envoi et la validation sur appareils réels sont explicites dans [la feuille de route](roadmap.md#conditions-de-lancement-et-points-bloquants). Aucun nouveau choix produit bloquant ne reste ouvert pour le MVP.
