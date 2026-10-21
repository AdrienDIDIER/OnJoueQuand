# Exploitation et préparation du pilote — J8

J8 est en préparation locale. Aucun déploiement, sauvegarde réelle, nouveau service ni invitation réelle n’a été exécuté. Les preuves figurent dans le [rapport J8](j8-validation.md). La décision de stockage est décrite dans l’[ADR 015](decisions/015-sauvegardes-privees-et-recette-exploitation.md).

## Environnements et livraison

| Environnement | Données et envois | Secrets et publication |
| --- | --- | --- |
| Local et CI | Synthétiques ; e-mails dans Mailpit ; cron désactivé | Aucun secret distant ; tests uniquement |
| Préproduction | Comptes de recette ; SMTP limité ; Push vers appareils de recette | Projet Supabase distinct ; jamais les clés de production |
| Production | Groupe réel après recette et autorisation de lancement | Environnements protégés ; aucun secret dans les previews non fiables |
| Exploitation privée | Sauvegardes chiffrées et métadonnées techniques | Miroir privé séparé ; clé de déchiffrement conservée hors Actions |

Avant de connecter Vercel à GitHub, désactiver les publications automatiques non approuvées et vérifier les droits des contributions externes. Restreindre les secrets Vercel par environnement, n’associer les clés de production à aucune preview. Choisir des régions européennes proches et confirmer l’usage personnel non commercial requis par [Hobby](https://vercel.com/docs/plans/hobby). Vérifier les [quotas Supabase](https://supabase.com/pricing) et [Resend](https://resend.com/pricing) au moment du provisionnement ; aucune dépense autorisée implicitement.

Séquence de livraison à effectuer après configuration et autorisation :

1. Choisir un SHA revu dont la CI distante est verte ; consigner SHA et migrations attendues.
2. Vérifier une sauvegarde récente et une restauration isolée. Geler les migrations incompatibles.
3. Appliquer les migrations additives en préproduction, puis seulement celles approuvées en production. Le dépôt ne fournit aucune commande automatique ciblant la production.
4. Déployer l’application avec les variables de l’environnement cible. Vérifier OTP, refus sans adhésion, disponibilité, vote, confirmation et RSVP avec des comptes de recette.
5. Vérifier l’URL publique, le manifest et les appareils ; activer ensuite les traitements selon le [guide notifications](notifications-operations.md).
6. Consigner les résultats, la version précédente et l’exploitant responsable avant les invitations réelles.

Retour arrière : remettre le déploiement Vercel précédent connu et compatible. Ne pas annuler automatiquement les migrations ; vérifier que ce déploiement accepte le schéma actuel. Si ce n’est pas le cas, passer en maintenance et corriger par migration progressive. Désactiver temporairement le cron si des notifications sont incorrectes ; ne pas rejouer l’outbox à l’aveugle. Une répétition Vercel effective et son compte rendu restent requis avant le pilote.

## Sauvegarde chiffrée

Prérequis : Node 24, client PostgreSQL de même version majeure que la base ou plus récent compatible, `age` et `age-keygen`. La recette locale utilise PostgreSQL 17.11 et age 1.3.2 officiel, téléchargé avec vérification SHA-256. Les outils système du workflow sont fournis par son image PostgreSQL et les dépôts Debian ; contrôler leurs versions lors de son premier essai privé.

Générer la paire age **sur le poste de récupération**, dans un répertoire sécurisé hors dépôt. `age-keygen -o <chemin-prive>` crée l’identité privée ; `age-keygen -y <chemin-prive>` extrait le destinataire public. Ne jamais transférer l’identité privée dans GitHub. Conserver deux copies sécurisées et vérifier que l’exploitant peut les retrouver.

Configurer les variables `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` via le coffre de l’exploitant, puis `PGSSLMODE=verify-full`, `PGSSLROOTCERT` et `BACKUP_RECIPIENT`. Utiliser le pooler **session**, pas transaction, ou la connexion directe adaptée au réseau. Lancer `npm run backup:create -- <chemin-hors-depot.dump.age>`. `AGE_BIN` peut indiquer le chemin de l’outil. Aucune connexion n’est tirée automatiquement de `.env.local`.

Le script exporte uniquement les quatre schémas explicitement listés. Il capture notamment les identités et jetons Auth : l’archive est très sensible, même si elle est chiffrée. Les réglages d’Auth et le matériel d’encryption de la plateforme ne sont pas inclus. Le stockage utilisateur est désactivé au MVP ; si cela change, prévoir un export séparé des fichiers.

Pour l’automatisation, copier les outils et `.github/workflows/backup.yml` dans un miroir d’exploitation **privé** à accès restreint. Le workflow vérifie la confidentialité du dépôt et exige `BACKUP_ENABLED=true`. Configurer l’environnement protégé `backup-production` : secrets `BACKUP_PGHOST`, `BACKUP_PGPORT`, `BACKUP_PGUSER`, `BACKUP_PGPASSWORD`, `BACKUP_CA` et variable `BACKUP_RECIPIENT`. Programmer les notifications d’échec GitHub pour le mainteneur. Aucun secret de déchiffrement n’y est nécessaire. Vérifier le premier export et son téléchargement ; les artefacts expirent après sept jours.

Copier également `.github/workflows/backup-monitor.yml` : ce contrôle indépendant s’exécute toutes les six heures avec les seuls droits `actions:read` et `contents:read`. Il exige un dépôt privé, un export réussi commencé depuis moins de 24 heures et un artefact correspondant non vide/non expiré. Il ne télécharge pas les sauvegardes et n’utilise pas les secrets PostgreSQL. Son activation et ses destinataires **restent à raccorder à la cible privée**. Tester une absence d’archive et la réception de l’alerte ; les notifications du seul export ne détectent pas une absence d’exécution. Les schedules GitHub peuvent être retardés : aucun SLA de détection n’est annoncé.

## Restauration et répétition

Répétition synthétique : démarrer une stack Supabase dédiée nommée `OnJoueQuandJxValidation`, avec des comptes `@example.test` et au moins une adhésion active. Définir `REHEARSAL_CONTAINER=supabase_db_OnJoueQuandJxValidation`, `AGE_BIN` et `AGE_KEYGEN_BIN` si nécessaires, puis `npm run backup:rehearse`. Le script ne réinitialise pas la source, refuse le conteneur principal, n’envoie aucun e-mail et supprime sa base temporaire et ses clés éphémères. Il vérifie compteurs, contraintes, politiques et refus/accès RLS. Il nécessite le superutilisateur **local**, indisponible dans un projet hébergé.

Pour une récupération hébergée, suivre le [guide Supabase](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) dans un **nouveau projet isolé** de version compatible. Ne pas appliquer directement la commande du script local au projet hébergé : les schémas Auth et rôles système y préexistent, leurs propriétaires et droits sont gérés par la plateforme. Inspecter l’archive avec `pg_restore --list`, préparer un plan de restauration revu distinguant objets applicatifs et schémas gérés. Le plan hébergé reste à éprouver, sans automatisation destructive ici.

Déchiffrer dans un espace local chiffré et protégé avec `age -d -i <identite-privee> -o <archive-temporaire.dump> <sauvegarde.dump.age>`. Vérifier le code de sortie avant d’utiliser le dump ; ne jamais restaurer un flux déchiffré partiellement en production. Purger ensuite cet espace selon la politique du support utilisé. Une suppression de fichier ne garantit pas son effacement physique sur SSD.

Réappliquer séparément : extensions, migrations et historique, propriétaires/ACL, RLS, paramètres Auth et templates français, SMTP et DNS, URLs/redirections, secrets Vercel, VAPID, Vault, cron **désactivé** et politiques de sauvegarde. Pour Vault ou les facteurs Auth chiffrés, suivre les exigences actuelles de copie de clé racine de Supabase ; aucune récupération de ces secrets n’est démontrée par notre export. Au MVP sans MFA, vérifier tout de même le parcours OTP. Invalider les anciennes sessions selon le plan de récupération et contrôler les révocations avant de réactiver les envois.

Vérifier ensuite identifiants Auth conservés, adhésions et relations, accès direct anonyme/non-membre/membre/révoqué, contraintes de vote/RSVP, connexion OTP et parcours complet. Consigner durée, date du snapshot, pertes possibles et résultat. Objectif pilote : RPO inférieur à 24 h et RTO d’une journée ouvrée, sans SLA.

## Surveillance et incidents

`npm run ops:monitor` utilise une connexion PostgreSQL opérateur configurée comme la sauvegarde, en lecture seule logique. Il ne crée aucune route publique ni ne passe par une clé privilégiée pour les actions utilisateur. Il contrôle l’activation du cron, le dernier job réussi, le retard d’outbox et les échecs Push. Seuls des messages agrégés sont affichés. Codes : `0` sain, `1` alerte, `2` contrôle indisponible. Seuils : quinze minutes sans succès ou d’attente. Un cron volontairement désactivé produit une alerte ; ne pas assimiler l’environnement local à une production saine.

Dans Groupe, « Suivi du traitement (administration) » présente les mêmes catégories avec un snapshot PostgreSQL daté. Le serveur utilise le JWT de l’utilisateur et la RPC vérifie son rôle actif à chaque appel ; aucun secret serveur n’est envoyé au navigateur. Un diagnostic indisponible ne bloque pas les préférences. Ce panneau ne prouve ni la livraison du Push ni la fraîcheur des sauvegardes.

Le miroir privé peut activer `.github/workflows/worker-monitor.yml` avec `WORKER_MONITOR_ENABLED=true`, après configuration de l’environnement `backup-production`. La connexion impose `default_transaction_read_only=on` et une limite de requête de dix secondes. Exécution **horaire**, seuil d’alerte à quinze minutes ; la détection peut donc attendre une heure ou davantage si GitHub retarde le job. Ce compromis économise des minutes privées ; vérifier le budget réel et les quotas avant activation. Les paramètres SQL sont ceux de la sauvegarde ; une connexion distincte aux seuls droits de lecture peut être substituée après recette. Tester un heartbeat absent et confirmer la réception de l’échec GitHub par le mainteneur.

| Incident | Réaction et preuve de reprise |
| --- | --- |
| Worker arrêté | Vérifier cron, Vault, secret et déploiement ; réactiver seulement après correction ; observer un job réussi et la baisse de file |
| SMTP indisponible | Consulter les journaux fournisseur sans codes/jetons ; vérifier domaine et quotas ; rétablir puis tester OTP avec une adresse de recette |
| Push en erreur | Examiner compteurs et codes fournisseur ; respecter le backoff ; ne pas réabonner un appareil supprimé sans son utilisateur |
| Sauvegarde absente/périmée | Vérifier activation privée, calendrier, connexion et quotas Actions ; relancer un export puis restaurer une copie ; signaler le dépassement de RPO |
| Quota/pause Supabase | Vérifier console et disponibilité ; décider avec le porteur avant tout changement payant |
| Fuite de secret | Désactiver l’accès concerné, effectuer la rotation, examiner les accès et restaurer la confiance avant les envois |

Avant lancement, désigner un responsable et un suppléant, tester la réception des alertes, les incidents SMTP/worker et le retour arrière. La fiche [appareils](pwa-device-checklist.md), la purge/conservation et le parcours pilote complet restent des portes de sortie J8 ; aucune n’est déclarée validée par les seuls scripts ci-dessus.

## Conservation appliquée par le worker

La [migration de purge](../supabase/migrations/202610210010_retention.sql) ajoute les dates fiables et une RPC interne. Chaque job traite au plus cent lignes par catégorie après les transitions de sessions ; les passages suivants résorbent le retard. Les compteurs agrégés figurent dans `job_runs.counters.retention`, sans identifiants ni données personnelles. Les durées et la reprise prudente de l’existant sont précisées dans l’[ADR 016](decisions/016-conservation-et-purges-bornees.md).

Avant activation réelle : vérifier les dates de reprise, une sauvegarde restaurable, les lignes arrivant à échéance et le rythme de rattrapage. Les baux vivants restent protégés ; les travaux expirés sont clôturés avant purge. Aucun profil, compte Auth, membre ou jeu n’est supprimé automatiquement. Ne pas appeler la purge avec une date simulée sur une base utilisateur. La migration locale seule n’exécute aucune suppression ; les recettes de purge et les appels HTTP du worker de cette livraison ciblent exclusivement la stack synthétique J8Validation.
