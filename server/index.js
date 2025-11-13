const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 5000;

// Configuration des sessions
app.use(session({
  secret: process.env.SESSION_SECRET || 'restaurant-secret-key-dev-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // false pour development (HTTP)
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 heures
  }
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : true,
  credentials: true
}));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use('/client', express.static('../client'));

// Route simple pour favicon
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Routes pour les pages d'authentification
app.get('/login.html', (req, res) => {
  res.sendFile('login.html', { root: '../client/html' });
});

app.get('/register.html', (req, res) => {
  res.sendFile('register.html', { root: '../client/html' });
});

// Route pour la page Super Admin
app.get('/admin.html', (req, res) => {
  res.sendFile('admin.html', { root: '../client/html' });
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

// Route de debug pour vérifier la base de données
app.get('/api/debug', (req, res) => {
  db.all('SELECT COUNT(*) as menu_count FROM menu_items', (err1, menuResult) => {
    db.all('SELECT COUNT(*) as table_count FROM tables', (err2, tableResult) => {
      db.all('SELECT COUNT(*) as room_count FROM rooms', (err3, roomResult) => {
        db.all('SELECT * FROM menu_items LIMIT 5', (err4, sampleMenu) => {
          res.json({
            database_status: {
              menu_items: menuResult[0]?.menu_count || 0,
              tables: tableResult[0]?.table_count || 0,
              rooms: roomResult[0]?.room_count || 0
            },
            sample_menu: sampleMenu || [],
            errors: {
              menu_error: err1?.message,
              table_error: err2?.message,
              room_error: err3?.message,
              sample_error: err4?.message
            }
          });
        });
      });
    });
  });
});

const db = new sqlite3.Database('restaurant.db');

db.serialize(() => {
  // Créer les tables d'authentification et de rôles
  db.run(`CREATE TABLE IF NOT EXISTS restaurants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Table des utilisateurs (remplace l'ancien système restaurant-only)
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL CHECK (role IN ('SUPER_ADMIN', 'RESTAURATEUR', 'MANAGER', 'EMPLOYE')),
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Table de liaison utilisateur-restaurant avec permissions
  db.run(`CREATE TABLE IF NOT EXISTS user_restaurants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    restaurant_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('RESTAURATEUR', 'MANAGER', 'EMPLOYE')),
    permissions TEXT, -- JSON des permissions spécifiques
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (restaurant_id) REFERENCES restaurants (id),
    UNIQUE(user_id, restaurant_id)
  )`);

  // Table des plannings
  db.run(`CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    restaurant_id INTEGER NOT NULL,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    shift_type TEXT, -- 'matin', 'midi', 'soir', 'nuit'
    notes TEXT,
    created_by INTEGER NOT NULL, -- ID du manager qui a créé
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (restaurant_id) REFERENCES restaurants (id),
    FOREIGN KEY (created_by) REFERENCES users (id)
  )`);

  // Table des événements
  db.run(`CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    event_type TEXT, -- 'special_menu', 'private_event', 'maintenance'
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants (id),
    FOREIGN KEY (created_by) REFERENCES users (id)
  )`);

  // Créer les tables principales avec restaurant_id
  db.run(`CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    width INTEGER DEFAULT 600,
    height INTEGER DEFAULT 400,
    color TEXT DEFAULT '#f8f9fa',
    restaurant_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_number INTEGER,
    qr_code TEXT,
    x_position REAL DEFAULT 0,
    y_position REAL DEFAULT 0,
    room_id INTEGER,
    restaurant_id INTEGER NOT NULL,
    status TEXT DEFAULT 'libre',
    FOREIGN KEY (room_id) REFERENCES rooms (id),
    FOREIGN KEY (restaurant_id) REFERENCES restaurants (id),
    UNIQUE(table_number, restaurant_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    category TEXT,
    stock_quantity INTEGER DEFAULT 0,
    is_available BOOLEAN DEFAULT 1,
    image_url TEXT,
    restaurant_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
  )`);

  // Créer la table orders avec toutes les colonnes dès le début
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_id INTEGER,
    items TEXT,
    total_amount REAL,
    status TEXT DEFAULT 'en_attente',
    payment_status TEXT DEFAULT 'non_paye',
    allergies TEXT,
    other_allergies TEXT,
    restaurant_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (table_id) REFERENCES tables (id),
    FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
  )`);

  // Migrations seulement après création des tables
  db.run(`PRAGMA table_info(tables)`, [], (err, rows) => {
    if (!err) {
      // Vérifier si room_id existe avant de l'ajouter
      db.all(`PRAGMA table_info(tables)`, [], (err, columns) => {
        if (!err && columns) {
          const hasRoomId = columns.some(col => col.name === 'room_id');
          if (!hasRoomId) {
            db.run(`ALTER TABLE tables ADD COLUMN room_id INTEGER`);
          }
        }
      });
    }
  });

  // Vérifier et ajouter les colonnes d'allergies et restaurant_id si nécessaires
  db.all(`PRAGMA table_info(orders)`, [], (err, columns) => {
    if (!err && columns) {
      const hasAllergies = columns.some(col => col.name === 'allergies');
      const hasOtherAllergies = columns.some(col => col.name === 'other_allergies');
      const hasRestaurantId = columns.some(col => col.name === 'restaurant_id');

      if (!hasAllergies) {
        db.run(`ALTER TABLE orders ADD COLUMN allergies TEXT`);
      }
      if (!hasOtherAllergies) {
        db.run(`ALTER TABLE orders ADD COLUMN other_allergies TEXT`);
      }
      if (!hasRestaurantId) {
        db.run(`ALTER TABLE orders ADD COLUMN restaurant_id INTEGER DEFAULT 1`);
      }
    }
  });

  // Ajouter restaurant_id aux autres tables si nécessaire
  ['tables', 'menu_items', 'rooms'].forEach(tableName => {
    db.all(`PRAGMA table_info(${tableName})`, [], (err, columns) => {
      if (!err && columns) {
        const hasRestaurantId = columns.some(col => col.name === 'restaurant_id');
        if (!hasRestaurantId) {
          db.run(`ALTER TABLE ${tableName} ADD COLUMN restaurant_id INTEGER DEFAULT 1`);
        }
      }
    });
  });

  // Créer le super admin par défaut s'il n'existe pas
  db.get('SELECT id FROM users WHERE role = "SUPER_ADMIN"', [], async (err, row) => {
    if (!err) {
      try {
        const bcrypt = require('bcryptjs');
        const superAdminPassword = await bcrypt.hash('venezesas542sp', 10);

        if (!row) {
          // Créer le super admin
          db.run(`INSERT INTO users (email, password_hash, first_name, last_name, role)
                  VALUES (?, ?, ?, ?, ?)`,
            ['superadmin@restaurant.com', superAdminPassword, 'Super', 'Admin', 'SUPER_ADMIN'],
            function(err) {
              if (!err) {
                console.log('🔑 Super Admin créé - Email: superadmin@restaurant.com, Password: venezesas542sp');
              }
            }
          );
        } else {
          // Mettre à jour le mot de passe du super admin existant
          db.run(`UPDATE users SET password_hash = ? WHERE role = "SUPER_ADMIN"`,
            [superAdminPassword],
            function(err) {
              if (!err) {
                console.log('🔑 Mot de passe Super Admin mis à jour - Email: superadmin@restaurant.com, Password: venezesas542sp');
              }
            }
          );
        }
      } catch (error) {
        console.error('Erreur création/mise à jour super admin:', error);
      }
    }
  });

  db.run(`CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_item_id INTEGER,
    movement_type TEXT,
    quantity INTEGER,
    reason TEXT,
    restaurant_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items (id),
    FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    stock_quantity REAL DEFAULT 0,
    min_quantity REAL DEFAULT 0,
    cost_per_unit REAL DEFAULT 0,
    supplier TEXT,
    restaurant_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS menu_ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_item_id INTEGER,
    ingredient_id INTEGER,
    quantity_needed REAL NOT NULL,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items (id),
    FOREIGN KEY (ingredient_id) REFERENCES ingredients (id)
  )`);
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
    orders: ['view', 'manage', 'create', 'edit', 'delete'],
    staff: ['view'],
    schedules: ['create', 'edit', 'delete', 'view'],
    events: ['create', 'edit', 'delete', 'view']
  },
  EMPLOYE: {
    schedules: ['view_own'],
    events: ['view']
  }
};

