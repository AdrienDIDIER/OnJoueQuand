# ADR 007 — Outbox, ordonnanceur et notifications

- Statut : Acceptée, conception non implémentée.
- Date : 2026-10-15.
- Portée : J6, J8 ; PR-10, PR-11, PR-14, PR-16.

## Contexte

Les rappels doivent suivre l'heure de Paris et cibler les réponses encore manquantes. Les fonctions serverless et les fournisseurs Push peuvent échouer ; un envoi ne doit pas faire perdre une confirmation métier.

## Décision

Écrire un événement d'outbox dans la transaction métier. Un worker du monolithe crée les notifications internes dédupliquées et tente les envois Web Push/VAPID par appareil. Utiliser Supabase Cron toutes les cinq minutes, `pg_net` et un secret conservé dans Vault pour appeler une route Next.js interne authentifiée.

Le dimanche à 18 h vise la semaine suivante ; le lundi à 18 h relance la même semaine si elle est encore incomplète. Revalider adhésion, préférences et complétude avant envoi. Calculer les échéances en Europe/Paris, avec rattrapage borné et clés de déduplication par membre/semaine/étape.

Réserver les travaux par bail, effectuer le réseau hors transaction, réessayer les erreurs transitoires et supprimer les abonnements morts sur `404/410`. La livraison externe est best-effort avec nouvelles tentatives, pas exactement une fois ; un tag stable limite l'effet des doublons. Les e-mails restent réservés à Auth et aux invitations.

## Alternatives écartées

- Push synchrone dans la commande : couple disponibilité fournisseur et transaction utilisateur.
- Cron dans un onglet ou un timer de fonction : ne fonctionne pas durablement sans utilisateur connecté.
- Vercel Cron Hobby : fréquence quotidienne incompatible avec le worker retenu.
- Redis/queue externe/Edge Function dédiée : infrastructure supplémentaire inutile à cette échelle.

## Conséquences

L'outbox et le worker nécessitent un suivi de backlog, des baux et une reprise. Un service en pause peut retarder ou empêcher un rappel ; l'interface interne demeure la référence. Les payloads Push ne divulguent pas les détails privés sur l'écran verrouillé.

## Vérification et sources

T-JOBS/T-NOTIFY : exécutions doubles, bail expiré, crash après envoi, rattrapage dimanche/lundi, DST, réponse complétée en attente et erreurs fournisseur. Références : [Supabase Cron](https://supabase.com/docs/guides/cron), [HTTP planifié et Vault](https://supabase.com/docs/guides/functions/schedule-functions), [limites Vercel Cron](https://vercel.com/docs/cron-jobs/usage-and-pricing), [architecture détaillée](../architecture.md#notifications-et-traitement-planifie).
