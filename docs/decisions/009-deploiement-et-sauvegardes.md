# ADR 009 — Déploiement économique et sauvegardes

- Statut : Acceptée ; préparation locale J8, précisée par l’[ADR 015](015-sauvegardes-privees-et-recette-exploitation.md). Déploiement et activation distants non effectués.
- Date : 2026-10-15.
- Portée : J1, J8 ; PR-16.

## Contexte

Le coût minimal est prioritaire pour un groupe privé. Les offres gratuites ont des quotas, interruptions possibles et garanties limitées ; elles ne suppriment pas le besoin de restaurer les données et les identités.

## Décision

Utiliser Vercel, Supabase et Resend avec les offres gratuites lorsqu'éligibles et suffisantes. L'hypothèse Vercel Hobby exige un usage personnel non commercial. Choisir des régions européennes proches pour Vercel et Supabase. Vérifier conditions, quotas et prix avant J8.

Séparer local/CI synthétique, préproduction et production. Les previews non fiables ne reçoivent aucun secret partagé. GitHub Actions vérifie installation, lint, typage, tests, migrations/RLS, build et parcours avant livraison. Les migrations sont compatibles avec le déploiement précédent ; les suppressions sont des étapes distinctes.

Exporter chaque jour les données, identités nécessaires, schéma et droits restaurables ; chiffrer avant stockage en artefact privé conservé sept jours. La clé privée de restauration reste hors dépôt, workflow et artefacts. Tester la restauration dans un projet isolé et tenir un inventaire séparé des secrets et réglages non couverts par le dump.

Objectifs du pilote sans SLA : sauvegarde réussie de moins de 24 heures et restauration manuelle en une journée ouvrée. Surveiller heartbeat, outbox, SMTP, quotas et âge réel des sauvegardes. Ne pas considérer un workflow planifié comme preuve de sauvegarde réussie.

## Alternatives écartées

- Paiement de toutes les offres dès J0 : contraire à la priorité économique sans usage mesuré.
- Aucune sauvegarde indépendante : restauration non démontrable et risque de perte d'identités ou relations.
- Export SQL en clair dans Git : exposition durable de données privées.
- Rollback applicatif assimilé à un rollback global : n'annule ni schéma, ni configuration Auth, ni cron.

## Conséquences

Les interruptions et limites des offres gratuites sont acceptées pour le pilote, sans garantie de service. Un passage payant peut devenir nécessaire ; il ne doit pas être effectué sans autorisation. La restauration requiert une procédure complète, pas une commande de dump supposée universelle.

## Vérification et sources

T-OPS : export chiffré, restauration Auth/relations/RLS, reprise des réglages, rollback et contrôles d'âge. Références : [Vercel Hobby](https://vercel.com/docs/plans/hobby), [Supabase](https://supabase.com/pricing), [sauvegardes Supabase](https://supabase.com/docs/guides/platform/backups), [Resend](https://resend.com/pricing), [exploitation](../architecture.md#deploiement-couts-et-exploitation).
