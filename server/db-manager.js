// Gestionnaire de base de données adaptatif pour SQLite et PostgreSQL
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

let db;
let isPostgreSQL = false;

// Debug des variables d'environnement
console.log('🔍 DIAGNOSTIC ENVIRONNEMENT:');
console.log('- DATABASE_URL:', process.env.DATABASE_URL ? '[DÉFINIE]' : '[NON DÉFINIE]');
console.log('- PGHOST:', process.env.PGHOST || '[NON DÉFINIE]');
console.log('- PGUSER:', process.env.PGUSER || '[NON DÉFINIE]');
console.log('- PGDATABASE:', process.env.PGDATABASE || '[NON DÉFINIE]');
console.log('- NODE_ENV:', process.env.NODE_ENV || '[NON DÉFINIE]');
console.log('- PORT:', process.env.PORT || '[NON DÉFINIE]');

// Vérification améliorée pour détecter Railway et forcer PostgreSQL
const isRailway = process.env.RAILWAY_ENVIRONMENT ||
                  process.env.RAILWAY_PROJECT_ID ||
                  process.env.RAILWAY_PROJECT_NAME ||
                  process.env.RAILWAY_SERVICE_NAME ||
                  process.env.RAILWAY_ENVIRONMENT_NAME ||
                  (process.env.PORT && process.env.NODE_ENV === 'production');

const hasPostgresConfig = process.env.DATABASE_URL || process.env.PGHOST || process.env.PGUSER;

