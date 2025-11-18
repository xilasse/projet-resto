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

app.get('/restaurant-selector.html', (req, res) => {
  res.sendFile('restaurant-selector.html', { root: '../client/html' });
});

// Route de test pour vérifier le déploiement
app.get('/api/version', (req, res) => {
  res.json({
    version: '2.2',
    commit: 'aa3869a',
    database: isPostgreSQL ? 'PostgreSQL' : 'SQLite',
    postgresqlFixDeployed: true,
    sqliteFixDeployed: true,
    timestamp: new Date().toISOString()
  });
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
  } else if (req.session.userRole === 'RESTAURATEUR') {
    // Pour les restaurateurs, vérifier s'ils ont plusieurs restaurants
    if (!req.session.activeRestaurantId && req.session.restaurants && req.session.restaurants.length > 1) {
      console.log('Restaurateur avec plusieurs restaurants, redirection vers sélecteur');
      return res.sendFile('restaurant-selector.html', { root: '../client/html' });
    } else {
      console.log('Redirection vers index.html pour restaurateur');
      return res.sendFile('index.html', { root: '../client/html' });
    }
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

// Route de debug pour tester la création de restaurant
app.post('/api/debug-restaurant', requireAuth, async (req, res) => {
  try {
    console.log('=== DEBUG CREATE RESTAURANT ===');
    console.log('Session userId:', req.session.userId);
    console.log('Session userRole:', req.session.userRole);
    console.log('Body:', req.body);
    console.log('IsPostgreSQL:', isPostgreSQL);

    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name required for debug' });
    }

    // Test de récupération utilisateur
    const user = await get('SELECT first_name, last_name, email FROM users WHERE id = ?', [req.session.userId]);
    console.log('User found:', user);

    if (!user) {
      return res.status(404).json({ error: 'User not found', userId: req.session.userId });
    }

    // Test d'insertion simple
    const testEmail = `debug-${Date.now()}@test.com`;
    console.log('Attempting insert with email:', testEmail);

    const result = await run(
      'INSERT INTO restaurants (name, owner_name, email, password_hash) VALUES (?, ?, ?, ?)',
      [name, `${user.first_name} ${user.last_name}`, testEmail, 'DEBUG_TEST']
    );

    console.log('Insert result:', result);

    res.json({
      success: true,
      debug: {
        insertResult: result,
        lastID: result.lastID,
        insertId: result.insertId,
        user: user,
        isPostgreSQL: isPostgreSQL
      }
    });

  } catch (error) {
    console.error('=== DEBUG ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error stack:', error.stack);

    res.status(500).json({
      error: error.message,
      code: error.code,
      stack: error.stack
    });
  }
});

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

      // Si l'utilisateur n'a qu'un seul restaurant, le définir comme actif
      if (restaurants.length === 1) {
        req.session.activeRestaurantId = restaurants[0].id;
        req.session.activeRestaurantName = restaurants[0].name;
        req.session.activeRestaurantRole = restaurants[0].user_role;
      }

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
    const activeRestaurantId = req.session.activeRestaurantId;

    if (!activeRestaurantId) {
      return res.status(400).json({ error: 'Aucun restaurant sélectionné' });
    }

    // Joindre avec rooms pour filtrer par restaurant
    const tables = await query(`
      SELECT t.*, r.name as room_name, r.color as room_color
      FROM tables t
      JOIN rooms r ON t.room_id = r.id
      WHERE r.restaurant_id = ?
      ORDER BY r.name, t.table_number
    `, [activeRestaurantId]);

    console.log(`📋 Tables récupérées pour restaurant ${activeRestaurantId}:`, tables.length);
    res.json(tables);
  } catch (error) {
    console.error('Erreur tables:', error);
    res.json([]);
  }
});

