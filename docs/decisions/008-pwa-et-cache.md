# ADR 008 — PWA installable et cache limité

- Statut : Acceptée, conception non implémentée.
- Date : 2026-10-15.
- Portée : J7 ; PR-11, PR-12, PR-13, PR-15.

## Contexte

Les membres veulent installer l'application sur téléphone et ordinateur. Le calendrier contient des données privées et des modifications concurrentes : le mode hors connexion complet n'est pas nécessaire au MVP.

## Décision

Fournir un manifest français, une identité stable, un affichage autonome, des icônes adaptées et un service worker minimal. Le worker gère Push, clic sécurisé et repli hors connexion générique ; seuls les assets publics explicitement autorisés sont conservés.

Ne pas mettre en cache les pages authentifiées, données API/RSC ou jetons, ni mettre en attente des écritures hors connexion. Expliquer l'indisponibilité réseau et proposer une reprise. Une mise à jour du worker n'interrompt pas brutalement une saisie.

Adapter l'aide à l'installation aux capacités du navigateur, sans supposer un prompt universel. Demander le Push uniquement après action volontaire. Sur iOS/iPadOS compatible, expliquer la nécessité d'une installation sur l'écran d'accueil. Le refus de permission ne bloque ni l'application ni sa boîte interne.

## Alternatives écartées

- Applications natives distinctes : coût de développement et de distribution sans besoin établi.
- Plugin PWA avec cache automatique large : risque de conserver des données privées ou des états périmés.
- Écritures offline synchronisées : conflits et arbitrages produits supplémentaires, différés après MVP.
- Demande Push au premier chargement : absence de contexte et de choix volontaire clair.

## Conséquences

L'application installée reste essentiellement connectée. Tous les navigateurs n'offrent pas la même installation ou le même Push ; la détection et l'aide sont indispensables. Les tests WebKit automatisés ne prouvent pas l'installation sur iPhone.

## Vérification et sources

T-PWA sur appareils iOS/Android et bureau : installation, lancement, permission, réception, clic, mise à jour, déconnexion et audit Cache Storage. T-UI valide les contenus français et l'accessibilité. Références : [WebKit](https://webkit.org/blog/13878/), [guide Next.js PWA](https://nextjs.org/docs/app/guides/progressive-web-apps), [architecture](../architecture.md#pwa-installation-et-cache).
