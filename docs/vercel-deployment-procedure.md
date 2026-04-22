# Procédure de déploiement Vercel pour Techfield

Ce document fixe une procédure de migration réaliste vers **Vercel** avec **Supabase**. Il ne suppose pas que l’architecture finale est déjà entièrement basculée. Au contraire, il sert de guide pour séparer proprement les responsabilités avant mise en ligne.

## Préparation des variables d’environnement

Avant tout déploiement, les variables d’environnement de l’application doivent être redéfinies autour de **Supabase** et des besoins propres à Vercel. La logique cible est la suivante.

| Variable | Usage |
| --- | --- |
| `SUPABASE_URL` | URL du projet Supabase |
| `SUPABASE_ANON_KEY` | Clé publique utilisée pour les clients SSR et front contrôlés |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé serveur réservée aux accès backend sécurisés |
| `DATABASE_URL` | Chaîne Postgres Supabase si une couche SQL serveur reste utilisée temporairement |
| `NODE_ENV` | Environnement d’exécution |

Les variables encore propres à l’environnement actuel ne doivent pas être reprises dans la cible Vercel, sauf pendant une phase transitoire strictement contrôlée.

## Authentification et session

La cible recommandée pour Vercel est une session **SSR pilotée par cookies**, conformément à la recommandation Supabase [1]. La session ne doit plus dépendre du `localStorage` comme source d’autorité. Concrètement, cela signifie que le front peut conserver un état dérivé pour l’ergonomie, mais la vérité d’authentification doit venir d’un cookie serveur, relu à chaque requête SSR ou API sensible.

| Option | Avantage | Réserve |
| --- | --- | --- |
| **Supabase Auth** | Intégration naturelle avec Supabase, cookies SSR, flux documentés | Nécessite migration du flux OAuth actuel |
| **Fournisseur externe + cookies serveur** | Plus flexible si vous avez déjà un SSO ciblé | Plus de travail d’intégration et de mapping des rôles |

Dans les deux cas, les rôles métiers `admin`, `technicien` et `client` doivent rester pilotés par la donnée applicative Techfield, pas uniquement par le fournisseur d’identité.

## Séquence de migration recommandée

Le déploiement Vercel doit suivre un ordre qui limite les régressions.

| Ordre | Action |
| --- | --- |
| 1 | Installer le schéma Supabase via SQL Editor |
| 2 | Basculer la couche stockage sur Supabase Storage |
| 3 | Introduire les modules serveur `server/integrations/supabase/*` |
| 4 | Remplacer progressivement les dépendances d’authentification actuelles |
| 5 | Découper les routes serveur pour la cible Vercel |
| 6 | Configurer les variables d’environnement dans Vercel |
| 7 | Déployer un environnement de préproduction |

## Déploiement sur Vercel

La documentation Vercel indique que les fonctions Node.js sont exposées dans le répertoire `/api` [2]. Cela implique que Techfield devra converger vers des handlers Vercel ciblés, plutôt que conserver indéfiniment un unique serveur Express central. En pratique, je recommande de garder le front Vite/React pour le rendu, puis de déplacer progressivement la logique serveur vers des points d’entrée `api/*` spécialisés.

## Limites de compatibilité à anticiper

Il faut être explicite sur ce point : l’état actuel du projet contient encore des briques dépendantes de l’environnement Manus, notamment l’authentification OAuth spécifique, le stockage Forge et certains outils de runtime. Ces éléments doivent être retirés ou encapsulés avant un déploiement Vercel final. La procédure de migration fournie ici sécurise cette transition, mais ne signifie pas encore que tout l’existant peut être envoyé tel quel sur Vercel sans adaptation complémentaire.

## Références

[1]: https://supabase.com/docs/guides/auth/server-side "Server-Side Rendering | Supabase Docs"
[2]: https://vercel.com/docs/functions/runtimes/node-js "Using the Node.js Runtime with Vercel Functions"
