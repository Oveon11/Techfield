# Plan de bascule runtime vers Supabase SQL

Ce document complète les scripts SQL en décrivant **comment** Techfield doit basculer sa couche d’accès runtime vers Supabase. L’objectif est d’éviter une migration purement théorique où le schéma existe, mais où le backend continue de dépendre d’une autre couche d’accès aux données.

| Étape | Action | Résultat attendu |
| --- | --- | --- |
| 1 | Conserver le schéma versionné dans `supabase/sql/` | La structure Postgres devient la source de vérité |
| 2 | Centraliser les clients Supabase dans `server/integrations/supabase/db/` | Les accès SQL sont isolés du reste du code |
| 3 | Introduire des repositories métier par domaine | Les routeurs n’appellent plus directement l’ancienne couche de données |
| 4 | Basculer domaine par domaine (`clients`, `sites`, `projects`, `contracts`, `interventions`) | Réduction du risque de régression |
| 5 | Vérifier chaque domaine par tests et requêtes de contrôle | Validation progressive et traçable |

## Priorité recommandée de migration

| Priorité | Domaine | Pourquoi commencer ici |
| --- | --- | --- |
| 1 | **Clients / Sites** | Données structurées, faible complexité transactionnelle |
| 2 | **Techniciens / Disponibilités** | Permet de valider les relations métier essentielles |
| 3 | **Chantiers** | Domaine central avec affectations |
| 4 | **Contrats** | Dépendances temporelles et alertes |
| 5 | **Interventions / Documents** | Cas les plus complets, incluant historique et fichiers |

## Convention d’implémentation

Les routeurs métier ne doivent plus construire eux-mêmes les accès data. Ils doivent appeler des modules dédiés du type `server/integrations/supabase/db/<domaine>.ts`, qui concentrent les requêtes, les filtres, les jointures et les mappings éventuels. Cette séparation permettra d’utiliser Supabase comme couche de données **explicite**, conformément à l’architecture cible souhaitée.