// Middleware d'authentification mis à jour
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  next();
};

// Middleware pour vérifier les permissions
const requirePermission = (resource, action) => {
  return (req, res, next) => {
    const userRole = req.session.userRole;
    const userPermissions = PERMISSIONS[userRole];

    if (!userPermissions || !userPermissions[resource] || !userPermissions[resource].includes(action)) {
      return res.status(403).json({ error: 'Permission refusée' });
    }
    next();
  };
};

// Middleware pour vérifier l'accès au restaurant
const requireRestaurantAccess = async (req, res, next) => {
  const userId = req.session.userId;
  const restaurantId = req.params.restaurantId || req.body.restaurantId || req.query.restaurantId;

  if (req.session.userRole === 'SUPER_ADMIN') {
    return next(); // Super admin a accès à tout
  }

  if (!restaurantId) {
    return res.status(400).json({ error: 'ID restaurant requis' });
  }

  // Vérifier l'accès à ce restaurant
  db.get(`SELECT role FROM user_restaurants WHERE user_id = ? AND restaurant_id = ? AND is_active = 1`,
    [userId, restaurantId], (err, row) => {
      if (err || !row) {
        return res.status(403).json({ error: 'Accès au restaurant refusé' });
      }
      req.restaurantRole = row.role;
      req.restaurantId = restaurantId;
      next();
    });
};

