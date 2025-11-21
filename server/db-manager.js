// Gestionnaire de base de données MySQL
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

let db;
const isMySQL = true; // MYSQL UTILISÉ

// Configuration MySQL
console.log('🔧 MIGRATION VERS MYSQL !');
console.log('📊 Variables d\'environnement MySQL:');
console.log('- DATABASE_URL:', process.env.DATABASE_URL ? '[DÉFINIE]' : '[NON DÉFINIE]');
console.log('- MYSQL_HOST:', process.env.MYSQL_HOST || '[NON DÉFINIE]');
console.log('- MYSQL_USER:', process.env.MYSQL_USER || '[NON DÉFINIE]');
console.log('- MYSQL_DATABASE:', process.env.MYSQL_DATABASE || '[NON DÉFINIE]');
console.log('- NODE_ENV:', process.env.NODE_ENV || '[NON DÉFINIE]');
console.log('- PORT:', process.env.PORT || '[NON DÉFINIE]');

// Configuration de connexion MySQL
let connectionConfig;

if (process.env.DATABASE_URL) {
  // Utiliser DATABASE_URL (format MySQL)
  connectionConfig = process.env.DATABASE_URL;
  console.log('📡 Utilisation DATABASE_URL pour MySQL');
} else {
  // Configuration par variables individuelles
  connectionConfig = {
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'restaurant_db',
    charset: 'utf8mb4',
    timezone: '+00:00'
  };
  console.log('🔧 Utilisation variables MySQL individuelles');
  console.log('⚠️ Configuration locale:', {
    host: connectionConfig.host,
    database: connectionConfig.database,
    user: connectionConfig.user
  });
}

console.log('🔄 Connexion à MySQL...');

// Créer la connexion
async function initializeConnection() {
  try {
    if (typeof connectionConfig === 'string') {
      db = await mysql.createConnection(connectionConfig);
    } else {
      db = await mysql.createConnection(connectionConfig);
    }

    console.log('✅ Connecté à MySQL');
    console.log('🎉 MIGRATION MYSQL RÉUSSIE !');

    // Initialiser la base de données
    await initializeDatabase();
  } catch (err) {
    console.error('❌ ERREUR CRITIQUE MySQL:', err);
    console.error('');
    console.error('🚨 IMPOSSIBLE DE CONTINUER SANS MYSQL !');
    console.error('📋 SOLUTION URGENTE:');
    console.error('   1. Installer MySQL localement');
    console.error('   2. Créer une base de données "restaurant_db"');
    console.error('   3. Configurer les variables d\'environnement:');
    console.error('      - MYSQL_HOST=localhost');
    console.error('      - MYSQL_USER=root');
    console.error('      - MYSQL_PASSWORD=votre_password');
    console.error('      - MYSQL_DATABASE=restaurant_db');
    console.error('   4. Redémarrer l\'application');
    console.error('');
    console.error('💀 APPLICATION ARRÊTÉE - MySQL requis !');
    process.exit(1);
  }
}

// Initialiser la connexion
initializeConnection();

// Fonction pour exécuter des requêtes de manière unifiée
async function query(sql, params = []) {
  try {
    const [rows] = await db.execute(sql, params);
    return rows;
  } catch (error) {
    console.error('Erreur SQL query:', error);
    throw error;
  }
}

async function run(sql, params = []) {
  try {
    const [result] = await db.execute(sql, params);
    return {
      lastID: result.insertId,
      changes: result.affectedRows,
      insertId: result.insertId
    };
  } catch (error) {
    console.error('Erreur SQL run:', error);
    throw error;
  }
}

async function get(sql, params = []) {
  try {
    const [rows] = await db.execute(sql, params);
    return rows[0] || null;
  } catch (error) {
    console.error('Erreur SQL get:', error);
    throw error;
  }
}

// Initialiser la base de données avec les tables et données de test
async function initializeDatabase() {
  try {
    console.log('🔧 Initialisation de la base de données MySQL...');

    // Tables principales
    await createTables();

    // Créer les comptes de test
    await createTestAccounts();

    console.log('✅ Base de données MySQL initialisée avec succès !');
  } catch (error) {
    console.error('❌ Erreur initialisation base MySQL:', error);
  }
}

async function createTables() {
  const tableQueries = getTableQueries();

  for (const queryText of tableQueries) {
    try {
      await db.execute(queryText);
    } catch (error) {
      console.log('⚠️ Table déjà existante ou erreur:', error.message);
    }
  }
}

function getTableQueries() {
  return [
    `CREATE TABLE IF NOT EXISTS restaurants (
        id INT AUTO_INCREMENT PRIMARY KEY,
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
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        role ENUM('SUPER_ADMIN', 'RESTAURATEUR', 'MANAGER', 'EMPLOYE') NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

    `CREATE TABLE IF NOT EXISTS user_restaurants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        restaurant_id INT NOT NULL,
        role ENUM('RESTAURATEUR', 'MANAGER', 'EMPLOYE') NOT NULL,
        permissions TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
      )`,

    `CREATE TABLE IF NOT EXISTS menu_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        category VARCHAR(255),
        image_url TEXT,
        is_available BOOLEAN DEFAULT true,
        restaurant_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
      )`,

    `CREATE TABLE IF NOT EXISTS rooms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        color VARCHAR(20) DEFAULT '#e3f2fd',
        width INT DEFAULT 600,
        height INT DEFAULT 400,
        restaurant_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
      )`,

    `CREATE TABLE IF NOT EXISTS tables (
        id INT AUTO_INCREMENT PRIMARY KEY,
        table_number VARCHAR(50) NOT NULL,
        room_id INT NOT NULL,
        capacity INT NOT NULL DEFAULT 4,
        status ENUM('available', 'occupied', 'reserved', 'maintenance') DEFAULT 'available',
        qr_code TEXT,
        x_position INT DEFAULT 50,
        y_position INT DEFAULT 50,
        shape ENUM('round', 'square') DEFAULT 'round',
        table_size ENUM('small', 'medium', 'large') DEFAULT 'medium',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms (id),
        UNIQUE KEY unique_table_room (table_number, room_id)
      )`,

    `CREATE TABLE IF NOT EXISTS ingredients (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        unit VARCHAR(50) NOT NULL,
        stock_quantity DECIMAL(10,2) DEFAULT 0,
        min_quantity DECIMAL(10,2) DEFAULT 0,
        cost_per_unit DECIMAL(10,2) DEFAULT 0,
        supplier VARCHAR(255),
        restaurant_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
      )`,

    `CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        table_id INT,
        items TEXT,
        total_amount DECIMAL(10,2),
        status VARCHAR(50) DEFAULT 'en_attente',
        customer_name VARCHAR(255),
        notes TEXT,
        restaurant_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (table_id) REFERENCES tables (id),
        FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
      )`
    ];
}

async function createTestAccounts() {
  try {
    console.log('👥 Création des comptes de test MySQL...');

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
      restaurantId = restaurantResult.insertId;
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

        const userId = userResult.insertId;
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
    console.error('❌ Erreur création comptes MySQL:', error);
  }
}

module.exports = {
  db,
  query,
  run,
  get,
  isMySQL,
  createTables
};