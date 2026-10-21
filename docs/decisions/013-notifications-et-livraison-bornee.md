# ADR 013 — Notifications privées et livraison bornée

- Statut : Implémentée localement en J6 ; précise ADR 007 et ADR 012.
- Date : 2026-10-21.
- Portée : PR-10, PR-11, PR-14, PR-16.

Le worker décrit ici correspond à J6 ; son cache public et ses mises à jour sont ensuite complétés par [ADR 014](014-pwa-cache-et-mises-a-jour.md), sans changer la livraison transactionnelle des notifications.

## Contexte

Une notification interne doit rester fiable même si un appareil, un fournisseur ou le processus HTTP est indisponible. Les traitements et endpoints Push ne doivent pas ouvrir un accès réseau arbitraire. La révocation et les préférences peuvent changer pendant une tentative.

## Décision

La matérialisation de l’outbox est une transaction SQL bornée, avec `FOR UPDATE SKIP LOCKED` et unicité événement/destinataire. Elle ne contient aucun réseau. Les états obsolètes, membres inactifs, anciennes époques d’adhésion et rappels devenus inutiles sont ignorés. Un événement malformé devient un échec observable sans empêcher les autres événements du lot. Les notifications internes de session ne dépendent pas du consentement Push.

Les livraisons sont privées et uniques par notification/appareil. Une réservation produit un jeton de bail de 90 secondes et incrémente la tentative. Avant chaque envoi, une nouvelle commande vérifie le bail, l’adhésion, l’époque, les préférences, l’état de session, l’expiration, la lecture et la complétude du rappel. Seul le détenteur courant peut acquitter. Un `404/410` retire l’abonnement à la révision réservée ; une mise à jour ultérieure ne doit pas être supprimée par un ancien envoi.

Le worker Node réserve six appareils au plus, par vagues de trois. Le client `web-push` stable impose un timeout de six secondes, sans proxy ni redirection. Les erreurs réseau, `408/429/5xx` réessaient avec recul exponentiel, jitter et `Retry-After`, dans la limite de cinq tentatives et de l’expiration. Les autres réponses sont permanentes. Un crash après envoi peut créer un doublon externe ; le tag stable regroupe les affichages, sans garantie d’unicité fournisseur.

La route POST `/api/internal/jobs` ignore le corps et exige un Bearer secret d’au moins 32 caractères, comparé sur des empreintes de longueur fixe. Une seconde valeur permet la rotation. Un bail de job de deux minutes empêche les exécutions superposées ; une interruption devient `abandoned` au passage suivant. Les compteurs et derniers passages sont accessibles seulement aux administrateurs, sans endpoints, clés ou réponses fournisseur brutes.

Supabase Cron, `pg_net` et Vault sont installés par migration. Le job toutes les cinq minutes est **désactivé par défaut**. Ses secrets et URL sont absents des migrations. L’activation relève du [guide d’exploitation](../notifications-operations.md), après configuration d’un environnement autorisé. Les rappels gardent leur lundi cible et une seule fenêtre : dimanche 18 h jusqu’à lundi 18 h, puis lundi 18 h jusqu’à mardi 18 h, à Paris. Une panne ne rattrape jamais deux étapes ensemble.

Les abonnements acceptent seulement les endpoints HTTPS des familles FCM, Mozilla et Apple, avec hôte et chemin stricts, sans port, identifiants, query ou fragment. Le contrôle est commun au domaine, à SQL et au dernier envoi. Un endpoint ne peut pas changer de propriétaire. Dix appareils par compte limitent les abus techniques ; l’interface permet de retirer les anciens. Activer un appareil active aussi le consentement Push du compte, transactionnellement. Révoquer une adhésion supprime ses abonnements. Une déconnexion n’est pas une révocation ; sur un appareil partagé, désactiver explicitement le Push.

Le service worker J6 gère uniquement Push et clic vers Accueil : aucun cache, aucun fetch intercepté, aucun jeton et aucun détail de session sur écran verrouillé. Le manifeste, l’installation et les mises à jour PWA restent en J7. Les libellés historiques de la boîte interne ne prétendent pas qu’une action ancienne est encore attendue ; les liens chargent l’état réel.

## Alternatives écartées

- Redis ou file externe : coût et exploitation inutiles pour quinze membres.
- Envoi pendant la transaction métier : lie la confirmation à la disponibilité d’un fournisseur.
- Endpoints HTTPS arbitraires : risque SSRF et redirections.
- Inscription Push automatique au chargement : ne respecte pas le geste volontaire et les contraintes des navigateurs.
- Secret ou clé VAPID commité : interdit ; génération dans un fichier local ignoré, sans écrasement ni sortie des clés.

## Conséquences et vérification

Sans VAPID, les notifications internes fonctionnent et les livraisons Push attendent ou expirent. Sans cron actif, un appel manuel authentifié reste nécessaire. Les préférences et révocations sont revérifiées avant le réseau ; une modification après ce contrôle ne peut rappeler un message déjà confié au fournisseur.

Voir [tests SQL](../../tests/integration/notifications.test.mjs), [tests de domaine/livraison](../../src/features/notifications/domain.test.ts), [parcours](../../tests/e2e/notifications.spec.ts) et [rapport J6](../j6-validation.md). La réception sur appareils réels et les réglages de production restent à valider avant lancement.

Sources vérifiées : [client Web Push Node](https://github.com/web-push-libs/web-push), [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart), [pg_net et Vault](https://supabase.com/docs/guides/functions/schedule-functions). Le code installé de `web-push` a également été inspecté pour confirmer l’usage direct de `https.request`, le timeout et l’absence de suivi des redirections.
