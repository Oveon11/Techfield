## Diagnostic page vide du 24-04-2026

Observation de l’URL de production `https://techfield.vercel.app` après redéploiement du commit `d642577`.

| Constat | Détail |
| --- | --- |
| Rendu initial | L’application affiche uniquement un squelette pleine page, sans contenu métier visible. |
| Titre HTML | `Techfield Web` |
| Symptôme console | Rafale d’erreurs `Failed to load resource: the server responded with a status of 404 ()`. |
| Hypothèse principale | Le frontend reste bloqué car des appels API, assets ou endpoints runtime nécessaires au chargement répondent en 404 sur Vercel. |

| Ressource problématique | Observation |
| --- | --- |
| `/api/trpc/auth.me?...` | Appel répété vu dans le navigateur, répondant en 404 et maintenant l’interface à l’état squelette. |
| `/%VITE_ANALYTICS_ENDPOINT%/umami` | URL d’analytics non substituée injectée telle quelle dans le HTML, générant aussi une ressource invalide. |

Conclusion provisoire : la page n’est pas réellement vide. Le frontend démarre, mais il reste bloqué parce que le flux d’authentification demande `auth.me` sur `/api/trpc`, endpoint actuellement introuvable sur le domaine Vercel, tandis qu’une variable d’analytics non remplacée pollue aussi le chargement.

| Vérification complémentaire | Résultat |
| --- | --- |
| Recharge de `https://techfield.vercel.app` | Le squelette reste affiché durablement, ce n’est pas seulement un état transitoire de premier chargement. |
| Documentation Vercel sur Vite | Vercel indique qu’un projet Vite reste essentiellement statique et recommande Nitro ou un framework adapté pour ajouter un backend/SSR sur Vercel. |

Ces indices renforcent l’hypothèse que le front statique est bien servi, mais que la partie backend nécessaire au routeur tRPC n’est pas réellement exposée de manière compatible sur le déploiement actuel.

| Observation de production | Constat |
| --- | --- |
| Interface sur `https://techfield.vercel.app` | Le site reste bloqué sur le squelette de chargement, sans basculer vers l’écran de connexion ni vers le tableau de bord. |
| Console navigateur | Rafales continues d’erreurs `Failed to load resource: the server responded with a status of 404 ()`. |
| Endpoint tRPC vérifié manuellement | `https://techfield.vercel.app/api/trpc/auth.me?...` répond `404 NOT_FOUND` côté Vercel. |
| Interprétation | Le frontend est bien servi, mais les appels API requis par l’application ne sont pas exposés correctement sur le déploiement actuel, ce qui maintient le chargement en boucle. |

| Vérification réseau depuis la page vide | Résultat |
| --- | --- |
| Ressource analytics injectée | `https://techfield.vercel.app/%VITE_ANALYTICS_ENDPOINT%/umami` répond en 404, signe qu’un placeholder Vite n’est pas remplacé dans le HTML ou la config. |
| Requête tRPC groupée | `https://techfield.vercel.app/api/trpc/auth.me,management.dashboard.summary?...` répond en 404. |
| Requête tRPC auth simple | `https://techfield.vercel.app/api/trpc/auth.me?...` répond aussi en 404, et est relancée en boucle. |
| Conclusion affinée | La page vide résulte au moins de deux problèmes de production : l’API Vercel n’est pas exposée sur `/api/trpc`, et un placeholder analytics non résolu reste présent dans le frontend livré. |

