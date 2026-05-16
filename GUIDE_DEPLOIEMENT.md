# TMPB — Guide de déploiement Vercel

## Ce que tu vas faire (30-45 min)

1. Créer un compte GitHub et uploader le projet
2. Créer un compte Vercel et connecter GitHub
3. Créer une base de données (Vercel KV — gratuit)
4. Ajouter tes clés secrètes
5. C'est en ligne !

---

## ÉTAPE 1 — Préparer le projet sur GitHub

1. Va sur **github.com** et crée un compte (gratuit)
2. Clique sur **"New repository"** (bouton vert)
3. Nomme-le `tmpb-design` — laisse tout le reste par défaut — clique **"Create repository"**
4. Sur la page qui s'ouvre, clique **"uploading an existing file"**
5. Glisse-dépose **tous les fichiers du dossier `tmpb`** que tu as téléchargé :
   - `vercel.json`
   - `package.json`
   - Le dossier `api/` (avec `cron.js`, `feed.js`, `archive.js`)
   - Le dossier `public/` (avec `index.html`)
6. Clique **"Commit changes"**

---

## ÉTAPE 2 — Créer le projet sur Vercel

1. Va sur **vercel.com** → "Sign up" → connecte-toi avec ton compte GitHub
2. Clique **"Add New Project"**
3. Sélectionne ton repo `tmpb-design`
4. Vercel détecte automatiquement la config — clique juste **"Deploy"**
5. Attends 1-2 minutes → ton site est en ligne à une URL genre `tmpb-design.vercel.app`

---

## ÉTAPE 3 — Créer la base de données (Vercel KV)

C'est ici que les projets du jour seront stockés.

1. Dans ton projet Vercel, va dans l'onglet **"Storage"**
2. Clique **"Create Database"** → choisis **"KV"** (Redis)
3. Nomme-la `tmpb-kv` → clique **"Create"**
4. Vercel va te demander de connecter cette base à ton projet → clique **"Connect"**
5. Les variables d'environnement `KV_REST_API_URL` et `KV_REST_API_TOKEN` sont automatiquement ajoutées ✓

---

## ÉTAPE 4 — Ajouter tes clés secrètes

1. Dans ton projet Vercel, va dans **"Settings"** → **"Environment Variables"**
2. Ajoute ces deux variables :

   **Variable 1 :**
   - Name : `OPENAI_API_KEY`
   - Value : ta clé OpenAI (commence par `sk-...`)

   **Variable 2 :**
   - Name : `CRON_SECRET`
   - Value : n'importe quelle suite de caractères (ex: `tmpb2024supersecret`)

3. Clique **"Save"** pour chaque variable
4. Va dans **"Deployments"** → clique les **"..."** sur le dernier déploiement → **"Redeploy"**

---

## ÉTAPE 5 — Tester que tout fonctionne

1. Ouvre ton site : `https://tmpb-design.vercel.app`
   → Tu dois voir le site (vide pour l'instant, c'est normal)

2. Pour déclencher manuellement le premier fetch (sans attendre minuit) :
   Va sur `https://tmpb-design.vercel.app/api/cron` dans ton navigateur
   → Tu dois voir `{"success":true,"count":10,...}`

3. Recharge ton site → les 10 projets apparaissent !

---

## Comment ça fonctionne ensuite

- **Chaque nuit à minuit** : Vercel appelle automatiquement `/api/cron`
- Le cron fetch 10 nouveaux projets via OpenAI et les stocke
- **Toi et tes amis** : vous visitez le site, qui lit juste ce qui est en base
- **Zéro coût supplémentaire** pour les visites — seulement le cron de minuit coûte ~$0.02/jour

---

## En cas de problème

- Vercel → onglet **"Functions"** → logs en temps réel
- Vercel → onglet **"Cron Jobs"** → voir si le cron tourne bien
