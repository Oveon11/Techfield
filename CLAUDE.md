# Techfield — Contexte projet pour Claude Code

> Ce fichier est lu automatiquement par Claude Code au démarrage de chaque session. Il fournit le contexte stable du projet pour que Claude puisse contribuer efficacement sans avoir à tout redécouvrir à chaque conversation.

## 1. Identité projet

- **Nom** : Techfield
- **Entreprise** : Oveon (CVC / climatisation / maintenance technique du bâtiment)
- **Propriétaire** : Léo Benkatta — `leo@oveon.fr`
- **But** : application web responsive de gestion pour techniciens terrain et bureau (clients, sites, chantiers, contrats, interventions, documents, RH)
- **Repo GitHub** : `Oveon11/Techfield` (branche par défaut : `main`)
- **Déploiement** : Render (auto-deploy sur push `main`). **PAS Vercel** — les fichiers `vercel.json` / `.env.vercel.example` sont historiques.
- **Roadmap fonctionnelle complète** : voir `docs/architecture-techfield.md`

## 2. Stack technique

| Couche | Techno |
|---|---|
| Frontend | React 19 + Vite 7 + TypeScript 5.9 + shadcn/ui + Tailwind 4 + wouter (routing) + sonner (toasts) + lucide-react |
| API | tRPC 11 (procédures typées) sur Express 4 |
| ORM | Drizzle ORM (lecture/écriture) |
| Base de données | Supabase PostgreSQL 17.6 — région `eu-west-3` — project ID `tplfivfxqxqatzvvfnll` |
| Auth | Supabase Auth (OAuth/email) + scope applicatif (`scope.user.role` : `admin` / `technicien` / `client`) |
| Stockage objet | Supabase Storage — buckets `techfield-documents` et `techfield-media` (signed URLs 1h TTL) |
| Tests | Vitest (`pnpm test` → 37/37 OK au dernier check) |
| Package manager | **pnpm 10.4.1** (NE PAS utiliser npm ou yarn) |

## 3. Architecture du dépôt

```
Techfield/
├── client/src/
│   ├── pages/
│   │   ├── TechfieldPages.tsx     ← MONOLITHIQUE (~2660 lignes, à éclater plus tard)
│   │   ├── ProjectDetailTabs.tsx  ← 4 panels Sprint 2 (Journal, Médias, Mémos, Documents)
│   │   ├── Home.tsx, ComponentShowcase.tsx, NotFound.tsx
│   ├── components/ui/              ← shadcn (alert-dialog, badge, button, card, dialog, input, select, textarea, etc.)
│   ├── lib/trpc.ts                 ← export `trpc` (TanStack Query)
├── server/
│   ├── _core/                      ← Express, oauth, sdk, contexte tRPC
│   ├── routers/management.ts       ← TOUS les sous-routeurs tRPC (clients, sites, projects, contracts, interventions, technicians, projectJournal, projectMemos, projectMedia, projectDocuments)
│   ├── integrations/supabase/db/
│   │   ├── chantier-features.ts    ← helpers Sprint 2 (list/create/update/delete + signed URLs)
│   │   └── management.ts           ← helpers core
├── supabase/sql/
│   ├── 01_techfield_schema.sql
│   ├── 02_techfield_storage.sql
│   ├── 03_techfield_verify.sql
│   ├── 05_rls_policies.sql
│   └── 06_sprint2_chantier_features.sql   ← migration Sprint 2 déjà appliquée
├── drizzle/                        ← migrations générées (mais on utilise SQL brut Supabase pour les schémas applicatifs)
├── docs/                           ← architecture-techfield.md + diagnostics Vercel/Supabase historiques
├── shared/                         ← types partagés client/serveur
├── api/                            ← entrée Vercel (historique, non utilisée)
├── todo.md                         ← suivi Sprints (à mettre à jour)
└── CLAUDE.md                       ← ce fichier
```

## 4. État actuel (12 mai 2026)