// Route pour créer une nouvelle table
app.post('/api/tables', requireAuth, async (req, res) => {
  try {
    console.log('🪑 Création table - Données reçues:', req.body);
    console.log('🔑 Session restaurant ID:', req.session.activeRestaurantId);

    const { table_number, room_id, capacity, tableNumber, roomId } = req.body;

    // Mapping des noms de paramètres (client vs serveur)
    const finalTableNumber = table_number || tableNumber;
    const finalRoomId = room_id || roomId;
    const finalCapacity = capacity || 4; // Capacité par défaut
    const activeRestaurantId = req.session.activeRestaurantId;

    // Vérifications
    if (!finalTableNumber || !finalRoomId) {
      console.log('❌ Données manquantes:', { finalTableNumber, finalRoomId, finalCapacity });
      return res.status(400).json({ error: 'Numéro de table et salle sont obligatoires' });
    }

    if (!activeRestaurantId) {
      return res.status(400).json({ error: 'Aucun restaurant sélectionné' });
    }

    // Vérifier que l'utilisateur a les droits sur ce restaurant
    if (req.session.userRole !== 'RESTAURATEUR' && req.session.userRole !== 'MANAGER') {
      return res.status(403).json({ error: 'Droits insuffisants' });
    }

    // Vérifier que la salle appartient au restaurant actif
    console.log('🔍 Vérification salle:', { finalRoomId, activeRestaurantId });
    const existingRoom = await get(
      'SELECT * FROM rooms WHERE id = ? AND restaurant_id = ?',
      [finalRoomId, activeRestaurantId]
    );

    console.log('🏠 Salle trouvée:', existingRoom);
    if (!existingRoom) {
      console.log('❌ Salle non trouvée pour room_id:', finalRoomId);
      return res.status(404).json({ error: 'Salle non trouvée' });
    }

    // Vérifier que le numéro de table n'existe pas déjà dans cette salle
    const existingTable = await get(
      'SELECT * FROM tables WHERE table_number = ? AND room_id = ?',
      [finalTableNumber, finalRoomId]
    );

    if (existingTable) {
      return res.status(400).json({ error: 'Ce numéro de table existe déjà dans cette salle' });
    }

    // Créer la table
    console.log('💾 Tentative création table...');
    const result = await run(
      'INSERT INTO tables (table_number, room_id, capacity, status) VALUES (?, ?, ?, ?)',
      [finalTableNumber, finalRoomId, finalCapacity, 'available']
    );

    console.log('✅ Table créée avec ID:', result.lastID);
    res.json({
      success: true,
      message: 'Table créée avec succès',
      table: {
        id: result.lastID,
        table_number: finalTableNumber,
        room_id: finalRoomId,
        capacity: finalCapacity,
        status: 'available'
      }
    });

  } catch (error) {
    console.error('Erreur création table:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la table' });
  }
});

// Route pour modifier une table
app.put('/api/tables/:id', requireAuth, async (req, res) => {
  try {
    const tableId = req.params.id;
    const { table_number, capacity, status } = req.body;
    const activeRestaurantId = req.session.activeRestaurantId;

    // Vérifications
    if (!table_number || !capacity) {
      return res.status(400).json({ error: 'Numéro de table et capacité sont obligatoires' });
    }

    if (!activeRestaurantId) {
      return res.status(400).json({ error: 'Aucun restaurant sélectionné' });
    }

    // Vérifier que l'utilisateur a les droits sur ce restaurant
    if (req.session.userRole !== 'RESTAURATEUR' && req.session.userRole !== 'MANAGER') {
      return res.status(403).json({ error: 'Droits insuffisants' });
    }

    // Vérifier que la table existe et appartient à une salle du restaurant actif
    const existingTable = await get(`
      SELECT t.*, r.restaurant_id
      FROM tables t
      JOIN rooms r ON t.room_id = r.id
      WHERE t.id = ? AND r.restaurant_id = ?
    `, [tableId, activeRestaurantId]);

    if (!existingTable) {
      return res.status(404).json({ error: 'Table non trouvée' });
    }

    // Mettre à jour la table
    await run(
      'UPDATE tables SET table_number = ?, capacity = ?, status = ? WHERE id = ?',
      [table_number, capacity, status || existingTable.status, tableId]
    );

    res.json({
      success: true,
      message: 'Table modifiée avec succès'
    });

  } catch (error) {
    console.error('Erreur modification table:', error);
    res.status(500).json({ error: 'Erreur lors de la modification de la table' });
  }
});

