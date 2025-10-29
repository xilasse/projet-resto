# Application de Gestion de Restaurant

Une application complète pour gérer un restaurant avec QR codes, gestion des stocks, et système de commandes.

## Fonctionnalités

### 🍽️ Gestion du Menu
- Ajout/modification/suppression de plats
- Catégorisation des plats (entrées, plats, desserts, boissons)
- Gestion des prix et descriptions
- Upload d'images pour les plats

### 📱 Interface Client (QR Code)
- Menu interactif accessible via QR code
- Filtrage par catégories
- Panier de commandes
- Système de paiement intégré (simulation)

### 🗺️ Gestion des Tables
- Disposition visuelle des tables
- Génération automatique de QR codes
- Déplacement des tables par glisser-déposer
- Statut des tables (libre/occupée)

### 📋 Gestion des Commandes
- Suivi en temps réel des commandes
- Workflow de préparation (attente → préparation → prête → servie)
- Affichage par table

### 📊 Gestion des Stocks
- Suivi automatique des stocks
- Alertes de stock faible
- Ajustements manuels des quantités
- Historique des mouvements

## Structure du Projet

```
restaurant-management-app/
├── server/                 # Backend Node.js
│   ├── index.js           # Serveur principal
│   ├── package.json       # Dépendances backend
│   └── public/            # Fichiers statiques
├── client/                # Frontend
│   ├── html/              # Fichiers HTML
│   │   ├── index.html     # Interface d'administration
│   │   └── client-menu.html # Menu client (QR code)
│   ├── css/               # Styles
│   │   ├── style.css      # Styles administration
│   │   └── client-style.css # Styles client
│   ├── js/                # JavaScript
│   │   ├── app.js         # Application principale
│   │   └── client-menu.js # Application client
│   └── assets/            # Images et ressources
└── package.json           # Scripts de gestion du projet
```

## Installation

1. **Cloner le projet**
   ```bash
   git clone [url-du-repo]
   cd restaurant-management-app
   ```

2. **Installer les dépendances**
   ```bash
   npm run install-all
   ```

3. **Démarrer l'application**
   ```bash
   npm start
   ```

   Ou démarrer séparément :
   ```bash
   # Terminal 1 - Backend
   npm run server

   # Terminal 2 - Frontend (si nécessaire)
   npm run client
   ```

## Utilisation

### Interface d'Administration
Accédez à `http://localhost:5000/client/html/index.html`

1. **Gestion du Menu** : Ajoutez vos plats avec prix, descriptions et images
2. **Disposition des Tables** : Créez et positionnez vos tables
3. **Suivi des Commandes** : Gérez le workflow des commandes
4. **Gestion des Stocks** : Surveillez et ajustez vos stocks

### Interface Client (QR Code)
1. Créez une table dans l'interface d'administration
2. Double-cliquez sur la table pour afficher son QR code
3. Les clients scannent le QR code pour accéder au menu
4. URL directe : `http://localhost:5000/menu/[numéro-table]`

## Technologies Utilisées

### Backend
- **Node.js** avec Express.js
- **SQLite** pour la base de données
- **QRCode** pour la génération des QR codes
- **CORS** pour les requêtes cross-origin

### Frontend
- **HTML5** / **CSS3** / **JavaScript Vanilla**
- **CSS Grid** et **Flexbox** pour les layouts
- **Fetch API** pour les requêtes HTTP
- **Responsive Design** pour mobile et desktop

## API Endpoints

### Menu
- `GET /api/menu` - Récupérer tous les plats
- `POST /api/menu` - Ajouter un plat
- `PUT /api/menu/:id` - Modifier un plat
- `DELETE /api/menu/:id` - Supprimer un plat

### Tables
- `GET /api/tables` - Récupérer toutes les tables
- `POST /api/tables` - Créer une table
- `PUT /api/tables/:id/position` - Mettre à jour la position
- `GET /api/table/:tableNumber` - Informations d'une table

### Commandes
- `GET /api/orders` - Récupérer toutes les commandes
- `POST /api/orders` - Créer une commande
- `PUT /api/orders/:id/status` - Mettre à jour le statut

## Base de Données

L'application utilise SQLite avec les tables suivantes :

- **tables** : Informations des tables et QR codes
- **menu_items** : Plats du menu avec stocks
- **orders** : Commandes des clients
- **stock_movements** : Historique des mouvements de stock

## Fonctionnalités Avancées

### Gestion des Stocks
- Décompte automatique lors des commandes
- Alertes visuelles (rouge = rupture, orange = stock faible)
- Historique des mouvements

### Interface Responsive
- Optimisé pour tablettes et smartphones
- Navigation tactile pour les serveurs
- Interface client adaptée aux mobiles

### Système de Paiement
- Simulation de différentes méthodes de paiement
- Intégration future possible avec Stripe
- Confirmation et suivi des paiements

## Développement Futur

- [ ] Intégration Stripe pour vrais paiements
- [ ] Notifications push pour les serveurs
- [ ] Rapports et statistiques
- [ ] Gestion multi-restaurant
- [ ] Application mobile native
- [ ] Impression des tickets de caisse

## Support

Pour toute question ou problème, consultez les logs du serveur ou créez une issue dans le repository.

## Licence

MIT License - Voir le fichier LICENSE pour plus de détails.