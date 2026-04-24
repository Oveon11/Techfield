# Diagnostic runtime Vercel

## Constat observé

Le déploiement Vercel associé au commit `6f12d20` échoue immédiatement avec le message : `Error: Function Runtimes must have a valid version, for example 'now-php@1.0.0'.`

## Cause probable

Le fichier `vercel.json` contient actuellement :

```json
"functions": {
  "api/[...path].ts": {
    "runtime": "nodejs22.x"
  }
}
```

D’après la documentation Vercel consultée le 2026-04-24, la propriété `functions.*.runtime` dans `vercel.json` sert à déclarer des runtimes versionnés de type communauté/autres runtimes au format similaire à `vercel-php@0.5.2`, alors qu’une fonction Node.js sans configuration supplémentaire utilise déjà par défaut le runtime Node.js.

## Hypothèse de correction

Retirer la propriété `runtime` de `vercel.json` pour laisser Vercel utiliser son runtime Node.js par défaut, puis, si nécessaire, piloter la version Node via `package.json` (`engines.node`) ou via les réglages du projet Vercel.
