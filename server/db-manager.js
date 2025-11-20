// Gestionnaire de base de données PostgreSQL SEULEMENT
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

let db;
const isPostgreSQL = true; // POSTGRESQL SEULEMENT

// Configuration PostgreSQL FORCÉE
console.log('🔧 POSTGRESQL SEULEMENT - SQLite supprimé !');
console.log('📊 Variables d\'environnement PostgreSQL:');
console.log('- DATABASE_URL:', process.env.DATABASE_URL ? '[DÉFINIE]' : '[NON DÉFINIE]');
console.log('- PGHOST:', process.env.PGHOST || '[NON DÉFINIE]');
console.log('- PGUSER:', process.env.PGUSER || '[NON DÉFINIE]');
console.log('- PGDATABASE:', process.env.PGDATABASE || '[NON DÉFINIE]');
console.log('- NODE_ENV:', process.env.NODE_ENV || '[NON DÉFINIE]');
console.log('- PORT:', process.env.PORT || '[NON DÉFINIE]');

// Configuration de connexion PostgreSQL
let connectionConfig;

if (process.env.DATABASE_URL) {
  // Utiliser DATABASE_URL (recommandé Railway)
  connectionConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  };
  console.log('📡 Utilisation DATABASE_URL pour PostgreSQL');
} else {
  // Configuration par variables individuelles
  connectionConfig = {
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT || 5432,
    database: process.env.PGDATABASE || 'postgres',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  };
  console.log('🔧 Utilisation variables PostgreSQL individuelles');
  console.log('⚠️ Si échec: configurez DATABASE_URL sur Railway !');
}

const client = new Client(connectionConfig);

console.log('🔄 Connexion à PostgreSQL...');

client.connect()
  .then(() => {
    console.log('✅ Connecté à PostgreSQL');
    console.log('🎉 DONNÉES PERSISTANTES GARANTIES !');
    initializeDatabase();
  })
  .catch(err => {
    console.error('❌ ERREUR CRITIQUE PostgreSQL:', err);
    console.error('');
    console.error('🚨 IMPOSSIBLE DE CONTINUER SANS POSTGRESQL !');
    console.error('📋 SOLUTION URGENTE:');
    console.error('   1. Railway Dashboard → Votre projet');
    console.error('   2. Add Service → Database → PostgreSQL');
    console.error('   3. Copiez DATABASE_URL depuis Connect tab');
    console.error('   4. Ajoutez DATABASE_URL dans Variables');
    console.error('   5. Redéployez');
    console.error('');
    console.error('💀 APPLICATION ARRÊTÉE - PostgreSQL requis !');
    process.exit(1);
  });

db = client;

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
    const existingRestaurant = await get(`SELECT id FROM restaurants WHERE email = $1`, ['restaurateur@test.com']);

    let restaurantId;
    if (!existingRestaurant) {
      // Créer le restaurant
      const restaurantResult = await run(
        `INSERT INTO restaurants (name, owner_name, email, password_hash, phone, address) VALUES ($1, $2, $3, $4, $5, $6)`,
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
      const existingUser = await get(`SELECT id FROM users WHERE email = $1`, [email]);

      if (!existingUser) {
        const userResult = await run(
          `INSERT INTO users (email, password_hash, first_name, last_name, phone, role) VALUES ($1, $2, $3, $4, $5, $6)`,
          [email, password, firstName, lastName, phone, role]
        );

        const userId = userResult.lastID || (await get(`SELECT id FROM users WHERE email = $1`, [email])).id;
        console.log(`✅ ${role} créé - ID:`, userId);

        // Lier au restaurant (sauf Super Admin)
        if (role !== 'SUPER_ADMIN') {
          await run(
            `INSERT INTO user_restaurants (user_id, restaurant_id, role) VALUES ($1, $2, $3)`,
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