// Diagnostic détaillé
console.log('🔍 DIAGNOSTIC COMPLET ENVIRONNEMENT:');
console.log('- Railway détecté:', !!isRailway);
console.log('- NODE_ENV:', process.env.NODE_ENV || '[NON DÉFINIE]');
console.log('- RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT || '[NON DÉFINIE]');
console.log('- PostgreSQL configuré:', !!hasPostgresConfig);

// Vérification critique pour la production
if ((process.env.NODE_ENV === 'production' || isRailway) && !hasPostgresConfig) {
  console.error('❌ ERREUR CRITIQUE: Environnement de production/Railway détecté mais aucune base PostgreSQL configurée !');
  console.error('💡 SOLUTION: Ajoutez un service PostgreSQL sur Railway et configurez DATABASE_URL');
  console.error('🚨 LES DONNÉES SERONT PERDUES À CHAQUE REDÉPLOIEMENT !');
  console.error('📋 Pour Railway: Ajoutez le service PostgreSQL et la variable DATABASE_URL sera auto-configurée');
}

// Forcer PostgreSQL sur Railway même si DATABASE_URL n'est pas définie
if (isRailway && !hasPostgresConfig) {
  console.warn('⚠️ RAILWAY DÉTECTÉ SANS POSTGRESQL - Tentative de configuration automatique...');
  // Railway devrait automatiquement fournir DATABASE_URL quand PostgreSQL est ajouté
}

// Utiliser PostgreSQL SI on a la configuration OU si Railway avec DATABASE_URL
if (hasPostgresConfig) {
  // Production - PostgreSQL sur Railway
  console.log('🔄 Connexion à PostgreSQL sur Railway...');
  console.log('📊 Configuration PostgreSQL détectée');
  const { Client } = require('pg');

  // Configuration de connexion intelligente pour Railway
  let connectionConfig;

  if (process.env.DATABASE_URL) {
    // Utiliser DATABASE_URL si disponible (recommandé Railway)
    connectionConfig = {
      connectionString: process.env.DATABASE_URL,
      ssl: isRailway ? { rejectUnauthorized: false } : false
    };
    console.log('📡 Utilisation DATABASE_URL pour PostgreSQL');
  } else {
    // Configuration par variables individuelles (fallback)
    connectionConfig = {
      host: process.env.PGHOST || 'localhost',
      port: process.env.PGPORT || 5432,
      database: process.env.PGDATABASE || 'railway',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || '',
      ssl: isRailway ? { rejectUnauthorized: false } : false
    };
    console.log('🔧 Utilisation variables PostgreSQL individuelles');
  }

  const client = new Client(connectionConfig);

  client.connect()
    .then(() => {
      console.log('✅ Connecté à PostgreSQL');
      console.log('🎉 DONNÉES PERSISTANTES - Redéploiements sans perte !');
      initializeDatabase();
    })
    .catch(err => {
      console.error('❌ Erreur PostgreSQL:', err);

      // Sur Railway, en cas d'erreur PostgreSQL, donner instructions et continuer avec SQLite
      if (isRailway) {
        console.error('🚨 ERREUR CRITIQUE: Railway détecté mais échec connexion PostgreSQL !');
        console.error('💡 Le service PostgreSQL n\'est pas correctement configuré sur Railway');
        console.error('📋 INSTRUCTIONS POUR RÉPARER:');
        console.error('   1. Allez dans Railway Dashboard');
        console.error('   2. Cliquez sur votre projet restaurant');
        console.error('   3. Cliquez "Add Service" → "Database" → "PostgreSQL"');
        console.error('   4. Une fois créé, cliquez sur le service PostgreSQL');
        console.error('   5. Allez dans "Connect" → copiez la "Postgres Connection URL"');
        console.error('   6. Dans Variables, ajoutez DATABASE_URL avec cette URL');
        console.error('   7. Redéployez l\'application');
        console.error('');
        console.error('⚠️ ATTENTION: Utilisation temporaire de SQLite - DONNÉES PERDUES AU REDÉPLOIEMENT!');
        console.error('🔄 Basculement vers SQLite pour maintenir l\'app fonctionnelle...');

        // Continuer avec SQLite plutôt que crash
        db = new (require('sqlite3').verbose()).Database(':memory:', (err) => {
          if (err) {
            console.error('❌ Erreur SQLite fallback:', err);
            process.exit(1);
          } else {
            console.log('✅ SQLite temporaire connecté (mémoire)');
            console.log('🚨 RÉPAREZ POSTGRESQL RAPIDEMENT - DONNÉES TEMPORAIRES !');
            initializeDatabase();
          }
        });
        isPostgreSQL = false;
        return; // Important: sortir de cette branche
      }
    });

  db = client;
  isPostgreSQL = true;

} else {
  // Pas de configuration PostgreSQL
  if (isRailway) {
    // Railway sans PostgreSQL configuré
    console.log('🔄 Railway détecté mais PostgreSQL non configuré...');
    console.error('🚨 CONFIGURATION POSTGRESQL MANQUANTE SUR RAILWAY !');
    console.error('📋 ÉTAPES POUR CONFIGURER POSTGRESQL:');
    console.error('   1. Ouvrez Railway Dashboard (https://railway.app)');
    console.error('   2. Sélectionnez votre projet restaurant');
    console.error('   3. Cliquez "+ Add Service" ou "New"');
    console.error('   4. Choisissez "Database" puis "PostgreSQL"');
    console.error('   5. Railway créera automatiquement DATABASE_URL');
    console.error('   6. Redéployez l\'application');
    console.error('');
    console.error('⚠️ UTILISATION TEMPORAIRE DE SQLITE EN MÉMOIRE');
    console.error('🚨 TOUTES LES DONNÉES SERONT PERDUES AU REDÉPLOIEMENT !');

    // SQLite en mémoire pour Railway sans PostgreSQL
    db = new sqlite3.Database(':memory:', (err) => {
      if (err) {
        console.error('❌ Erreur SQLite mémoire:', err);
      } else {
        console.log('✅ SQLite temporaire connecté (mémoire)');
        console.log('🔄 Application fonctionnelle mais DONNÉES TEMPORAIRES');
        initializeDatabase();
      }
    });
  } else {
    // Développement local - SQLite normal
    console.log('🔄 Connexion à SQLite local...');
    console.log('⚠️ ATTENTION: Utilisation de SQLite - les données seront perdues au redéploiement !');
    console.log('💡 Pour utiliser PostgreSQL, définissez DATABASE_URL dans les variables d\'environnement');

    db = new sqlite3.Database('./restaurant.db', (err) => {
      if (err) {
        console.error('❌ Erreur SQLite:', err);
      } else {
        console.log('✅ Connecté à SQLite');
        console.log('📁 Fichier de base: ./restaurant.db');
        initializeDatabase();
      }
    });
  }
  isPostgreSQL = false;
}

// Fonction pour exécuter des requêtes de manière unifiée
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (isPostgreSQL) {
      db.query(sql, params)
        .then(result => resolve(result.rows))
        .catch(reject);
    } else {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    }
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (isPostgreSQL) {
      db.query(sql, params)
        .then(result => resolve({ lastID: result.rows[0]?.id, changes: result.rowCount }))
        .catch(reject);
    } else {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    }
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (isPostgreSQL) {
      db.query(sql, params)
        .then(result => resolve(result.rows[0] || null))
        .catch(reject);
    } else {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    }
  });
}