// Routes d'authentification mises à jour
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
    db.get('SELECT id FROM users WHERE email = ?', [email], async (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      if (row) {
        return res.status(400).json({ error: 'Cet email est déjà utilisé' });
      }

      // Hasher le mot de passe
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Transaction pour créer restaurant et utilisateur
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // Créer le restaurant
        db.run(
          'INSERT INTO restaurants (name, owner_name, email, password_hash, phone, address) VALUES (?, ?, ?, ?, ?, ?)',
          [restaurantName, `${firstName} ${lastName}`, email, hashedPassword, phone, address],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: 'Erreur lors de la création du restaurant' });
            }

            const restaurantId = this.lastID;

            // Créer l'utilisateur restaurateur
            db.run(
              'INSERT INTO users (email, password_hash, first_name, last_name, phone, role) VALUES (?, ?, ?, ?, ?, ?)',
              [email, hashedPassword, firstName, lastName, phone, 'RESTAURATEUR'],
              function(err) {
                if (err) {
                  db.run('ROLLBACK');
                  return res.status(500).json({ error: 'Erreur lors de la création de l\'utilisateur' });
                }

                const userId = this.lastID;

                // Lier l'utilisateur au restaurant
                db.run(
                  'INSERT INTO user_restaurants (user_id, restaurant_id, role) VALUES (?, ?, ?)',
                  [userId, restaurantId, 'RESTAURATEUR'],
                  function(err) {
                    if (err) {
                      db.run('ROLLBACK');
                      return res.status(500).json({ error: 'Erreur lors de la liaison utilisateur-restaurant' });
                    }

                    db.run('COMMIT');

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
                  }
                );
              }
            );
          }
        );
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  console.log('Tentative de login pour:', email);

  db.get('SELECT * FROM users WHERE email = ? AND is_active = 1', [email], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur serveur' });
    }
    if (!user) {
      console.log('Aucun utilisateur trouvé pour:', email);
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    console.log('Utilisateur trouvé:', { id: user.id, email: user.email, role: user.role });

    try {
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      console.log('Vérification mot de passe:', { isValidPassword, passwordProvided: password });

      if (!isValidPassword) {
        return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      }

      // Récupérer les restaurants associés (sauf pour Super Admin)
      if (user.role !== 'SUPER_ADMIN') {
        db.all(`SELECT r.id, r.name, ur.role as user_role
                FROM restaurants r
                JOIN user_restaurants ur ON r.id = ur.restaurant_id
                WHERE ur.user_id = ?`,
          [user.id], (err, restaurants) => {
            if (err) {
              return res.status(500).json({ error: 'Erreur serveur' });
            }

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
          });
      } else {
        // Super Admin - pas de restaurants spécifiques
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
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur lors de la déconnexion' });
    }
    res.json({ success: true });
  });
});

app.get('/api/me', requireAuth, (req, res) => {
  db.get('SELECT id, email, first_name, last_name, phone, role FROM users WHERE id = ?',
    [req.session.userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur serveur' });
    }
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json({
      user: {
        id: user.id,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        phone: user.phone,
        role: user.role
      },
      restaurants: req.session.restaurants || []
    });
  });
});

// Routes Super Admin
app.get('/api/admin/restaurants', requireAuth, requirePermission('restaurants', 'view_all'), (req, res) => {
  db.all(`SELECT r.*, COUNT(ur.user_id) as user_count,
          COUNT(CASE WHEN o.created_at >= date('now', '-30 days') THEN 1 END) as orders_30_days
          FROM restaurants r
          LEFT JOIN user_restaurants ur ON r.id = ur.restaurant_id AND ur.is_active = 1
          LEFT JOIN orders o ON r.id = o.restaurant_id
          WHERE r.is_active = 1
          GROUP BY r.id
          ORDER BY r.created_at DESC`,
    (err, restaurants) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(restaurants);
    });
});

app.get('/api/admin/users', requireAuth, requirePermission('users', 'view_all'), (req, res) => {
  db.all(`SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.is_active, u.created_at,
          GROUP_CONCAT(r.name || ' (' || ur.role || ')') as restaurants
          FROM users u
          LEFT JOIN user_restaurants ur ON u.id = ur.user_id AND ur.is_active = 1
          LEFT JOIN restaurants r ON ur.restaurant_id = r.id AND r.is_active = 1
          WHERE u.role != 'SUPER_ADMIN'
          GROUP BY u.id
          ORDER BY u.created_at DESC`,
    (err, users) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(users);
    });
});

