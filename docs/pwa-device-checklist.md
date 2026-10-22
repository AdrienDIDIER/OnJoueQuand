# Recette sur appareils — OnJoueQuand

**Non exécutée sur appareils réels au 21 octobre 2026.** Les tests automatisés J7 ne remplacent pas cette recette. Ne pas déclarer l’installation ou la réception Push de production validées tant que les preuves suivantes ne sont pas renseignées.

Utiliser une origine HTTPS autorisée et un groupe synthétique, avec les secrets VAPID et le traitement configurés selon le [guide notifications](notifications-operations.md). Ne pas utiliser de données ou d’adresses personnelles dans les captures. Ne pas inscrire les endpoints, clés, OTP ou cookies dans le rapport.

| Plateforme | Appareil / OS / navigateur / date / version applicative | Statut |
| --- | --- | --- |
| iPhone ou iPad compatible | À renseigner | Non exécuté |
| Android compatible | À renseigner | Non exécuté |
| Bureau compatible | À renseigner | Non exécuté |

Pour chaque plateforme, renseigner résultat et anomalie éventuelle :

1. Ouvrir l’application et vérifier français, thème, zoom texte, contraste et lisibilité en portrait/paysage. Le contenu et les actions restent accessibles autour des zones système.
2. À la première ouverture dans le navigateur, vérifier l’invitation d’installation. Plus tard doit reporter la fenêtre tout en gardant l’aide dans les réglages. Si un bouton natif est disponible, vérifier qu’il ne lance l’installation qu’après un clic. Sur iOS/iPadOS : étapes Safari → partager → Sur l’écran d’accueil. Vérifier icône nette, nom et absence de rognage de la marque.
3. Lancer depuis l’icône : aucune invitation à réinstaller, affichage autonome, bonne page de départ, connexion obligatoire et quatre onglets utilisables. Vérifier dès cette première ouverture, avant toute navigation, que la barre du bas reste ancrée et que la zone de l’indicateur d’accueil prolonge son fond opaque, sans bande supplémentaire. Refaire après rotation, ouverture/fermeture du clavier et retour du second plan. Fermer puis rouvrir ; aucun détail privé ne doit être disponible hors connexion.
4. Depuis l’icône, se connecter et vérifier l’invitation aux notifications. Aucune permission avant Activer ; Plus tard doit reporter la fenêtre. Après activation, vérifier absence de nouvelle sollicitation et tester le bouton de test dans Groupe → Mes réglages. Tester aussi refus et préférence désactivée : aucune insistance, application et notifications internes utilisables. Sur Samsung et iOS/iPadOS, vérifier sur un appareil réel.
5. Publier/confirmer avec un autre compte. Vérifier réception en premier plan et application fermée, texte générique sur écran verrouillé et clic ouvrant l’état actuel après contrôle d’accès.
6. Commencer une saisie puis couper le réseau. Tenter l’enregistrement : aucune écriture ou relance différée, saisie conservée dans l’onglet quand la perte de connexion est détectée. Une navigation affiche la page générique. Reconnecter et réessayer volontairement.
7. Préparer une nouvelle version du worker dans l’environnement de recette. Conserver une saisie sur deux onglets ; vérifier absence de rechargement automatique, confirmation avant abandon et actualisation séparée de chaque onglet.
8. Mettre l’application en arrière-plan. Révoquer le compte de recette puis revenir : l’accès est recontrôlé. Déconnecter, revenir en arrière et relancer : aucune page privée ne doit être rendue sans session active.
9. Examiner Cache Storage : uniquement page générique et quatre icônes. Aucune disponibilité, session, API, RSC, jeton ou requête POST. Tester aussi un deuxième compte sur le même appareil et retirer les abonnements devenus inutiles.
10. Vérifier clavier et focus visible sur bureau, lecteur d’écran sur téléphone, noms des contrôles, état des notifications et option de réduction des animations.

Après recette, consigner les versions, résultats, anomalies, correctifs et date de contre-vérification. Cette fiche n’autorise pas l’envoi à des personnes hors recette ni l’activation d’un cron de production.

## Bande inférieure au lancement — 22 octobre 2026

Le signalement concerne une bande vide sous les onglets au lancement depuis l’icône, qui disparaît après navigation. Le correctif rend la barre mobile opaque, retire son flou de fond et donne au canevas HTML la même couleur que la barre lorsque le shell privé est présent. Les insets système sont conservés, y compris à gauche/droite en paysage. Aucun calcul JavaScript de hauteur, déplacement forcé du défilement ou changement de service worker n’est ajouté.

Les tests `mobile-launch.spec.ts` et `pwa-accessibility.spec.ts` passent dans les quatre profils Chromium, Firefox, WebKit et mobile : **8 tests réussis**, sur la stack synthétique J8Validation. La recette contrôle le premier écran Accueil réellement chargé, l’ancrage inférieur, deux changements de hauteur/orientation, le retour au portrait puis Dispos, les cibles tactiles et l’absence de débordement horizontal. Lint, typage et build réussis.

Cette protection du fond ne démontre pas la suppression d’un éventuel décalage natif du viewport sur l’iPhone concerné. Le [suivi WebKit 313800](https://bugs.webkit.org/show_bug.cgi?id=313800) décrit une bande extérieure au viewport dans certaines applications autonomes ; ce signalement constitue une piste, pas une reproduction de notre incident. Les [recommandations WebKit](https://webkit.org/blog/7929/designing-websites-for-iphone-x/) justifient de conserver les zones de sécurité et de peindre le fond racine. La contre-vérification depuis l’icône sur l’appareil de l’utilisateur reste nécessaire.