// Initialiser la base de données avec les tables et données de test
async function initializeDatabase() {
  try {
    console.log('🔧 Initialisation de la base de données...');

    // Tables principales
    await createTables();

    // Créer les comptes de test
    await createTestAccounts();

    console.log('✅ Base de données initialisée avec succès !');
  } catch (error) {
    console.error('❌ Erreur initialisation base:', error);
  }
}

async function createTables() {
  const tableQueries = getTableQueries();

  for (const query of tableQueries) {
    try {
      await run(query);
    } catch (error) {
      console.log('⚠️ Table déjà existante ou erreur:', error.message);
    }
  }
}

function getTableQueries() {
  if (isPostgreSQL) {
    return [
      `CREATE TABLE IF NOT EXISTS restaurants (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        owner_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        address TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        role VARCHAR(20) NOT NULL CHECK (role IN ('SUPER_ADMIN', 'RESTAURATEUR', 'MANAGER', 'EMPLOYE')),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS user_restaurants (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        restaurant_id INTEGER NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('RESTAURATEUR', 'MANAGER', 'EMPLOYE')),
        permissions TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
      )`,

      `CREATE TABLE IF NOT EXISTS menu_items (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        category VARCHAR(255),
        image_url TEXT,
        is_available BOOLEAN DEFAULT true,
        restaurant_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
      )`,

      `CREATE TABLE IF NOT EXISTS rooms (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        color VARCHAR(20) DEFAULT '#e3f2fd',
        width INTEGER DEFAULT 600,
        height INTEGER DEFAULT 400,
        restaurant_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
      )`,

      `CREATE TABLE IF NOT EXISTS tables (
        id SERIAL PRIMARY KEY,
        table_number VARCHAR(50) NOT NULL,
        room_id INTEGER NOT NULL,
        capacity INTEGER NOT NULL DEFAULT 4,
        status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved', 'maintenance')),
        qr_code TEXT,
        x_position INTEGER DEFAULT 50,
        y_position INTEGER DEFAULT 50,
        shape VARCHAR(10) DEFAULT 'round' CHECK (shape IN ('round', 'square')),
        table_size VARCHAR(10) DEFAULT 'medium' CHECK (table_size IN ('small', 'medium', 'large')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms (id),
        UNIQUE(table_number, room_id)
      )`,

      `CREATE TABLE IF NOT EXISTS ingredients (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        unit VARCHAR(50) NOT NULL,
        stock_quantity DECIMAL(10,2) DEFAULT 0,
        min_quantity DECIMAL(10,2) DEFAULT 0,
        cost_per_unit DECIMAL(10,2) DEFAULT 0,
        supplier VARCHAR(255),
        restaurant_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
      )`,

      `CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        table_id INTEGER,
        items TEXT,
        total_amount DECIMAL(10,2),
        status VARCHAR(50) DEFAULT 'en_attente',
        customer_name VARCHAR(255),
        notes TEXT,
        restaurant_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (table_id) REFERENCES tables (id),
        FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
      )`
    ];
  } else {
    // SQLite queries (existantes)
    return [
      `CREATE TABLE IF NOT EXISTS restaurants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        owner_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT,
        role TEXT NOT NULL CHECK (role IN ('SUPER_ADMIN', 'RESTAURATEUR', 'MANAGER', 'EMPLOYE')),
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS user_restaurants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        restaurant_id INTEGER NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('RESTAURATEUR', 'MANAGER', 'EMPLOYE')),
        permissions TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
      )`,

      `CREATE TABLE IF NOT EXISTS menu_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        category TEXT,
        image_url TEXT,
        is_available INTEGER DEFAULT 1,
        restaurant_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
      )`,

      `CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#e3f2fd',
        width INTEGER DEFAULT 600,
        height INTEGER DEFAULT 400,
        restaurant_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
      )`,

      `CREATE TABLE IF NOT EXISTS tables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_number TEXT NOT NULL,
        room_id INTEGER NOT NULL,
        capacity INTEGER NOT NULL DEFAULT 4,
        status TEXT DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved', 'maintenance')),
        qr_code TEXT,
        x_position INTEGER DEFAULT 50,
        y_position INTEGER DEFAULT 50,
        shape TEXT DEFAULT 'round' CHECK (shape IN ('round', 'square')),
        table_size TEXT DEFAULT 'medium' CHECK (table_size IN ('small', 'medium', 'large')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms (id),
        UNIQUE(table_number, room_id)
      )`,

      `CREATE TABLE IF NOT EXISTS ingredients (
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
      )`,

      `CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_id INTEGER,
        items TEXT,
        total_amount REAL,
        status TEXT DEFAULT 'en_attente',
        customer_name TEXT,
        notes TEXT,
        restaurant_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (table_id) REFERENCES tables (id),
        FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
      )`
    ];
  }
}

