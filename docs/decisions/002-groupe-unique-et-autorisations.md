# ADR 002 — Groupe unique et autorisations

- Statut : Implémentée en J2 pour groupe, identité et invitations ; les domaines suivants étendront la même protection.
- Date : 2026-10-15.
- Portée : J2–J8 ; PR-01, PR-02, PR-15.

## Contexte

Le produit vise un seul groupe privé. Les utilisateurs doivent partager leur calendrier sans que leur identité Auth suffise à donner accès au groupe. Un administrateur gère les membres mais ne doit pas répondre à leur place.

## Décision

Persister un groupe singleton et des adhésions `active/revoked` avec rôles `admin/member`. Tout membre actif peut proposer une session ; le créateur actif ou un administrateur gère sa confirmation. Invitations, rôles et révocations sont administratifs. Le dernier administrateur actif est protégé transactionnellement.

Vérifier session et adhésion côté serveur et utiliser RLS sur toutes les tables exposées. Protéger les relations par FK composites, les colonnes sensibles par grants et les transitions par commandes SQL contrôlées. Les lectures ordinaires utilisent le contexte utilisateur. Les RPC privilégiées nécessaires à une transaction vérifient elles-mêmes les droits : leur propriétaire peut contourner RLS, ce qui exige des gardes explicites et des droits minimaux.

Une révocation s'applique à la prochaine requête même si le JWT est encore valide ; elle désactive les livraisons Push. Les données historiques ne sont pas réécrites comme si le membre n'avait jamais répondu. La [matrice RLS](../database.md#matrice-rls-et-droits) définit les permissions exactes.

## Alternatives écartées

- Multitenant complet : interfaces et exploitation inutiles pour le périmètre actuel.
- Contrôles uniquement dans les routes/pages : contournables par l'API de données ou une RPC.
- Rôle dans les métadonnées utilisateur ou le cache client : insuffisant pour la révocation et susceptible de confiance abusive.
- Écriture administrative des disponibilités/votes/RSVP d'autrui : contraire aux comptes individuels et à l'engagement explicite.

## Conséquences

Le champ groupe et ses FK restent utiles malgré le singleton. Les helpers RLS doivent éviter les récursions sur la table d'adhésion. Aucun quota à quinze membres n'est imposé. La clé secrète n'est pas un substitut à une politique correctement écrite.

## Vérification

T-RLS avec anonyme, utilisateur Auth non membre, membres distincts, admin et révoqué ; appels directs aux tables/RPC, changement de propriétaire/groupe et colonnes protégées. T-CONCURRENCY couvre la protection du dernier administrateur.
