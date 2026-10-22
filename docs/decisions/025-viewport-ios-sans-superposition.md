# ADR 025 — Viewport installé sans superposition de la barre système

- Date : 22 octobre 2026.
- Statut : décision appliquée ; contre-vérification iOS 27.0.1 après réinstallation nécessaire.
- Portée : présentation PWA ; précise les ADR 008 et 014. Ni cache, ni authentification, ni Push modifiés.

## Contexte

Les deux ajustements CSS de la navigation n’ont pas corrigé la bande vide sur l’iPhone de l’utilisateur. Le relevé `affichage-20261022-1` apporte une mesure réelle : écran de 956 px, `innerHeight` et viewport visuel de 894 px, `100vh` de 956 px, `100dvh` de 894 px et inset supérieur de 62 px. Après défilement, `100dvh` atteint 956 px avec un offset visuel négatif. Le défaut dépasse donc l’alignement du seul composant de navigation.

Le [suivi WebKit 301994](https://bugs.webkit.org/show_bug.cgi?id=301994) décrit un écart similaire dans les applications installées et a été rouvert pour iOS 27. Ce rapprochement ne constitue pas une reproduction locale du défaut natif.

## Décision

Utiliser `apple-mobile-web-app-status-bar-style=black` et `viewport-fit=auto`. L’application demande à être cadrée dans la zone disponible, sans superposition intentionnelle avec la barre système. Selon la [référence Apple](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariHTMLRef/Articles/MetaTags.html), `black` place le contenu sous la barre, tandis que `black-translucent` demande un affichage sous celle-ci. Cette référence décrit le contrat historique ; les versions iOS récentes peuvent présenter des régressions.

Revenir à l’ancrage inférieur CSS ordinaire de la navigation. Conserver son fond opaque et ses insets résiduels : ne pas coder 62 px en dur, ne pas ajouter un complément basé sur `screen.height`, ne pas simuler un défilement et ne pas bloquer le zoom. Le manifest garde son identité et `display:standalone`.

## Alternatives écartées

- Déplacer encore la barre ou employer `100vh` à la place du viewport dynamique : la mesure montre qu’un contenu ainsi placé peut dépasser le viewport réellement accessible.
- Soustraire ou ajouter systématiquement l’inset supérieur : cela risquerait de masquer un problème au portrait et de décaler l’interface avec le clavier, le zoom ou la rotation.
- Forcer un scroll au lancement : cela modifie la position de lecture et dépend d’un effet de bord natif.
- Réécrire le shell avec un défilement imbriqué : changement plus large sans preuve qu’il corrige le viewport lui-même.

## Conséquences et validation

La barre système peut avoir un fond noir au lieu de prolonger le fond de la page. La vérification sur appareil doit inclure une nouvelle installation depuis Safari, pour ne pas confondre la nouvelle configuration avec des paramètres conservés par l’ancienne icône. Le [suivi WebKit 316008](https://bugs.webkit.org/show_bug.cgi?id=316008) documente précisément des différences de géométrie liées aux métadonnées présentes au moment de l’installation.

Retirer l’application installée ne supprime pas les disponibilités ni les soirées stockées côté serveur, mais peut nécessiter une nouvelle connexion OTP et une nouvelle activation des notifications. Ne pas modifier les données serveur ni supprimer les abonnements d’autres appareils.

Les tests automatisés vérifient les métadonnées effectivement rendues, l’alignement avant/après défilement, les changements de dimensions et l’accessibilité sur quatre profils. Le diagnostic temporaire version `affichage-20261022-2` reste disponible jusqu’à la contre-vérification réelle ; une hauteur de page inférieure à l’écran devient normale si la barre système occupe correctement l’espace au-dessus. Le critère décisif est l’absence de bande supplémentaire sous les onglets dès le lancement, avec et sans clavier et après rotation.
