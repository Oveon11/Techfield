# Guide de déploiement Vercel + Supabase pour Techfield

Ce document décrit l’état actuel de **Techfield** et les actions à réaliser pour déployer proprement l’application sur **Vercel** avec **Supabase** comme socle base de données et session SSR.

## État technique actuel

Le projet est désormais préparé pour une cible **Vercel + Supabase** sur les points structurants suivants.

| Domaine | État actuel | Remarque |
| --- | --- | --- |
| Base Supabase | Configurée et sécurisée avec RLS | Le correctif bigint a été pris en compte côté politiques SQL |
| Runtime Supabase | Branché côté serveur | Les helpers utilisateurs utilisent Supabase en priorité |
| Contexte serveur | Compatible SSR Supabase | Le contexte tRPC sait reconstruire l’utilisateur applicatif depuis une session Supabase si le cookie historique est absent |
| Lectures métier migrées | Tableau de bord, interventions, contrats, calendrier, documents, clients, sites, chantiers, contacts clients, équipe, disponibilités | Les routes conservent un fallback Drizzle pendant la transition |
| Build Vercel | Préparée | `vercel.json` et `build:vercel` sont en place |
| Validation | Réussie | Les tests Vitest passent et la build Vercel passe |

## Variables d’environnement à définir dans Vercel

Dans le projet Vercel, ajoutez au minimum les variables suivantes.

| Variable | Valeur attendue |
| --- | --- |
| `SUPABASE_URL` | URL du projet Supabase |
| `SUPABASE_ANON_KEY` | Clé publique `anon` |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé serveur `service_role` |
| `DATABASE_URL` | URL PostgreSQL Supabase |
| `DEPLOY_TARGET` | `vercel` |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | Secret de session serveur |
| `VITE_APP_TITLE` | Titre de l’application |
| `VITE_APP_LOGO` | Logo si utilisé |

L’exemple minimal se trouve dans **`.env.vercel.example`**.

## Configuration déjà ajoutée au projet

Les éléments suivants sont déjà présents dans le dépôt.

| Fichier | Rôle |
| --- | --- |
| `vercel.json` | Indique la commande de build Vercel, le dossier de sortie et le runtime Node de la fonction API |
| `api/[...path].ts` | Point d’entrée serveur pour la cible Vercel |
| `server/_core/app.ts` | Fabrique Express mutualisée entre local et déploiement |
| `server/_core/context.ts` | Contexte tRPC avec fallback d’authentification Supabase SSR |
| `.env.vercel.example` | Gabarit des variables d’environnement de déploiement |

## Vérifications à lancer avant le premier déploiement

Depuis la racine du projet, les commandes suivantes doivent rester vertes.

```bash
pnpm test
pnpm check:vercel
```

## Séquence recommandée de mise en ligne

Commencez par connecter le dépôt à Vercel, puis renseignez les variables d’environnement du tableau ci-dessus. Une fois ces variables enregistrées, lancez un premier déploiement de préproduction. Après le premier déploiement, vérifiez les points suivants dans l’ordre.

| Vérification | Attendu |
| --- | --- |
| Chargement du front | L’application s’affiche sans erreur de build |
| Appels `/api/trpc` | Les routes répondent depuis l’environnement Vercel |
| Session | Le contexte serveur récupère correctement un utilisateur authentifié |
| Modules métier migrés | Les listes et vues principales chargent les données Supabase |
| Permissions | Les lectures respectent le périmètre RLS attendu |

## Points encore à surveiller

Le projet est prêt pour une **préproduction** sérieuse, mais la migration reste **progressive**. Les lectures principales passent déjà par Supabase, tandis que certains chemins historiques conservent encore un fallback Drizzle pour sécuriser la transition. Avant une bascule finale stricte, il faudra supprimer ces fallbacks uniquement quand l’ensemble des parcours critiques sera validé en environnement déployé.

## Résumé de la prochaine action

La prochaine action recommandée est simple : **créer un checkpoint**, puis utiliser ce dépôt et ce paramétrage pour lancer un premier déploiement de préproduction sur **Vercel** avec les variables Supabase déjà préparées.