app.get('/api/admin/stats', requireAuth, requirePermission('global_stats', 'view'), (req, res) => {
  const stats = {};

  // Statistiques des restaurants
  db.get('SELECT COUNT(*) as total_restaurants FROM restaurants WHERE is_active = 1', (err, restaurantStats) => {
    stats.restaurants = restaurantStats?.total_restaurants || 0;

    // Statistiques des utilisateurs
    db.get('SELECT COUNT(*) as total_users FROM users WHERE is_active = 1 AND role != "SUPER_ADMIN"', (err, userStats) => {
      stats.users = userStats?.total_users || 0;

      // Commandes récentes
      db.get('SELECT COUNT(*) as orders_today FROM orders WHERE date(created_at) = date("now")', (err, orderStats) => {
        stats.orders_today = orderStats?.orders_today || 0;

        db.get('SELECT COUNT(*) as orders_month FROM orders WHERE date(created_at) >= date("now", "start of month")', (err, monthStats) => {
          stats.orders_month = monthStats?.orders_month || 0;

          res.json(stats);
        });
      });
    });
  });
});

// Routes pour la gestion des employés
app.post('/api/restaurants/:restaurantId/staff', requireAuth, requireRestaurantAccess, async (req, res) => {
  const { email, firstName, lastName, phone, role, permissions } = req.body;
  const { restaurantId } = req.params;

  // Vérifier les permissions
  if (req.restaurantRole !== 'RESTAURATEUR' && req.session.userRole !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Permission insuffisante' });
  }

  try {
    const saltRounds = 10;
    const tempPassword = 'temp' + Math.random().toString(36).substr(2, 8);
    const hashedPassword = await bcrypt.hash(tempPassword, saltRounds);

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      // Créer l'utilisateur
      db.run(
        'INSERT INTO users (email, password_hash, first_name, last_name, phone, role) VALUES (?, ?, ?, ?, ?, ?)',
        [email, hashedPassword, firstName, lastName, phone, role],
        function(err) {
          if (err) {
            db.run('ROLLBACK');
            if (err.code === 'SQLITE_CONSTRAINT') {
              return res.status(400).json({ error: 'Cet email est déjà utilisé' });
            }
            return res.status(500).json({ error: 'Erreur création utilisateur' });
          }

          const userId = this.lastID;

          // Lier à ce restaurant
          db.run(
            'INSERT INTO user_restaurants (user_id, restaurant_id, role, permissions) VALUES (?, ?, ?, ?)',
            [userId, restaurantId, role, JSON.stringify(permissions || {})],
            function(err) {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'Erreur liaison restaurant' });
              }

              db.run('COMMIT');

              res.json({
                success: true,
                user: {
                  id: userId,
                  name: `${firstName} ${lastName}`,
                  email,
                  role,
                  tempPassword
                },
                message: `Employé créé. Mot de passe temporaire: ${tempPassword}`
              });
            }
          );
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('/api/restaurants/:restaurantId/staff', requireAuth, requireRestaurantAccess, (req, res) => {
  const { restaurantId } = req.params;

  db.all(`SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.is_active, u.created_at,
          ur.role, ur.permissions
          FROM users u
          JOIN user_restaurants ur ON u.id = ur.user_id
          WHERE ur.restaurant_id = ? AND ur.is_active = 1
          ORDER BY u.created_at DESC`,
    [restaurantId], (err, staff) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      // Parser les permissions JSON
      const staffWithPermissions = staff.map(member => ({
        ...member,
        permissions: member.permissions ? JSON.parse(member.permissions) : {}
      }));

      res.json(staffWithPermissions);
    });
});

// Routes pour la gestion des plannings
app.post('/api/restaurants/:restaurantId/schedules', requireAuth, requireRestaurantAccess, (req, res) => {
  const { restaurantId } = req.params;
  const { userId, startDate, endDate, shiftType, notes } = req.body;

  // Vérifier les permissions (Manager ou Restaurateur)
  if (!['MANAGER', 'RESTAURATEUR'].includes(req.restaurantRole) && req.session.userRole !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Permission insuffisante pour gérer les plannings' });
  }

  db.run(
    `INSERT INTO schedules (user_id, restaurant_id, start_date, end_date, shift_type, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, restaurantId, startDate, endDate, shiftType, notes, req.session.userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      res.json({
        success: true,
        schedule: {
          id: this.lastID,
          userId,
          startDate,
          endDate,
          shiftType,
          notes
        }
      });
    }
  );
});

app.get('/api/restaurants/:restaurantId/schedules', requireAuth, requireRestaurantAccess, (req, res) => {
  const { restaurantId } = req.params;
  const { userId, startDate, endDate } = req.query;

  let query = `
    SELECT s.*, u.first_name, u.last_name, u.email,
           creator.first_name as created_by_name, creator.last_name as created_by_lastname
    FROM schedules s
    JOIN users u ON s.user_id = u.id
    JOIN users creator ON s.created_by = creator.id
    WHERE s.restaurant_id = ?
  `;
  const params = [restaurantId];

  if (userId) {
    query += ' AND s.user_id = ?';
    params.push(userId);
  }

  if (startDate && endDate) {
    query += ' AND s.start_date >= ? AND s.end_date <= ?';
    params.push(startDate, endDate);
  }

  // Filtrer selon le rôle
  if (req.restaurantRole === 'EMPLOYE') {
    query += ' AND s.user_id = ?';
    params.push(req.session.userId);
  }

  query += ' ORDER BY s.start_date ASC';

  db.all(query, params, (err, schedules) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(schedules);
  });
});

// Route pour générer les QR codes des tables
app.post('/api/tables', requireAuth, async (req, res) => {
  const { tableNumber, roomId, x, y } = req.body;

  try {
    const qrData = `${req.protocol}://${req.get('host')}/menu/${tableNumber}`;
    const qrCodeImage = await QRCode.toDataURL(qrData);

    db.run(
      'INSERT OR REPLACE INTO tables (table_number, qr_code, x_position, y_position, room_id, restaurant_id) VALUES (?, ?, ?, ?, ?, ?)',
      [tableNumber, qrCodeImage, x || 0, y || 0, roomId, req.session.restaurantId],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({
          id: this.lastID,
          tableNumber,
          qrCode: qrCodeImage,
          x: x || 0,
          y: y || 0
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la génération du QR code' });
  }
});

// Route pour obtenir toutes les tables
app.get('/api/tables', requireAuth, (req, res) => {
  db.all('SELECT * FROM tables WHERE restaurant_id = ? ORDER BY table_number',
    [req.session.restaurantId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Route pour mettre à jour la position d'une table
app.put('/api/tables/:id/position', requireAuth, (req, res) => {
  const { x, y } = req.body;
  const tableId = req.params.id;

  db.run(
    'UPDATE tables SET x_position = ?, y_position = ? WHERE id = ? AND restaurant_id = ?',
    [x, y, tableId, req.session.restaurantId],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ success: true });
    }
  );
});

// Route pour supprimer une table
app.delete('/api/tables/:id', (req, res) => {
  const tableId = req.params.id;

  db.run('DELETE FROM tables WHERE id = ?', [tableId], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    if (this.changes === 0) {
      res.status(404).json({ error: 'Table non trouvée' });
      return;
    }

    res.json({
      success: true,
      message: 'Table supprimée avec succès',
      deletedId: tableId
    });
  });
});

// Routes pour le menu
app.get('/api/menu', (req, res) => {
  db.all('SELECT * FROM menu_items WHERE is_available = 1 ORDER BY category, name', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// API pour obtenir les catégories de menu disponibles
app.get('/api/menu/categories', (req, res) => {
  const categories = [
    { id: 'aperitif', label: 'Apéritifs' },
    { id: 'entree', label: 'Entrées' },
    { id: 'plat', label: 'Plats' },
    { id: 'dessert', label: 'Desserts' },
    { id: 'boisson_froide', label: 'Boissons froides' },
    { id: 'boisson_chaude', label: 'Boissons chaudes' },
    { id: 'boisson_alcoolise', label: 'Boissons alcoolisées' }
  ];
  res.json(categories);
});

// API pour obtenir le menu groupé par catégories
app.get('/api/menu/by-category', (req, res) => {
  db.all('SELECT * FROM menu_items WHERE is_available = 1 ORDER BY category, name', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    // Grouper par catégories
    const menuByCategory = {
      aperitif: [],
      entree: [],
      plat: [],
      dessert: [],
      boisson_froide: [],
      boisson_chaude: [],
      boisson_alcoolise: []
    };

    rows.forEach(item => {
      const category = item.category || 'plat'; // catégorie par défaut
      if (menuByCategory[category]) {
        menuByCategory[category].push(item);
      }
    });

    res.json(menuByCategory);
  });
});

app.post('/api/menu', (req, res) => {
  const { name, description, price, category, stockQuantity, imageUrl } = req.body;

  db.run(
    'INSERT INTO menu_items (name, description, price, category, stock_quantity, image_url) VALUES (?, ?, ?, ?, ?, ?)',
    [name, description, price, category, stockQuantity || 0, imageUrl],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({
        id: this.lastID,
        name,
        description,
        price,
        category,
        stockQuantity: stockQuantity || 0,
        imageUrl
      });
    }
  );
});

app.put('/api/menu/:id', (req, res) => {
  const { name, description, price, category, stockQuantity, isAvailable, imageUrl } = req.body;
  const itemId = req.params.id;

  db.run(
    'UPDATE menu_items SET name = ?, description = ?, price = ?, category = ?, stock_quantity = ?, is_available = ?, image_url = ? WHERE id = ?',
    [name, description, price, category, stockQuantity, isAvailable ? 1 : 0, imageUrl, itemId],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ success: true });
    }
  );
});

// Routes pour les commandes
app.post('/api/orders', (req, res) => {
  const { tableId, items, totalAmount, allergies, otherAllergies } = req.body;

  db.run(
    'INSERT INTO orders (table_id, items, total_amount, allergies, other_allergies) VALUES (?, ?, ?, ?, ?)',
    [tableId, JSON.stringify(items), totalAmount, JSON.stringify(allergies || []), otherAllergies || ''],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      // Déduire les ingrédients du stock
      items.forEach(item => {
        // Récupérer les ingrédients nécessaires pour ce plat
        db.all(
          'SELECT ingredient_id, quantity_needed FROM menu_ingredients WHERE menu_item_id = ?',
          [item.id],
          (err, ingredients) => {
            if (!err && ingredients) {
              ingredients.forEach(ingredient => {
                const totalQuantityNeeded = ingredient.quantity_needed * item.quantity;

                // Déduire du stock d'ingrédients
                db.run(
                  'UPDATE ingredients SET stock_quantity = stock_quantity - ? WHERE id = ?',
                  [totalQuantityNeeded, ingredient.ingredient_id]
                );

                // Enregistrer le mouvement de stock
                db.run(
                  'INSERT INTO stock_movements (menu_item_id, movement_type, quantity, reason) VALUES (?, ?, ?, ?)',
                  [ingredient.ingredient_id, 'sortie', totalQuantityNeeded, `Commande - ${item.name || 'Plat'}`]
                );
              });
            }
          }
        );
      });

      // Marquer la table comme occupée
      db.run('UPDATE tables SET status = ? WHERE id = ?', ['occupee', tableId]);

      res.json({
        id: this.lastID,
        message: 'Commande créée avec succès'
      });
    }
  );
});

app.get('/api/orders', (req, res) => {
  db.all(`
    SELECT o.*, t.table_number
    FROM orders o
    JOIN tables t ON o.table_id = t.id
    ORDER BY o.created_at DESC
  `, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    const ordersWithItems = rows.map(order => ({
      ...order,
      items: JSON.parse(order.items)
    }));

    res.json(ordersWithItems);
  });
});

