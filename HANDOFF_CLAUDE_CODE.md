# Passage à Claude Code — guide d'installation et amorçage

> Ce fichier n'est PAS lu par Claude Code (contrairement à `CLAUDE.md`). C'est un mémo pour toi, Léo, à utiliser une fois pour démarrer.

## 1. Installation de Claude Code sur ton Mac

```bash
# Installation globale (Node 18+ requis)
npm install -g @anthropic-ai/claude-code

# Vérifier l'installation
claude --version
```

Première lancement :

```bash
cd ~/Desktop/Techfield
claude
```

Une fenêtre browser s'ouvre pour t'authentifier avec ton compte Anthropic. Une fois fait, Claude Code détectera automatiquement le fichier `CLAUDE.md` à la racine du projet et chargera tout le contexte.

## 2. Choisir Sonnet 4.6 comme modèle par défaut

Dans la session Claude Code, tape :

```
/model sonnet
```

Pour les tâches complexes (archi, debug tordu, gros refacto), bascule sur Opus :

```
/model opus
```

## 3. Configurer le MCP Supabase (recommandé)

Tu auras besoin d'un Personal Access Token Supabase : dashboard.supabase.com → Settings → Access Tokens → Generate new token (scope read+write).

Ensuite, dans le terminal (hors de Claude Code) :

```bash
claude mcp add supabase \
  --command "npx" \
  --args "-y @supabase/mcp-server-supabase --access-token=TON_TOKEN_SUPABASE"
```

Ou édite directement `~/.claude/mcp.json` :

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-supabase", "--access-token=TON_TOKEN_SUPABASE"]
    }
  }
}
```

Redémarre Claude Code. Tu pourras alors faire appliquer des migrations SQL directement depuis la conversation, comme on faisait ici.

## 4. Premier message à copier-coller dans Claude Code

Une fois Claude Code lancé dans `~/Desktop/Techfield`, colle ce message pour amorcer la session :

---

```
Salut, on continue le développement de Techfield. Lis d'abord CLAUDE.md
à la racine du repo pour avoir tout le contexte projet, puis dis-moi
ce que tu as compris en 5 lignes max.

État actuel : Sprint 2 vient d'être déployé sur Render (commit 70fcc59).
Les 4 nouveaux onglets sur la page détail chantier sont Journal, Médias,
Mémos, Documents. Je dois encore les tester en production sur les 3 rôles
(admin, technicien, client).

Prochaine étape pressentie : Sprint 3 = Interventions (planning,
compte-rendu, signature client, génération PDF du rapport). Mais avant
de coder, j'aimerais qu'on cadre le scope ensemble.

Avant de proposer quoi que ce soit :
1. Lis CLAUDE.md
2. Jette un œil à docs/architecture-techfield.md (section interventions)
3. Regarde server/routers/management.ts pour voir si un sous-routeur
   `interventions` existe déjà ou pas

Puis pose-moi les questions de cadrage Sprint 3 que tu juges importantes
(périmètre minimal, signature obligatoire ou optionnelle, format PDF,
notifications, etc.).
```

---

## 5. Différences pratiques Cowork → Claude Code

| Action | Cowork mode | Claude Code |
|---|---|---|
| Lire/éditer fichiers | Outils virtuels via `/sessions/...` | Filesystem natif `~/Desktop/Techfield/...` |
| Lancer un test | Décrire à Claude | Claude lance `pnpm test` directement |
| Git push | Léo le fait en CLI | Léo le fait en CLI (inchangé — sécurité) |
| Migrations Supabase | MCP via Cowork | MCP à reconfigurer dans Claude Code |
| Présentations / Word / PDF | Cowork (skills natifs) | Pas disponible → garder Cowork pour ça |
| Coût/token | Plus élevé (surcouche) | Réduit (focalisé code) |

## 6. Quand revenir sur Cowork mode

- Quand tu as besoin de **créer un livrable bureautique** (présentation client, devis Word, rapport PDF formaté).
- Quand tu fais des **recherches web** poussées ou des intégrations Canva/Indeed/etc.
- Quand tu veux que je gère un workflow **multi-domaines** (admin + design + dev en même temps).

## 7. Workflow recommandé sprint après sprint

1. Cadrage avec moi (Cowork ou Claude Code) — décider scope précis.
2. Implémentation backend dans Claude Code (Sonnet) — migration SQL + helpers + procédures tRPC.
3. Push backend + apply migration (toi en CLI + MCP Supabase).
4. Implémentation frontend dans Claude Code (Sonnet) — composants + wiring.
5. `pnpm check && pnpm test` avant commit.
6. Push frontend → Render auto-deploy.
7. Tests runtime sur Render (admin + technicien + client).
8. Cocher le sprint dans `todo.md` et `CLAUDE.md` (section 11).

Bonne migration ! 🚀
