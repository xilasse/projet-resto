# Restaurant Management App

Application complète de gestion de restaurant avec QR codes, gestion des stocks et système de commandes.

## 🚀 Déploiement sur Railway

Cette application est configurée pour être déployée sur Railway.

### Variables d'environnement nécessaires

**Pour le développement local :**
- `MYSQL_HOST`: Hôte MySQL (localhost)
- `MYSQL_USER`: Utilisateur MySQL (root)
- `MYSQL_PASSWORD`: Mot de passe MySQL
- `MYSQL_DATABASE`: Nom de la base (restaurant_db)
- `PORT`: Port du serveur (5000)
- `NODE_ENV`: Environnement (development/production)

**Pour la production :**
- `DATABASE_URL`: URL complète MySQL (recommandé)
- `PORT`: Port du serveur (automatiquement défini)
- `NODE_ENV`: production

### 📁 Structure du projet

```
projet-resto/
├── server/           # Backend Node.js/Express
│   ├── index.js      # Point d'entrée principal
│   ├── public/       # Fichiers statiques (HTML, CSS, JS client)
│   └── package.json  # Dépendances backend
├── client/           # Assets client (HTML, CSS, JS)
└── package.json      # Configuration principale
```

### 🛠️ Technologies utilisées

- **Backend**: Node.js, Express.js, MySQL2
- **Frontend**: HTML5, CSS3, JavaScript Vanilla
- **Base de données**: MySQL
- **QR Codes**: qrcode library
- **Sessions**: express-session
- **Authentification**: bcryptjs
- **Validation**: express-validator

### 📋 Fonctionnalités

- ✅ Gestion des tables avec QR codes
- ✅ Menu dynamique par catégories
- ✅ Système de commandes en temps réel
- ✅ Gestion des allergies détaillée
- ✅ Suivi des stocks et ingrédients
- ✅ Interface client responsive
- ✅ Tableau de bord administrateur

### 🔧 Installation locale

**Prérequis :**
- Node.js (v14+)
- MySQL Server

**Étapes :**

1. **Installer les dépendances**
```bash
cd server
npm install
```

2. **Configurer MySQL**
```sql
CREATE DATABASE restaurant_db;
```

3. **Variables d'environnement**
```bash
# Copier le template
cp server/.env.example server/.env

# Éditer avec vos paramètres MySQL
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=votre_password
MYSQL_DATABASE=restaurant_db
```

4. **Démarrer l'application**
```bash
npm start
```

L'application sera accessible sur `http://localhost:5000`

### 🌐 Déploiement

**Railway (recommandé) :**

1. Connectez votre repository à Railway
2. Ajoutez une base de données MySQL
3. Configurez `DATABASE_URL` dans les variables d'environnement
4. Le déploiement se lance automatiquement

**Variables Railway :**
- `DATABASE_URL` : URL MySQL fournie par Railway
- `NODE_ENV` : production

### 📱 Utilisation

1. **Admin**: Accédez à `/` pour la gestion
2. **Client**: Scannez le QR code de votre table
3. **Commandes**: Interface temps réel pour les commandes

---

*Déployé avec ❤️ sur [Railway](https://railway.app)*