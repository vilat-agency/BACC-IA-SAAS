# Bac IA

Plateforme éducative avec IA qui résout et rédige des problèmes comme une copie de Terminale pour le Baccalauréat, avec comptes utilisateurs et historique persistant (MongoDB).

## Fonctionnalités

- Génération d'une copie d'examen (Markdown + LaTeX + schémas SVG) à partir d'un énoncé ou d'un fichier joint (PDF/image), via l'API Gemini.
- Rendu "copie manuscrite" (lignes classiques ou papier millimétré) exportable en PDF.
- Comptes utilisateurs (inscription / connexion par email + mot de passe) et historique des copies sauvegardé par compte dans MongoDB.

## Architecture

```
src/                 Frontend React (Vite)
server.ts            Point d'entrée du serveur Express
server/
  db.ts              Connexion MongoDB (mongoose)
  models/            Schémas User et History
  middleware/auth.ts Vérification du token JWT
  routes/            Routes /api/auth, /api/history, /api/solve
```

## Lancer le projet en local

**Prérequis :** Node.js 18+, une base MongoDB (locale, Docker, ou Atlas gratuit).

1. Installer les dépendances :
   ```bash
   npm install
   ```
2. Copier `.env.example` vers `.env` et renseigner :
   - `GEMINI_API_KEY` : clé de l'API Gemini.
   - `MONGODB_URI` : URI de connexion MongoDB (ex. `mongodb://localhost:27017/bac-ia`).
   - `JWT_SECRET` : chaîne aléatoire longue (voir la commande suggérée dans `.env.example`).
3. Lancer l'app :
   ```bash
   npm run dev
   ```
   L'application est disponible sur http://localhost:3000.

## Déploiement sur Railway

1. **Créer le service web**
   - Sur [railway.app](https://railway.app), créer un nouveau projet à partir de ce dépôt Git.
   - Railway détecte automatiquement Node.js et utilise les scripts `build` / `start` du `package.json`.

2. **Ajouter une base MongoDB**
   - Dans le même projet Railway : "New" → "Database" → "Add MongoDB" (ou utiliser un cluster MongoDB Atlas externe).
   - Railway génère une variable `MONGO_URL` (ou équivalent) : copier cette valeur.

3. **Configurer les variables d'environnement du service web**
   - `GEMINI_API_KEY` : votre clé API Gemini.
   - `MONGODB_URI` : coller l'URI de connexion MongoDB obtenue à l'étape précédente.
   - `JWT_SECRET` : une chaîne aléatoire longue et secrète.
   - `NODE_ENV=production`.
   - Ne pas définir `PORT` manuellement : Railway l'injecte automatiquement et le serveur l'utilise déjà (`process.env.PORT`).

4. **Build & démarrage**
   - Build command (par défaut, déjà dans `package.json`) : `npm run build`
   - Start command : `npm start`

5. Une fois déployé, Railway fournit une URL publique (`https://votre-app.up.railway.app`) sur laquelle l'application, l'authentification et l'historique MongoDB sont immédiatement fonctionnels.

## Notes

- Sans `MONGODB_URI` valide, l'inscription/connexion et l'historique renvoient une erreur explicite (503) mais le reste de l'app ne plante pas.
- Les mots de passe sont hashés avec bcrypt ; jamais stockés en clair.
- Le token de session est un JWT valable 30 jours, stocké côté client dans `localStorage`.
