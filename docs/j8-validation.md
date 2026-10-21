# J8 — Préparation de l’exploitation

Date : 2026-10-21. **J8 en cours, pilote non lancé.** J7 est commité dans `0980d66`. Aucun push supplémentaire, déploiement, migration distante, provisionnement ni invitation réelle effectué pendant cette livraison.

## Réalisé et vérifié localement

- Export PostgreSQL custom des schémas applicatifs, Auth et historique ; chiffrement age en flux, publication exclusive et nettoyage sur erreur, TLS vérifié à distance.
- Workflow quotidien réservé aux dépôts privés, double activation par variable et environnement dédié ; inactif sur le dépôt public. Conservation sept jours ; aucune clé privée nécessaire sur le runner.
- Cinq tests Node réussis : aller-retour réel age, mauvaise clé/archive altérée, export interrompu/outil manquant, validation TLS, alertes de traitement et contrôle indépendant d’âge/présence des sauvegardes.
- Répétition réelle sur `supabase_db_OnJoueQuandJ6Validation` (PostgreSQL 17.11), jamais la base utilisateur. Archive exportée et chiffrée puis restaurée en une transaction dans une base temporaire neuve. Compteurs Auth/adhésions/dispos/sessions/migrations, contraintes et politiques identiques ; anonyme et authentifié sans adhésion bloqués, membre actif autorisé. Base temporaire et clé de recette supprimées.
- Diagnostic administrateur enrichi dans Groupe : cron actif/inactif, dernier succès, retard et compteurs d’échec ; snapshot daté en heure de Paris, aucune action d’activation ni donnée personnelle exposée. Une réponse technique invalide n’est jamais présentée comme saine et ne bloque pas les préférences.
- Migration additive `202610210009_operations_status.sql` appliquée aux bases locales principale et synthétique, sans réinitialisation. Contrat RPC inchangé, types régénérés identiques. Test SQL/API réussi sur la stack synthétique avec de vrais JWT : anonyme, membre, non-membre, administrateur révoqué et administrateur rétrogradé refusés ; administrateur actif autorisé. Les clés du résultat sont limitées aux agrégats attendus.
- age 1.3.2 officiel, empreinte de téléchargement vérifiée. ESLint, TypeScript strict, **53 tests Vitest**, cinq tests opérateur et build Next.js réussis. **Huit parcours Playwright J8 réussis** sur Chromium, Firefox, WebKit et mobile : diagnostic administrateur et refus après retrait du rôle. Les suites historiques J2–J7 ne sont pas rejouées intégralement.
- Guide de livraison, récupération, configuration privée, surveillance et incidents ; ADR 015 expliquant la séparation du dépôt public et des sauvegardes privées.
- Quatre workflows validés par actionlint 1.7.12 officiel (SHA-256 vérifié ; shellcheck et pyflakes non exécutés). Liens locaux : 33 documents, 239 liens valides ; `git diff --check` réussi. La stack synthétique a été arrêtée après recette, la base principale conservée.

## Limites et portes restantes

Le test de restauration partage les rôles système du cluster synthétique et utilise son superutilisateur pour charger les schémas. Il ne démontre ni restauration dans Supabase hébergé, ni OTP après récupération, ni copie des clés racines, ni bascule Vercel. Le schéma de cron et les secrets Vault sont volontairement exclus de l’archive ; leur reconstitution est une étape distincte.

Les trois workflows privés, leurs outils Debian et le stockage n’ont pas été exécutés à distance. Le workflow indépendant contrôle toutes les six heures l’âge du dernier export réussi et la présence d’un artefact non expiré, via les métadonnées GitHub sans télécharger de données. Le contrôle des traitements est prévu une fois par heure, en connexion SQL forcée en lecture seule ; ce compromis limite les minutes Actions privées. Ces workflows sont bloqués sur le dépôt public. Leur activation, les quotas et la réception d’alertes restent à valider sur la cible privée. Le panneau administrateur ne vérifie pas les sauvegardes ni la réception réelle du Push.

Restent : comptes/domaine/DNS/SMTP et premier administrateur, environnements séparés, éligibilité économique, secrets, recette réelle iOS/Android/bureau, pipeline de livraison et rollback Vercel répétés, restauration hébergée avec OTP, incidents SMTP/worker, contrôle des purges et pilote multi-utilisateur. Aucun achat ni activation distante n’est implicite dans ce rapport. Voir le [guide](operations.md) et les [conditions de lancement](roadmap.md#conditions-de-lancement-et-points-bloquants).
