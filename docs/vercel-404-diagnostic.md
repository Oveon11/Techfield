# Diagnostic 404 Vercel après build réussi

## Constat

Le déploiement Vercel associé au commit `9b3c7f8` atteint l’état `Ready`, mais l’URL de production renvoie une page `404 NOT_FOUND` au lieu de l’application Techfield.

## Cause identifiée

Le fichier `vercel.json` publie actuellement `outputDirectory: "dist"`, alors que la configuration Vite produit les fichiers statiques dans `dist/public`.

Le build local confirme la présence de `dist/public/index.html` et des assets frontaux dans `dist/public/assets`, mais aucun `dist/index.html` n’existe. Vercel publie donc un répertoire qui ne contient pas la racine statique attendue.

## Correctif prévu

Mettre à jour `vercel.json` pour publier `dist/public` à la place de `dist`, puis revalider le build et le test de configuration associé avant nouveau push GitHub.

## Observations runtime supplémentaires

Après correction du `outputDirectory`, l’URL de production charge désormais le bundle frontend mais l’application affiche une page d’erreur globale avec `TypeError: Invalid URL`.

L’observation directe du site déployé montre une pile côté frontend pointant vers le bundle `assets/index-MXkeUl2e.js`. Le seul usage direct de `new URL(...)` repéré dans le client se trouve dans `client/src/const.ts`, où l’URL OAuth est construite depuis `import.meta.env.VITE_OAUTH_PORTAL_URL`.

La console navigateur montre également un échec de chargement de ressource : `net::ERR_HTTP2_PROTOCOL_ERROR`.