app.put('/api/orders/:id/status', (req, res) => {
  const { status } = req.body;
  const orderId = req.params.id;

  db.run(
    'UPDATE orders SET status = ? WHERE id = ?',
    [status, orderId],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      // Si la commande est terminée, libérer la table
      if (status === 'terminee') {
        db.get('SELECT table_id FROM orders WHERE id = ?', [orderId], (err, row) => {
          if (!err && row) {
            db.run('UPDATE tables SET status = ? WHERE id = ?', ['libre', row.table_id]);
          }
        });
      }

      res.json({ success: true });
    }
  );
});

// Route pour la page d'accueil - redirige vers l'interface restaurateur
app.get('/', (req, res) => {
  res.redirect('/admin');
});

// Route pour l'interface administrateur du restaurateur
app.get('/admin', (req, res) => {
  const path = require('path');
  res.sendFile(path.join(__dirname, '../client/html', 'index.html'));
});

// Route pour initialiser la base avec un menu d'exemple
app.post('/api/init-menu', (req, res) => {
  const menuItems = [
    // Apéritifs
    { name: "Kir Royal", description: "Champagne et crème de cassis", price: 8.50, category: "aperitif" },
    { name: "Cocktail Maison", description: "Rhum, fruits de la passion et menthe", price: 9.00, category: "aperitif" },

    // Entrées
    { name: "Salade César", description: "Salade verte, parmesan, croûtons, sauce césar", price: 12.00, category: "entree" },
    { name: "Foie Gras Mi-Cuit", description: "Foie gras maison, chutney de figues", price: 18.00, category: "entree" },
    { name: "Carpaccio de Bœuf", description: "Lamelles de bœuf, roquette, parmesan", price: 14.50, category: "entree" },

    // Plats
    { name: "Entrecôte Grillée", description: "300g avec frites maison et salade", price: 24.00, category: "plat" },
    { name: "Saumon Grillé", description: "Filet de saumon, légumes de saison", price: 22.00, category: "plat" },
    { name: "Risotto aux Champignons", description: "Risotto crémeux, champignons de saison", price: 18.50, category: "plat" },
    { name: "Magret de Canard", description: "Magret laqué au miel, gratin dauphinois", price: 26.00, category: "plat" },

    // Desserts
    { name: "Tiramisu Maison", description: "Tiramisu traditionnel aux amaretti", price: 7.50, category: "dessert" },
    { name: "Tarte Tatin", description: "Tarte aux pommes caramélisées, glace vanille", price: 8.00, category: "dessert" },
    { name: "Mousse au Chocolat", description: "Mousse onctueuse, chantilly", price: 6.50, category: "dessert" },

    // Boissons froides
    { name: "Coca-Cola", description: "33cl", price: 3.50, category: "boisson_froide" },
    { name: "Jus d'Orange Frais", description: "Pressé minute", price: 4.50, category: "boisson_froide" },
    { name: "Eau Minérale", description: "50cl", price: 2.50, category: "boisson_froide" },

    // Boissons chaudes
    { name: "Café Expresso", description: "Café italien", price: 2.50, category: "boisson_chaude" },
    { name: "Thé Earl Grey", description: "Thé anglais bergamote", price: 3.00, category: "boisson_chaude" },
    { name: "Chocolat Chaud", description: "Chocolat chaud maison, chantilly", price: 4.50, category: "boisson_chaude" },

    // Boissons alcoolisées
    { name: "Vin Rouge", description: "Côtes du Rhône, verre", price: 5.50, category: "boisson_alcoolise" },
    { name: "Vin Blanc", description: "Sancerre, verre", price: 6.00, category: "boisson_alcoolise" },
    { name: "Bière Pression", description: "33cl", price: 4.50, category: "boisson_alcoolise" }
  ];

  let completed = 0;
  let errors = 0;

  menuItems.forEach((item, index) => {
    db.run(
      'INSERT INTO menu_items (name, description, price, category, stock_quantity, image_url) VALUES (?, ?, ?, ?, ?, ?)',
      [item.name, item.description, item.price, item.category, 50, ''],
      function(err) {
        completed++;
        if (err) {
          errors++;
          console.log(`Erreur pour ${item.name}:`, err.message);
        }

        if (completed === menuItems.length) {
          res.json({
            success: true,
            message: `Menu initialisé: ${menuItems.length - errors} plats ajoutés, ${errors} erreurs`,
            total: menuItems.length,
            added: menuItems.length - errors,
            errors: errors
          });
        }
      }
    );
  });
});

