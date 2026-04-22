# Architecture fonctionnelle et modèle de données Techfield

## Vision produit

Techfield est une application de gestion destinée aux entreprises du bâtiment et de la maintenance. La première version reconstruite est pensée comme une **application web responsive**, utilisable aussi bien au bureau que sur mobile par les techniciens terrain. Le produit doit centraliser les données des **clients**, **sites**, **chantiers**, **contrats d’entretien**, **interventions**, **documents** et **ressources humaines**, tout en offrant un pilotage clair de l’activité opérationnelle.

L’ancienne version du projet montrait déjà une base métier structurée autour des chantiers, des contrats, du suivi des heures, des techniciens et d’un accès mobile simplifié pour le terrain. La reconstruction conserve cette logique métier, mais la réorganise dans une architecture plus robuste, plus sécurisée et plus évolutive.

## Architecture cible

| Domaine | Décision retenue | Raison |
|---|---|---|
| Frontend | Application React avec interface dashboard responsive | Permet une expérience fluide desktop et mobile sur une base unique |
| Backend | Serveur Express avec procédures typées | Structure claire pour la logique métier et les contrôles d’accès |
| Base de données | Base relationnelle avec schéma normalisé | Cohérence des données, historisation et requêtes métier fiables |
| Authentification | Authentification intégrée avec gestion de rôles applicatifs | Sécurise les accès selon les profils métier |
| Stockage fichiers | Stockage objet pour documents et photos, métadonnées en base | Évite de stocker des fichiers binaires dans la base |
| Expérience mobile | Interface responsive prioritaire pour les vues technicien | Répond au besoin terrain sans maintenir deux socles distincts au départ |

## Rôles métiers

| Rôle | Périmètre principal | Accès attendu |
|---|---|---|
| Admin | Pilotage global et paramétrage | Accès complet à tous les modules et aux indicateurs |
| Technicien | Exécution opérationnelle | Consultation de ses interventions, chantiers affectés, disponibilités, documents et comptes-rendus |
| Client | Consultation limitée | Accès restreint à ses sites, contrats, interventions et documents autorisés |

La gestion de rôle doit être portée par la table des utilisateurs applicatifs, avec séparation entre l’identité technique de connexion et les permissions métier. Le système devra permettre plus tard l’ajout de rôles complémentaires comme chef d’équipe ou coordinateur, sans casser le modèle existant.

## Modules fonctionnels de la V1

| Module | Contenu fonctionnel |
|---|---|
| Tableau de bord | Indicateurs, alertes, activités récentes, échéances proches |
| Clients | Fiches clients, contacts, informations administratives |
| Sites | Sites d’intervention liés à un client, adresses, contraintes d’accès |
| Chantiers | Création, planification, avancement, équipes affectées, historique |
| Contrats d’entretien | Références, périodicité, échéances, renouvellements, alertes |
| Interventions | Planification, assignation, compte-rendu, rattachement chantier ou contrat |
| Techniciens | Profils, compétences, disponibilités, charge et affectations |
| Calendrier | Vue consolidée des interventions et maintenances planifiées |
| Documents | Dépôt et consultation de photos, rapports et pièces jointes |

## Modèle de données métier

Le modèle de données est organisé autour d’un socle de référence partagé, puis de tables opérationnelles. Les utilisateurs, clients et sites forment la base relationnelle sur laquelle se rattachent les activités de terrain.

| Entité | Rôle métier | Relations principales |
|---|---|---|
| users | Comptes applicatifs et rôles | 1 utilisateur peut être lié à un profil technicien ou client |
| technicians | Profil métier technicien | lié à un user, affecté à plusieurs chantiers et interventions |
| clients | Entreprises ou particuliers clients | possède plusieurs sites, contrats et chantiers |
| client_contacts | Contacts opérationnels et administratifs | rattachés à un client ou à un site |
| sites | Lieux d’exécution | rattachés à un client, support de chantiers, contrats et interventions |
| projects | Chantiers | rattachés à un client et un site |
| project_assignments | Affectations chantier | relie chantiers et techniciens/équipes |
| maintenance_contracts | Contrats d’entretien | rattachés à un client et éventuellement à un site |
| interventions | Interventions planifiées ou réalisées | rattachées à un chantier ou à un contrat |
| technician_availability | Disponibilités et indisponibilités | rattachées aux techniciens |
| documents | Métadonnées documentaires | rattachées à un chantier, contrat, site ou intervention |
| activity_logs | Historique métier | journal d’événements sur les objets clés |

## Relations métier structurantes

| Source | Cible | Type de relation | Finalité |
|---|---|---|---|
| client | site | un-à-plusieurs | Un client peut posséder plusieurs sites |
| client | project | un-à-plusieurs | Un client peut avoir plusieurs chantiers |
| site | project | un-à-plusieurs | Un chantier se déroule sur un site |
| client | maintenance_contract | un-à-plusieurs | Un client peut avoir plusieurs contrats |
| site | maintenance_contract | un-à-plusieurs | Un contrat peut couvrir un site précis |
| project | intervention | un-à-plusieurs | Les interventions chantier sont historisées |
| maintenance_contract | intervention | un-à-plusieurs | Les maintenances planifiées ou curatives sont historisées |
| technician | intervention | un-à-plusieurs | Un technicien peut réaliser plusieurs interventions |
| technician | project_assignment | un-à-plusieurs | Un technicien peut être affecté à plusieurs chantiers |
| any business record | document | un-à-plusieurs | Chaque objet métier peut embarquer des pièces jointes |

## Principes de sécurité et d’autorisation

Les données doivent être filtrées selon le rôle métier et, pour certains usages, selon le rattachement métier. Un administrateur dispose d’un accès global. Un technicien ne voit que ses affectations, ses interventions, les documents autorisés et les informations nécessaires à l’exécution. Un client ne voit que ses propres contrats, ses sites, les interventions liées et les documents explicitement partagés.

Le backend doit donc centraliser les contrôles d’accès dans les procédures serveur plutôt que dans l’interface seule. L’interface masque des fonctions, mais la sécurité réelle doit être imposée côté serveur.

## Orientation UX

L’application adoptera une **interface dashboard premium**, sobre et crédible, avec hiérarchie visuelle claire, cartes de synthèse, tableaux lisibles et navigation persistante. Sur mobile, les vues terrain privilégieront la rapidité d’usage, la lisibilité des informations essentielles et l’accès direct aux actions de saisie, de photo et de compte-rendu.

## Priorités de construction

| Priorité | Livrable |
|---|---|
| P1 | Schéma de données, rôles, authentification, autorisations |
| P2 | Modules clients, sites, chantiers, contrats et interventions |
| P3 | Tableau de bord, calendrier, documents et expérience mobile |
| P4 | Tests, validation et préparation à l’extension future |