// Route pour supprimer une table
app.delete('/api/tables/:id', requireAuth, async (req, res) => {
  try {
    const tableId = req.params.id;
    const activeRestaurantId = req.session.activeRestaurantId;

    if (!activeRestaurantId) {
      return res.status(400).json({ error: 'Aucun restaurant sélectionné' });
    }

    // Vérifier que l'utilisateur a les droits sur ce restaurant
    if (req.session.userRole !== 'RESTAURATEUR' && req.session.userRole !== 'MANAGER') {
      return res.status(403).json({ error: 'Droits insuffisants' });
    }

    // Vérifier que la table existe et appartient à une salle du restaurant actif
    const existingTable = await get(`
      SELECT t.*, r.restaurant_id
      FROM tables t
      JOIN rooms r ON t.room_id = r.id
      WHERE t.id = ? AND r.restaurant_id = ?
    `, [tableId, activeRestaurantId]);

    if (!existingTable) {
      return res.status(404).json({ error: 'Table non trouvée' });
    }

    // Supprimer la table
    await run('DELETE FROM tables WHERE id = ?', [tableId]);

    res.json({
      success: true,
      message: 'Table supprimée avec succès'
    });

  } catch (error) {
    console.error('Erreur suppression table:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la table' });
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
    const activeRestaurantId = req.session.activeRestaurantId;

    if (!activeRestaurantId) {
      return res.status(400).json({ error: 'Aucun restaurant sélectionné' });
    }

    const rooms = await query('SELECT * FROM rooms WHERE restaurant_id = ? ORDER BY name', [activeRestaurantId]);
    console.log(`📋 Salles récupérées pour restaurant ${activeRestaurantId}:`, rooms.length);
    res.json(rooms);
  } catch (error) {
    console.error('Erreur rooms:', error);
    res.json([]);
  }
});

// Route pour créer une nouvelle salle
app.post('/api/rooms', requireAuth, async (req, res) => {
  try {
    console.log('🏪 Création salle - Données reçues:', req.body);
    console.log('🔑 Session restaurant ID:', req.session.activeRestaurantId);
    console.log('👤 Role utilisateur:', req.session.userRole);

    const { name, color, width, height } = req.body;
    const activeRestaurantId = req.session.activeRestaurantId;

    // Vérifications
    if (!name || !color) {
      console.log('❌ Données manquantes:', { name, color });
      return res.status(400).json({ error: 'Nom et couleur sont obligatoires' });
    }

    if (!activeRestaurantId) {
      console.log('❌ Aucun restaurant actif en session');
      return res.status(400).json({ error: 'Aucun restaurant sélectionné' });
    }

    // Vérifier que l'utilisateur a les droits sur ce restaurant
    if (req.session.userRole !== 'RESTAURATEUR' && req.session.userRole !== 'MANAGER') {
      console.log('❌ Droits insuffisants:', req.session.userRole);
      return res.status(403).json({ error: 'Droits insuffisants' });
    }

    // Vérifier d'abord si la table rooms a bien la colonne restaurant_id
    console.log('🔍 Vérification structure table rooms...');

    // Créer la salle avec restaurant_id et dimensions
    console.log('💾 Tentative création salle...');
    const result = await run(
      'INSERT INTO rooms (name, color, width, height, restaurant_id) VALUES (?, ?, ?, ?, ?)',
      [name, color, width || 600, height || 400, activeRestaurantId]
    );

    console.log('✅ Salle créée avec ID:', result.lastID);

    res.json({
      success: true,
      message: 'Salle créée avec succès',
      room: {
        id: result.lastID,
        name,
        color,
        width: width || 600,
        height: height || 400,
        restaurant_id: activeRestaurantId
      }
    });

  } catch (error) {
    console.error('❌ Erreur création salle détaillée:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      error: 'Erreur lors de la création de la salle',
      details: error.message
    });
  }
});

