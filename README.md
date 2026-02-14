Outil interne de visualisation de données : posez une question en langage naturel, obtenez du SQL exécuté sur PostgreSQL et affichez les résultats en **tableau**, **courbe (line)**, **barres** ou **camembert**. Sauvegarde de rapports pour réutilisation.

---

## Prérequis

- **Node.js** ≥ 20
- **pnpm** 9+ ([installation](https://pnpm.io/installation))
- **Docker** (pour PostgreSQL et un LLM local)

---

## Installation pas à pas

### 1. Cloner le projet et installer les dépendances

```bash
cd /chemin/vers/test
pnpm install
```

Toutes les dépendances du monorepo (API NestJS + frontend Next.js) sont installées.

---

### 2. Lancer PostgreSQL avec Docker

Sans PostgreSQL installé sur la machine, le plus simple est d’utiliser Docker :

```bash
docker run -d --name clinic-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=clinic \
  -p 5432:5432 \
  postgres:16
```

- La base `clinic` est créée automatiquement.
- Identifiants : utilisateur `postgres`, mot de passe `postgres`, port `5432`.

Vérifier que le conteneur tourne :

```bash
docker ps
```

---

### 3. Configurer les variables d’environnement

Créer un fichier **`.env`** à la **racine du projet** ou dans **`apps/api/.env`** (l’API charge les deux).

**Utiliser un LLM dans Docker (Ollama)** — sans crédits OpenAI :

```bash
docker run -d -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama
docker exec -it ollama ollama pull llama3.2
```

Puis dans `.env` :

```env
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_MODEL=llama3.2
OPENAI_API_KEY=ollama
```

**Autres variables optionnelles :**

```env
PORT=4000
CORS_ORIGIN=http://localhost:3000
```

---

### 4. Créer les tables et remplir la base

À la **racine du projet** :

```bash
# Appliquer le schéma (tables organizations, facilities, doctors, patients, visits, insurances, saved_reports)
pnpm db:migrate

# Remplir avec des données de démo (1 org, 2 établissements, 8 médecins, 12 patients, assurances, ~250+ visites)
pnpm db:seed
```

**Réinitialiser la base puis re-remplir :**

```bash
pnpm --filter api db:reset:seed
```

---

### 5. Lancer l’application

Ouvrir **deux terminaux** à la racine du projet.

**Terminal 1 — API (NestJS) :**

```bash
pnpm dev:api
```

→ API disponible sur **http://localhost:4000**

**Terminal 2 — Frontend (Next.js) :**

```bash
pnpm dev:web
```

→ Interface sur **http://localhost:3000**

Ouvrir **http://localhost:3000** dans le navigateur : zone de question, choix du type de vue (table / barres / camembert), sauvegarde de rapports, sidebar des rapports, toggle « Stats DB » pour voir les effectifs en base.

---

## Résumé des commandes

| Commande | Description |
|----------|-------------|
| `pnpm install` | Installer les dépendances (à la racine) |
| `pnpm dev:api` | Démarrer l’API en mode watch |
| `pnpm dev:web` | Démarrer le frontend en dev |
| `pnpm db:migrate` | Appliquer les migrations (créer les tables) |
| `pnpm db:seed` | Remplir la base avec les données de démo |
| `pnpm --filter api db:reset` | Vider toutes les tables et réinitialiser les séquences |
| `pnpm --filter api db:reset:seed` | Reset + seed en une commande |
| `pnpm --filter api db:studio` | Ouvrir Drizzle Studio sur la base |
| `pnpm build` | Build de l’API et du frontend |

---

## Comment ça marche

1. **Frontend (Next.js + React)**  
   L’utilisateur saisit une question en langage naturel (ex. « Liste des médecins », « Nombre de visites par patient »).

2. **API (NestJS)**  
   La question est envoyée à un **LLM** (OpenAI ou Ollama via `OPENAI_BASE_URL`) qui renvoie une requête SQL.

3. **Sécurité**  
   Seuls les **SELECT** sont autorisés. Les requêtes contenant `DROP`, `TRUNCATE`, `DELETE`, `INSERT`, `UPDATE`, etc. sont refusées.

4. **Base de données**  
   Le SQL est exécuté sur PostgreSQL (Drizzle). Le résultat (colonnes + lignes) est renvoyé au frontend.

5. **Affichage**  
   Le frontend affiche les données en **table**, **courbe (line)**, **barres** ou **camembert**, avec possibilité de **sauvegarder le rapport** (nom + requête + type de vue). Le toggle **Stats DB** affiche les effectifs en base (médecins, patients, visites, etc.) pour vérifier la cohérence des résultats.

---

## Règles et comportement

### Règles envoyées au LLM (schema context)

Le prompt système contient :

- **Schéma PostgreSQL** : tables (organizations, facilities, doctors, patients, insurances, visits), colonnes et relations (clés étrangères).
- **Vocabulaire** : mapping des notions du domaine vers le schéma (établissement / facility / hospital → `facilities`, médecin → `doctors`, visite → `visits`, assurance → `insurances`, diagnostic / raison → `visits.diagnosis` / `visits.reason`). Le LLM doit utiliser les bonnes tables pour les concepts demandés.
- **Règles critiques** : alias obligatoires (o, f, d, p, i, v), pas de `d.name`/`p.name` (utiliser `first_name || ' ' || last_name`), agrégats dans HAVING pas dans WHERE, « un row par X avec le Y qui a le plus de Z » → CTE + `ROW_NUMBER()`, listes (diagnostics, raisons) → inclure la colonne concernée dans le SELECT, etc.

### Corrections automatiques (post-traitement)

Après génération du SQL, une série de **correctifs** est appliquée (ordre fixe) : troncature au premier `;`, suppression des backticks, correction de virgules en trop, déplacement d’agrégats du WHERE vers le HAVING, ajout de GROUP BY pour EXTRACT(visit_date), correction d’ordres de JOIN (facilities/doctors/visits), et **réécriture** du pattern « GROUP BY établissement + patient + ORDER BY num_visits » en requête « un patient par établissement » (CTE + `ROW_NUMBER()`).

### Timeout (proxy)

Les appels du frontend vers l’API passent par une **route proxy** Next.js (`/api/proxy/*`) qui relaie vers l’API Nest (port 4000). Un **timeout de 2 minutes** (120 s) est appliqué à chaque requête proxy. Au-delà, le client reçoit une erreur **504** (timeout) au lieu d’un « socket hang up ». Cela évite les coupures de connexion lors d’appels LLM longs.

### Retry en cas d’erreur d’exécution SQL

Si l’exécution PostgreSQL échoue avec une erreur reconnue (ex. `missing FROM-clause entry`, `must appear in the GROUP BY`, `aggregate function`, `syntax error`, etc.), le service :

1. **Relance jusqu’à 3 fois** : à chaque tentative, une **nouvelle** génération SQL est demandée au LLM.
2. **Envoie l’erreur au LLM** : le message d’erreur PostgreSQL est ajouté au prompt (« This error occurred when executing the previous generated query… »), avec une extraction des **noms de colonnes / identifiants** mentionnés dans l’erreur, pour guider la correction.
3. **Log** : un message du type `Error LLM (execution): … Retry 1/3 (max 3)` est écrit dans les logs de l’API.

Les erreurs non reconnues (réseau, quota, etc.) ne déclenchent pas de retry et sont renvoyées telles quelles au client (en **400** via le filtre d’exception, pas en 500).

---

## Stack technique

- **Monorepo** : pnpm
- **Frontend** : React, Next.js, Tailwind CSS, Motion, Recharts, Lucide
- **Backend** : NestJS, Drizzle ORM
- **Base de données** : PostgreSQL
- **NL → SQL** : OpenAI ou Ollama (OPENAI_BASE_URL)

---

## Structure du repo

```
├── apps/
│   ├── api/              # NestJS (query, reports, stats, DB, seed, reset)
│   │   ├── src/
│   │   │   ├── db/       # Schéma Drizzle, seed, reset
│   │   │   ├── query/    # NL → SQL, exécution
│   │   │   ├── reports/  # CRUD rapports sauvegardés
│   │   │   └── stats/    # GET /stats (effectifs en base)
│   │   └── drizzle/     # Migrations SQL
│   └── web/              # Next.js (page unique, graphiques, sidebar, Stats DB)
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

---

## Limitations

- **NL → SQL** : Ollama, des formulations ambiguës peuvent produire un SQL incorrect.
- **Sécurité** : uniquement des `SELECT` ; pas d’authentification ni de rôles dans cette version.
- **Graphiques** : courbe, barres et camembert supposent des colonnes numériques ; la vue tableau reste la plus fiable pour tout type de résultat.

---

## Licence

Test technique.