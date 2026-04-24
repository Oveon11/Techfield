# Diagnostic 404 Vercel après build réussi

## Constat

Le déploiement Vercel associé au commit `9b3c7f8` atteint l’état `Ready`, mais l’URL de production renvoie une page `404 NOT_FOUND` au lieu de l’application Techfield.

## Cause identifiée

Le fichier `vercel.json` publie actuellement `outputDirectory: "dist"`, alors que la configuration Vite produit les fichiers statiques dans `dist/public`.

Le build local confirme la présence de `dist/public/index.html` et des assets frontaux dans `dist/public/assets`, mais aucun `dist/index.html` n’existe. Vercel publie donc un répertoire qui ne contient pas la racine statique attendue.

## Correctif prévu

Mettre à jour `vercel.json` pour publier `dist/public` à la place de `dist`, puis revalider le build et le test de configuration associé avant nouveau push GitHub.
