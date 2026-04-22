# Guide d’exécution Supabase pour Techfield

Ce kit a été préparé pour vous permettre d’installer la base **Techfield** dans **Supabase** sans connexion directe de ma part à votre projet. L’objectif est de réduire le risque d’erreur en séparant les scripts en plusieurs blocs, avec un ordre d’exécution simple et vérifiable.

| Étape | Fichier | Rôle | Où le coller |
| --- | --- | --- | --- |
| 1 | `supabase/sql/01_techfield_schema.sql` | Crée les types PostgreSQL, les tables métier, les index et les triggers `updated_at` | SQL Editor |
| 2 | `supabase/sql/02_techfield_storage.sql` | Crée et configure le bucket Supabase Storage pour les documents Techfield | SQL Editor |
| 3 | `supabase/sql/03_techfield_verify.sql` | Vérifie que les tables, types et bucket existent bien | SQL Editor |

## Ordre exact d’exécution

Vous devez ouvrir votre projet Supabase, puis aller dans **SQL Editor**. Commencez par exécuter le fichier `01_techfield_schema.sql`. Attendez la confirmation complète de succès avant de passer à la suite. Une fois ce premier script terminé, exécutez `02_techfield_storage.sql`. Enfin, exécutez `03_techfield_verify.sql` pour contrôler le résultat.

| Ordre | Action attendue | Résultat normal |
| --- | --- | --- |
| 1 | Lancer `01_techfield_schema.sql` | Création du schéma métier complet Techfield |
| 2 | Lancer `02_techfield_storage.sql` | Création ou mise à jour du bucket `techfield-documents` |
| 3 | Lancer `03_techfield_verify.sql` | Retour de listes de tables, types et bucket présents |

## Ce que crée le schéma

Le script principal crée les blocs métiers actuellement utilisés dans l’application. Cela comprend les **utilisateurs**, **clients**, **contacts clients**, **sites**, **techniciens**, **chantiers**, **affectations chantier**, **contrats d’entretien**, **interventions**, **disponibilités**, **documents** et **journaux d’activité**. Les champs ont été convertis vers une structure **PostgreSQL/Supabase** cohérente, avec des identifiants `bigint generated always as identity`, des dates métier en `date` quand cela a du sens, et des dates d’exécution en `timestamptz` pour éviter les ambiguïtés de fuseau horaire.

## Ce que fait le script de stockage

Le second script crée un bucket privé nommé `techfield-documents`. Il est prévu pour accueillir les documents métier, comme les **rapports**, **photos**, **contrats** ou **bons d’intervention**. Le script ne crée pas encore de politiques d’accès fines, afin d’éviter d’introduire des erreurs tant que la stratégie finale d’authentification entre **Vercel**, **Supabase** et l’application n’est pas complètement figée.

> En pratique, ce choix est volontairement prudent : il vaut mieux installer une base et un stockage propres, puis ajouter les politiques d’accès dans un second temps, plutôt que de bloquer la création initiale avec des règles trop tôt ou mal branchées.

## Vérification après exécution

Après l’exécution des trois scripts, le résultat attendu est simple. Vous devez voir dans le résultat du script `03_techfield_verify.sql` l’ensemble des tables principales de Techfield, les types PostgreSQL personnalisés, ainsi que le bucket `techfield-documents`.

| Contrôle | Ce que vous devez voir |
| --- | --- |
| Tables | `users`, `clients`, `client_contacts`, `sites`, `technicians`, `projects`, `project_assignments`, `maintenance_contracts`, `interventions`, `technician_availability`, `documents`, `activity_logs` |
| Types | Les enums métier comme `user_role`, `project_status`, `contract_status`, `intervention_status`, etc. |
| Storage | Le bucket `techfield-documents` |

## Organisation cible du code entre Vercel et Supabase

Pour respecter votre demande de séparation claire, l’architecture cible doit distinguer sans ambiguïté la partie **application** et la partie **données**.

| Bloc | Responsabilité |
| --- | --- |
| Frontend / App Vercel | Interface utilisateur, navigation, composants, appels API, expérience mobile |
| API applicative | Logique métier, validation, orchestration des flux, sécurité côté serveur |
| SQL Supabase | Schéma, migrations, index, procédures SQL éventuelles |
| Storage Supabase | Fichiers, photos, rapports, contrats scannés, métadonnées de stockage |

Dans cette logique, l’application ne doit pas mélanger les requêtes SQL brutes, la logique métier et la gestion de fichiers dans les mêmes modules. Les requêtes SQL et la structure de données doivent vivre dans une couche dédiée Supabase, tandis que les composants et les parcours utilisateur restent du côté application. C’est précisément ce découpage qui permettra ensuite de rendre Techfield plus propre à déployer sur **Vercel**.

## Recommandations de prudence

N’exécutez pas ces scripts sur un projet Supabase contenant déjà des tables homonymes actives sans sauvegarde préalable. Même si les scripts ont été rendus aussi prudents que possible, ils ont été pensés pour poser la base de **Techfield** proprement, pas pour fusionner automatiquement un existant inconnu. Si votre projet Supabase est vierge, l’exécution est beaucoup plus simple et beaucoup plus sûre.

## Suite logique

Une fois ces scripts exécutés avec succès, la prochaine étape sera de **brancher le code applicatif sur Supabase**, puis d’**isoler ce qui dépend encore de l’environnement actuel** pour le rendre compatible avec un déploiement sur **Vercel**. À ce moment-là, je pourrai vous préparer la structure de code suivante : une couche d’accès **Supabase SQL**, une couche **Supabase Storage**, et une couche **application Vercel** clairement séparées.
