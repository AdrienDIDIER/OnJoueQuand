# ADR 001 — Monolithe modulaire et stack

- Statut : Acceptée ; socle J1 et modules J2–J4 implémentés. Voir les [versions J1](../j1-validation.md) et les [preuves J4](../j4-validation.md).
- Date : 2026-10-15.
- Portée : J1–J8 ; PR-13, PR-15, PR-16.

## Contexte

Un groupe privé de 6 à 15 personnes a besoin d'un produit maintenable à faible coût, avec une séparation claire entre calculs de calendrier, interface et accès aux données. Le dépôt initial ne contient qu'un README vide ; aucune compatibilité existante n'est à préserver.

## Décision

Construire un monolithe Next.js App Router sur Vercel, TypeScript strict, Tailwind CSS et shadcn/ui, avec Supabase Auth/PostgreSQL/RLS. Organiser le code par fonctionnalité et séparer domaine pur, application, infrastructure et UI. Employer Server Components, Server Actions validées et RPC transactionnelles selon le besoin.

Utiliser npm et un lockfile, Vitest, Playwright et GitHub Actions. Les repères du plan sont Node.js 24 LTS, Next.js 16.4, React 19.3 et Tailwind CSS 4.3 ; J1 vérifiera et verrouillera les versions stables compatibles et corrigées. Aucun canary ni option expérimentale n'est nécessaire. La [matrice de stack](../architecture.md#stack-et-versions) recense les sources et le processus de vérification.

Pas d'ORM supplémentaire, Redis, microservice, bus externe ou couche générale de cache client au MVP. Les types de données sont générés depuis le schéma Supabase, dont les migrations sont la source de vérité.

## Alternatives écartées

- Backend séparé et microservices : davantage de déploiements, d'authentification interservices et d'exploitation pour une charge très faible.
- Logique métier dans les composants : difficile à tester et incohérente entre commandes UI et jobs.
- Versions bêta ou dépendances « latest » non verrouillées : reproductibilité et compatibilité non maîtrisées.

## Conséquences

Un seul backend applicatif facilite les transactions et le diagnostic. Le domaine doit rester indépendant de Next.js et Supabase pour éviter un couplage généralisé. Les contraintes de durée des fonctions Vercel imposent des lots bornés pour les jobs. Les dépendances exactes restent une preuve à produire en J1, pas un fait accompli de J0.

## Vérification

J1 : installation depuis un clone propre, lint, typage, build et smoke test. J2–J8 : tests de domaine et base indépendants de l'UI, validation de l'absence de secrets clients. Référence : [roadmap](../roadmap.md).