// Route GET pour initialiser le menu facilement
app.get('/api/init-menu', (req, res) => {
  // Vérifier s'il y a déjà des éléments
  db.get('SELECT COUNT(*) as count FROM menu_items', (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    if (row.count > 0) {
      res.json({
        message: `Menu déjà présent: ${row.count} éléments trouvés. Utilisez POST pour forcer la réinitialisation.`,
        count: row.count
      });
    } else {
      // Rediriger vers POST pour ajouter le menu
      res.redirect(307, '/api/init-menu');
    }
  });
});

// Route pour initialiser des tables d'exemple
app.post('/api/init-tables', (req, res) => {
  // D'abord créer une salle par défaut
  db.run(
    'INSERT OR IGNORE INTO rooms (name, width, height, color) VALUES (?, ?, ?, ?)',
    ['Salle Principale', 600, 400, '#f8f9fa'],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      const roomId = this.lastID || 1;
      let completed = 0;
      let errors = 0;
      const totalTables = 10;

      // Créer 10 tables
      for (let i = 1; i <= totalTables; i++) {
        const QRCode = require('qrcode');
        const tableUrl = `${req.protocol}://${req.get('host')}/menu/${i}`;

        QRCode.toDataURL(tableUrl, (err, qrCode) => {
          db.run(
            'INSERT OR IGNORE INTO tables (table_number, qr_code, x_position, y_position, room_id, status) VALUES (?, ?, ?, ?, ?, ?)',
            [i, qrCode || '', Math.random() * 500, Math.random() * 300, roomId, 'libre'],
            function(err) {
              completed++;
              if (err) errors++;

              if (completed === totalTables) {
                res.json({
                  success: true,
                  message: `Tables initialisées: ${totalTables - errors} tables créées`,
                  total: totalTables,
                  added: totalTables - errors,
                  errors: errors
                });
              }
            }
          );
        });
      }
    }
  );
});

