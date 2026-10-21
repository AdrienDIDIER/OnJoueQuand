# ADR 022 — Invitation Push depuis l’application installée

- Date : 21 octobre 2026.
- Statut : implémentée et validée localement ; livraison sans migration supplémentaire.
- Demande : proposer l’activation des notifications au lancement depuis l’icône, sur iPhone et Android/Samsung compatibles.

## Parcours

Après connexion, le layout privé monte une invitation **On vous prévient ?** uniquement en véritable mode autonome. L’événement `appinstalled` reçu dans un onglet ne suffit pas : installer et lancer l’icône sont distingués. Aucune fenêtre dans le simple navigateur ni avant adhésion active.

Le bouton **Activer les notifications** demande la permission système directement depuis le geste utilisateur, puis inscrit l’appareil via la commande existante. Le succès n’est annoncé qu’après acceptation du serveur. **Plus tard**, Échap et la fermeture reportent l’invitation de sept jours dans une préférence locale constituée d’un timestamp, sans compte ni abonnement stocké.

Ne pas solliciter un appareil déjà actif, une préférence Push explicitement désactivée, un refus système existant, une plateforme incompatible ou un environnement sans clé publique. Si une permission est déjà accordée mais l’inscription manque, permettre de terminer l’activation sans redemander cette permission. Une panne de vérification n’interrompt pas l’ouverture de l’application. Un autre dialogue ouvert garde la priorité.

## Mise en œuvre

`pushInvitationStatus` vérifie identité et adhésion, puis lit uniquement préférences et appareil de l’acteur sous RLS. Il retourne un état minimal, sans clé Push. La fenêtre et les réglages utilisent le même adaptateur `activateDevice` ; aucun abonnement ou préférence n’est modifié avant un clic explicite. Aucun changement SQL, de worker, de cache privé ou de cron.

Les opérations d’installation restent gérées par le navigateur. Sur Samsung Internet, passer par l’interface native disponible ou le menu d’ajout à l’écran d’accueil ; [documentation Samsung](https://samsunginternet.github.io/docs/homescreen). La permission de notification reste distincte de l’installation : [documentation de l’API](https://web.dev/articles/codelab-notifications-get-started).

## Validation et limites

Vitest exerce absence de configuration, permission bloquée, inscription serveur, refus serveur et échec d’abonnement. Playwright utilise des comptes synthétiques et simule les interfaces navigateur pour vérifier le geste explicite, l’inscription réelle en PostgreSQL, l’activation de la préférence, le refus, le report, les préférences désactivées et l’appareil déjà enregistré.

Le lanceur de recette génère seulement une clé publique VAPID synthétique et neutralise clé privée/sujet : aucun envoi Push réel pendant ces parcours. Le système d’installation et l’affichage des notifications doivent toujours être essayés sur un Samsung et un iPhone réels. Cette livraison ne démarre pas l’ordonnanceur des rappels.

Résultats : lint, typage, build et **61 tests Vitest** réussis. Passe générale : 207 parcours réussis, un test clavier WebKit ignoré sur Windows et quatre anciennes attentes de configuration sans Push à adapter à la nouvelle clé de recette. Après séparation explicite de cette simulation, les **36 parcours de notifications ciblés** réussissent sur Chromium, Firefox, WebKit et mobile, avec un cas supplémentaire de permission accordée mais inscription manquante. Les 32 scénarios d’invitation utilisent des interfaces système simulées et vérifient les écritures réelles sur la base synthétique J8Validation. Capture mobile inspectée. Aucun test ne cible un abonnement utilisateur réel.
