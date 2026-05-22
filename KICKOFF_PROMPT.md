# Premier message à coller dans Claude Code

> Copie-colle TOUT le bloc ci-dessous dans Claude Code après l'avoir lancé dans `~/Desktop/Techfield` avec `/model sonnet`.

---

Salut, on continue le développement de Techfield. Lis d'abord `CLAUDE.md` à la racine du repo pour avoir tout le contexte projet, puis dis-moi ce que tu as compris en 5 lignes max.

**État actuel (12 mai 2026)** : Sprint 2 vient d'être commité localement (sha `70fcc59` côté frontend, `3b591b4` côté backend, migration SQL `06_sprint2_chantier_features.sql` déjà appliquée sur Supabase). Les 4 nouveaux onglets sur la page détail chantier sont Journal, Médias, Mémos, Documents. Le push vers Render est à faire (ou déjà fait si je l'ai poussé entre-temps — vérifie avec `git status` et `git log origin/main..HEAD`).

**À faire avant de coder quoi que ce soit** :
1. Lire `CLAUDE.md` (contexte projet stable)
2. Jeter un œil à `docs/architecture-techfield.md` (chercher la section interventions)
3. Regarder `server/routers/management.ts` pour voir si un sous-routeur `interventions` existe déjà ou pas (il devrait exister depuis Sprint 1, vérifier son périmètre actuel)
4. Vérifier l'état git avec `git status` et `git log --oneline -5`

**Prochaine étape pressentie** : Sprint 3 = Interventions (planning, compte-rendu d'intervention, signature client tactile, génération PDF du rapport, lien intervention ↔ chantier ↔ contrat). Mais je veux cadrer le scope ensemble avant qu'on code.

**Questions de cadrage que j'attends de toi avant qu'on attaque** :
- Périmètre minimal du Sprint 3 (MVP vs version complète)
- Signature client : obligatoire / optionnelle / par type d'intervention ?
- Format PDF : jsPDF (client) ou pdf-lib serveur ? Template ?
- Notifications technicien (email Supabase Auth ? Push ? Rien pour la V1 ?)
- Calendrier : vue admin globale ou perso technicien d'abord ?
- Statuts d'intervention à modéliser (planifiée / en cours / terminée / annulée / refacturable ?)

Pose-moi ces questions une par une, je réponds, et seulement ensuite on attaque la migration SQL Sprint 3.

**Rappels importants** :
- Réponses en français, ton direct.
- Demander confirmation avant migration SQL en prod ou suppression.
- Préférer éditer les fichiers existants.
- `pnpm check && pnpm test` avant tout commit.
- Tu commit en local, je push moi-même depuis le terminal.
