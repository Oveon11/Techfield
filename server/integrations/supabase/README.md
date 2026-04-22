# Intégration Supabase de Techfield

Ce dossier prépare la séparation de responsabilités voulue pour la cible **Vercel + Supabase**.

| Emplacement | Rôle |
| --- | --- |
| `env.ts` | Variables d’environnement Supabase |
| `db/admin.ts` | Client serveur pour les opérations SQL et administratives |
| `storage/admin.ts` | Accès au bucket `techfield-documents` |
| `auth-ssr.ts` | Base de travail pour une session SSR en cookies compatible Vercel |

La règle d’architecture est simple : les composants UI et les pages ne doivent pas connaître les détails techniques de Supabase. Ils appellent des routes ou des services métier, qui eux-mêmes s’appuient sur les modules d’intégration de ce dossier.