### ✅ Sprint 1 — Chantiers (terminé)
CRUD complet, recherche, filtres, page détail (`ProjectDetailPage` dans `TechfieldPages.tsx` à partir de la ligne 1101). Commit `7dcf83e`.

### ✅ Sprint 2 — Suivi chantier (terminé, en production)
- **Backend** : migration `06_sprint2_chantier_features.sql` appliquée sur Supabase (tables `project_journal_entries`, `project_memos`, `project_media`, `project_documents` + RLS par rôle + 2 buckets storage). Procédures tRPC dans `management.ts` (sous-routeurs `projectJournal`, `projectMemos`, `projectMedia`, `projectDocuments`). Commit `3b591b4`.
- **Frontend** : 4 panels dans `ProjectDetailTabs.tsx` (Journal avec types `etape/blocage/livraison/contact_client/note`, Médias upload photos/vidéos via signed URL, Mémos internes admin+tech, Documents avec catégorie + visibilité). Wired dans `ProjectDetailPage`. Commit `70fcc59`.

### 🟡 Prochain sprint suggéré — Sprint 3 : Interventions
La fonctionnalité majeure manquante. À cadrer avec Léo. Pistes :
- Planning des interventions (calendrier hebdomadaire/mensuel)
- Assignation technicien
- Compte-rendu d'intervention (texte + photos)
- Signature client (canvas tactile)
- Génération PDF du rapport d'intervention (jsPDF ou pdf-lib)
- Lien intervention ↔ chantier ↔ contrat

## 5. Conventions de code à respecter

