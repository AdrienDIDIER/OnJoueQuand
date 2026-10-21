# ADR 021 — Invitation à installer au démarrage

- Statut : implémentée et validée localement ; publication en attente avec le lot précédent.
- Date : 2026-10-21.
- Demande explicite : proposer l’installation à l’ouverture du site hors mode application. Complète l’ADR 014 ; remplace la limitation de la sollicitation aux réglages de l’ADR 017.

## Expérience

Le layout racine porte un fournisseur d’installation sans données privées ni dépendance à une adhésion. Après le premier affichage, une fenêtre `dialog` propose l’installation, y compris sur la connexion. Elle ne s’ouvre pas en mode autonome, sur une page masquée ou par-dessus un dialogue déjà ouvert.

**Plus tard**, la fermeture et Échap reportent la proposition de sept jours. Seul un timestamp `ojq-install-later-until` est stocké ; aucun compte, jeton ou contenu privé. Si le stockage est bloqué, la fermeture fonctionne et la proposition ne revient pas pendant les navigations du chargement courant. L’aide reste accessible dans Groupe → Mes réglages, même pendant le report.

Le bouton **Installer l’application** apparaît seulement après `beforeinstallprompt` et appelle son `prompt()` directement depuis le clic, une seule fois. Aucun lancement automatique ni permission Push. L’événement `appinstalled` ferme la fenêtre. Le mode autonome utilise la media query et `navigator.standalone` sur les appareils compatibles.

Sans cette API, afficher les étapes adaptées. Sur iPhone/iPad : Safari → Partager → Sur l’écran d’accueil → Ajouter. Les capacités dépendent du navigateur : [guide d’installation](https://web.dev/learn/pwa/installation-prompt). Détecter le mode autonome ne permet pas de savoir universellement si une autre fenêtre ou un autre navigateur possède déjà l’installation.

## Architecture et confidentialité

La fenêtre et l’aide manuelle partagent l’événement et son état pour éviter une double consommation. Les contrôles de connexion et les protections PWA restent distincts. Aucun changement du worker, de son cache, de la base ou des dépendances. Le timestamp est une préférence publique, pas un cache de données privées.

Le dialogue assure modalité, fermeture clavier et retour du focus. Sur téléphone, il s’ouvre en bas de l’écran avec les couleurs et tailles de boutons existantes. L’utilisateur peut continuer dans le navigateur.

## Vérification

`installation.spec.ts` couvre le contexte vierge, le report persistant, le bouton natif après clic uniquement, les instructions iPhone, le mode autonome et l’événement d’installation sans rechargement. Les autres parcours simulent explicitement une invitation déjà reportée ; les tests d’installation utilisent des contextes vierges. Les tests PWA vérifient toujours l’aide manuelle, les mises à jour et l’absence de cache privé. Le parcours système réel reste à valider sur appareils.

Recette exécutée sur J8Validation, comptes synthétiques : **183 parcours réussis**, un test clavier WebKit ignoré sur Windows, dont les vingt cas d’installation sur les quatre profils. Lint, typage, 56 tests Vitest et build réussis. Captures bureau et mobile inspectées. Aucune migration ou modification du worker pour cette invitation ; les migrations 011/012 du lot Soirées/Push restent à autoriser avant publication de l’ensemble.
