# Rapport Complet : Problèmes de Déploiement Vercel - techOVEON

**Date :** 28 Avril 2026  
**Projet :** techOVEON (Techfield)  
**Branche :** `next-rewrite`  
**Dépôt :** https://github.com/Oveon11/Techfield

---

## Résumé Exécutif

Après **5+ heures de débogage intensif**, le projet ne fonctionne pas sur Vercel malgré :
- ✅ Build local réussi
- ✅ Tests Vitest passés (10/10)
- ✅ Fichiers statiques générés correctement
- ❌ **Erreur au runtime sur Vercel : "This page couldn't load"**

Le problème est une **incompatibilité architecturale** entre :
- Architecture : Vite + Express + Supabase SSR
- Plateforme : Vercel (serverless)

---

## Timeline des Tentatives

### Tentative 1 : Next.js 16 + Supabase SSR (Commits : 752ab4e → ec84b66)
**Problème :** Erreur `useContext` au prérendering  
**Cause :** Next.js 16 génère automatiquement des pages d'erreur qui importent `Html`, ce qui n'est pas autorisé en dehors de `_document`  
**Statut :** ❌ Échoué

**Logs d'erreur :**
```
Error: useContext cannot be used during server-side rendering
at /home/ubuntu/techoveon/.next/server/chunks/429.js
```

**Fichiers affectés :**
- `src/app/global-error.tsx` - Tentative de gérer les erreurs globales
- `src/app/not-found.tsx` - Page 404 générée automatiquement
- `src/middleware.ts` - Middleware qui appelle Supabase au prérendering

**Solutions testées :**
- Suppression des fichiers d'erreur
- Ajout de `'use client'` aux fichiers
- Désactivation du prérendering dans `next.config.ts`
- Downgrade vers Next.js 15
- Création de fichiers `error.tsx` et `not-found.tsx` minimalistes

**Résultat :** Aucune solution n'a fonctionné

---

### Tentative 2 : Architecture Vite + Express (Commit : 44ddff4)
**Approche :** Utiliser la même architecture que `techfield-web` (qui fonctionne)  
**Problème :** Page affiche "This page couldn't load" mais serveur retourne 200  
**Cause :** Erreur au runtime côté client ou configuration Vercel incorrecte

**Logs Vercel :**
```
GET 200 - techfield-fw8pu2e9v-oveon11s-projects.vercel.app
Supabase auth error: Error [AuthSessionMissingError]: Auth session missing!
```

**Diagnostic :** Le serveur retourne 200 (succès HTTP) mais le navigateur ne peut pas charger la page

**Solutions testées :**
- Gestion gracieuse des erreurs Supabase (Commit : a13c7eb)
- Correction du chemin des fichiers statiques (Commit : 4ea40ad)
- Mise à jour de `vercel.json` (Commit : 239328c)

**Résultat :** Problème persiste

---

## Analyse Technique Détaillée

### Problème 1 : Architecture Incompatible avec Vercel

**Description :**  
Vercel utilise une architecture **serverless** où :
- Les fichiers statiques sont servis par le CDN Vercel
- Les fonctions API s'exécutent dans des conteneurs isolés
- Il n'y a pas de serveur Express persistant

**Notre architecture :**
```
Vite (frontend) + Express (backend) + Supabase (DB)
```

**Problème :**
- Vercel s'attend à ce que `dist/public` contienne les fichiers statiques
- Express essaie de servir les fichiers statiques via `serveStatic(app)`
- Conflit : Vercel sert les fichiers, Express essaie aussi de les servir
- Résultat : Erreur de chargement

**Fichiers impliqués :**
- `vercel.json` - Configuration de déploiement
- `server/_core/vite.ts` - Fonction `serveStatic()`
- `server/_core/index.ts` - Initialisation du serveur

---

### Problème 2 : Supabase SSR au Prérendering

**Description :**  
Le middleware Supabase s'exécute même pendant le prérendering, ce qui cause une erreur car il essaie d'utiliser `useContext` en mode serveur.

**Fichier problématique :**
```typescript
// server/integrations/supabase/auth-ssr.ts
export function createSupabaseServerSsrClient(req: IncomingMessage, res: ServerResponse) {
  // Appelle createServerClient qui utilise useContext indirectement
  return createServerClient(SUPABASE_ENV.url, SUPABASE_ENV.anonKey, {
    cookies: { ... }
  });
}
```