async function createTestAccounts() {
  try {
    console.log('👥 Création des comptes de test...');

    // Hasher les mots de passe
    const restaurateurPassword = await bcrypt.hash('test123', 10);
    const managerPassword = await bcrypt.hash('manager123', 10);
    const employeePassword = await bcrypt.hash('employee123', 10);
    const superAdminPassword = await bcrypt.hash('venezesas542sp', 10);

    // Vérifier si le restaurant existe déjà
    const existingRestaurant = await get(`SELECT id FROM restaurants WHERE email = ?`, ['restaurateur@test.com']);

    let restaurantId;
    if (!existingRestaurant) {
      // Créer le restaurant
      const restaurantResult = await run(
        `INSERT INTO restaurants (name, owner_name, email, password_hash, phone, address) VALUES (?, ?, ?, ?, ?, ?)`,
        ['Restaurant Le Gourmet', 'Jean Dupont', 'restaurateur@test.com', restaurateurPassword, '0123456789', '123 Rue de la Paix, Paris']
      );
      restaurantId = restaurantResult.lastID || 1;
      console.log('✅ Restaurant créé - ID:', restaurantId);
    } else {
      restaurantId = existingRestaurant.id;
      console.log('ℹ️ Restaurant déjà existant - ID:', restaurantId);
    }

    // Créer les utilisateurs s'ils n'existent pas
    const users = [
      ['restaurateur@test.com', restaurateurPassword, 'Jean', 'Dupont', '0123456789', 'RESTAURATEUR'],
      ['manager@test.com', managerPassword, 'Marie', 'Martin', '0123456788', 'MANAGER'],
      ['employe@test.com', employeePassword, 'Pierre', 'Moreau', '0123456787', 'EMPLOYE'],
      ['superadmin@restaurant.com', superAdminPassword, 'Super', 'Admin', '', 'SUPER_ADMIN']
    ];

    for (const [email, password, firstName, lastName, phone, role] of users) {
      const existingUser = await get(`SELECT id FROM users WHERE email = ?`, [email]);

      if (!existingUser) {
        const userResult = await run(
          `INSERT INTO users (email, password_hash, first_name, last_name, phone, role) VALUES (?, ?, ?, ?, ?, ?)`,
          [email, password, firstName, lastName, phone, role]
        );

        const userId = userResult.lastID || (await get(`SELECT id FROM users WHERE email = ?`, [email])).id;
        console.log(`✅ ${role} créé - ID:`, userId);

        // Lier au restaurant (sauf Super Admin)
        if (role !== 'SUPER_ADMIN') {
          await run(
            `INSERT INTO user_restaurants (user_id, restaurant_id, role) VALUES (?, ?, ?)`,
            [userId, restaurantId, role]
          );
          console.log(`✅ ${role} lié au restaurant`);
        }
      } else {
        console.log(`ℹ️ ${role} déjà existant`);
      }
    }

    console.log('\n🎉 Comptes de test prêts !');
    console.log('👨‍💼 Restaurateur: restaurateur@test.com / test123');
    console.log('👩‍💼 Manager: manager@test.com / manager123');
    console.log('👨‍🍳 Employé: employe@test.com / employee123');
    console.log('👑 Super Admin: superadmin@restaurant.com / venezesas542sp');

  } catch (error) {
    console.error('❌ Erreur création comptes:', error);
  }
}

module.exports = {
  db,
  query,
  run,
  get,
  isPostgreSQL,
  createTables
};