// Route de debug temporaire pour vérifier la structure des tables
app.get('/api/debug/tables-structure', requireAuth, async (req, res) => {
  try {
    if (isPostgreSQL) {
      // PostgreSQL
      const roomsStructure = await query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'rooms'
      `);
      const tablesStructure = await query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'tables'
      `);
      res.json({ rooms: roomsStructure, tables: tablesStructure });
    } else {
      // SQLite
      const roomsStructure = await query('PRAGMA table_info(rooms)');
      const tablesStructure = await query('PRAGMA table_info(tables)');
      res.json({ rooms: roomsStructure, tables: tablesStructure });
    }
  } catch (error) {
    console.error('Erreur structure debug:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route de debug pour forcer la re-initialisation des tables manquantes
app.post('/api/debug/reinit-tables', requireAuth, async (req, res) => {
  try {
    // Importer la fonction d'initialisation
    const { createTables } = require('./db-manager');

    console.log('🔄 Re-initialisation forcée des tables...');
    await createTables();

    res.json({
      success: true,
      message: 'Tables re-créées avec succès'
    });
  } catch (error) {
    console.error('Erreur re-init tables:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour modifier une salle
app.put('/api/rooms/:id', requireAuth, async (req, res) => {
  try {
    const roomId = req.params.id;
    const { name, color } = req.body;
    const activeRestaurantId = req.session.activeRestaurantId;

    // Vérifications
    if (!name || !color) {
      return res.status(400).json({ error: 'Nom et couleur sont obligatoires' });
    }

    if (!activeRestaurantId) {
      return res.status(400).json({ error: 'Aucun restaurant sélectionné' });
    }

    // Vérifier que l'utilisateur a les droits sur ce restaurant
    if (req.session.userRole !== 'RESTAURATEUR' && req.session.userRole !== 'MANAGER') {
      return res.status(403).json({ error: 'Droits insuffisants' });
    }

    // Vérifier que la salle appartient au restaurant actif
    const existingRoom = await get(
      'SELECT * FROM rooms WHERE id = ? AND restaurant_id = ?',
      [roomId, activeRestaurantId]
    );

    if (!existingRoom) {
      return res.status(404).json({ error: 'Salle non trouvée' });
    }

    // Mettre à jour la salle
    await run(
      'UPDATE rooms SET name = ?, color = ? WHERE id = ? AND restaurant_id = ?',
      [name, color, roomId, activeRestaurantId]
    );

    res.json({
      success: true,
      message: 'Salle modifiée avec succès'
    });

  } catch (error) {
    console.error('Erreur modification salle:', error);
    res.status(500).json({ error: 'Erreur lors de la modification de la salle' });
  }
});

// Route pour supprimer une salle
app.delete('/api/rooms/:id', requireAuth, async (req, res) => {
  try {
    const roomId = req.params.id;
    const activeRestaurantId = req.session.activeRestaurantId;

    if (!activeRestaurantId) {
      return res.status(400).json({ error: 'Aucun restaurant sélectionné' });
    }

    // Vérifier que l'utilisateur a les droits sur ce restaurant
    if (req.session.userRole !== 'RESTAURATEUR' && req.session.userRole !== 'MANAGER') {
      return res.status(403).json({ error: 'Droits insuffisants' });
    }

    // Vérifier que la salle appartient au restaurant actif
    const existingRoom = await get(
      'SELECT * FROM rooms WHERE id = ? AND restaurant_id = ?',
      [roomId, activeRestaurantId]
    );

    if (!existingRoom) {
      return res.status(404).json({ error: 'Salle non trouvée' });
    }

    // Supprimer d'abord toutes les tables associées
    await run('DELETE FROM tables WHERE room_id = ?', [roomId]);

    // Supprimer la salle
    await run('DELETE FROM rooms WHERE id = ? AND restaurant_id = ?', [roomId, activeRestaurantId]);

    res.json({
      success: true,
      message: 'Salle supprimée avec succès'
    });

  } catch (error) {
    console.error('Erreur suppression salle:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la salle' });
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

// Route pour récupérer les restaurants d'un utilisateur
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
    console.error('Erreur récupération restaurants:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route pour définir le restaurant actif en session
app.post('/api/set-active-restaurant', requireAuth, async (req, res) => {
  try {
    const { restaurantId } = req.body;
    const userId = req.session.userId;

    // Vérifier que l'utilisateur a accès à ce restaurant
    const access = await get(
      'SELECT ur.role FROM user_restaurants ur WHERE ur.user_id = ? AND ur.restaurant_id = ?',
      [userId, restaurantId]
    );

    if (!access) {
      return res.status(403).json({ error: 'Accès au restaurant refusé' });
    }

    // Récupérer les informations du restaurant
    const restaurant = await get(
      'SELECT id, name FROM restaurants WHERE id = ?',
      [restaurantId]
    );

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant introuvable' });
    }

    // Mettre à jour la session
    req.session.activeRestaurantId = restaurantId;
    req.session.activeRestaurantName = restaurant.name;
    req.session.activeRestaurantRole = access.role;

    // Sauvegarder la session
    req.session.save((err) => {
      if (err) {
        console.error('Erreur sauvegarde session:', err);
        return res.status(500).json({ error: 'Erreur session' });
      }

      res.json({
        success: true,
        restaurant: {
          id: restaurantId,
          name: restaurant.name,
          role: access.role
        }
      });
    });

  } catch (error) {
    console.error('Erreur définition restaurant actif:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route pour récupérer le restaurant actif
app.get('/api/active-restaurant', requireAuth, (req, res) => {
  res.json({
    restaurantId: req.session.activeRestaurantId,
    restaurantName: req.session.activeRestaurantName,
    restaurantRole: req.session.activeRestaurantRole
  });
});

// Route pour supprimer le restaurant actif de la session
app.post('/api/clear-active-restaurant', requireAuth, (req, res) => {
  try {
    req.session.activeRestaurantId = null;
    req.session.activeRestaurantName = null;
    req.session.activeRestaurantRole = null;

    req.session.save((err) => {
      if (err) {
        console.error('Erreur sauvegarde session:', err);
        return res.status(500).json({ error: 'Erreur session' });
      }

      res.json({ success: true });
    });
  } catch (error) {
    console.error('Erreur suppression restaurant actif:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route pour créer un nouveau restaurant (réservée aux restaurateurs)
app.post('/api/create-restaurant', requireAuth, [
  body('name').notEmpty().withMessage('Le nom du restaurant est requis'),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional(),
  body('address').optional(),
  body('description').optional()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // Vérifier que l'utilisateur est bien un restaurateur
  if (req.session.userRole !== 'RESTAURATEUR') {
    return res.status(403).json({ error: 'Seuls les restaurateurs peuvent créer des restaurants' });
  }

  const { name, email, phone, address, description } = req.body;
  const userId = req.session.userId;

  try {
    // Récupérer les informations de l'utilisateur
    const user = await get('SELECT first_name, last_name, email FROM users WHERE id = ?', [userId]);

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    // Créer le nouveau restaurant (sans password_hash car c'est un restaurant géré par un utilisateur existant)
    // Générer un email unique pour le restaurant si aucun fourni
    const restaurantEmail = email || `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}@restaurant.local`;

    // Requête adaptée selon le type de base de données
    let restaurantResult;
    if (isPostgreSQL) {
      // PostgreSQL - utiliser RETURNING pour récupérer l'ID
      restaurantResult = await query(
        'INSERT INTO restaurants (name, owner_name, email, password_hash, phone, address) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [
          name,
          `${user.first_name} ${user.last_name}`,
          restaurantEmail,
          'MANAGED_RESTAURANT',
          phone,
          address
        ]
      );
    } else {
      // SQLite - utiliser run normal
      restaurantResult = await run(
        'INSERT INTO restaurants (name, owner_name, email, password_hash, phone, address) VALUES (?, ?, ?, ?, ?, ?)',
        [
          name,
          `${user.first_name} ${user.last_name}`,
          restaurantEmail,
          'MANAGED_RESTAURANT',
          phone,
          address
        ]
      );
    }

    const restaurantId = isPostgreSQL
      ? restaurantResult[0].id
      : (restaurantResult.lastID || restaurantResult.insertId || await get('SELECT last_insert_rowid() as id').then(r => r.id));

    // Lier l'utilisateur au nouveau restaurant comme propriétaire
    await run(
      'INSERT INTO user_restaurants (user_id, restaurant_id, role) VALUES (?, ?, ?)',
      [userId, restaurantId, 'RESTAURATEUR']
    );

    // Mettre à jour la session avec le nouveau restaurant dans la liste
    const updatedRestaurants = await query(`
      SELECT r.id, r.name, ur.role as user_role
      FROM restaurants r
      JOIN user_restaurants ur ON r.id = ur.restaurant_id
      WHERE ur.user_id = ?
      ORDER BY r.name
    `, [userId]);

    req.session.restaurants = updatedRestaurants;

    // Optionnellement, définir ce nouveau restaurant comme actif
    req.session.activeRestaurantId = restaurantId;
    req.session.activeRestaurantName = name;
    req.session.activeRestaurantRole = 'RESTAURATEUR';

    // Sauvegarder la session
    req.session.save((err) => {
      if (err) {
        console.error('Erreur sauvegarde session après création restaurant:', err);
        return res.status(500).json({ error: 'Restaurant créé mais erreur session' });
      }

      res.json({
        success: true,
        restaurant: {
          id: restaurantId,
          name: name,
          role: 'RESTAURATEUR'
        },
        message: `Restaurant "${name}" créé avec succès !`
      });
    });

  } catch (error) {
    console.error('Erreur création restaurant:', error);
    console.error('Détails erreur:', error.message);
    console.error('Stack trace:', error.stack);

    // Gérer les erreurs spécifiques
    let errorMessage = 'Erreur lors de la création du restaurant';

    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      errorMessage = 'Un restaurant avec cet email existe déjà';
    } else if (error.code === '23505' && error.constraint && error.constraint.includes('email')) {
      // PostgreSQL unique constraint violation
      errorMessage = 'Un restaurant avec cet email existe déjà';
    } else if (process.env.NODE_ENV === 'development') {
      errorMessage = `Erreur lors de la création du restaurant: ${error.message}`;
    }

    res.status(500).json({ error: errorMessage });
  }
});

// Route pour créer un nouveau utilisateur (manager/employé) - réservée aux restaurateurs
app.post('/api/create-user', requireAuth, [
  body('firstName').notEmpty().withMessage('Le prénom est requis'),
  body('lastName').notEmpty().withMessage('Le nom est requis'),
  body('email').isEmail().normalizeEmail().withMessage('Email valide requis'),
  body('password').isLength({ min: 6 }).withMessage('Mot de passe minimum 6 caractères'),
  body('role').isIn(['MANAGER', 'EMPLOYE']).withMessage('Rôle invalide'),
  body('phone').optional(),
  body('notes').optional()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // Vérifier que l'utilisateur est bien un restaurateur
  if (req.session.userRole !== 'RESTAURATEUR') {
    return res.status(403).json({ error: 'Seuls les restaurateurs peuvent créer des utilisateurs' });
  }

  // Vérifier qu'un restaurant actif est sélectionné
  const activeRestaurantId = req.session.activeRestaurantId;
  if (!activeRestaurantId) {
    return res.status(400).json({ error: 'Aucun restaurant sélectionné' });
  }

  const { firstName, lastName, email, password, role, phone, notes } = req.body;
  const userId = req.session.userId;

  try {
    // Vérifier que le restaurateur a bien accès à ce restaurant
    const restaurantAccess = await get(
      'SELECT ur.role FROM user_restaurants ur WHERE ur.user_id = ? AND ur.restaurant_id = ?',
      [userId, activeRestaurantId]
    );

    if (!restaurantAccess || restaurantAccess.role !== 'RESTAURATEUR') {
      return res.status(403).json({ error: 'Accès restaurant non autorisé' });
    }

    // Vérifier si l'email existe déjà
    const existingUser = await get('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }

    // Hasher le mot de passe
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Créer l'utilisateur (sans notes pour l'instant)
    const userResult = await run(
      'INSERT INTO users (email, password_hash, first_name, last_name, phone, role) VALUES (?, ?, ?, ?, ?, ?)',
      [email, hashedPassword, firstName, lastName, phone, role]
    );

    const newUserId = userResult.lastID;

    // Lier l'utilisateur au restaurant
    await run(
      'INSERT INTO user_restaurants (user_id, restaurant_id, role) VALUES (?, ?, ?)',
      [newUserId, activeRestaurantId, role]
    );

    res.json({
      success: true,
      user: {
        id: newUserId,
        firstName,
        lastName,
        email,
        role,
        phone
      },
      message: `Utilisateur ${firstName} ${lastName} créé avec succès !`
    });

  } catch (error) {
    console.error('Erreur création utilisateur:', error);
    res.status(500).json({ error: 'Erreur lors de la création de l\'utilisateur' });
  }
});

// Route pour récupérer l'équipe d'un restaurant
app.get('/api/restaurant-team', requireAuth, async (req, res) => {
  try {
    // Vérifier qu'un restaurant actif est sélectionné
    const activeRestaurantId = req.session.activeRestaurantId;
    if (!activeRestaurantId) {
      return res.status(400).json({ error: 'Aucun restaurant sélectionné' });
    }

    const userId = req.session.userId;

    // Vérifier l'accès au restaurant
    const restaurantAccess = await get(
      'SELECT ur.role FROM user_restaurants ur WHERE ur.user_id = ? AND ur.restaurant_id = ?',
      [userId, activeRestaurantId]
    );

    if (!restaurantAccess || (restaurantAccess.role !== 'RESTAURATEUR' && req.session.userRole !== 'SUPER_ADMIN')) {
      return res.status(403).json({ error: 'Accès restaurant non autorisé' });
    }

    // Récupérer l'équipe du restaurant
    const team = await query(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.role, u.is_active, ur.role as restaurant_role
      FROM users u
      JOIN user_restaurants ur ON u.id = ur.user_id
      WHERE ur.restaurant_id = ? AND u.role != 'SUPER_ADMIN'
      ORDER BY u.role, u.last_name, u.first_name
    `, [activeRestaurantId]);

    res.json(team);

  } catch (error) {
    console.error('Erreur récupération équipe:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'équipe' });
  }
});

// Route pour supprimer un utilisateur
app.delete('/api/delete-user/:id', requireAuth, async (req, res) => {
  try {
    const userIdToDelete = req.params.id;
    const currentUserId = req.session.userId;
    const activeRestaurantId = req.session.activeRestaurantId;

    // Vérifications de sécurité
    if (req.session.userRole !== 'RESTAURATEUR') {
      return res.status(403).json({ error: 'Seuls les restaurateurs peuvent supprimer des utilisateurs' });
    }

    if (!activeRestaurantId) {
      return res.status(400).json({ error: 'Aucun restaurant sélectionné' });
    }

    // Ne pas permettre l'auto-suppression
    if (userIdToDelete == currentUserId) {
      return res.status(400).json({ error: 'Vous ne pouvez pas vous supprimer vous-même' });
    }

    // Vérifier que l'utilisateur à supprimer appartient bien au restaurant
    const userAccess = await get(
      'SELECT ur.role FROM user_restaurants ur WHERE ur.user_id = ? AND ur.restaurant_id = ?',
      [userIdToDelete, activeRestaurantId]
    );

    if (!userAccess) {
      return res.status(404).json({ error: 'Utilisateur non trouvé dans ce restaurant' });
    }

    // Supprimer la liaison restaurant
    await run(
      'DELETE FROM user_restaurants WHERE user_id = ? AND restaurant_id = ?',
      [userIdToDelete, activeRestaurantId]
    );

    // Si l'utilisateur n'a plus d'autre restaurant, le désactiver
    const otherRestaurants = await query(
      'SELECT COUNT(*) as count FROM user_restaurants WHERE user_id = ?',
      [userIdToDelete]
    );

    if (otherRestaurants[0].count === 0) {
      await run('UPDATE users SET is_active = 0 WHERE id = ?', [userIdToDelete]);
    }

    res.json({ success: true, message: 'Utilisateur supprimé avec succès' });

  } catch (error) {
    console.error('Erreur suppression utilisateur:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de l\'utilisateur' });
  }
});

// Route pour mettre à jour un utilisateur
app.put('/api/update-user/:id', requireAuth, async (req, res) => {
  try {
    const userIdToUpdate = req.params.id;
    const { firstName, lastName, email, phone, role, isActive } = req.body;
    const activeRestaurantId = req.session.activeRestaurantId;

    // Vérifications de sécurité
    if (req.session.userRole !== 'RESTAURATEUR') {
      return res.status(403).json({ error: 'Seuls les restaurateurs peuvent modifier des utilisateurs' });
    }

    if (!activeRestaurantId) {
      return res.status(400).json({ error: 'Aucun restaurant sélectionné' });
    }

    // Validation des données
    if (!firstName || !lastName || !email || !role) {
      return res.status(400).json({ error: 'Tous les champs obligatoires doivent être remplis' });
    }

    if (!['EMPLOYE', 'MANAGER'].includes(role)) {
      return res.status(400).json({ error: 'Rôle invalide' });
    }

    // Vérifier que l'utilisateur à modifier appartient bien au restaurant
    const userAccess = await get(
      'SELECT ur.role FROM user_restaurants ur WHERE ur.user_id = ? AND ur.restaurant_id = ?',
      [userIdToUpdate, activeRestaurantId]
    );

    if (!userAccess) {
      return res.status(404).json({ error: 'Utilisateur non trouvé dans ce restaurant' });
    }

    // Vérifier que l'email n'est pas déjà utilisé par un autre utilisateur
    const existingUser = await get(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [email, userIdToUpdate]
    );

    if (existingUser) {
      return res.status(400).json({ error: 'Cette adresse email est déjà utilisée' });
    }

    // Mettre à jour les informations de l'utilisateur
    await run(
      'UPDATE users SET first_name = ?, last_name = ?, email = ?, phone = ?, is_active = ? WHERE id = ?',
      [firstName, lastName, email, phone || null, isActive ? 1 : 0, userIdToUpdate]
    );

    // Mettre à jour le rôle dans la table user_restaurants
    await run(
      'UPDATE user_restaurants SET role = ? WHERE user_id = ? AND restaurant_id = ?',
      [role, userIdToUpdate, activeRestaurantId]
    );

    res.json({
      success: true,
      message: 'Profil utilisateur mis à jour avec succès'
    });

  } catch (error) {
    console.error('Erreur mise à jour utilisateur:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de l\'utilisateur' });
  }
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💾 Base de données: ${isPostgreSQL ? 'PostgreSQL (Railway)' : 'SQLite (local)'}`);
  console.log(`🚀 SERVEUR VERSION 2.1 - CORRECTION POSTGRESQL DEPLOYEE`);
});

module.exports = app;