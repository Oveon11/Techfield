# Cartographie runtime Supabase

Ce document résume le rôle effectif des modules d’intégration **Supabase** actuellement utilisés par Techfield côté serveur.

| Module | Rôle runtime effectif | État |
| --- | --- | --- |
| `server/integrations/supabase/env.ts` | Centralise et valide les variables `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` | Actif |
| `server/integrations/supabase/db/admin.ts` | Crée le client serveur privilégié utilisé par les helpers backend pour lire Supabase en priorité | Actif |
| `server/integrations/supabase/auth-ssr.ts` | Crée le client SSR côté requête pour relire une session Supabase via cookies | Actif |
| `server/integrations/supabase/storage/admin.ts` | Pousse les documents vers le bucket `techfield-documents` et génère les URL signées côté serveur | Actif |
| `server/_core/context.ts` | Injecte le client Supabase SSR dans le contexte tRPC et reconstruit l’utilisateur applicatif si le cookie historique est absent | Actif |
| `server/db.ts` | Résout l’utilisateur runtime, les profils d’accès et le fallback d’identité Supabase | Actif |
| `server/integrations/supabase/db/management.ts` | Porte les lectures métier backend déjà migrées vers Supabase | Actif |

## Lecture opérationnelle

Le runtime Techfield s’appuie maintenant sur deux usages distincts de Supabase. D’une part, le **client admin** exécute les lectures backend migrées. D’autre part, le **client SSR** lit la session de l’utilisateur pour rétablir le contexte serveur en environnement déployé. Cette séparation garde une frontière claire entre la session applicative et les accès métier serveur.

## Conséquence pratique

Le projet peut désormais être déployé sur une cible **Vercel + Supabase** avec un flux SSR cohérent, tout en conservant une phase de transition où certains appels historiques peuvent encore tomber sur le fallback Drizzle si nécessaire.