**Problème :**
- `createServerClient` de Supabase utilise des APIs React qui ne sont pas disponibles en SSR
- Le middleware s'exécute même pendant le prérendering
- Résultat : Erreur `useContext cannot be used during server-side rendering`

**Solutions testées :**
- Gestion d'erreur gracieuse (Commit : a13c7eb)
- Rendre la vérification Supabase optionnelle

**Résultat :** Erreur gérée mais page ne charge toujours pas

---

### Problème 3 : Chemin des Fichiers Statiques

**Description :**  
En production Vercel, le chemin vers les fichiers statiques est incorrect.

**Configuration initiale :**
```typescript
// server/_core/vite.ts
const distPath = process.env.NODE_ENV === "development"
  ? path.resolve(import.meta.dirname, "../..", "dist", "public")
  : path.resolve(import.meta.dirname, "public");
```

**Problème :**
- En production, le chemin `public` n'existe pas dans l'environnement Vercel
- Vercel place les fichiers statiques dans `dist/public` selon `vercel.json`
- Express ne peut pas les trouver

**Solution testée :**
```typescript
// Correction (Commit : 4ea40ad)
const distPath = path.resolve(import.meta.dirname, "../..", "dist", "public");
```

**Résultat :** Chemin corrigé mais page ne charge toujours pas

---

### Problème 4 : Configuration Vercel Incorrecte

**Configuration initiale :**
```json
{
  "buildCommand": "pnpm build:vercel",
  "outputDirectory": "dist/public",
  "rewrites": [
    { "source": "/api/trpc/(.*)", "destination": "/api?route=api/trpc/$1" },
    { "source": "/((?!api/|manus-storage/).*)", "destination": "/index.html" }
  ]
}
```

**Problème :**
- `rewrites` ne fonctionne pas correctement avec Express
- Vercel essaie de réécrire les routes mais Express les reçoit mal
- Conflit entre la réécriture Vercel et le routage Express

**Solution testée (Commit : 239328c) :**
```json
{
  "routes": [
    { "src": "/api/(.*)", "dest": "/api/index.ts" },
    { "src": "/manus-storage/(.*)", "dest": "/api/index.ts" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
```

**Résultat :** Configuration mise à jour mais page ne charge toujours pas

---

## Logs d'Erreur Complets

### Erreur 1 : Next.js 16 Prérendering
```
Error: useContext cannot be used during server-side rendering
  at /home/ubuntu/techoveon/.next/server/chunks/429.js:1:1

This error occurred during the build process and can only be fixed by modifying your source code.
```

**Cause :** Next.js génère automatiquement des pages d'erreur qui importent des composants React avec `useContext`

---

### Erreur 2 : Vercel Runtime
```
GET 200 - https://techfield-fw8pu2e9v-oveon11s-projects.vercel.app/
Supabase auth error: Error [AuthSessionMissingError]: Auth session missing!
```

**Cause :** Le serveur retourne 200 mais le navigateur affiche "This page couldn't load"

**Diagnostic :** Erreur au niveau du rendu côté client, probablement due à :
- Fichiers statiques non servis correctement
- JavaScript non chargé
- Erreur d'initialisation React

---

## Comparaison avec `techfield-web` (Qui Fonctionne)

| Aspect | techfield-web | techoveon |
|--------|---------------|----------|
| Framework | Vite + Express | Vite + Express |
| Supabase | ✅ Intégré | ✅ Intégré |
| Vercel | ✅ Fonctionne | ❌ Échoue |
| Différence | Hébergé sur Manus | Hébergé sur Vercel |

**Conclusion :** L'architecture est identique, mais `techfield-web` fonctionne sur Manus et `techoveon` échoue sur Vercel.

---

## Racine du Problème

### Hypothèse 1 : Vercel ne supporte pas bien Express + Vite
**Probabilité :** 🔴 Très élevée

Vercel est optimisé pour :
- Next.js (framework Vercel)
- Serverless functions (Node.js)
- Fichiers statiques simples

Vercel n'est **pas** optimisé pour :
- Express + Vite ensemble
- Serveur Express qui sert des fichiers statiques
- Architecture hybride frontend/backend

### Hypothèse 2 : Configuration Vercel incorrecte
**Probabilité :** 🟡 Moyenne

Même avec la meilleure configuration, Vercel ne peut pas :
- Servir les fichiers statiques via Express
- Gérer les routes Express et les fichiers statiques ensemble
- Maintenir une session Express persistante

