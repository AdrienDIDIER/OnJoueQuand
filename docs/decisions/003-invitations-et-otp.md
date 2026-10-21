# ADR 003 — Invitations nominatives et OTP e-mail

- Statut : Implémentée en J2, transport et premier code précisés par [ADR 010](010-premier-code-et-invitation-smtp.md).
- Date : 2026-10-15.
- Portée : J2, J8 ; PR-01, PR-02.

## Contexte

Les membres veulent un compte individuel sans gérer de mot de passe. L'accès reste strictement nominatif et sur invitation. Les preuves d'identité, l'envoi des e-mails et l'adhésion au groupe ont des cycles de vie distincts.

## Décision

Utiliser Supabase Auth avec code e-mail expirant après dix minutes. Désactiver les inscriptions publiques et utiliser `shouldCreateUser: false`. Un administrateur crée une invitation valable sept jours ; le serveur provisionne au besoin un compte sans mot de passe et sans confirmer artificiellement l'adresse.

Envoyer l'invitation française et les codes via le SMTP Auth, conformément à l'ADR 010 qui remplace la séparation API Resend/SMTP initialement prévue. Le lien d'invitation n'accorde aucun accès à lui seul. Après vérification OTP, une transaction compare l'adresse Auth confirmée à l'invitation, contrôle validité et révocation, puis crée l'adhésion et consomme l'invitation.

Séparer états d'invitation, provisionnement et livraison pour reprendre les erreurs sans compte ni adhésion dupliqués. Le premier administrateur suit une procédure d'exploitation contrôlée ; les demandes de code sont limitées et leur réponse n'énumère pas les comptes.

## Alternatives écartées

- Mot de passe : récupération et friction supplémentaires pour ce groupe.
- Google uniquement : dépendance à un fournisseur d'identité que tous les invités ne souhaitent pas nécessairement utiliser.
- Invitation publique partageable donnant accès seule : ne garantit pas l'identité nominative.
- Confirmation administrative de l'e-mail : ne prouve pas que le destinataire maîtrise l'adresse.

## Conséquences

Un domaine et un SMTP fiable sont indispensables avant les connexions réelles. Le SMTP Supabase par défaut ne constitue pas un service de production. Une panne SMTP peut bloquer une nouvelle connexion ; elle ne doit pas corrompre l'invitation. La création Auth et PostgreSQL n'étant pas une transaction distribuée, le provisionnement doit être idempotent.

## Vérification et sources

T-AUTH/T-RLS : compte provisionné non confirmé avec création publique désactivée, codes expirés/réutilisés, invitation révoquée, mauvaise adresse, acceptation concurrente et reprise d'échec. Valider ce parcours avec la configuration exacte en J2.

Références : [OTP Supabase](https://supabase.com/docs/guides/auth/auth-email-passwordless), [SMTP personnalisé](https://supabase.com/docs/guides/auth/auth-smtp), [flux applicatif](../architecture.md#authentification-et-invitations).
