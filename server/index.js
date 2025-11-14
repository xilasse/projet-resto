const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const { body, validationResult } = require('express-validator');

// Gestionnaire de base de données adaptatif
const { db, query, run, get, isPostgreSQL } = require('./db-manager');

const app = express();
const PORT = process.env.PORT || 5000;

// Configuration des sessions avec store adaptatif
app.use(session({
  secret: process.env.SESSION_SECRET || 'restaurant-secret-key-dev-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // HTTP pour Railway (pas HTTPS interne)
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 heures
  },
  name: 'restaurant.sid' // Nom de cookie personnalisé
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
  } else {
    console.log('Redirection vers index.html pour utilisateur normal');
    return res.sendFile('index.html', { root: '../client/html' });
  }
});

// Système de permissions
const PERMISSIONS = {
  SUPER_ADMIN: {
    restaurants: ['view_all', 'view_stats'],
    users: ['view_all', 'create', 'edit', 'delete'],
    global_stats: ['view']
  },
  RESTAURATEUR: {
    restaurants: ['manage_own'],
    menu: ['create', 'edit', 'delete', 'view'],
    tables: ['create', 'edit', 'delete', 'view'],
    orders: ['view', 'manage'],
    staff: ['create', 'edit', 'delete', 'view'],
    schedules: ['create', 'edit', 'delete', 'view'],
    events: ['create', 'edit', 'delete', 'view']
  },
  MANAGER: {
    menu: ['view', 'edit'],
    tables: ['view', 'edit'],
    orders: ['view', 'manage'],
    schedules: ['view', 'edit'],
    events: ['view', 'edit']
  },
  EMPLOYE: {
    menu: ['view'],
    tables: ['view'],
    orders: ['view'],
    schedules: ['view']
  }
};

// Middleware pour vérifier les permissions
const checkPermission = (resource, action) => {
  return (req, res, next) => {
    const userRole = req.session.userRole;

    if (!userRole) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const userPermissions = PERMISSIONS[userRole];

    if (!userPermissions || !userPermissions[resource] || !userPermissions[resource].includes(action)) {
      return res.status(403).json({ error: 'Permission refusée' });
    }

    next();
  };
};

// Middleware pour vérifier qu'un utilisateur est connecté
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentification requise' });
  }
  next();
};

// Middleware pour vérifier l'accès au restaurant
const checkRestaurantAccess = async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const restaurantId = req.restaurantId;

    if (req.session.userRole === 'SUPER_ADMIN') {
      return next();
    }

    const access = await get(
      'SELECT id FROM user_restaurants WHERE user_id = ? AND restaurant_id = ?',
      [userId, restaurantId]
    );

    if (!access) {
      return res.status(403).json({ error: 'Accès au restaurant refusé' });
    }

    next();
  } catch (error) {
    console.error('Erreur vérification accès restaurant:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// Middleware pour extraire restaurantId depuis les paramètres
const extractRestaurantId = (req, res, next) => {
  const restaurantId = req.params.restaurantId || req.body.restaurantId || req.query.restaurantId;

  if (!restaurantId && req.session.userRole !== 'SUPER_ADMIN') {
    return res.status(400).json({ error: 'ID du restaurant manquant' });
  }

  req.restaurantId = restaurantId;
  next();
};

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

    const restaurantId = restaurantResult.lastID;

    // Créer l'utilisateur restaurateur
    const userResult = await run(
      'INSERT INTO users (email, password_hash, first_name, last_name, phone, role) VALUES (?, ?, ?, ?, ?, ?)',
      [email, hashedPassword, firstName, lastName, phone, 'RESTAURATEUR']
    );

    const userId = userResult.lastID;

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

    // Sauvegarder explicitement la session
    req.session.save((err) => {
      if (err) {
        console.error('Erreur sauvegarde session:', err);
        return res.status(500).json({ error: 'Erreur session' });
      }

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

  console.log('Tentative de login pour:', email);

  try {
    const user = await get('SELECT * FROM users WHERE email = ? AND is_active = 1', [email]);

    if (!user) {
      console.log('Aucun utilisateur trouvé pour:', email);
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    console.log('Utilisateur trouvé:', { id: user.id, email: user.email, role: user.role });

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    console.log('Vérification mot de passe:', { isValidPassword, passwordProvided: password });

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

      // Sauvegarder explicitement la session
      req.session.save((err) => {
        if (err) {
          console.error('Erreur sauvegarde session:', err);
          return res.status(500).json({ error: 'Erreur session' });
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
      });
    } else {
      // Super Admin - pas de restaurants
      req.session.userId = user.id;
      req.session.userRole = user.role;
      req.session.userName = `${user.first_name} ${user.last_name}`;
      req.session.restaurants = [];

      // Sauvegarder explicitement la session
      req.session.save((err) => {
        if (err) {
          console.error('Erreur sauvegarde session:', err);
          return res.status(500).json({ error: 'Erreur session' });
        }

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
      });
    }
  } catch (error) {
    console.error('Erreur login:', error);
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

// Alias pour compatibilité
app.get('/api/me', requireAuth, (req, res) => {
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

// Routes API basiques pour éviter les erreurs 404
app.get('/api/menu', requireAuth, async (req, res) => {
  try {
    const menu = await query('SELECT * FROM menu_items ORDER BY category, name');
    res.json(menu);
  } catch (error) {
    console.error('Erreur menu:', error);
    res.json([]); // Retourner un tableau vide en cas d'erreur
  }
});

app.get('/api/tables', requireAuth, async (req, res) => {
  try {
    const tables = await query('SELECT * FROM tables ORDER BY table_number');
    res.json(tables);
  } catch (error) {
    console.error('Erreur tables:', error);
    res.json([]);
  }
});

app.get('/api/orders', requireAuth, async (req, res) => {
  try {
    const orders = await query('SELECT * FROM orders ORDER BY created_at DESC');
    res.json(orders);
  } catch (error) {
    console.error('Erreur orders:', error);
    res.json([]);
  }
});

app.get('/api/rooms', requireAuth, async (req, res) => {
  try {
    const rooms = await query('SELECT * FROM rooms ORDER BY name');
    res.json(rooms);
  } catch (error) {
    console.error('Erreur rooms:', error);
    res.json([]);
  }
});

app.get('/api/ingredients', requireAuth, async (req, res) => {
  try {
    const ingredients = await query('SELECT * FROM ingredients ORDER BY name');
    res.json(ingredients);
  } catch (error) {
    console.error('Erreur ingredients:', error);
    res.json([]);
  }
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💾 Base de données: ${isPostgreSQL ? 'PostgreSQL (Railway)' : 'SQLite (local)'}`);
});

module.exports = app;