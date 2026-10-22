# ADR 024 — Navigation immédiate et enregistrement sans rendu global

- Date : 22 octobre 2026.
- Statut : implémentée ; [recette et mesures](../instant-navigation-validation.md).
- Remplace le contrôle bloquant des onglets des ADR 019 et 023. Conserve leurs contrôles serveur, l’absence de stockage persistant privé et les règles du worker.
- Arbitrage explicitement accepté : afficher immédiatement les données déjà reçues et contrôler l’accès en arrière-plan. Toute nouvelle lecture et toute modification restent autorisées côté serveur.

## Causes traitées

Le gestionnaire de navigation attendait `GET /api/session-status` avant d’appeler le routeur, même avec une page déjà préchargée. Le réseau imposait donc un délai minimal à chaque onglet. Un compteur local ou une animation ne pouvait pas supprimer cette attente.

Le bouton rapide de disponibilité utilisait une Server Action suivie de `revalidatePath('/', 'layout')`. La réponse comprenait un rendu React et invalidait les pages en mémoire pour les prochaines visites. Next.js documente cette différence entre [Server Function et Route Handler](https://nextjs.org/docs/app/api-reference/functions/revalidatePath) : une Route Handler marque la revalidation pour une prochaine visite, sans renvoyer immédiatement un rendu à l’interface.

## Navigation

Les quatre onglets conservent le préchargement Next.js et le Router Cache en mémoire. Le clic démarre immédiatement `router.push` ; la sonde réseau est lancée séparément, hors de la transition React. Un contrôle lent ne retient donc pas les clics suivants. Une première page non encore préchargée attend toujours sa vraie lecture serveur.

Chaque lien privé conserve une sonde fraîche en arrière-plan. Une réponse positive exige toujours Auth en direct et l’adhésion sous RLS. `401/403` ferme les vues ; une empreinte de compte, rôle ou époque différente provoque un nouveau document et abandonne les anciens snapshots. Les réponses de clics dépassés sont ignorées, ainsi que celles d’un composant démonté. Un changement d’empreinte reçu pendant un rendu serveur masque également l’interface et force ce renouvellement.

Les quatre onglets déjà reçus sont aussi réaffichés immédiatement dans l’historique. Une sous-route de l’historique reste masquée jusqu’au contrôle. Une panne temporaire affiche une erreur mais laisse consultables les données déjà reçues. Ce choix autorise une brève visibilité de données précédemment obtenues avant la détection d’une révocation ; il ne constitue jamais une autorisation de lecture réseau ou d’écriture. Aucun TTL d’autorisation positive et aucun stockage persistant privé ne sont ajoutés.

## Commande rapide de disponibilité

`POST /api/availability/quick` accepte un petit objet JSON, avec Origin/Host cohérents, HTTPS hors local, refus explicite de `cross-site`, format JSON et lecture bornée à 4 096 octets, même sans `Content-Length`. L’hôte public est utilisé : l’URL interne de Next peut être `localhost` derrière un proxy. Un en-tête opaque de contexte doit correspondre au compte et à l’adhésion vérifiés par le serveur ; il sert de garde de péremption et n’accorde aucun droit.

Le service lit seulement la journée du membre et les paramètres rapides. Il valide l’horizon Paris, le mode, les horaires affichés et la révision, puis appelle la RPC existante `save_availability`. RLS, verrou et révision SQL restent opposables à deux requêtes concurrentes. Le résultat décrit la modification effectivement acceptée ; la révision est celle créée ou incrémentée sous verrou par cette RPC. Un test HTTP la compare aux données PostgreSQL. Aucun nouveau schéma ni client privilégié.

La Route Handler appelle `revalidatePrivateViews` sans renvoyer un arbre React. `Server-Timing` expose seulement les durées Auth et commande, sans identifiant ou contenu métier ; le temps du proxy n’y est pas inclus. Les autres commandes gardent leurs Server Actions et leur revalidation.

## Réconciliation de l’interface

Le bouton indique immédiatement la réponse choisie, puis attend l’accusé réel pour annoncer l’enregistrement et mettre à jour le compteur. Un refus annule cette sélection et explique le problème. Une erreur réseau après envoi reste un résultat inconnu : demander d’actualiser, sans relancer automatiquement la commande.

Un contexte React privé garde en mémoire au maximum 56 journées confirmées de ce membre. Il est indexé par contexte d’accès, n’accepte que des révisions croissantes et ne remplace jamais une donnée serveur plus récente. Accueil, Dispos et la ligne personnelle du calendrier réconcilient ces confirmations ; aucune réponse d’un autre membre n’est modifiée. Un identifiant de membre différent désactive l’application des confirmations précédentes. Le contexte est abandonné avec le compte ou le rôle. Aucun `localStorage`, IndexedDB ou cache du worker.

Les autres jours et les onglets restent utilisables pendant une requête lente. Une confirmation arrivant après un changement d’onglet met encore à jour l’accueil du même contexte. Les réponses RSVP et favoris ont également un affichage optimiste, sans transformer cet affichage en preuve de sauvegarde ni contourner leurs commandes serveur.

## Limites

La mesure concerne les vues préchargées et une stack synthétique. Ni le démarrage d’une fonction froide, ni une première lecture, ni la validation d’une écriture ne deviennent sans réseau. Les commandes de création, copie détaillée et gestion conservent leurs parcours serveur. Pas de nouvelle dépendance, migration, activation de cron ou modification du service worker.
