# J1 — Socle et preuves de validation

Rapport historique de J1 au **19 octobre 2026**. J0 est enregistré dans le commit `1841203`, J1 dans `6b1af70`. Aucun push, déploiement, projet distant ou invitation réelle n'a été effectué. Les évolutions ultérieures de l'authentification sont décrites dans le [rapport J2](j2-validation.md).

## Ce qui est livré

- Next.js App Router, TypeScript strict et lockfile npm ; configuration des versions et variables d'environnement.
- Navigation Accueil, Dispos, Sessions et Groupe, redirection depuis `/`, shell sombre responsive, composants Button/Card selon les conventions shadcn/ui et icônes Lucide.
- Pages d'attente françaises, sans comptes, statistiques ou sessions fictifs ; page 404 et message d'erreur français.
- Supabase local PostgreSQL 17, Studio et boîte e-mail locale ; inscriptions publiques désactivées, exposition automatique des futures tables désactivée. Aucun schéma métier ni utilisateur créé.
- Vitest pour les erreurs de configuration ; Playwright pour les routes, liens, affichage mobile, clavier et captures.
- GitHub Actions avec permissions minimales, actions référencées par SHA et jobs distincts pour application et Supabase. Aucun secret de production requis.

Les routes sous `(prive)` ne sont **pas protégées en J1**. Ce groupe organise les fichiers, sans mécanisme d'autorisation implicite. Le shell ne lit aucune donnée et ne possède aucun client privilégié. J2 doit ajouter Auth, contrôles d'appartenance et RLS avant toute connexion de données privées.

## Versions installées et compatibles

| Composant | Version verrouillée ou vérifiée |
| --- | --- |
| Node.js de validation | 24.22.0 ; ligne 24.x pour développement et CI |
| npm | 11.21.1 |
| Next.js / eslint-config-next | 16.4.1 |
| React / React DOM | 19.3.1 |
| TypeScript | 6.0.3 |
| Tailwind / plugin PostCSS | 4.3.3 |
| ESLint | 9.39.5 |
| Vitest | 5.0.5 |
| Playwright | 1.64.1 |
| Supabase CLI | 2.121.0 |
| PostgreSQL local | 17.11 |

Les autres versions exactes sont dans [package.json](../package.json) et [package-lock.json](../package-lock.json). Les SDK Supabase applicatifs, Temporal et Web Push seront ajoutés au jalon qui les utilise ; ils ne sont pas des dépendances inutilisées de J1.

TypeScript 7 a été écarté car les dépendances typescript-eslint de la configuration Next.js exigent `<6.1`. ESLint 10 a été écarté car les plugins import/react/jsx-a11y intégrés par cette configuration déclarent une compatibilité s'arrêtant à ESLint 9. Le choix est la version stable compatible, sans `--force`, `--legacy-peer-deps` ni override masquant une incompatibilité. `npm ls --depth=0` réussit.

Le Node 22 initial de la machine n'a pas été remplacé globalement. Les contrôles Windows utilisent un Node 24 et npm 11 installés dans `.tools/`, ignoré par Git. Pour un autre poste, installer Node 24 LTS et npm 11 avant `npm ci` ; ce répertoire de vérification n'est pas un prérequis distribué.

## Vérifications effectuées

| Contrôle | Résultat |
| --- | --- |
| Réinstallation avec `npm ci` | Réussie sous Node 24 et npm 11 depuis le lockfile. |
| `npm run lint` | Réussi, aucun avertissement de lint. |
| `npm run typecheck` | Réussi, types de routes générés et TypeScript strict. |
| `npm test` | Neuf tests réussis : origine absente/invalide, paire Supabase incomplète, clé secrète/service_role refusée, erreurs sans fuite et shell sans Supabase. |
| `npm run build` | Réussi ; `/`, `/accueil`, `/dispos`, `/sessions`, `/groupe` et page introuvable. |
| Playwright Windows | 31 réussis, un ignoré explicitement : focus natif WebKit Windows. Les autres parcours WebKit, Chromium, Firefox et mobile passent. |
| Validation Linux isolée | Installation propre, lint, typage, neuf tests Vitest et build réussis ; 32 tests Playwright réussis, sans test ignoré, dont le focus clavier WebKit. |
| Revue visuelle | Captures Accueil bureau et mobile examinées ; bouton primaire à texte sombre pour le contraste, navigation mobile fixe et absence de débordement horizontal. |
| Supabase local | Démarrage, `db reset --local`, seed sans données métier et requête PostgreSQL réussis. |
| Audit des dépendances de production | Zéro vulnérabilité signalée lors du contrôle `npm audit --omit=dev`. |
| CI GitHub distante | Non exécutée : aucun push demandé/effectué. Son résultat n'est pas assimilé aux contrôles locaux. |

### Focus WebKit et contrôle Linux

Sous WebKit headless Windows, le diagnostic observé est `document.hasFocus() === false` : Tab, Alt+Tab et la mise au premier plan ne donnent pas de focus natif au document. Le test clavier n'est donc ignoré que pour la combinaison WebKit/Windows. Il ne remplace pas la navigation réelle par un appel artificiel à `focus()`.

Le même test est obligatoire sous Linux dans le workflow ; les autres navigateurs continuent de vérifier le lien d'évitement sous Windows. La validation dans l'image officielle `mcr.microsoft.com/playwright:v1.64.1-noble`, avec les seules sources applicatives copiées et sans secrets, a réussi : installation propre sous Node 24.22.0/npm 11.21.1, `npm run check` et 32 tests Playwright sur 32. Cette exécution locale en conteneur est distincte de GitHub Actions, qui n'a pas encore été exécuté.

## Réserves techniques

L'audit complet signale cinq entrées élevées provenant d'une seule chaîne de dépendances de développement : `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`. L'avis est [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), déni de service sur des motifs profondément imbriqués. La version `braces` disponible lors de la vérification est 3.0.3 et reste concernée. Cette chaîne n'est pas servie à l'utilisateur ; les patterns de lint sont ceux du dépôt. Une PR malveillante peut toutefois affecter les ressources du job : aucune donnée sensible ni secret de production n'est accessible dans ce workflow, et les jobs ont une durée maximale.

ESLint 9 est également signalé comme hors support par npm. Une mise à jour compatible de la configuration Next.js/plugins sera nécessaire pour passer à ESLint 10 et éliminer cette réserve. Ne pas exécuter `npm audit fix --force` : la correction proposée rétrograde la configuration Next.js vers une branche incompatible avec le socle choisi. L'audit de production bloquant en CI ne remplace pas le suivi de cet audit de développement.

Les performances métier, RLS, OTP, PWA installée et Push ne sont pas testés en J1 : leurs fonctionnalités n'existent pas encore. Les émulations navigateur ne constituent pas une recette sur iPhone ou Android réels.

## Reproduire les contrôles

```sh
npm ci
npm run check
npx playwright install chromium firefox webkit
npm run test:e2e
npm audit --omit=dev
npm run db:start
npm run db:reset
npm run db:stop
```

Sous Linux, utiliser `npx playwright install --with-deps chromium firefox webkit`. Les ports Supabase sont 55320–55324 pour ne pas interrompre un autre projet utilisant 54320–54324. Le port Playwright 3100 doit être libre. Les serveurs Next.js des tests sont démarrés et arrêtés par Playwright.

Les secrets locaux et les captures restent ignorés ; aucune sortie complète contenant des clés Supabase n'est enregistrée dans les documents. Voir le [README](../README.md) pour démarrer l'interface et la [roadmap](roadmap.md) pour J2.
