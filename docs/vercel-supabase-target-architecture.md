# Architecture cible Techfield pour Vercel et Supabase

Techfield doit évoluer d’une architecture actuellement centrée sur un serveur Express et des services intégrés vers une architecture **séparée**, dans laquelle **Vercel** héberge l’application et les routes serveur, tandis que **Supabase** porte explicitement le **SQL**, le **stockage documentaire** et, si vous le validez ensuite, la **gestion de session** via cookies côté serveur. Cette cible est cohérente avec les recommandations des plateformes : Vercel exécute les fonctions serveur dans le répertoire `/api` [1], tandis que Supabase recommande, pour les scénarios SSR, de conserver les sessions dans des **cookies** plutôt que dans le `localStorage` [2].

| Bloc | Rôle dans Techfield | Ce qui doit y vivre | Ce qui ne doit pas y vivre |
| --- | --- | --- | --- |
| **Frontend Vercel** | Interface utilisateur et navigation | Pages React, composants UI, formulaires, tableaux, calendrier, dashboards | Requêtes SQL directes, logique de sécurité métier profonde |
| **API Vercel** | Orchestration métier côté serveur | Validation, contrôle d’accès, composition des flux, appels Supabase | Stockage local, dépendances spécifiques Manus |
| **SQL Supabase** | Modèle métier et persistance | Tables, index, enums, vues, fonctions SQL, migrations | Rendu UI, logique de formulaire |
| **Storage Supabase** | Fichiers et médias métier | Photos, rapports, pièces jointes, contrats, bons d’intervention | Règles UI, calculs métier non liés aux fichiers |
| **Auth / Session** | Identité et session | Cookies SSR, mapping rôles Techfield, éventuels profils reliés aux utilisateurs | Session en `localStorage` comme source de vérité |

Dans cette organisation, le code doit être lu comme une chaîne de responsabilités. Le navigateur appelle l’application déployée sur **Vercel**. Les routes serveur Vercel valident les entrées, appliquent les règles métier, puis délèguent les accès structurés à **Supabase SQL** et à **Supabase Storage**. Les règles d’accès aux données et aux fichiers doivent être pensées comme des couches distinctes, afin d’éviter qu’une décision de sécurité documentaire se retrouve mélangée à une mutation de chantier ou de contrat.

## Impacts directs sur l’existant

L’existant Techfield comporte plusieurs dépendances liées à l’environnement actuel : la connexion base via `DATABASE_URL`, le stockage via des helpers Forge et des URLs `/manus-storage/...`, ainsi qu’un flux d’authentification OAuth et de session adossé à des variables spécifiques. Ces points doivent être isolés avant un déploiement Vercel propre, car Vercel attend un découpage en fonctions serveur plutôt qu’un serveur Node monolithique permanent [1]. En parallèle, Supabase SSR recommande explicitement une gestion de session par cookies côté serveur [2].

| Zone existante | Dépendance actuelle | Cible recommandée |
| --- | --- | --- |
| Base de données | `DATABASE_URL` + Drizzle MySQL | Supabase Postgres + scripts SQL versionnés |
| Stockage fichiers | helper Forge + `/manus-storage/...` | bucket Supabase + métadonnées dans `public.documents` |
| Auth client | URL OAuth spécifique + redirection actuelle | session SSR compatible Vercel, idéalement Supabase Auth ou fournisseur externe géré en cookies |
| Serveur | Express central | routes `/api` ciblées pour Vercel |
| Logs/debug | plugins spécifiques à l’environnement actuel | instrumentation Vercel ou observabilité applicative séparée |

## Structure de code recommandée

Pour rendre la séparation lisible et maintenable, je recommande de converger vers une structure de code dans laquelle les accès Supabase sont regroupés par nature de service et non mélangés au rendu applicatif.

| Dossier cible | Contenu attendu |
| --- | --- |
| `client/src/` | UI, routes, composants, hooks front |
| `api/` | Fonctions Vercel et points d’entrée serveur |
| `server/core/` | Logique métier réutilisable, validation, règles d’accès |
| `server/integrations/supabase/db/` | Clients SQL, requêtes, mapping des tables |
| `server/integrations/supabase/storage/` | Upload, signed URLs, suppression logique, conventions de clés |
| `supabase/sql/` | Schéma, migrations, vérifications, futures politiques |
| `docs/` | Guides d’exploitation, déploiement, décisions d’architecture |

Cette organisation répond à votre demande de bien **distinguer les deux mondes**. Vercel exécute l’application ; Supabase exécute la donnée. Le code applicatif doit donc appeler des modules d’intégration dédiés, et non porter en direct les détails techniques des requêtes SQL ou des chemins de buckets.

## Stratégie d’authentification recommandée

Sur ce point, il faut être prudent. La documentation Supabase précise que, pour SSR, la session doit être gérée via **cookies** et non dans le stockage local [2]. Cela signifie que l’authentification actuelle de Techfield ne doit pas être simplement copiée telle quelle vers Vercel. La cible la plus propre est soit **Supabase Auth**, soit un fournisseur externe raccordé à une session serveur compatible SSR. Dans les deux cas, les rôles métier **admin**, **technicien** et **client** doivent rester portés par la base Techfield, et non être dispersés uniquement dans le fournisseur d’identité.

## Conclusion opérationnelle

La bonne migration n’est donc pas seulement une conversion SQL. C’est une **séparation de responsabilités**. Le schéma Supabase que j’ai déjà préparé pose le socle de données. La suite logique consiste maintenant à créer les modules d’intégration **Supabase DB** et **Supabase Storage**, puis à retirer progressivement les dépendances encore spécifiques à l’environnement actuel pour faire converger Techfield vers une exécution propre sur **Vercel**.

## References

[1]: https://vercel.com/docs/functions/runtimes/node-js "Using the Node.js Runtime with Vercel Functions"
[2]: https://supabase.com/docs/guides/auth/server-side "Server-Side Rendering | Supabase Docs"
