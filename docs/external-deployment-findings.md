# Constats clés pour la migration Vercel + Supabase

## Vercel

La documentation Vercel indique que les fonctions Node.js sont servies à partir du répertoire `/api` et qu’elles peuvent exposer soit un export `fetch`, soit des handlers HTTP dédiés. Cela confirme que l’architecture actuelle basée sur un serveur Express monolithique devra être découpée pour une cible Vercel orientée fonctions. La documentation rappelle également que TypeScript est supporté dans `/api`, et que les dépendances sont installées à partir du `package.json` racine.

## Supabase Auth SSR

La documentation Supabase précise que l’authentification SSR doit stocker la session dans des cookies côté serveur plutôt que dans le local storage. Elle recommande d’utiliser les variantes de flux **PKCE** lorsque cela s’applique et mentionne le package `@supabase/ssr` pour simplifier la gestion des clients côté serveur, avec la réserve que l’API est encore indiquée comme bêta.

## Conséquences directes pour Techfield

Techfield devra séparer clairement :

1. les routes serveur destinées à Vercel,
2. la logique de session/authentification,
3. l’accès aux données Supabase,
4. le stockage documentaire Supabase.

Le stockage actuel et l’authentification actuelle sont encore liés à l’environnement Manus et devront être remplacés ou isolés avant un vrai déploiement Vercel.
