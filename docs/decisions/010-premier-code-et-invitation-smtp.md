# ADR 010 — Premier code et invitation par SMTP Auth

- Statut : Acceptée et implémentée en J2 ; précise l'ADR 003.
- Date : 2026-10-19.
- Portée : premier accès, invitations et reprise des envois.

## Constat vérifié

Avec Supabase Auth local et les inscriptions fermées, `signInWithOtp` retourne `signup_disabled` pour un compte provisionné mais non confirmé, même avec `shouldCreateUser: false`. La route OTP considère ce compte comme une inscription inachevée. Le mécanisme `resend({ type: 'signup', email })` envoie en revanche un code de confirmation à un compte existant ; il ne crée pas de compte. La vérification reste `verifyOtp` avec `type: 'email'`.

Le réglage local `auth.email.enable_signup` active le fournisseur e-mail. Il doit rester à `true` tandis que `auth.enable_signup=false` interdit les inscriptions publiques. Ces deux propriétés sont testées séparément.

## Décision

L'adaptateur tente l'OTP sans création ; uniquement sur `signup_disabled`, il demande le code de confirmation. Les réponses publiques restent génériques. Aucun compte n'est confirmé administrativement et aucune inscription publique n'est ouverte.

L'invitation utilise ce même envoi SMTP Auth et un modèle français contenant le code, le lien vers la connexion et les explications. J2 n'ajoute pas un second fournisseur d'envoi via API Resend. En production, Resend reste le SMTP prévu pour Supabase, à configurer avant J8. Cette décision remplace uniquement le transport de l'invitation prévu dans l'ADR 003 ; la validité de sept jours reste indépendante du code de dix minutes.

L'administrateur peut réessayer depuis une invitation existante. Le compte est retrouvé par son adresse côté backend après un timeout, sans recréation ni suppression compensatoire. Les états de livraison ne prouvent jamais l'acceptation. Une révocation concurrente avec un envoi déjà engagé peut laisser parvenir un code ; les contrôles SQL empêchent toute adhésion après révocation.

## Alternatives et conséquences

Confirmer artificiellement l'adresse ou rouvrir les inscriptions affaiblirait les règles retenues. Générer puis envoyer nous-mêmes des codes via Resend ajouterait un transport et la manipulation de secrets sans nécessité au MVP. Réutiliser SMTP permet de tester le flux complet avec Mailpit ; une panne est visible dans la liste administrative et réessayable.

Sources : [code officiel Auth, MagicLink](https://github.com/supabase/auth/blob/master/internal/api/magic_link.go), [renvoi de confirmation](https://github.com/supabase/auth/blob/master/internal/api/resend.go), [configuration CLI](https://supabase.com/docs/guides/local-development/cli/config). La preuve déterminante reste le test exécuté contre la version locale, décrit dans le [rapport J2](../j2-validation.md).
