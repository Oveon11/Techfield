# Audit de compatibilité Vercel pour Techfield

Cet audit synthétise les incompatibilités restantes entre l’état actuel de Techfield et une cible de déploiement **Vercel + Supabase**. Il ne remplace pas les adaptations de code, mais fournit un état de référence vérifiable pour piloter la migration.

| Domaine | État actuel | Risque pour Vercel | Statut | Action de résolution |
| --- | --- | --- | --- | --- |
| **Serveur HTTP** | Serveur Express local démarré par `server/_core/index.ts` avec écoute d’un port | Vercel privilégie des handlers `/api` plutôt qu’un serveur persistant | **Partiellement traité** | Une fabrique `server/_core/app.ts` et un handler `api/[...path].ts` ont été ajoutés ; il reste à valider le routage complet en environnement Vercel |
| **Auth** | Flux OAuth et session dépendants de l’environnement actuel | Incompatibilité potentielle hors environnement Manus | **Partiellement traité** | Utiliser une session SSR en cookies et finaliser la bascule vers Supabase Auth ou un fournisseur externe compatible |
| **Stockage** | Fallback historique Forge encore présent | Dépendance résiduelle à l’environnement actuel | **Partiellement traité** | Continuer la bascule vers Supabase Storage et supprimer le fallback lorsque les secrets seront en place |
| **Base de données** | Schéma Supabase préparé mais logique métier encore sur la couche existante | Mélange temporaire des sources d’accès data | **Partiellement traité** | Introduire progressivement une couche d’accès Supabase pour les modules métier prioritaires |
| **Build frontend** | Vite avec plugins spécifiques à l’environnement actuel | Plugins inutiles ou incompatibles en cible externe | **Traité pour la phase de migration** | Garde `DEPLOY_TARGET=vercel` ajoutée dans `vite.config.ts` |
| **Variables d’environnement** | Variables hétérogènes issues de l’environnement actuel | Risque de configuration confuse lors du déploiement | **Traité pour la préparation** | Fichier `.env.vercel.example` et modules `server/integrations/supabase/*` ajoutés |

## Lecture opérationnelle

La migration est **préparée**, mais pas encore totalement **basculée**. Les points les plus structurants sont désormais identifiés et partiellement découplés. L’effort résiduel porte surtout sur la finalisation de l’authentification SSR et sur la substitution progressive des accès runtime encore liés à l’environnement actuel.