// Route pour servir le menu aux clients (via QR code)
app.get('/menu/:tableNumber', (req, res) => {
  const path = require('path');
  res.sendFile(path.join(__dirname, 'public', 'client-menu.html'));
});

// Route pour obtenir les informations d'une table
app.get('/api/table/:tableNumber', (req, res) => {
  const tableNumber = req.params.tableNumber;

  db.get('SELECT * FROM tables WHERE table_number = ?', [tableNumber], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Table non trouvée' });
      return;
    }
    res.json(row);
  });
});

// Endpoints pour les salles
app.get('/api/rooms', (req, res) => {
  db.all('SELECT * FROM rooms ORDER BY created_at ASC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/rooms', (req, res) => {
  const { name, width, height, color } = req.body;

  db.run(
    'INSERT INTO rooms (name, width, height, color) VALUES (?, ?, ?, ?)',
    [name, width, height, color],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({
        id: this.lastID,
        name,
        width,
        height,
        color,
        success: true
      });
    }
  );
});

app.delete('/api/rooms/:id', (req, res) => {
  const roomId = req.params.id;

  // Supprimer d'abord toutes les tables de cette salle
  db.run('DELETE FROM tables WHERE room_id = ?', [roomId], (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    // Puis supprimer la salle
    db.run('DELETE FROM rooms WHERE id = ?', [roomId], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ success: true });
    });
  });
});

