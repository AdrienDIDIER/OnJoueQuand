# Exploiter les notifications — J6

Ce guide décrit la configuration ; aucune activation distante n’a été effectuée. Le job livré est désactivé par défaut, y compris en preview. Ne pas créer d’envoi réel sans environnement et appareils de recette autorisés.

## Configuration serveur

Appliquer les migrations avec `npm run db:migrate` en local ; utiliser le processus de déploiement approuvé pour un projet distant. Variables :

| Variable | Usage |
| --- | --- |
| `JOBS_SECRET` | Secret aléatoire d’au moins 32 caractères, serveur uniquement. |
| `JOBS_SECRET_PREVIOUS` | Ancien secret accepté temporairement pendant rotation ; vide sinon. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Clé publique VAPID, utilisable par le navigateur. |
| `VAPID_PRIVATE_KEY` | Clé privée VAPID, serveur uniquement. |
| `VAPID_SUBJECT` | Contact `mailto:` ou URL HTTPS contrôlée par l’exploitant. |

`npm run push:keys` génère `.tools/vapid-local.json`, ignoré par Git. Le script refuse d’écraser un fichier et n’affiche aucune clé. Copier soi-même les valeurs dans l’environnement local ou le gestionnaire de secrets autorisé ; ne jamais transmettre les clés dans un ticket, un log ou le chat. Les clés doivent rester stables : un remplacement exige le réabonnement des appareils. Ne pas exposer de secret avec `NEXT_PUBLIC`.

Sans VAPID, le worker produit les notifications internes et n’effectue aucun appel Push. Sans secret de job, la route retourne 503 ; un secret absent ou invalide dans une installation configurée retourne 401. GET n’est pas une méthode de traitement. Aucune heure, URL ou destinataire ne vient du corps HTTP.

## Cron et Vault

La migration crée le job `ojq-notifications`, expression `*/5 * * * *`, **inactif**. Dans un environnement autorisé, enregistrer par l’interface sécurisée de Supabase Vault deux secrets :

- `ojq_jobs_url` : `https://votre-domaine/api/internal/jobs`, sans query ni port.
- `ojq_jobs_secret` : même valeur que `JOBS_SECRET`.

Ne pas enregistrer ces valeurs dans une migration ou un historique shell. L’URL HTTP `http://host.docker.internal:3100/api/internal/jobs` est une exception exclusivement prévue pour la recette Docker locale.

Vérifier un POST authentifié depuis l’environnement d’exploitation, sans journaliser son header. Puis activer explicitement :

```sql
select cron.alter_job(job_id := jobid, active := true)
from cron.job where jobname = 'ojq-notifications';
```

Pour désactiver, remplacer `true` par `false`. Ne pas activer sur une preview. Le test local de J6 a vérifié l’expression SQL et un appel `pg_net`/Vault vers un récepteur local ; il ne constitue pas une activation du cron de production.

Rotation : déployer le nouveau `JOBS_SECRET`, conserver provisoirement l’ancien dans `JOBS_SECRET_PREVIOUS`, modifier Vault, vérifier le prochain passage, retirer l’ancien. Ne jamais changer simultanément les deux côtés sans période de recouvrement.

## Recette et suivi

Dans Groupe → Mes notifications, enregistrer les préférences puis activer volontairement chaque appareil personnel. L’activation d’un appareil active le Push du compte. Le navigateur peut refuser ou ne pas proposer le Push ; la boîte interne reste utilisable. Sur iOS/iPadOS compatible, installer sur l’écran d’accueil avant la demande ; la recette réelle relève aussi de J7.

Dans Accueil, vérifier la notification, son marquage comme lue et le lien vers l’état courant. Créer/publier avec un autre compte : l’auteur de l’action ne reçoit pas sa propre notification. À clôture, seul le créateur actif est relancé ; à défaut, les administrateurs.

Les administrateurs disposent du dernier passage et des comptes d’événements/livraisons en attente ou en échec dans Groupe. Un passage ancien de plus de quinze minutes, un bail abandonné ou une file qui augmente exige une vérification : route, secrets/Vault, état cron, quotas et disponibilité Supabase/Vercel. Examiner `cron.job_run_details` et les codes HTTP `net._http_response` avec accès d’exploitation, sans exporter les headers ni les secrets. Le succès HTTP ne garantit pas la livraison au système d’exploitation de l’appareil.

Les livraisons retentent au plus cinq fois. `404/410` retirent l’appareil ; `408/429/5xx` et réseau retentent ; les autres réponses échouent définitivement. Un bail expiré est repris avec un nouveau jeton ; l’ancien processus ne peut plus acquitter. Le message externe peut être reçu deux fois si le processus s’interrompt après envoi : les tags sont stables.

Une outbox en échec reste visible pour diagnostic. Après correction de la cause, un exploitant peut remettre **des UUID explicitement identifiés** à `pending` si leur expiration n’est pas dépassée. Ne pas réessayer globalement toutes les lignes ni effacer des notifications par simple critère de date.

## Tests et limites

`npm run test:integration` et `npm run test:notifications` sont réservés à une **base synthétique de recette dédiée** : la suite Auth exige un bootstrap neuf et les rappels utilisent une horloge simulée. Ne pas lancer ces tests contre une base utilisateur à conserver. Le rapport J6 décrit le projet isolé et les résultats réellement obtenus.

Les transports unitaires sont simulés ; aucune réception Push sur iPhone, Android ou bureau réel n’est revendiquée. Vérifier autorisation, arrivée, clic et révocation sur ces appareils avant lancement. Les purges générales de conservation, sauvegardes et alertes externes relèvent de la préparation J8 ; les tables ne sont pas purgées automatiquement dans cette livraison. Désactiver ou retirer un appareil partagé avant de changer de compte ; un abonnement ne peut pas être transféré en revendiquant son endpoint.
