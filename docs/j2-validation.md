# J2 — Identité et groupe privé

Rapport de validation du 20 octobre 2026. J1 est commité dans `6b1af70` ; J2 a ensuite été commité séparément dans `5cac4e7`. Aucun push, déploiement ni envoi réel. Les comptes et e-mails de recette utilisent exclusivement `example.test` et la boîte locale Mailpit.

## Fonctionnalités livrées

- Connexion par code e-mail à usage unique, durée de dix minutes ; déconnexion locale.
- Invitation administrative nominative de sept jours, reprise de provisionnement et d'envoi, révocation.
- Acceptation atomique avec adresse Auth confirmée ; profil personnel, annuaire, rôles et retrait d'accès.
- Protection du dernier administrateur avec verrou du groupe, même sous concurrence ; révisions de profil, invitations et adhésions.
- RLS et grants minimaux ; écriture directe des tables interdite aux clients ordinaires ; fonctions privilégiées internes réservées au backend.
- Contrôle de session via `getUser`, puis adhésion active à chaque page privée et commande. Rendu dynamique et absence de cache partagé ; le proxy rafraîchit les cookies sans décider seul de l'autorisation.
- Bootstrap local explicite et environnement local généré sans afficher de clés. Aucun compte automatique dans les migrations ou le seed.

Versions ajoutées : `@supabase/supabase-js` **2.118.0**, `@supabase/ssr` **0.12.7**, verrouillées dans npm. Le reste du socle conserve les versions de J1. Les types PostgreSQL sont générés depuis la migration locale.

## Ajustements documentés

[ADR 010](decisions/010-premier-code-et-invitation-smtp.md) explique le code de confirmation initial et l'invitation utilisant le même SMTP Auth. Aucun besoin d'ouvrir les inscriptions ni de confirmer administrativement une adresse. L'API Resend distincte prévue en J0 n'est plus nécessaire pour les invitations.

Les tables privées d'audit et de limitation ne sont pas exposées par PostgREST. Les RPC ordinaires utilisent le JWT de l'utilisateur. Les RPC internes n'acceptent l'identifiant d'acteur qu'après vérification serveur et contrôlent encore son rôle en base. Le verrou groupe précède les mutations d'identité et empêche une révocation de croiser une écriture sans revalidation.

Les demandes publiques de code restent génériques, y compris en cas de panne ou de limite. Les compteurs persistés par fenêtre de dix minutes utilisent un HMAC : cinq demandes de code et dix vérifications par adresse, plus cent par réseau. Sur Vercel, seul l'en-tête réseau écrasé par la plateforme est utilisé ; hors Vercel, le budget réseau est global. Les limites Auth natives s'appliquent aussi aux appels directs qui contournent Next.js. Vérifier leur configuration de production avant J8. Une configuration de secret de limitation absente échoue sans autoriser l'envoi.

## Vérifications locales

| Vérification | Résultat |
| --- | --- |
| Migration depuis une base locale réinitialisée | Réussie sur PostgreSQL 17.11. |
| Lint, TypeScript strict, build Next.js | Réussis ; toutes les pages sont rendues dynamiquement. |
| Vitest | 11 tests réussis : configuration, normalisation de l'adresse, nom et code. |
| Intégration Auth/PostgreSQL | Huit scénarios, neuf tests Node en comptant le test parent, réussis. |
| Playwright Windows | 47 tests réussis, un test de focus WebKit Windows ignoré pour la limitation déjà documentée en J1. |
| Audit de production | `npm audit --omit=dev --audit-level=high` : aucune vulnérabilité signalée le 20 octobre. |
| Revue finale | Captures de connexion mobile et de groupe bureau examinées ; liens locaux des 19 documents et `git diff --check` valides. |
| CI GitHub | Configurée, non exécutée à distance. |

L'intégration prouve : inscriptions ouvertes refusées, accès anonyme/non-membre/révoqué interdit, métadonnées de rôle sans pouvoir, fonctions internes inaccessibles, compte non confirmé + code réel + acceptation, code invalide/réutilisé/expiré refusé, mauvaise adresse, invitation expirée/révoquée, double acceptation idempotente, profil avec ancienne révision refusé, deux retraits concurrents préservant un administrateur, compteur concurrent atomique. La panne SMTP est provoquée en arrêtant le seul conteneur Mailpit OnJoueQuand ; le test le redémarre dans un `finally` et prouve le nouvel envoi.

Les parcours navigateur couvrent Chromium, Firefox, WebKit et mobile : pages privées sans session, réponse générique, Auth sans adhésion, invitation administrative, code lu dans Mailpit, acceptation, modification du profil, révocation puis accès refusé malgré la session existante, déconnexion, navigation et absence de débordement. Les traces réseau sont désactivées pour ne pas conserver OTP et cookies dans les artefacts.

## Exploitation et limites

Suivre les commandes du [README](../README.md). Les tests d'intégration exigent une base locale vide et laissent des fixtures ; ils ne doivent pas être exécutés contre une base de développement contenant des données à conserver. Les helpers refusent une URL autre que le projet local sur `127.0.0.1:55321`.

Pour un premier administrateur distant, avant J8 : configurer domaine et SMTP, désactiver les inscriptions publiques tout en gardant le fournisseur e-mail actif, installer les modèles français et appliquer les migrations dans l'environnement autorisé. Dans un outil opérateur sécurisé, provisionner le compte Auth avec `email_confirm: false`, puis appeler `bootstrap_admin(account_id, display_name)` avec un accès privilégié. Cette commande refuse une installation ayant déjà des adhésions. Vérifier ensuite une connexion réelle par code et retirer les accès temporaires. Ne pas recopier de clé ou de code dans un ticket, une commande journalisée ou Git. Cette procédure distante n'a pas été exécutée.

Le SMTP de production, l'exécution GitHub distante et la recette iOS réelle ne sont pas revendiqués. Les dépendances de développement héritent de la réserve d'audit [J1](j1-validation.md#réserves-techniques). La révocation coupe les accès aux données dès le prochain appel ; elle n'efface pas ce qui était déjà affiché à l'écran. L'envoi SMTP n'est pas transactionnel : un code déjà parti peut arriver après une révocation, mais l'acceptation restera interdite. Les abonnements Push n'existent pas encore ; leur désactivation sur révocation devra être branchée en J6.

La conservation/purge automatique d'audit et d'invitations sera branchée sur le traitement planifié en J6 ; les compteurs de fréquence expirés sont purgés lors de leur utilisation. J3 est la prochaine livraison : disponibilités et calendrier.
