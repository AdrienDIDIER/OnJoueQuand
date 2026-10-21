# ADR 018 — Interface chaleureuse et latence de navigation

- Statut : Implémentée ; cache et contrôle initial du layout remplacés par l’[ADR 019](019-cache-navigation-privee.md). Région Dublin vérifiée après publication.
- Date : 2026-10-21.
- Portée : navigation, présentation et coût des lectures ; prolonge l’ADR 017.

## Constat

La première simplification reste jugée lente et trop complexe. Le retour demande une présentation plus naturelle et humaine. Un contrôle distant en lecture confirme Supabase en `eu-west-1` ; trois réponses publiques de connexion portent `cdg1::iad1`, indiquant une exécution à Washington. Durées observées sur cette page publique : 376, 174 et 182 ms. Ce petit échantillon sans session ne mesure pas les changements d’onglet authentifiés.

## Décisions

`vercel.json` fixe une seule région `dub1`, Dublin, proche de Supabase et sans ajout de service. Les régions et leur configuration sont décrites par [Vercel](https://vercel.com/docs/functions/configuring-functions/region). Vérifier la région réellement utilisée dans les réponses après publication ; une compilation locale ne la démontre pas.

Le proxy utilise `getClaims` pour vérifier et rafraîchir le jeton, selon le [guide Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client). Avec une signature asymétrique, la vérification peut réutiliser les clés publiques ; un projet à signature symétrique peut encore exiger un appel Auth. Les pages et commandes conservent `getUser`, la lecture d’adhésion active et RLS. Aucune identité provenant d’un header navigateur ou d’un jeton décodé sans vérification n’est acceptée.

Le layout privé ne contient que le shell public et ne bloque plus son affichage sur Auth. Chaque page continue à vérifier ses propres lectures ; la garde du layout n’était jamais une frontière de sécurité. Le shell affiche un retour de navigation pendant une réponse retardée. Les lectures indépendantes de l’accueil sont diffusées séparément avec Suspense.

`loadOwnWeek` ne lit que les journées du membre et les paramètres horaires du groupe, en parallèle. La saisie, les aperçus et les copies n’ont plus besoin des profils, des réponses des autres membres ou du catalogue. La déduplication reste limitée au rendu courant. Aucun cache persistant privé ni autorisation SQL n’est changé.

## Présentation et interactions

Palette charbon chaud, crème, sauge et mauve discret ; titres éditoriaux, texte courant avec la police système, marque textuelle. Aucun chargement de police distante. Les quatre onglets sont conservés.

- Mes dispos : sept lignes courtes avec réponses rapides ; toucher le jour ouvre ses horaires dans un dialogue natif. Les changements complexes gardent l’aperçu.
- Le groupe et Trouver un soir : vues distinctes sous `/dispos/groupe` et `/dispos/trouver`, autorisées côté serveur, chargées à la demande.
- Sessions : création dans un panneau dédié, options facultatives repliées, RSVP par deux boutons explicites. La création d’un brouillon et sa publication restent deux étapes distinctes ; votes et RSVP restent séparés.
- Groupe : membres avant les raccourcis et réglages. Installation et diagnostics restent dans leur écran dédié.

Le dialogue natif fournit modalité, navigation clavier, fermeture et retour du focus. Les indications optimistes de disponibilité montrent une intention pendant l’enregistrement ; elles ne valent jamais confirmation serveur et reviennent à l’état enregistré en cas de refus. Le test d’une page périmée contrôle aussi la réponse réellement conservée en base.

## Alternatives et limites

Un cache de pages privées réduirait certains chargements mais compliquerait révocations et fraîcheur ; il reste exclu. Retirer les autorisations serveur pour gagner du temps est exclu. Afficher seulement un indicateur de chargement ne corrigerait pas les allers-retours transatlantiques ni les lectures inutiles.

Les captures mobiles, le scénario réseau retenu, les contrôles de focus, les parcours Auth/RLS, les copies et les RSVP constituent des vérifications locales. Ils ne démontrent ni temps de réponse garanti sur iPhone ni réception Push réelle. Le service worker et sa liste de cache restent inchangés ; seul le manifest adopte la couleur de fond de l’interface.
