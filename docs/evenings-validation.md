# Recette — Soirées, états de l’accueil et test Push

Date : 21 octobre 2026. Périmètre : [ADR 020](decisions/020-soirees-simples-et-test-push.md). Code local prêt ; aucune migration hébergée ni publication de cette révision pendant la recette.

## Résultat fonctionnel

- Soirées : un jour et un début suffisent ; fin prévue affichée, jeu et nom facultatifs. Création directement confirmée, réponses explicites Je viens / Sans moi. Anciennes propositions préservées.
- Accueil : sept dates ordonnées du lundi au dimanche ; disponible vert, indisponible rouge, absence de réponse neutre discontinue. Une réponse pour vendredi ne colore plus lundi. Le compteur conserve le nombre total de réponses.
- Réglages : bouton Tester les notifications pour l’appareil courant activé ; contrôle de propriété, préférence Push et limite d’un test par minute. Pas d’activation implicite, de cron ou d’envoi collectif.

## Contrôles réellement exécutés

Environnement : Supabase local **OnJoueQuandJ8Validation**, données et comptes synthétiques dédiés. Aucune réinitialisation de la stack personnelle ni envoi Push réel.

- `npm run check` : lint, typage strict, 56 tests Vitest et compilation réussis.
- Suites SQL `sessions.test.mjs` et `evenings.test.mjs` adaptées à J8Validation : 15 tests réussis, avec contrôles d’accès directs et concurrence. Cela inclut les anciens votes et les nouvelles soirées, l’absence de participation implicite et la limitation des tests Push.
- Passe générale Playwright : 159 parcours réussis, un test clavier WebKit ignoré sur Windows, quatre attentes textuelles anciennes repérées puis corrigées après le renommage Session → Soirée.
- Reprise ciblée sur Chromium, Firefox, WebKit et profil mobile : **52 parcours réussis**, incluant ces quatre attentes corrigées, les soirées à deux comptes, l’historique, le cache, les sept états journaliers et le bouton de test.
- Capture du formulaire mobile inspectée ; le formulaire court s’ouvre directement depuis une date sélectionnée. Deux scénarios mobiles de test Push et de formulaire rejoués avec succès.
- Types publics régénérés depuis les migrations locales ; liens Markdown et `git diff --check` contrôlés.

Le test de Push automatisé vérifie les conditions de déclenchement et les droits ; il ne prouve pas la réception sur l’iPhone réel. Aucun fournisseur externe n’est sollicité pendant cette recette.

## Ordre de livraison

1. Obtenir l’autorisation d’appliquer les migrations additives 011 et 012 au projet hébergé.
2. Vérifier la cible et les migrations déjà appliquées ; appliquer uniquement les migrations attendues, puis confirmer leur présence.
3. Publier le code et vérifier Vercel/CI.
4. Sur l’iPhone installé : activer cet appareil si nécessaire, toucher Tester les notifications et constater la réception. Vérifier ensuite une réponse Dispo puis Non et leur couleur sur l’accueil ; organiser une soirée et répondre avec un second membre.

Le rollback applicatif garde les anciennes commandes compatibles ; les migrations n’effacent ni proposition, ni vote, ni RSVP. Ne pas supprimer les nouveaux objets en production pour revenir à une interface antérieure.