1. **Forme des procédures tRPC** : toujours `protectedProcedure.input(zodSchema).query/mutation(async ({ ctx, input }) => { const scope = await getScope(ctx.user.openId); try { return await helper(scope, input); } catch (err) { throw new TRPCError({ code: "BAD_REQUEST", message: err instanceof Error ? err.message : "..." }); } })`. Voir `projectJournal` dans `management.ts` ligne 1229+ comme modèle.
2. **RLS Supabase** : les politiques RLS filtrent déjà par rôle. Les helpers `chantier-features.ts` utilisent `scope.supabase` (client authentifié). NE PAS contourner avec le service_role sauf besoin admin documenté.
3. **Frontend** : utiliser `trpc.useUtils()` + `utils.management.X.list.invalidate({ projectId })` pour rafraîchir après mutation. Pattern toast : `toast.success(...)` ou `toast.error(error.message)` côté `onSuccess`/`onError`.
4. **shadcn** : composants `@/components/ui/*` déjà importables. Dialogs avec `Dialog/DialogTrigger/DialogContent`. Confirmations destructives avec `AlertDialog`.
5. **Permissions UI** : `const canManage = !!permissions?.manageProjects;` (depuis `useRoleMatrix()`). Cacher les boutons d'écriture côté admin/tech, RLS bloque côté serveur pour les clients.
6. **Imports** : alias `@/` → `client/src/`. Pas d'imports relatifs `../../` côté frontend.
7. **i18n** : tout est en français (libellés UI + messages d'erreur tRPC).
8. **Storage uploads** : pattern `createUploadUrl → fetch PUT signedUrl avec body=file → register`. Limite client 100 Mo pour médias.

## 6. Workflow de développement

```bash
# Démarrage local
pnpm install
pnpm dev                              # serveur Express + Vite dev en watch (port 5173 ou .env.local)

# Avant de committer (OBLIGATOIRE)
pnpm check                            # tsc --noEmit
pnpm test                             # vitest run (doit rester vert)

# Commit + push
git add -p                            # éviter `git add .` (cf. PAT history)
git commit -m "Sprint X module: ..."
git push origin main                  # déclenche le build Render auto
```

**Auteur git utilisé jusqu'ici** : `Benkatta léo <leo@MacBook-Air-de-Benkatta.local>` (déjà configuré localement sur le Mac).

## 7. Secrets et accès (NE JAMAIS COMMITTER)

- Fichier `.env.local` à la racine (gitignored). Variables : `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (pooler 6543).
- Render dashboard pour les variables de prod (mêmes clés).
- Supabase dashboard : `https://supabase.com/dashboard/project/tplfivfxqxqatzvvfnll`

### ⚠️ Dette de sécurité

Un GitHub PAT commençant par `ghp_mOxop...` a été leaké dans l'historique git lors d'un commit antérieur. **Action en attente** : révoquer le token via GitHub → Settings → Developer settings → Personal access tokens, puis régénérer si besoin et le stocker uniquement en variable d'environnement locale.

## 8. MCP recommandés à configurer

Configurer via `claude mcp add` ou `~/.claude/mcp.json` :

- **supabase** (officiel `@supabase/mcp-server-supabase`) — pour appliquer des migrations SQL, lister les tables, lancer des advisors. Token : créer un PAT Supabase dans le dashboard.
- **github** (officiel) — pour gérer issues/PR (optionnel, `gh` CLI suffit souvent).

## 9. Modèle de données — vue rapide

Tables Sprint 1+2 principales (toutes en snake_case côté SQL, camelCase côté TS) :

- `users` (admin/technicien/client) + `technician_profiles` + `client_profiles`
- `clients` → `sites` → `projects` (= chantiers)
- `contracts` (rattachés clients) → `interventions` (rattachées projects et/ou contracts)
- `project_assignments` (techniciens ↔ projects)
- `project_journal_entries` (Sprint 2)
- `project_memos` (Sprint 2)
- `project_media` (Sprint 2)
- `project_documents` (Sprint 2)
- `activity_log` (audit trail via `logActivity` côté serveur)

Détail complet et relations dans `docs/architecture-techfield.md`.

## 10. Pièges connus

1. **`TechfieldPages.tsx` fait 2660 lignes** — éviter d'y ajouter de gros panneaux ; créer un fichier dédié à côté (cf. `ProjectDetailTabs.tsx`).
2. **Render redeploy** : si une feature n'apparaît pas après un push, vérifier les logs de build Render et l'onglet "Events". Ne pas culpabiliser le cache navigateur, c'est presque toujours côté build.
3. **Drizzle vs SQL brut** : on a les deux. Pour les schémas applicatifs récents (Sprint 2), on a écrit du SQL Supabase pur dans `supabase/sql/`. Les anciens fichiers `drizzle/` sont historiques. Ne PAS lancer `pnpm db:push` sans accord — risque de drift.
4. **Build Vercel** : ignorer toute erreur ou doc liée à Vercel — déploiement passé sur Render.
5. **Types tRPC** : si un input Zod change côté backend, recompiler côté frontend avec `pnpm check` pour voir tous les usages cassés.
6. **`scope` object** : helpers serveur attendent `(scope, ...)`. Ne jamais appeler un helper sans `scope` sinon RLS contournée par erreur.

## 11. TODO (état au 12/05/2026)

- [x] Sprint 1 chantiers (CRUD + recherche)
- [x] Sprint 2 backend (SQL + tRPC)
- [x] Sprint 2 frontend (4 onglets)
- [ ] Tester en runtime sur Render les 4 onglets Sprint 2 (admin + technicien + client)
- [ ] Révoquer PAT GitHub leaké (`ghp_mOxop...`)
- [ ] Cadrer Sprint 3 (interventions + signature + PDF rapport)
- [ ] Éclater `TechfieldPages.tsx` en fichiers par module (refacto, basse priorité)

## 12. Comment Léo aime travailler

- Réponses en **français**, ton direct, sans verbiage.
- **Demander confirmation** avant les actions risquées (migrations SQL en prod, force push, suppression de fichiers).
- Préférer **éditer** les fichiers existants plutôt qu'en créer de nouveaux.
- Toujours **valider TypeScript** (`pnpm check`) avant de proposer un commit.
- Léo push lui-même depuis son terminal — Claude commit en local et indique le message + sha.
- Suivre les sprints (cadrage → backend → frontend → tests → commit → push → vérif Render).
