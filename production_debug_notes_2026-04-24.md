# Constat de production Vercel — 2026-04-24

La racine `https://techfield.vercel.app/` charge un shell visuel vide de type squelette, sans contenu métier visible.

La console navigateur en production remonte une série d’erreurs `Failed to load resource: the server responded with a status of 404 ()` répétées en boucle. Cela suggère qu’un ou plusieurs assets ou appels réseau nécessaires au rendu initial ne sont pas trouvés en production.

Le problème observé n’est donc plus un échec de build TypeScript, mais un problème de ressources ou de requêtes runtime en production qui empêche l’application de sortir de son état de chargement.

## Constat complémentaire

Les assets frontend principaux sont bien chargés en production :

- script : `https://techfield.vercel.app/assets/index-BBn6gFnC.js`
- feuille CSS : `https://techfield.vercel.app/assets/index-8FW9bTLO.css`

Le blocage vient de l’API runtime : l’appel `GET /api/trpc/auth.me?...` répond **404** avec un corps texte `The page could not be found / NOT_FOUND`.

Cela indique que le shell frontend démarre, mais que le runtime Vercel ne route pas correctement ` /api/trpc/* ` vers la function applicative, ou que le point d’entrée API publié ne correspond pas au chemin attendu par le client.

## Diagnostic final du 24/04/2026

La cause racine du rendu vide en production n’était plus une erreur TypeScript mais un **problème de publication des routes API sous Vercel dans un projet non-Next**. Une source Vercel communautaire confirme que le comportement **catch-all** du type `api/[...slug].ts` est une fonctionnalité propre à **Next.js** et qu’en dehors de Next.js, les routes dynamiques sont limitées aux segments simples, sans support réel du catch-all multi-segments.[1]

En cohérence avec ce constat, le point d’entrée `api/[...path].ts` a été remplacé par une **fonction API unique** `api/index.ts`, alimentée par des **rewrites explicites** pour `api/trpc`, `api/oauth/callback` et `manus-storage`. Cette approche évite de dépendre d’un mécanisme de catch-all non pris en charge dans ce contexte de déploiement.

La prévisualisation locale de l’application affiche maintenant une **interface réelle** à la racine `/`, avec la carte d’accès Techfield visible. L’écran n’est donc plus vide localement après ce correctif. Le message affiché localement indique encore que la configuration Supabase navigateur doit être renseignée dans l’environnement de déploiement pour activer la connexion côté client.

## Référence

[1] https://github.com/vercel/community/discussions/947 — *How do dynamic `/api` routes (specifically catch all routes) work?* (Vercel Community)
