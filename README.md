# Restaurant Management App

Application complète de gestion de restaurant avec QR codes, gestion des stocks et système de commandes.

## 🚀 Déploiement sur Railway

Cette application est configurée pour être déployée sur Railway.

### Variables d'environnement nécessaires

- `PORT`: Port du serveur (automatiquement défini par Railway)
- `NODE_ENV`: Environnement (production)

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

- **Backend**: Node.js, Express.js, SQLite3
- **Frontend**: HTML5, CSS3, JavaScript Vanilla
- **Base de données**: SQLite (intégrée)
- **QR Codes**: qrcode library
- **Paiements**: Stripe integration

### 📋 Fonctionnalités

- ✅ Gestion des tables avec QR codes
- ✅ Menu dynamique par catégories
- ✅ Système de commandes en temps réel
- ✅ Gestion des allergies détaillée
- ✅ Suivi des stocks et ingrédients
- ✅ Interface client responsive
- ✅ Tableau de bord administrateur

### 🔧 Installation locale

```bash
# Installer toutes les dépendances
npm run install-all

# Démarrer le serveur de développement
npm start
```

### 🌐 Déploiement

1. Connectez votre repository à Railway
2. Railway détectera automatiquement la configuration
3. Les variables d'environnement seront configurées automatiquement
4. Le déploiement se lance automatiquement

### 📱 Utilisation

1. **Admin**: Accédez à `/` pour la gestion
2. **Client**: Scannez le QR code de votre table
3. **Commandes**: Interface temps réel pour les commandes

---

*Déployé avec ❤️ sur [Railway](https://railway.app)*