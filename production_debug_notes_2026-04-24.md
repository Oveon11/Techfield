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
