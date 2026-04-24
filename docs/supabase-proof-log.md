# Journal de preuve Supabase

Ce document consigne les éléments **versionnés** qui servent de preuve traçable pour la préparation de la base Supabase dans le dépôt Techfield.

| Élément | Fichier versionné | Preuve relevée |
| --- | --- | --- |
| Fondations SQL | `supabase/sql/01_techfield_schema.sql` | Le script contient les 12 tables métier attendues : `users`, `clients`, `client_contacts`, `sites`, `technicians`, `projects`, `project_assignments`, `maintenance_contracts`, `interventions`, `technician_availability`, `documents`, `activity_logs` |
| Stockage Supabase | `supabase/sql/02_techfield_storage.sql` | Le bucket `techfield-documents` est créé ou mis à jour, avec limite de taille et MIME types autorisés |
| Vérification SQL | `supabase/sql/03_techfield_verify.sql` | Le script contrôle les tables publiques, les types métiers et le bucket `techfield-documents` |
| RLS bigint | `supabase/sql/05_rls_policies.sql` | Les fonctions `tf_user_id`, `tf_technician_id` et `tf_client_id` retournent bien `bigint`, et les politiques admin / technicien / client clés sont présentes |
| Runtime storage | `server/integrations/supabase/storage/admin.ts` | Le module pointe sur le bucket `techfield-documents` et expose l’upload ainsi que la génération d’URL signées |

## Lecture opérationnelle

Cette preuve est une **preuve de dépôt** : elle confirme que les scripts et modules nécessaires sont bien présents, cohérents entre eux et versionnés. Elle ne remplace pas une capture d’exécution SQL, mais elle rend la préparation Techfield traçable et réutilisable pour les prochains environnements.
