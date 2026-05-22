# MANUS_SPEC — Référence technique complète Techfield

> Destiné à Manus ou tout développeur externe.
> Couvre : stack, API backend complète, schéma Supabase, variables d'env, déploiement Render, conventions UI.
> **Ne pas modifier ce fichier** — maintenu par Claude Code.

---

## TABLE DES MATIÈRES

1. [Stack et architecture](#1-stack-et-architecture)
2. [Structure des fichiers](#2-structure-des-fichiers)
3. [Variables d'environnement](#3-variables-denvironnement)
4. [Déploiement sur Render](#4-déploiement-sur-render)
5. [Backend — API tRPC complète](#5-backend--api-trpc-complète)
6. [Schéma Supabase complet](#6-schéma-supabase-complet)
7. [RLS — Politiques de sécurité](#7-rls--politiques-de-sécurité)
8. [Stockage Supabase Storage](#8-stockage-supabase-storage)
9. [Authentification et contexte](#9-authentification-et-contexte)
10. [Conventions frontend](#10-conventions-frontend)
11. [Composants shadcn disponibles](#11-composants-shadcn-disponibles)
12. [Règles critiques — NE PAS CASSER](#12-règles-critiques--ne-pas-casser)
13. [Commandes de développement](#13-commandes-de-développement)

---

## 1. Stack et architecture

### Vue d'ensemble

```
Browser (React 19 SPA)
    ↕ tRPC over HTTP (/api/trpc)
Express 4 server  (server/_core/index.ts → app.ts)
    ↕ Supabase JS client (service_role)
Supabase PostgreSQL 17.6 (eu-west-3, project: tplfivfxqxqatzvvfnll)
    + Supabase Auth (JWT custom claims : role, open_id, email)
    + Supabase Storage (2 buckets privés)
```

### Versions exactes

| Technologie | Version |
|---|---|
| Node.js | 20.x (requis par Render) |
| React | 19.x |
| TypeScript | 5.9.3 |
| Vite | 7.x |
| tRPC | 11.x |
| Express | 4.x |
| Drizzle ORM | 0.44.x — **legacy, ne pas utiliser** |
| @supabase/supabase-js | 2.104.x |
| Tailwind CSS | 4.x |
| shadcn/ui | composants Radix UI |
| wouter | 3.3.x (routing côté client) |
| sonner | 2.x (toasts) |
| lucide-react | 0.453.x |
| nanoid | 5.x |
| zod | 4.x |
| pnpm | **10.4.1** (gestionnaire de paquets — OBLIGATOIRE) |

---

## 2. Structure des fichiers

```
Techfield/
├── client/src/
│   ├── pages/
│   │   ├── TechfieldPages.tsx     ← ~2700 lignes — tous les pages principales
│   │   ├── ProjectDetailTabs.tsx  ← panels chantier (Journal, Médias, Mémos, Docs, Interventions)
│   │   ├── Home.tsx
│   │   └── NotFound.tsx
│   ├── components/
│   │   ├── DashboardLayout.tsx    ← shell avec sidebar + topbar
│   │   └── ui/                    ← composants shadcn
│   └── lib/
│       └── trpc.ts                ← client tRPC (export `trpc`) — ne pas modifier
├── shared/
│   └── const.ts                   ← constantes d'erreur (UNAUTHED_ERR_MSG, NOT_ADMIN_ERR_MSG)
├── server/
│   ├── _core/
│   │   ├── index.ts               ← point d'entrée serveur (PORT, listen)
│   │   ├── app.ts                 ← Express app + middleware tRPC sur /api/trpc
│   │   ├── context.ts             ← createContext (auth Supabase SSR → user)
│   │   ├── trpc.ts                ← protectedProcedure, adminProcedure, router
│   │   └── env.ts                 ← ENV.cookieSecret, ENV.ownerEmail
│   ├── routers/
│   │   └── management.ts          ← managementRouter (tous les sous-routeurs tRPC, ~2200 lignes)
│   ├── routers.ts                 ← appRouter = router({ system, auth, security, management })
│   ├── integrations/supabase/
│   │   ├── env.ts                 ← SUPABASE_ENV (url, anonKey, serviceRoleKey, isConfigured)
│   │   ├── auth-ssr.ts            ← createSupabaseServerSsrClient
│   │   └── db/
│   │       ├── admin.ts           ← createSupabaseAdminClient() (service_role)
│   │       ├── management.ts      ← helpers Sprint 1 (clients, sites, projets, contrats, etc.)
│   │       ├── chantier-features.ts ← helpers Sprint 2 (journal, médias, mémos, documents)
│   │       └── intervention-features.ts ← helpers Sprint 3 (interventions, médias intervention)
│   ├── db.ts                      ← getDb() (Drizzle MySQL — legacy), getUserAccessProfile()
│   └── storage.ts                 ← storagePut (S3 compatible)
├── drizzle/
│   └── schema.ts                  ← ⚠️ SCHEMA MYSQL LEGACY — ne pas utiliser
├── supabase/sql/
│   ├── 01_techfield_schema.sql    ← tables + enums + triggers + index (Sprint 1)
│   ├── 02_techfield_storage.sql   ← bucket techfield-documents
│   ├── 05_rls_policies.sql        ← toutes les politiques RLS
│   ├── 06_sprint2_chantier_features.sql ← tables Sprint 2 + RLS + bucket techfield-media
│   └── 07_sprint3_interventions.sql     ← table intervention_media + RLS
├── package.json
├── vite.config.ts
├── tsconfig.json
└── CLAUDE.md                      ← contexte projet pour Claude Code
```

---

## 3. Variables d'environnement

### Fichier `.env.local` (dev local — ne jamais committer)

```bash
# Supabase — OBLIGATOIRES
SUPABASE_URL=https://tplfivfxqxqatzvvfnll.supabase.co
SUPABASE_ANON_KEY=<clé anon publique du projet Supabase>
SUPABASE_SERVICE_ROLE_KEY=<clé service_role — accès complet, confidentielle>

# Base de données — pooler Supabase PostgreSQL (port 6543)
DATABASE_URL=postgresql://postgres.tplfivfxqxqatzvvfnll:<password>@aws-0-eu-west-3.pooler.supabase.com:6543/postgres

# Application
NODE_ENV=development
PORT=3000

# Optionnel — premier email admin au signup
OWNER_EMAIL=leo@oveon.fr

# Secret JWT sessions (si auth JWT locale)
JWT_SECRET=<secret aléatoire 32+ chars>
```

### Variables requises en production (Render Dashboard)

| Variable | Description | Obligatoire |
|---|---|---|
| `SUPABASE_URL` | URL du projet Supabase | ✅ |
| `SUPABASE_ANON_KEY` | Clé publique anon Supabase | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service_role (bypass RLS) | ✅ |
| `DATABASE_URL` | Pooler PostgreSQL Supabase (port 6543) | ✅ |
| `NODE_ENV` | `production` | ✅ |
| `OWNER_EMAIL` | Email du premier admin | Recommandé |
| `JWT_SECRET` | Secret pour sessions JWT | Si auth locale |

### Comment `SUPABASE_ENV.isConfigured` fonctionne

```typescript
// server/integrations/supabase/env.ts
export const SUPABASE_ENV = {
  isConfigured: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY),
};
```

**Si `isConfigured = false`** → toutes les procédures tombent dans le fallback Drizzle (MySQL legacy) → échoue en prod. Les 3 variables Supabase sont donc obligatoires.

---

## 4. Déploiement sur Render

### Configuration actuelle

- **Service type** : Web Service
- **Runtime** : Node 20
- **Region** : Oregon (US West) ou Frankfurt (EU)
- **Branch** : `main` (auto-deploy à chaque push)
- **Build command** : `pnpm install && pnpm build`
- **Start command** : `pnpm start`

### Commandes npm scripts

```bash
# Build production (compile Vite + bundle server avec esbuild)
pnpm build
# → génère dist/ (frontend static) + dist/index.js (server bundle)

# Start production
pnpm start
# → node dist/index.js
# → Express sert les fichiers static de dist/ + écoute sur $PORT
```

### Étapes pour un nouveau déploiement Render

1. Créer un **Web Service** sur [render.com](https://render.com)
2. Connecter le repo GitHub `Oveon11/Techfield`
3. Configurer :
   - **Build Command** : `pnpm install && pnpm build`
   - **Start Command** : `pnpm start`
   - **Node Version** : 20.x
4. Ajouter toutes les variables d'environnement (section 3)
5. Cliquer Deploy

### Push vers Render (depuis terminal Mac)

```bash
git add -p                        # Ajouter les fichiers modifiés (éviter git add .)
git commit -m "Sprint X: ..."
git push origin main              # Render déploie automatiquement
```

### Vérifier le déploiement

- Render dashboard → onglet "Events" → voir les logs de build
- Si une feature n'apparaît pas : vérifier les logs build, pas le cache navigateur
- Build time moyen : 2-3 minutes

---

## 5. Backend — API tRPC complète

### Point de montage

```
POST/GET  /api/trpc/{procedure}
```

Toutes les procédures sont dans `server/routers/management.ts` sous le préfixe `management`.

### Types de procédures

```typescript
protectedProcedure  // Requiert un utilisateur connecté (admin, tech ou client)
adminProcedure      // Requiert rôle "admin" uniquement
```

### Pattern obligatoire pour chaque procédure

```typescript
// TOUJOURS vérifier Supabase d'abord — sinon tombera sur le fallback Drizzle MySQL qui échoue en prod
protectedProcedure.input(z.object({ ... })).query/mutation(async ({ ctx, input }) => {
  if (SUPABASE_ENV.isConfigured && ctx.supabase) {
    const scope = await getScope(ctx.user.openId);
    try {
      return await mySupabaseHelper(scope, input);
    } catch (err) {
      throw new TRPCError({ code: "BAD_REQUEST", message: err instanceof Error ? err.message : "Erreur." });
    }
  }
  // Fallback Drizzle — legacy, ne sera jamais atteint en prod si Supabase est configuré
  const db = await requireDb();
  ...
})
```

---

### `auth`

| Procédure | Type | Description |
|---|---|---|
| `auth.me` | query | Utilisateur connecté. Retourne `{ id, openId, name, email, role, accountStatus, ... }` |

### `security`

| Procédure | Type | Input | Description |
|---|---|---|---|
| `security.roleMatrix` | query | — | Retourne `{ role, permissions: { manageProjects, manageTechnicians, manageContracts, ... } }` |

### `management.dashboard`

| Procédure | Type | Input | Description |
|---|---|---|---|
| `summary` | query | — | Cards + liste interventions imminentes + contrats expirants |

**Retourne :**
```typescript
{
  cards: {
    projectsInProgress: number;
    upcomingInterventions: number;
    expiringContracts: number;
  };
  upcomingInterventions: Array<{
    id: number; reference: string; title: string;
    status: string; scheduledStartAt: string | null;
    clientName: string | null; siteName: string | null;
  }>;
  expiringContracts: Array<{ id: number; title: string; endDate: string | null; ... }>;
}
```

### `management.clients`

| Procédure | Type | Input | Description |
|---|---|---|---|
| `list` | query | — | Liste tous les clients (filtrés RLS par rôle) |
| `getById` | query | `{ clientId: number }` | Détail client + contacts |
| `create` | mutation (admin) | `{ companyName, legalName?, customerType?, email?, phone?, billingAddress?, city?, postalCode?, notes? }` | Crée un client |
| `update` | mutation (admin) | `{ clientId, ...mêmes champs }` | Met à jour |
| `delete` | mutation (admin) | `{ clientId: number }` | Supprime |

**Type retourné par `list` :**
```typescript
Array<{
  id: number; customerType: string; companyName: string;
  email: string | null; phone: string | null;
  city: string | null; isActive: boolean; createdAt: string;
}>
```

### `management.clientContacts`

| Procédure | Type | Input |
|---|---|---|
| `list` | query | `{ clientId: number }` |
| `create` | mutation (admin) | `{ clientId, firstName, lastName, email?, phone?, jobTitle?, contactType?, isPrimary? }` |
| `delete` | mutation (admin) | `{ contactId: number }` |

### `management.sites`

| Procédure | Type | Input |
|---|---|---|
| `list` | query | — |
| `getById` | query | `{ siteId: number }` |
| `create` | mutation (admin) | `{ clientId, siteName, siteCode?, addressLine1, addressLine2?, city, postalCode?, country?, accessInstructions?, notes? }` |
| `update` | mutation (admin) | `{ siteId, ...mêmes champs }` |
| `delete` | mutation (admin) | `{ siteId: number }` |

### `management.technicians`

| Procédure | Type | Input |
|---|---|---|
| `list` | query | — (admin/tech seulement) |
| `create` | mutation (admin) | `{ firstName, lastName, email?, phone?, employeeCode?, skills?: string[], notes? }` |
| `update` | mutation (admin) | `{ technicianId, ...mêmes champs }` |
| `delete` | mutation (admin) | `{ technicianId: number }` |
| `getAvailability` | query | `{ technicianId: number }` |
| `setAvailability` | mutation | `{ technicianId, availabilityType, startAt, endAt, notes? }` |
| `deleteAvailability` | mutation | `{ availabilityId: number }` |

### `management.projects` (chantiers)

| Procédure | Type | Input |
|---|---|---|
| `list` | query | — |
| `getById` | query | `{ projectId: number }` |
| `create` | mutation (admin) | voir schéma ci-dessous |
| `update` | mutation (admin) | `{ projectId, ...mêmes champs }` |
| `delete` | mutation (admin) | `{ projectId: number }` |
| `updateStatus` | mutation | `{ projectId, status, progressPercent? }` |

**Input `create`/`update` :**
```typescript
{
  clientId: number;
  siteId?: number | null;
  title: string;           // min 3 chars
  serviceType: "clim" | "pac" | "chauffe_eau" | "pv" | "vmc" | "autre";
  description?: string | null;
  status: "brouillon" | "planifie" | "en_cours" | "bloque" | "termine" | "annule";
  progressPercent: number; // 0-100
  estimatedHours: string;  // ex: "12.50"
  actualHours: string;
  budgetAmount: string;    // ex: "1500.00"
  startDate?: string | null;       // "YYYY-MM-DD"
  plannedEndDate?: string | null;
  technicianIds: number[];
}
```

**Retourne `getById` :**
```typescript
{
  id: number; reference: string; title: string; serviceType: string;
  status: string; progressPercent: number;
  clientId: number; clientName: string | null;
  siteId: number | null; siteName: string | null;
  description: string | null; budgetAmount: string | null;
  startDate: string | null; plannedEndDate: string | null;
  estimatedHours: string | null; actualHours: string | null;
  technicianIds: number[];
  createdAt: string; updatedAt: string;
}
```

### `management.contracts`

| Procédure | Type | Input |
|---|---|---|
| `list` | query | — |
| `getById` | query | `{ contractId: number }` |
| `create` | mutation (admin) | voir schéma ci-dessous |
| `update` | mutation (admin) | `{ contractId, ...mêmes champs }` |
| `delete` | mutation (admin) | `{ contractId: number }` |
| `renew` | mutation (admin) | `{ contractId, startDate, endDate, nextServiceDate?, annualAmount?, notes? }` |

**Input `create` :**
```typescript
{
  clientId: number; siteId?: number | null;
  title: string; serviceType: service_type_enum;
  frequency: "mensuelle" | "trimestrielle" | "semestrielle" | "annuelle" | "personnalisee";
  status: "brouillon" | "actif" | "renouvellement_proche" | "expire" | "suspendu";
  annualAmount: string; renewalNoticeDays: number;
  startDate?: string | null; nextServiceDate?: string | null; endDate?: string | null;
  notes?: string | null;
}
```

### `management.interventions`

| Procédure | Type | Input | Rôle |
|---|---|---|---|
| `list` | query | — | tous |
| `listByProject` | query | `{ projectId: number }` | tous |
| `history` | query | `{ projectId: number }` | tous |
| `getById` | query | `{ interventionId: number }` | tous |
| `create` | mutation | voir schéma ci-dessous | admin |
| `update` | mutation | `{ interventionId, title, interventionType, priority, technicianId?, scheduledStartAt?, scheduledEndAt?, description? }` | admin/tech |
| `updateStatus` | mutation | `{ interventionId, status, report? }` | admin/tech |
| `updateReport` | mutation | `{ interventionId, report?, internalNotes? }` | admin/tech |
| `delete` | mutation | `{ interventionId: number }` | admin |

**Input `create` :**
```typescript
{
  clientId: number;
  siteId?: number | null;
  projectId?: number | null;
  contractId?: number | null;
  technicianId?: number | null;
  title: string;           // min 3 chars
  description?: string | null;
  interventionType: "installation" | "maintenance" | "depannage" | "inspection" | "urgence" | "autre";
  priority: "basse" | "normale" | "haute" | "urgente";
  status: "planifiee" | "assignee" | "en_cours" | "rapport_a_faire" | "terminee" | "annulee";
  scheduledStartAt?: string | null;  // ISO datetime
  scheduledEndAt?: string | null;
}
```

**Retourne `listByProject` :**
```typescript
Array<{
  id: number; reference: string; title: string;
  interventionType: string; priority: string; status: string;
  technicianId: number | null; technicianName: string | null;
  scheduledStartAt: string | null; scheduledEndAt: string | null;
  completedAt: string | null;
  description: string | null; report: string | null; internalNotes: string | null;
  createdAt: string | null;
}>
```

### `management.interventions.media`

| Procédure | Type | Input |
|---|---|---|
| `createUploadUrl` | mutation | `{ interventionId: number, fileName: string, mimeType: string }` |
| `register` | mutation | `{ interventionId, caption?, fileName, fileKey, mimeType, sizeBytes? }` |
| `list` | query | `{ interventionId: number }` |
| `delete` | mutation | `{ mediaId: number }` |

**`createUploadUrl` retourne :**
```typescript
{ uploadUrl: string; fileKey: string }
```

### `management.projectJournal`

| Procédure | Type | Input |
|---|---|---|
| `list` | query | `{ projectId: number }` |
| `create` | mutation | `{ projectId, entryType, content, title?, occurredAt? }` |
| `update` | mutation | `{ id, entryType, content, title?, occurredAt? }` |
| `delete` | mutation | `{ id: number }` |

**Types `entryType` :** `"etape"` | `"blocage"` | `"livraison"` | `"contact_client"` | `"note"`

**Retourne `list` :**
```typescript
Array<{
  id: number; projectId: number;
  entryType: string; title: string | null; content: string;
  authorName: string | null; occurredAt: string | null;
  createdAt: string; updatedAt: string;
}>
```

### `management.projectMemos`

| Procédure | Type | Input |
|---|---|---|
| `list` | query | `{ projectId: number }` |
| `create` | mutation | `{ projectId, content, title? }` |
| `update` | mutation | `{ id, content, title? }` |
| `delete` | mutation | `{ id: number }` |

⚠️ **Jamais visible aux clients** (aucune politique RLS client sur `project_memos`).

**Retourne `list` :**
```typescript
Array<{
  id: number; projectId: number;
  title: string | null; content: string; authorName: string | null;
  updatedAt: string; createdAt: string;
}>
```

### `management.projectMedia`

| Procédure | Type | Input |
|---|---|---|
| `list` | query | `{ projectId: number }` |
| `createUploadUrl` | mutation | `{ projectId, fileName, mimeType, mediaType: "photo"\|"video" }` |
| `register` | mutation | `{ projectId, mediaType, fileName, fileKey, mimeType, caption?, sizeBytes? }` |
| `delete` | mutation | `{ id: number }` |

**`createUploadUrl` retourne :** `{ uploadUrl: string; fileKey: string }`

**Retourne `list` :**
```typescript
Array<{
  id: number; projectId: number;
  mediaType: "photo" | "video"; caption: string | null;
  fileName: string; fileKey: string; mimeType: string;
  sizeBytes: number | null; signedUrl: string | null;  // URL signée 1h
  uploaderName: string | null; createdAt: string;
}>
```

### `management.projectDocuments`

| Procédure | Type | Input |
|---|---|---|
| `list` | query | `{ projectId: number }` |
| `createUploadUrl` | mutation | `{ projectId, fileName, mimeType }` |
| `register` | mutation | `{ projectId, title, documentType, visibility, fileName, fileKey, mimeType }` |
| `getSignedUrl` | query | `{ fileKey: string }` |
| `delete` | mutation | `{ id: number }` |

**Types `documentType` :** `"rapport"` | `"photo"` | `"contrat"` | `"bon_intervention"` | `"plan"` | `"autre"`
**Types `visibility` :** `"interne"` | `"client"` | `"restreint"`

**Retourne `list` :**
```typescript
Array<{
  id: number; projectId: number;
  title: string; documentType: string; visibility: string;
  fileName: string; fileKey: string; mimeType: string;
  uploaderName: string | null; createdAt: string;
}>
```

### `management.calendar`

| Procédure | Type | Input | Description |
|---|---|---|---|
| `events` | query | — | Liste d'événements calendrier (interventions planifiées) avec date, statut, technicien |

---

## 6. Schéma Supabase complet

### Enums PostgreSQL

```sql
user_role            → 'admin' | 'technicien' | 'client'
user_status          → 'active' | 'invited' | 'suspended'
customer_type        → 'particulier' | 'professionnel' | 'collectivite'
contact_type         → 'principal' | 'technique' | 'facturation' | 'autre'
service_type         → 'clim' | 'pac' | 'chauffe_eau' | 'pv' | 'vmc' | 'autre'
project_status       → 'brouillon' | 'planifie' | 'en_cours' | 'bloque' | 'termine' | 'annule'
contract_status      → 'brouillon' | 'actif' | 'renouvellement_proche' | 'expire' | 'suspendu'
contract_frequency   → 'mensuelle' | 'trimestrielle' | 'semestrielle' | 'annuelle' | 'personnalisee'
intervention_type    → 'installation' | 'maintenance' | 'depannage' | 'inspection' | 'urgence' | 'autre'
intervention_priority → 'basse' | 'normale' | 'haute' | 'urgente'
intervention_status  → 'planifiee' | 'assignee' | 'en_cours' | 'rapport_a_faire' | 'terminee' | 'annulee'
assignment_role      → 'chef_equipe' | 'technicien' | 'renfort'
availability_type    → 'disponible' | 'indisponible' | 'conges' | 'formation' | 'maladie'
document_type        → 'rapport' | 'photo' | 'contrat' | 'bon_intervention' | 'plan' | 'autre'
document_visibility  → 'interne' | 'client' | 'restreint'
entity_type          → 'user' | 'client' | 'site' | 'project' | 'contract' | 'intervention' | ...
journal_entry_type   → 'etape' | 'blocage' | 'livraison' | 'contact_client' | 'note'
media_type           → 'photo' | 'video'
```

### Tables — Sprint 1

```sql
-- Utilisateurs applicatifs (liés à Supabase Auth via open_id)
public.users (
  id                 bigint PK generated always as identity,
  open_id            varchar(64) UNIQUE NOT NULL,   -- identifiant Supabase Auth
  name               text,
  email              varchar(320) UNIQUE,
  phone              varchar(32),
  login_method       varchar(64),
  role               user_role DEFAULT 'client',
  account_status     user_status DEFAULT 'active',
  avatar_url         text,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now(),
  last_signed_in     timestamptz DEFAULT now()
)

-- Clients (entreprises ou particuliers)
public.clients (
  id                 bigint PK,
  customer_type      customer_type DEFAULT 'professionnel',
  company_name       varchar(255) NOT NULL,
  legal_name         varchar(255),
  email              varchar(320),
  phone              varchar(32),
  billing_address    text,
  postal_code        varchar(20),
  city               varchar(120),
  country            varchar(120) DEFAULT 'France',
  notes              text,
  is_active          boolean DEFAULT true,
  created_at, updated_at
)

-- Contacts d'un client (peut avoir un compte users)
public.client_contacts (
  id                 bigint PK,
  client_id          bigint FK → clients(id) ON DELETE CASCADE,
  user_id            bigint UNIQUE FK → users(id) ON DELETE SET NULL,
  first_name         varchar(120) NOT NULL,
  last_name          varchar(120) NOT NULL,
  email              varchar(320),
  phone              varchar(32),
  job_title          varchar(160),
  contact_type       contact_type DEFAULT 'principal',
  is_primary         boolean DEFAULT false,
  created_at, updated_at
)

-- Sites d'intervention
public.sites (
  id                 bigint PK,
  client_id          bigint FK → clients(id) ON DELETE CASCADE,
  site_code          varchar(64),
  site_name          varchar(255) NOT NULL,
  address_line_1     text NOT NULL,
  address_line_2     text,
  postal_code        varchar(20),
  city               varchar(120) NOT NULL,
  country            varchar(120) DEFAULT 'France',
  latitude           double precision,
  longitude          double precision,
  access_instructions text,
  notes              text,
  is_active          boolean DEFAULT true,
  created_at, updated_at
)

-- Techniciens (peut avoir un compte users)
public.technicians (
  id                 bigint PK,
  user_id            bigint UNIQUE FK → users(id) ON DELETE SET NULL,
  first_name         varchar(120) NOT NULL,
  last_name          varchar(120) NOT NULL,
  email              varchar(320),
  phone              varchar(32),
  employee_code      varchar(64) UNIQUE,
  skills             jsonb,
  notes              text,
  is_active          boolean DEFAULT true,
  created_at, updated_at
)

-- Chantiers
public.projects (
  id                 bigint PK,
  reference          varchar(64) UNIQUE NOT NULL,   -- ex: PROJ-ABC12345
  client_id          bigint FK → clients(id) ON DELETE RESTRICT,
  site_id            bigint FK → sites(id) ON DELETE SET NULL,
  title              varchar(255) NOT NULL,
  service_type       service_type DEFAULT 'autre',
  description        text,
  status             project_status DEFAULT 'brouillon',
  progress_percent   integer DEFAULT 0 CHECK(0..100),
  estimated_hours    numeric(8,2) DEFAULT 0.00,
  actual_hours       numeric(8,2) DEFAULT 0.00,
  budget_amount      numeric(12,2) DEFAULT 0.00,
  start_date         date,
  planned_end_date   date,
  actual_end_date    date,
  created_by_user_id bigint FK → users(id),
  created_at, updated_at
)

-- Affectations techniciens ↔ chantiers
public.project_assignments (
  id                 bigint PK,
  project_id         bigint FK → projects(id) ON DELETE CASCADE,
  technician_id      bigint FK → technicians(id) ON DELETE CASCADE,
  assignment_role    assignment_role DEFAULT 'technicien',
  assigned_at        timestamptz DEFAULT now(),
  assigned_by_user_id bigint FK → users(id)
)

-- Contrats d'entretien
public.maintenance_contracts (
  id                 bigint PK,
  contract_number    varchar(64) UNIQUE NOT NULL,
  client_id          bigint FK → clients(id) ON DELETE RESTRICT,
  site_id            bigint FK → sites(id) ON DELETE SET NULL,
  title              varchar(255) NOT NULL,
  service_type       service_type DEFAULT 'autre',
  frequency          contract_frequency DEFAULT 'annuelle',
  status             contract_status DEFAULT 'brouillon',
  annual_amount      numeric(12,2) DEFAULT 0.00,
  renewal_notice_days integer DEFAULT 30,
  start_date         date,
  next_service_date  date,
  end_date           date,
  notes              text,
  created_by_user_id bigint FK → users(id),
  created_at, updated_at
)

-- Interventions terrain
public.interventions (
  id                 bigint PK,
  reference          varchar(64) UNIQUE NOT NULL,   -- ex: INT-ABC12345
  client_id          bigint FK → clients(id) ON DELETE RESTRICT,
  site_id            bigint FK → sites(id) ON DELETE SET NULL,
  project_id         bigint FK → projects(id) ON DELETE SET NULL,
  contract_id        bigint FK → maintenance_contracts(id) ON DELETE SET NULL,
  technician_id      bigint FK → technicians(id) ON DELETE SET NULL,
  title              varchar(255) NOT NULL,
  description        text,
  intervention_type  intervention_type DEFAULT 'maintenance',
  priority           intervention_priority DEFAULT 'normale',
  status             intervention_status DEFAULT 'planifiee',
  scheduled_start_at timestamptz,
  scheduled_end_at   timestamptz,
  started_at         timestamptz,
  completed_at       timestamptz,
  report             text,
  internal_notes     text,
  created_by_user_id bigint FK → users(id),
  created_at, updated_at
)

-- Disponibilité techniciens
public.technician_availability (
  id                 bigint PK,
  technician_id      bigint FK → technicians(id) ON DELETE CASCADE,
  availability_type  availability_type DEFAULT 'disponible',
  start_at           timestamptz NOT NULL,
  end_at             timestamptz NOT NULL,
  notes              text,
  created_at         timestamptz,
  CHECK (end_at >= start_at)
)

-- Documents (métadonnées — fichiers dans Supabase Storage)
public.documents (
  id                 bigint PK,
  entity_type        entity_type NOT NULL,
  entity_id          bigint NOT NULL,
  client_id          bigint FK → clients(id),
  site_id            bigint FK → sites(id),
  project_id         bigint FK → projects(id),
  contract_id        bigint FK → maintenance_contracts(id),
  intervention_id    bigint FK → interventions(id),
  uploaded_by_user_id bigint FK → users(id),
  title              varchar(255) NOT NULL,
  file_name          varchar(255) NOT NULL,
  file_key           varchar(512) NOT NULL,
  file_url           varchar(1024) NOT NULL,
  mime_type          varchar(160),
  document_type      document_type DEFAULT 'autre',
  visibility         document_visibility DEFAULT 'interne',
  created_at         timestamptz DEFAULT now()
)

-- Journal d'audit
public.activity_logs (
  id                 bigint PK,
  actor_user_id      bigint FK → users(id),
  entity_type        entity_type NOT NULL,
  entity_id          bigint NOT NULL,
  action             varchar(120) NOT NULL,
  message            text,
  metadata           jsonb,
  created_at         timestamptz DEFAULT now()
)
```

### Tables — Sprint 2 (chantier features)

```sql
-- Journal d'étapes du chantier
public.project_journal_entries (
  id                   bigint PK,
  project_id           bigint FK → projects(id) ON DELETE CASCADE,
  entry_type           journal_entry_type DEFAULT 'etape',
  title                varchar(255),
  content              text NOT NULL,
  occurred_at          timestamptz DEFAULT now(),
  created_by_user_id   bigint FK → users(id),
  created_at           timestamptz,
  updated_at           timestamptz
)

-- Mémos internes (admin + tech — JAMAIS visibles clients)
public.project_memos (
  id                   bigint PK,
  project_id           bigint FK → projects(id) ON DELETE CASCADE,
  title                varchar(255),
  content              text NOT NULL,
  created_by_user_id   bigint FK → users(id),
  created_at           timestamptz,
  updated_at           timestamptz
)

-- Médias photo/vidéo du chantier
public.project_media (
  id                   bigint PK,
  project_id           bigint FK → projects(id) ON DELETE CASCADE,
  media_type           media_type DEFAULT 'photo',
  caption              varchar(500),
  file_name            varchar(255) NOT NULL,
  file_key             varchar(512) NOT NULL,   -- clé dans bucket techfield-media
  mime_type            varchar(160),
  size_bytes           bigint,
  uploaded_by_user_id  bigint FK → users(id),
  created_at           timestamptz
)
```

### Tables — Sprint 3 (médias intervention)

```sql
-- Photos du compte-rendu d'intervention
public.intervention_media (
  id                   bigint PK,
  intervention_id      bigint FK → interventions(id) ON DELETE CASCADE,
  caption              text,
  file_name            varchar(255) NOT NULL,
  file_key             text NOT NULL,    -- clé dans bucket techfield-media
  mime_type            varchar(127),
  size_bytes           bigint,
  uploaded_by_user_id  bigint FK → users(id),
  created_at           timestamptz
)
```

### Diagramme de relations simplifié

```
users ──────────────────────────────────────────────────────┐
  │                                                          │
  ├── client_contacts (user_id nullable)                     │
  └── technicians (user_id nullable)                         │
                                                             │
clients ──────────────────────────────────                   │
  ├── client_contacts ──────────────────┤ created_by_user_id
  ├── sites                             │
  │    └── ...                          │
  ├── projects ─────────────────────────┤
  │    ├── project_assignments ──→ technicians
  │    ├── project_journal_entries
  │    ├── project_memos
  │    ├── project_media
  │    └── documents (project_id)
  ├── maintenance_contracts ────────────┤
  └── interventions ─────────────────────────→ technicians
       ├── intervention_media
       └── documents (intervention_id)
```

---

## 7. RLS — Politiques de sécurité

### Fonctions helper JWT (dans Supabase)

```sql
-- Récupère le rôle applicatif depuis le JWT Supabase
public.tf_role()      → 'admin' | 'technicien' | 'client' | ''
public.tf_open_id()   → open_id de l'utilisateur connecté
public.tf_email()     → email en minuscules
public.tf_user_id()   → id dans public.users (résolution par open_id ou email)
public.tf_technician_id() → id dans public.technicians (via user_id)
public.tf_client_id() → id dans public.clients (via email)
public.tf_is_admin()  → boolean
public.tf_is_technician() → boolean
public.tf_is_client() → boolean
```

### Résumé des accès par rôle

| Table | Admin | Technicien | Client |
|---|---|---|---|
| `users` | ALL | SELECT (soi-même) | SELECT (soi-même) |
| `clients` | ALL | SELECT (ses interventions/projets) | SELECT (son client) |
| `client_contacts` | ALL | SELECT (ses clients) | SELECT (son client) |
| `sites` | ALL | SELECT (ses interventions/projets) | SELECT (son client) |
| `technicians` | ALL | SELECT (soi-même) | ❌ |
| `projects` | ALL | SELECT (assigné via project_assignments) | SELECT (son client) |
| `project_assignments` | ALL | SELECT (soi-même) | ❌ |
| `maintenance_contracts` | ALL | SELECT (ses interventions) | SELECT (son client) |
| `interventions` | ALL | SELECT+INSERT+UPDATE (assigné à lui) | SELECT (son client) |
| `technician_availability` | ALL | SELECT+INSERT+UPDATE+DELETE (soi-même) | ❌ |
| `documents` | ALL | SELECT+INSERT (ses projets/interventions) | SELECT (son client, visibilité ≠ restreint implicite) |
| `activity_logs` | ALL | SELECT+INSERT (soi-même) | ❌ |
| `project_journal_entries` | ALL | SELECT+INSERT+UPDATE+DELETE (projets assignés, ses entrées) | SELECT (ses projets) |
| `project_memos` | ALL | SELECT+INSERT+UPDATE+DELETE (projets assignés, ses mémos) | ❌ |
| `project_media` | ALL | SELECT+INSERT+DELETE (projets assignés, ses médias) | SELECT (ses projets) |
| `intervention_media` | ALL | SELECT+INSERT+DELETE (ses interventions) | ❌ |

### Comment les helpers Supabase contournent la RLS

Les helpers dans `server/integrations/supabase/db/*.ts` utilisent tous `createSupabaseAdminClient()` qui emploie la clé `SUPABASE_SERVICE_ROLE_KEY`. Ce client bypasse la RLS — l'autorisation est gérée manuellement via le type `AccessScope` et des fonctions `assertXxxAccess()`.

---

## 8. Stockage Supabase Storage

### Buckets

| Bucket | Visibilité | Taille max | Types MIME acceptés |
|---|---|---|---|
| `techfield-media` | Privé | 100 MB | image/jpeg, image/png, image/webp, image/heic, image/heif, video/mp4, video/quicktime, video/webm |
| `techfield-documents` | Privé | 20 MB | application/pdf, image/jpeg, image/png, image/webp, text/plain |

### Clés de stockage (Storage keys)

```
Médias chantier :     projects/{projectId}/photos/{timestamp}_{rand}_{fileName}
Vidéos chantier :     projects/{projectId}/videos/{timestamp}_{rand}_{fileName}
Médias intervention : interventions/{interventionId}/photos/{timestamp}_{rand}_{fileName}
Documents :           projects/{projectId}/documents/{timestamp}_{rand}_{fileName}
```

### Pattern upload en 3 étapes

```typescript
// Étape 1 — Obtenir l'URL signée d'upload (PUT)
const { uploadUrl, fileKey } = await trpc.management.projectMedia.createUploadUrl.mutate({
  projectId,
  fileName: file.name,
  mimeType: file.type,
  mediaType: "photo",
});

// Étape 2 — Uploader le fichier directement vers Supabase Storage
await fetch(uploadUrl, {
  method: "PUT",
  body: file,
  headers: { "Content-Type": file.type },
});

// Étape 3 — Enregistrer en base
await trpc.management.projectMedia.register.mutate({
  projectId,
  mediaType: "photo",
  fileName: file.name,
  fileKey,
  mimeType: file.type,
  sizeBytes: file.size,
  caption: null,
});
```

### URLs signées (download)

- Les URLs dans `signedUrl` de `projectMedia.list` sont générées automatiquement côté serveur (TTL 1h)
- Pour télécharger un document : appeler `projectDocuments.getSignedUrl({ fileKey })` → retourne `{ url: string }`
- Les URLs expirent : ne jamais les stocker en base côté client

---

## 9. Authentification et contexte

### Flux d'authentification

```
1. Utilisateur se connecte via Supabase Auth (email/password ou OAuth)
2. Supabase émet un JWT avec custom claims : { role, open_id, email }
3. Le browser envoie le cookie Supabase à chaque requête vers /api/trpc
4. server/_core/context.ts :
   - createSupabaseServerSsrClient() lit le cookie
   - supabase.auth.getUser() → { supabaseUser }
   - resolveUserFromSupabaseIdentity() → trouve ou crée l'utilisateur dans public.users
   - ctx.user = l'utilisateur applicatif
5. Les procédures tRPC accèdent à ctx.user.openId, ctx.user.role
```

### Type `TrpcContext`

```typescript
type TrpcContext = {
  req: Express.Request;
  res: Express.Response;
  user: User | null;          // null si non authentifié
  supabase: SupabaseClient | null;  // null si SUPABASE_ENV.isConfigured = false
};
```

### Type `AccessScope`

```typescript
type AccessScope = {
  user: { id: number; role: "admin" | "technicien" | "client" };
  technicianProfile: { id: number } | null;       // non-null si rôle = technicien
  clientContactProfile: { clientId: number } | null; // non-null si rôle = client
};
```

Obtenu via : `const scope = await getScope(ctx.user.openId);` dans management.ts.

> **Note importante** : `scope.user.id` (id numérique de la table `users`) est disponible
> dans `chantier-features.ts` et `intervention-features.ts` (utilisé pour `created_by_user_id`).
> Dans les helpers de `management.ts` (Sprint 1), la variante locale peut ne pas exposer `user.id` —
> dans ce cas passer `ctx.user.id` directement depuis le routeur si besoin.

---

## 10. Conventions frontend

### Routing (wouter)

```tsx
import { Link, useRoute } from "wouter";

// Lire un paramètre d'URL
const [, params] = useRoute<{ id: string }>("/chantiers/:id");
const projectId = params?.id ? Number(params.id) : NaN;

// Lien
<Link href="/chantiers">Retour</Link>
```

**Routes existantes (App.tsx) :**
```
/                → DashboardPage
/clients         → ClientsPage
/sites           → SitesPage
/chantiers       → ProjectsPage
/chantiers/:id   → ProjectDetailPage
/contrats        → ContractsPage
/interventions   → InterventionsPage
/equipe          → TeamPage
/calendrier      → CalendarPage
/documents       → DocumentsPage
/404             → NotFound
```

**Ajouter une nouvelle page :**
1. Créer / exporter le composant depuis `client/src/pages/TechfieldPages.tsx`
2. Ajouter `import { NouveauPage } from "./pages/TechfieldPages"` dans `App.tsx`
3. Ajouter `<Route path="/nouveau-chemin" component={NouveauPage} />` dans le `<Switch>` de `App.tsx`

### Permissions (hook `useRoleMatrix`)

```tsx
// Toujours utiliser ce hook pour les permissions UI
const { permissions, role } = useRoleMatrix();
const canManage = !!permissions?.manageProjects;

// Cacher les boutons d'écriture si !canManage
{canManage && <Button>+ Nouveau</Button>}

// La RLS bloque côté serveur même si le frontend rate le check
```

### tRPC — configuration client (NE PAS MODIFIER)

Fichier `client/src/main.tsx` — critique, ne jamais changer cette configuration :

```tsx
const trpcClient = trpc.createClient({
  links: [httpBatchLink({
    url: "/api/trpc",
    transformer: superjson,       // sérialise les Date automatiquement
    fetch(input, init) {
      return globalThis.fetch(input, {
        ...(init ?? {}),
        credentials: "include",   // envoie le cookie Supabase Auth
      });
    },
  })],
});
```

### tRPC — namespaces de l'appRouter

```
appRouter
├── system.*           ← health check, version
├── auth.*
│   ├── auth.me        ← publicProcedure — renvoie user ou null
│   ├── auth.session   ← protectedProcedure — profil complet
│   └── auth.logout    ← publicProcedure mutation — efface le cookie
├── security.*
│   ├── security.roleMatrix       ← protectedProcedure — permissions par rôle
│   ├── security.requireAdmin     ← adminProcedure
│   ├── security.requireTechnician ← protectedProcedure
│   └── security.requireClient    ← protectedProcedure
└── management.*       ← voir section 5 pour la liste complète
```

### tRPC — types de procédures

```typescript
// Accessible sans auth (utilisé pour me, logout, login)
publicProcedure

// Exige un user connecté (ctx.user non null)
// Lance TRPCError UNAUTHORIZED si non connecté
protectedProcedure

// Exige user.role === 'admin'
// Lance TRPCError FORBIDDEN sinon
adminProcedure
```

> Côté client, les appels tRPC échouent avec `err.message = 'Please login (10001)'` si non connecté,
> et `'You do not have required permission (10002)'` si rôle insuffisant.

### tRPC — pattern standard

```tsx
import { trpc } from "@/lib/trpc";

// Query
const { data, isLoading } = trpc.management.projects.list.useQuery();

// Mutation avec invalidation
const utils = trpc.useUtils();
const createMemo = trpc.management.projectMemos.create.useMutation({
  onSuccess: async () => {
    toast.success("Mémo ajouté.");
    await utils.management.projectMemos.list.invalidate({ projectId });
  },
  onError: err => toast.error(err.message),
});
createMemo.mutate({ projectId, content: "..." });
```

### App.tsx — providers et structure

```tsx
// App.tsx wraps tout dans :
<ThemeProvider defaultTheme="light">       // contexts/ThemeContext
  <TooltipProvider>                         // @/components/ui/tooltip
    <ErrorBoundary>                         // composant interne
      <Router>
        {/* Routes wouter */}
      </Router>
    </ErrorBoundary>
    <Toaster />                             // sonner — toasts globaux
  </TooltipProvider>
</ThemeProvider>
```

Toast — utiliser `sonner` directement :
```tsx
import { toast } from "sonner";
toast.success("Sauvegardé");
toast.error(err.message);
```

### Imports — toujours utiliser l'alias `@/`

```tsx
// ✅ Correct
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

// ❌ Incorrect
import { Button } from "../../components/ui/button";
```

### Couleurs des badges (conventions)

```tsx
// Vert — terminé, actif
"border border-emerald-200 bg-emerald-500/10 text-emerald-700"

// Orange — en cours, planifié
"border border-amber-200 bg-amber-500/10 text-amber-700"

// Rouge — urgent, bloqué, annulé
"border border-rose-200 bg-rose-500/10 text-rose-700"

// Gris — brouillon, inconnu
"border border-slate-200 bg-slate-500/10 text-slate-700"
```

---

## 11. Composants shadcn disponibles

Tous dans `@/components/ui/`. Tous basés sur Radix UI.

**Installer un nouveau composant shadcn :**
```bash
pnpm dlx shadcn@latest add <nom-du-composant>
# Exemple : pnpm dlx shadcn@latest add calendar
# Le composant est généré dans client/src/components/ui/<nom>.tsx
```

```
alert-dialog   badge          button         card
checkbox       dialog         dropdown-menu  input
label          popover        progress       scroll-area
select         separator      skeleton       switch
table          tabs           textarea       tooltip
```

### Exemples clés

**Dialog (formulaire) :**
```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger asChild><Button>Ouvrir</Button></DialogTrigger>
  <DialogContent className="sm:max-w-lg">
    <DialogHeader>
      <DialogTitle>Titre du dialog</DialogTitle>
      <DialogDescription>Description optionnelle</DialogDescription>
    </DialogHeader>
    {/* Contenu + inputs */}
    <DialogFooter>
      <Button onClick={handleSubmit} disabled={isPending}>Valider</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**AlertDialog (confirmation destructive) :**
```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="outline" className="text-rose-700 hover:bg-rose-50">
      <Trash2 className="h-4 w-4" />Supprimer
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Confirmer la suppression ?</AlertDialogTitle>
      <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Annuler</AlertDialogCancel>
      <AlertDialogAction onClick={handleDelete} className="bg-rose-600 text-white hover:bg-rose-700">
        Supprimer
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Select :**
```tsx
<Select value={value} onValueChange={setValue}>
  <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
  <SelectContent>
    <SelectItem value="planifiee">Planifiée</SelectItem>
    <SelectItem value="en_cours">En cours</SelectItem>
    <SelectItem value="terminee">Terminée</SelectItem>
  </SelectContent>
</Select>
```

**Tabs :**
```tsx
<Tabs defaultValue="journal">
  <TabsList>
    <TabsTrigger value="journal">Journal</TabsTrigger>
    <TabsTrigger value="medias">Médias</TabsTrigger>
  </TabsList>
  <TabsContent value="journal">...</TabsContent>
  <TabsContent value="medias">...</TabsContent>
</Tabs>
```

**Card :**
```tsx
<Card className="border-white/10 shadow-sm shadow-slate-950/5">
  <CardHeader>
    <CardTitle>Titre</CardTitle>
    <CardDescription>Sous-titre</CardDescription>
  </CardHeader>
  <CardContent>...</CardContent>
</Card>
```

---

## 12. Règles critiques — NE PAS CASSER

### ⛔ Règle 1 — Toujours le check Supabase dans les procédures backend

```typescript
// OBLIGATOIRE dans toute procédure tRPC
if (SUPABASE_ENV.isConfigured && ctx.supabase) {
  // → Chemin Supabase (SEUL chemin en production)
}
// Le fallback Drizzle ne fonctionne PAS en prod :
// drizzle/schema.ts utilise mysqlTable (MySQL dialect)
// mais DATABASE_URL pointe sur PostgreSQL → SQL avec backticks = erreur PG
```

### ⛔ Règle 2 — Ne jamais utiliser `drizzle/schema.ts` pour de nouvelles features

Le schema Drizzle (`drizzle/schema.ts`) utilise `mysqlTable` de `drizzle-orm/mysql-core`. En prod sur Render, la variable `DATABASE_URL` pointe sur Supabase PostgreSQL. Le driver mysql2 se connecte mais génère du SQL avec backticks et noms de colonnes camelCase — PostgreSQL le rejette. **Tous les nouveaux accès données passent par les helpers Supabase.**

### ⛔ Règle 3 — `logActivity` toujours fire-and-forget

```typescript
// ✅ Correct — ne bloque jamais la mutation principale
getDb().then(db => logActivity(db, userId, "project", id, "action", "msg")).catch(() => {});

// ❌ Incorrect — peut faire échouer toute la mutation
await logActivity(db, ...);
```

### ⛔ Règle 4 — Imports frontend avec alias `@/`

```typescript
// ✅ import { Button } from "@/components/ui/button";
// ❌ import { Button } from "../../components/ui/button";
```

### ⛔ Règle 5 — Jamais ajouter de dépendances sans pnpm

```bash
pnpm add <package>     # ✅
npm install <package>  # ❌
yarn add <package>     # ❌
```

### ⛔ Règle 6 — `pnpm check` doit passer à 0 erreurs avant tout commit

```bash
pnpm check    # tsc --noEmit — doit afficher 0 erreurs
pnpm test     # vitest run — 37/37 OK
```

### ⛔ Règle 7 — Ne jamais committer `.env.local`

`.env.local` est dans `.gitignore`. Contient `SUPABASE_SERVICE_ROLE_KEY` — secret absolu.

### ⛔ Règle 8 — `AccessScope` toujours passé aux helpers

```typescript
// ✅ Correct
const scope = await getScope(ctx.user.openId);
return await createProjectJournalEntry(scope, input);

// ❌ Contourne la RLS applicative
return await createProjectJournalEntry(null, input);
```

### ⛔ Règle 9 — `AccessScope.user.id` disponible dans chantier-features, pas dans management

```typescript
// chantier-features.ts et intervention-features.ts → scope.user.id est disponible
// (utilisé pour created_by_user_id)
const scope = await getScope(ctx.user.openId);
// scope = { user: { id: number; role }, technicianProfile, clientContactProfile }

// Dans management.ts (helpers Sprint 1), la variante interne ne contient pas user.id
// Si tu as besoin de created_by_user_id dans un nouveau helper Sprint 1,
// passer ctx.user.id directement depuis le routeur
```

### ⛔ Règle 10 — Table `documents` réutilisée pour les documents projet

Il n'existe PAS de table `project_documents`.
La table `documents` (Sprint 1) est filtrée par `project_id` pour les documents chantier :

```sql
-- documents projet = documents WHERE project_id = $1
SELECT * FROM documents WHERE project_id = $1 ORDER BY created_at DESC;
```

De même, `intervention_id` sur cette même table lie un document à une intervention.
Ne jamais créer de table `project_documents` — utiliser toujours la table `documents`.

---

## 13. Commandes de développement

```bash
# Installation
pnpm install

# Développement local (hot reload — port 3000 par défaut ou $PORT)
pnpm dev

# Vérification TypeScript (OBLIGATOIRE avant commit)
pnpm check

# Tests unitaires
pnpm test

# Build production (Vite + esbuild server)
pnpm build

# Start production (après build)
pnpm start

# Linting / formatting
pnpm format    # prettier

# Git — committer et pousser (Render déploie automatiquement)
git add -p     # éviter git add . (risque de committer .env.local ou fichiers sensibles)
git commit -m "Sprint X module: description"
git push origin main
```

---

## 14. Supabase — accès dashboard et migrations

### Dashboard
```
https://supabase.com/dashboard/project/tplfivfxqxqatzvvfnll
```

### Appliquer une migration SQL
1. Aller dans **SQL Editor** du dashboard Supabase
2. Coller le contenu du fichier SQL
3. Exécuter
4. Vérifier dans **Table Editor** que les tables existent

### Structure des fichiers SQL
```
supabase/sql/01_techfield_schema.sql        — tables + enums + triggers (Sprint 1)
supabase/sql/02_techfield_storage.sql       — bucket techfield-documents
supabase/sql/05_rls_policies.sql            — toutes les politiques RLS
supabase/sql/06_sprint2_chantier_features.sql — Sprint 2 tables + RLS + bucket techfield-media
supabase/sql/07_sprint3_interventions.sql   — Sprint 3 intervention_media + RLS
```

⚠️ **Ne jamais lancer `pnpm db:push`** — cela tenterait d'appliquer le schema Drizzle MySQL sur PostgreSQL et causerait un drift de schema.

---

*Dernière mise à jour : 22/05/2026 — Sprint 3 terminé et en production.*
*Référence commit actuel : `6dae4ac` (logActivity silencieux global)*
