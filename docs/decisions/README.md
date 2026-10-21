# Décisions d'architecture

Ces ADR consignent le plan approuvé le **15 octobre 2026**. Leur statut « Acceptée » porte sur la conception ; il ne signifie pas que toutes les fonctionnalités existent. Le socle J1 est maintenant implémenté ; les [preuves de validation](../j1-validation.md) précisent la portée et les limites de cette réalisation.

| ADR | Décision | Statut | Jalons concernés |
| --- | --- | --- | --- |
| [001](001-monolithe-et-stack.md) | Monolithe modulaire, stack et politique de versions | Acceptée | J1–J8 |
| [002](002-groupe-unique-et-autorisations.md) | Groupe unique, rôles et autorisations serveur/RLS | Acceptée | J2–J8 |
| [003](003-invitations-et-otp.md) | Invitations nominatives et OTP e-mail | Acceptée | J2, J8 |
| [004](004-disponibilites-et-fuseau.md) | Disponibilités, copie et Europe/Paris | Acceptée | J3–J6 |
| [005](005-matching.md) | Matching déterministe par intersection de disponibilités | Acceptée | J4–J5 |
| [006](006-votes-et-rsvp.md) | Propositions, votes multiples et RSVP explicites | Acceptée | J5 |
| [007](007-notifications-et-ordonnanceur.md) | Outbox, Supabase Cron et Web Push | Acceptée | J6, J8 |
| [008](008-pwa-et-cache.md) | PWA installable et absence de cache privé hors connexion | Acceptée | J7 |
| [009](009-deploiement-et-sauvegardes.md) | Hébergement économique, CI et restauration | Acceptée | J1, J8 |
| [010](010-premier-code-et-invitation-smtp.md) | Premier code de confirmation et invitation via SMTP Auth ; précise 003 | Implémentée localement | J2 |
| [011](011-disponibilites-et-apercus.md) | Disponibilités transactionnelles, copie et aperçus signés ; précise 004 | Implémentée localement | J3 |

Chaque ADR contient contexte, décision, alternatives, conséquences et vérification. Une modification structurelle crée une nouvelle ADR qui remplace explicitement l'ancienne ; ne pas effacer l'historique d'une décision appliquée. Les détails normatifs évoluent dans le [PRD](../product-requirements.md), l'[architecture](../architecture.md) et le [modèle de données](../database.md) avec la même modification.
