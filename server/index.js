const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const { body, validationResult } = require('express-validator');

// Gestionnaire de base de données adaptatif MySQL
const { db, query, run, get } = require('./db-manager');

// Fonction pour générer un QR code pour une table
async function generateQRCodeForTable(tableId, tableNumber, restaurantId) {
  try {
    // URL que le QR code pointera (menu client avec table ID)
    const menuUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/client-menu.html?table=${tableId}&restaurant=${restaurantId}`;

    // Générer le QR code en base64
    const qrCodeDataURL = await QRCode.toDataURL(menuUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    console.log(`✅ QR code généré pour table ${tableNumber} (ID: ${tableId})`);
    return qrCodeDataURL;
  } catch (error) {
    console.error('Erreur génération QR code:', error);
    return null;
  }
}

const app = express();
const PORT = process.env.PORT || 5000;

// Configuration des sessions
app.use(session({
  secret: process.env.SESSION_SECRET || 'restaurant-secret-key-dev-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 heures
  },
  name: 'restaurant.sid'
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : true,
  credentials: true
}));
app.use(bodyParser.json());
app.use(express.static('../client'));

// Protection contre les erreurs non gérées
app.use((err, req, res, next) => {
  console.error('Erreur serveur:', err);
  res.status(500).json({ error: 'Erreur serveur interne' });
});

// Routes statiques pour toutes les pages HTML
app.get('/login.html', (req, res) => {
  res.sendFile('login.html', { root: '../client/html' });
});

app.get('/register.html', (req, res) => {
  res.sendFile('register.html', { root: '../client/html' });
});

app.get('/admin.html', (req, res) => {
  res.sendFile('admin.html', { root: '../client/html' });
});

app.get('/index.html', (req, res) => {
  res.sendFile('index.html', { root: '../client/html' });
});

app.get('/client-menu.html', (req, res) => {
  res.sendFile('client-menu.html', { root: '../client/html' });
});

app.get('/restaurant-selector.html', (req, res) => {
  res.sendFile('restaurant-selector.html', { root: '../client/html' });
});

// Route de test pour vérifier le déploiement
app.get('/api/version', (req, res) => {
  res.json({
    version: '3.0',
    commit: 'mysql-migration',
    database: 'MySQL',
    mysqlMigrationComplete: true,
    timestamp: new Date().toISOString()
  });
});

// Route pour diagnostiquer l'environnement
app.get('/api/debug/environment', (req, res) => {
  const envInfo = {
    database_type: 'MySQL',
    deployment_platform: 'Local',
    environment: {
      NODE_ENV: process.env.NODE_ENV || 'undefined',
      PORT: process.env.PORT || 'undefined',
      MYSQL_HOST: process.env.MYSQL_HOST || '[NON DÉFINIE]',
      MYSQL_USER: process.env.MYSQL_USER || '[NON DÉFINIE]',
      MYSQL_DATABASE: process.env.MYSQL_DATABASE || '[NON DÉFINIE]',
      DATABASE_URL: process.env.DATABASE_URL ? '[DÉFINIE]' : '[NON DÉFINIE]'
    },
    platform: process.platform,
    node_version: process.version,
    timestamp: new Date().toISOString()
  };

  console.log('🔍 Diagnostic environnement MySQL:', envInfo);
  res.json(envInfo);
});

// Middleware pour vérifier qu'un utilisateur est connecté
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentification requise' });
  }
  next();
};

// Redirection intelligente selon le rôle
app.get('/', (req, res) => {
  console.log('Route / appelée, session:', {
    userId: req.session.userId,
    userRole: req.session.userRole,
    sessionID: req.sessionID
  });

  if (!req.session.userId) {
    console.log('Pas d\'utilisateur en session, redirection vers login');
    return res.redirect('/login.html');
  }

  // Rediriger selon le rôle de l'utilisateur
  if (req.session.userRole === 'SUPER_ADMIN') {
    console.log('Redirection vers admin.html pour SUPER_ADMIN');
    return res.sendFile('admin.html', { root: '../client/html' });
  } else if (req.session.userRole === 'RESTAURATEUR') {
    if (!req.session.activeRestaurantId && req.session.restaurants && req.session.restaurants.length > 1) {
      console.log('Restaurateur avec plusieurs restaurants, redirection vers sélecteur');
      return res.sendFile('restaurant-selector.html', { root: '../client/html' });
    } else {
      console.log('Redirection vers index.html pour restaurateur');
      return res.sendFile('index.html', { root: '../client/html' });
    }
  } else if (req.session.userRole === 'MANAGER') {
    console.log('Redirection vers index.html pour manager');
    return res.sendFile('index.html', { root: '../client/html' });
  } else {
    console.log('Redirection vers index.html pour utilisateur normal');
    return res.sendFile('index.html', { root: '../client/html' });
  }
});

// Routes d'authentification
app.post('/api/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('restaurantName').notEmpty(),
  body('firstName').notEmpty(),
  body('lastName').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password, restaurantName, firstName, lastName, phone, address } = req.body;

  try {
    // Vérifier si l'email existe déjà
    const existingUser = await get('SELECT id FROM users WHERE email = ?', [email]);

    if (existingUser) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }

    // Hasher le mot de passe
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Créer le restaurant
    const restaurantResult = await run(
      'INSERT INTO restaurants (name, owner_name, email, password_hash, phone, address) VALUES (?, ?, ?, ?, ?, ?)',
      [restaurantName, `${firstName} ${lastName}`, email, hashedPassword, phone, address]
    );

    const restaurantId = restaurantResult.insertId;

    // Créer l'utilisateur restaurateur
    const userResult = await run(
      'INSERT INTO users (email, password_hash, first_name, last_name, phone, role) VALUES (?, ?, ?, ?, ?, ?)',
      [email, hashedPassword, firstName, lastName, phone, 'RESTAURATEUR']
    );

    const userId = userResult.insertId;

    // Lier l'utilisateur au restaurant
    await run(
      'INSERT INTO user_restaurants (user_id, restaurant_id, role) VALUES (?, ?, ?)',
      [userId, restaurantId, 'RESTAURATEUR']
    );

    // Créer la session
    req.session.userId = userId;
    req.session.userRole = 'RESTAURATEUR';
    req.session.userName = `${firstName} ${lastName}`;
    req.session.restaurants = [{ id: restaurantId, name: restaurantName, role: 'RESTAURATEUR' }];

    res.json({
      success: true,
      user: {
        id: userId,
        name: `${firstName} ${lastName}`,
        email,
        role: 'RESTAURATEUR'
      },
      restaurants: [{ id: restaurantId, name: restaurantName }]
    });

  } catch (error) {
    console.error('Erreur registration:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  console.log('Tentative de login MySQL pour:', email);

  try {
    const user = await get('SELECT * FROM users WHERE email = ? AND is_active = true', [email]);

    if (!user) {
      console.log('Aucun utilisateur trouvé pour:', email);
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    console.log('Utilisateur trouvé:', { id: user.id, email: user.email, role: user.role });

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    console.log('Vérification mot de passe:', { isValidPassword });

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Récupérer les restaurants associés (sauf pour Super Admin)
    if (user.role !== 'SUPER_ADMIN') {
      const restaurants = await query(`SELECT r.id, r.name, ur.role as user_role
              FROM restaurants r
              JOIN user_restaurants ur ON r.id = ur.restaurant_id
              WHERE ur.user_id = ?`, [user.id]);

      // Créer la session
      req.session.userId = user.id;
      req.session.userRole = user.role;
      req.session.userName = `${user.first_name} ${user.last_name}`;
      req.session.restaurants = restaurants;

      // Si l'utilisateur n'a qu'un seul restaurant, le définir comme actif
      if (restaurants.length === 1) {
        req.session.activeRestaurantId = restaurants[0].id;
        req.session.activeRestaurantName = restaurants[0].name;
        req.session.activeRestaurantRole = restaurants[0].user_role;
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          name: `${user.first_name} ${user.last_name}`,
          email: user.email,
          role: user.role
        },
        restaurants: restaurants
      });
    } else {
      // Super Admin - pas de restaurants
      req.session.userId = user.id;
      req.session.userRole = user.role;
      req.session.userName = `${user.first_name} ${user.last_name}`;
      req.session.restaurants = [];

      res.json({
        success: true,
        user: {
          id: user.id,
          name: `${user.first_name} ${user.last_name}`,
          email: user.email,
          role: user.role
        },
        restaurants: []
      });
    }
  } catch (error) {
    console.error('Erreur login MySQL:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route de déconnexion
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur lors de la déconnexion' });
    }
    res.json({ success: true });
  });
});

// Route de vérification de session
app.get('/api/check-auth', requireAuth, (req, res) => {
  res.json({
    authenticated: true,
    user: {
      id: req.session.userId,
      role: req.session.userRole,
      name: req.session.userName
    },
    restaurants: req.session.restaurants
  });
});

// Routes API basiques
app.get('/api/menu', requireAuth, async (req, res) => {
  try {
    const activeRestaurantId = req.session.activeRestaurantId;
    if (!activeRestaurantId) {
      return res.status(400).json({ error: 'Aucun restaurant sélectionné' });
    }

    const menu = await query('SELECT * FROM menu_items WHERE restaurant_id = ? ORDER BY category, name', [activeRestaurantId]);
    res.json(menu);
  } catch (error) {
    console.error('Erreur menu MySQL:', error);
    res.json([]);
  }
});

// API pour les restaurants
app.get('/api/my-restaurants', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const restaurants = await query(`
      SELECT r.id, r.name, r.email, r.phone, r.address, ur.role as user_role
      FROM restaurants r
      JOIN user_restaurants ur ON r.id = ur.restaurant_id
      WHERE ur.user_id = ?
      ORDER BY r.name
    `, [userId]);

    res.json(restaurants);
  } catch (error) {
    console.error('Erreur récupération restaurants MySQL:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur MySQL démarré sur le port ${PORT}`);
  console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💾 Base de données: MySQL`);
  console.log(`🎉 MIGRATION MYSQL COMPLETE - VERSION 3.0`);
});

module.exports = app;