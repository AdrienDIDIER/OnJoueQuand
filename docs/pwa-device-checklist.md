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
2. Installer par la procédure proposée ou le menu du navigateur. Sur iOS/iPadOS, utiliser Safari → partager → Sur l’écran d’accueil. Vérifier icône nette, nom et absence de rognage de la marque.
3. Lancer depuis l’icône : affichage autonome, bonne page de départ, connexion obligatoire et quatre onglets utilisables. Fermer puis rouvrir ; aucun détail privé ne doit être disponible hors connexion.
4. Dans Groupe, activer volontairement le Push. Tester aussi un refus : l’application et les notifications internes restent utilisables. Sur iOS/iPadOS, effectuer la demande depuis l’app installée.
5. Publier/confirmer avec un autre compte. Vérifier réception en premier plan et application fermée, texte générique sur écran verrouillé et clic ouvrant l’état actuel après contrôle d’accès.
6. Commencer une saisie puis couper le réseau. Tenter l’enregistrement : aucune écriture ou relance différée, saisie conservée dans l’onglet quand la perte de connexion est détectée. Une navigation affiche la page générique. Reconnecter et réessayer volontairement.
7. Préparer une nouvelle version du worker dans l’environnement de recette. Conserver une saisie sur deux onglets ; vérifier absence de rechargement automatique, confirmation avant abandon et actualisation séparée de chaque onglet.
8. Mettre l’application en arrière-plan. Révoquer le compte de recette puis revenir : l’accès est recontrôlé. Déconnecter, revenir en arrière et relancer : aucune page privée ne doit être rendue sans session active.
9. Examiner Cache Storage : uniquement page générique et quatre icônes. Aucune disponibilité, session, API, RSC, jeton ou requête POST. Tester aussi un deuxième compte sur le même appareil et retirer les abonnements devenus inutiles.
10. Vérifier clavier et focus visible sur bureau, lecteur d’écran sur téléphone, noms des contrôles, état des notifications et option de réduction des animations.

Après recette, consigner les versions, résultats, anomalies, correctifs et date de contre-vérification. Cette fiche n’autorise pas l’envoi à des personnes hors recette ni l’activation d’un cron de production.