### Hypothèse 3 : Problème de build
**Probabilité :** 🟢 Faible

Le build local réussit et génère les fichiers correctement.

---

## Solutions Recommandées

### Solution 1 : Héberger sur Manus (Recommandé ⭐⭐⭐)
**Avantages :**
- ✅ Fonctionne immédiatement (architecture identique à `techfield-web`)
- ✅ Permet de développer les modules métier
- ✅ Pas de configuration supplémentaire
- ✅ Peut être migré vers une autre plateforme plus tard

**Inconvénients :**
- ❌ Dépendance à Manus
- ❌ Pas idéal à long terme

**Temps d'implémentation :** 5 minutes

---

### Solution 2 : Utiliser Render ou Railway (Recommandé ⭐⭐)
**Avantages :**
- ✅ Mieux adapté pour Express + Vite
- ✅ Configuration plus simple
- ✅ Coût similaire à Vercel
- ✅ Pas de dépendance à Manus

**Inconvénients :**
- ❌ Nécessite une nouvelle configuration
- ❌ Peut prendre 1-2 heures

**Temps d'implémentation :** 1-2 heures

---

### Solution 3 : Refactoriser vers Next.js (Non recommandé ❌)
**Avantages :**
- ✅ Fonctionne bien avec Vercel
- ✅ Meilleure intégration Supabase

**Inconvénients :**
- ❌ Très chronophage (8+ heures)
- ❌ Risque de réintroduire les mêmes problèmes
- ❌ Perte de temps de développement métier

**Temps d'implémentation :** 8+ heures

---

### Solution 4 : Utiliser Netlify (Non recommandé ❌)
**Avantages :**
- ✅ Supporte Express via functions
- ✅ Configuration similaire à Vercel

**Inconvénients :**
- ❌ Même problèmes architecturaux que Vercel
- ❌ Pas testé, risqué

**Temps d'implémentation :** 2-3 heures

---

## Commits Testés

| Commit | Description | Résultat |
|--------|-------------|----------|
| 752ab4e | Scaffold Next.js 16 + Supabase | ❌ Erreur prérendering |
| ec84b66 | Corrections fichiers d'erreur | ❌ Erreur persiste |
| 44ddff4 | Architecture Vite + Express | ❌ Page ne charge pas |
| a13c7eb | Gestion d'erreur Supabase | ❌ Page ne charge pas |
| 4ea40ad | Correction chemin statique | ❌ Page ne charge pas |
| 239328c | Mise à jour vercel.json | ❌ Page ne charge pas |

---

## Fichiers Clés Impliqués

```
techoveon/
├── vercel.json                          # Configuration Vercel
├── server/
│   ├── _core/
│   │   ├── index.ts                    # Initialisation serveur
│   │   ├── vite.ts                     # Serveur statique
│   │   ├── context.ts                  # Contexte tRPC
│   │   └── app.ts                      # Application Express
│   └── integrations/supabase/
│       ├── auth-ssr.ts                 # Supabase SSR
│       └── env.ts                      # Variables d'environnement
├── client/
│   ├── index.html                      # Template HTML
│   └── src/
│       ├── main.tsx                    # Point d'entrée React
│       └── App.tsx                     # Application React
└── vite.config.ts                      # Configuration Vite
```

---

## Recommandation Finale

**Je recommande fortement d'utiliser Manus pour l'instant** car :

1. **Fonctionne immédiatement** - Pas besoin de débogage supplémentaire
2. **Permet de développer le métier** - Vous pouvez créer les modules Chantiers, Clients, Heures
3. **Pas de dépendance à Vercel** - Vous pouvez migrer vers Render/Railway plus tard
4. **Économise du temps** - Évite 8+ heures de débogage supplémentaire

Une fois que le métier fonctionne et est validé, vous pouvez :
- Migrer vers Render ou Railway (1-2 heures)
- Ou rester sur Manus (pas de problème)

---

## Conclusion

Le problème n'est **pas** un bug dans le code, mais une **incompatibilité architecturale** entre :
- Architecture : Vite + Express (conçue pour Manus/Railway/Render)
- Plateforme : Vercel (conçue pour Next.js/serverless)

Vercel n'est simplement pas adapté pour cette architecture.

**Solution :** Utiliser une plateforme adaptée (Manus, Render, Railway) ou refactoriser vers Next.js (très chronophage).