// Route pour mettre à jour une salle
app.put('/api/rooms/:id', (req, res) => {
  const roomId = req.params.id;
  const { name, width, height, color } = req.body;

  db.run(
    'UPDATE rooms SET name = ?, width = ?, height = ?, color = ? WHERE id = ?',
    [name, width, height, color, roomId],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      // Vérifier si des tables sortent des nouvelles limites et les ajuster si nécessaire
      db.run(
        `UPDATE tables
         SET x_position = CASE
           WHEN x_position > ? THEN ?
           ELSE x_position
         END,
         y_position = CASE
           WHEN y_position > ? THEN ?
           ELSE y_position
         END
         WHERE room_id = ?`,
        [width - 100, width - 100, height - 100, height - 100, roomId],
        (err) => {
          if (err) {
            console.error('Erreur lors de l\'ajustement des positions des tables:', err);
          }
          res.json({
            success: true,
            message: 'Salle mise à jour avec succès'
          });
        }
      );
    }
  );
});

// Endpoint pour enregistrer les mouvements de stock
app.post('/api/stock-movements', (req, res) => {
  const { item_id, quantity, movement_type, reason } = req.body;

  db.run(
    'INSERT INTO stock_movements (menu_item_id, movement_type, quantity, reason) VALUES (?, ?, ?, ?)',
    [item_id, movement_type, quantity, reason],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({
        id: this.lastID,
        success: true
      });
    }
  );
});

// Routes pour la gestion des ingrédients
app.get('/api/ingredients', (req, res) => {
  db.all('SELECT * FROM ingredients ORDER BY name', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/ingredients', (req, res) => {
  const { name, unit, stock_quantity, min_quantity, cost_per_unit, supplier } = req.body;

  db.run(
    'INSERT INTO ingredients (name, unit, stock_quantity, min_quantity, cost_per_unit, supplier) VALUES (?, ?, ?, ?, ?, ?)',
    [name, unit, stock_quantity || 0, min_quantity || 0, cost_per_unit || 0, supplier],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({
        id: this.lastID,
        name,
        unit,
        stock_quantity: stock_quantity || 0,
        min_quantity: min_quantity || 0,
        cost_per_unit: cost_per_unit || 0,
        supplier
      });
    }
  );
});

app.put('/api/ingredients/:id', (req, res) => {
  const ingredientId = req.params.id;
  const { name, unit, stock_quantity, min_quantity, cost_per_unit, supplier } = req.body;

  db.run(
    'UPDATE ingredients SET name = ?, unit = ?, stock_quantity = ?, min_quantity = ?, cost_per_unit = ?, supplier = ? WHERE id = ?',
    [name, unit, stock_quantity, min_quantity, cost_per_unit, supplier, ingredientId],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ success: true });
    }
  );
});

app.delete('/api/ingredients/:id', (req, res) => {
  const ingredientId = req.params.id;

  db.run('DELETE FROM ingredients WHERE id = ?', [ingredientId], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    if (this.changes === 0) {
      res.status(404).json({ error: 'Ingrédient non trouvé' });
      return;
    }

    res.json({
      success: true,
      message: 'Ingrédient supprimé avec succès',
      deletedId: ingredientId
    });
  });
});

// Endpoint pour enregistrer les mouvements d'ingrédients
app.post('/api/ingredient-movements', (req, res) => {
  const { ingredient_id, movement_type, quantity, reason } = req.body;

  db.run(
    'INSERT INTO stock_movements (menu_item_id, movement_type, quantity, reason) VALUES (?, ?, ?, ?)',
    [ingredient_id, movement_type, quantity, reason],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({
        id: this.lastID,
        success: true
      });
    }
  );
});

// Routes pour les recettes (liaison plat-ingrédients)
app.get('/api/menu/:id/ingredients', (req, res) => {
  const menuItemId = req.params.id;

  db.all(`
    SELECT mi.*, i.name, i.unit
    FROM menu_ingredients mi
    JOIN ingredients i ON mi.ingredient_id = i.id
    WHERE mi.menu_item_id = ?
  `, [menuItemId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/menu/:id/ingredients', (req, res) => {
  const menuItemId = req.params.id;
  const { ingredient_id, quantity_needed } = req.body;

  db.run(
    'INSERT INTO menu_ingredients (menu_item_id, ingredient_id, quantity_needed) VALUES (?, ?, ?)',
    [menuItemId, ingredient_id, quantity_needed],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({
        id: this.lastID,
        success: true
      });
    }
  );
});

app.delete('/api/menu-ingredients/:id', (req, res) => {
  const menuIngredientId = req.params.id;

  db.run('DELETE FROM menu_ingredients WHERE id = ?', [menuIngredientId], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true });
  });
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});