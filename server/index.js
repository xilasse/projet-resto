const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));
app.use('/client', express.static('../client'));

const db = new sqlite3.Database('restaurant.db');

db.serialize(() => {
  // Créer les tables principales d'abord
  db.run(`CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    width INTEGER DEFAULT 600,
    height INTEGER DEFAULT 400,
    color TEXT DEFAULT '#f8f9fa',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_number INTEGER UNIQUE,
    qr_code TEXT,
    x_position REAL DEFAULT 0,
    y_position REAL DEFAULT 0,
    room_id INTEGER,
    status TEXT DEFAULT 'libre',
    FOREIGN KEY (room_id) REFERENCES rooms (id)
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (table_id) REFERENCES tables (id)
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

  // Vérifier et ajouter les colonnes d'allergies si nécessaires
  db.all(`PRAGMA table_info(orders)`, [], (err, columns) => {
    if (!err && columns) {
      const hasAllergies = columns.some(col => col.name === 'allergies');
      const hasOtherAllergies = columns.some(col => col.name === 'other_allergies');

      if (!hasAllergies) {
        db.run(`ALTER TABLE orders ADD COLUMN allergies TEXT`);
      }
      if (!hasOtherAllergies) {
        db.run(`ALTER TABLE orders ADD COLUMN other_allergies TEXT`);
      }
    }
  });

  db.run(`CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_item_id INTEGER,
    movement_type TEXT,
    quantity INTEGER,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items (id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    stock_quantity REAL DEFAULT 0,
    min_quantity REAL DEFAULT 0,
    cost_per_unit REAL DEFAULT 0,
    supplier TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

// Route pour générer les QR codes des tables
app.post('/api/tables', async (req, res) => {
  const { tableNumber, roomId, x, y } = req.body;

  try {
    const qrData = `${req.protocol}://${req.get('host')}/menu/${tableNumber}`;
    const qrCodeImage = await QRCode.toDataURL(qrData);

    db.run(
      'INSERT OR REPLACE INTO tables (table_number, qr_code, x_position, y_position, room_id) VALUES (?, ?, ?, ?, ?)',
      [tableNumber, qrCodeImage, x || 0, y || 0, roomId],
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
app.get('/api/tables', (req, res) => {
  db.all('SELECT * FROM tables ORDER BY table_number', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Route pour mettre à jour la position d'une table
app.put('/api/tables/:id/position', (req, res) => {
  const { x, y } = req.body;
  const tableId = req.params.id;

  db.run(
    'UPDATE tables SET x_position = ?, y_position = ? WHERE id = ?',
    [x, y, tableId],
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

// Route pour la page d'accueil
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Restaurant Management</title>
        <meta charset="utf-8">
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #333; text-align: center; }
            .links { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-top: 30px; }
            .link-card { background: #007bff; color: white; padding: 20px; border-radius: 8px; text-decoration: none; text-align: center; transition: background 0.3s; }
            .link-card:hover { background: #0056b3; color: white; text-decoration: none; }
            .status { background: #28a745; color: white; padding: 10px; border-radius: 5px; text-align: center; margin-bottom: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="status">🟢 Serveur en ligne - Port ${PORT}</div>
            <h1>🍽️ Système de Gestion Restaurant</h1>
            <div class="links">
                <a href="/client" class="link-card">
                    <h3>📱 Interface Client</h3>
                    <p>Application de gestion des tables et commandes</p>
                </a>
                <a href="/api/tables" class="link-card">
                    <h3>🪑 API Tables</h3>
                    <p>Visualiser les tables disponibles</p>
                </a>
                <a href="/api/menu" class="link-card">
                    <h3>📋 API Menu</h3>
                    <p>Voir le menu complet du restaurant</p>
                </a>
                <a href="/api/orders" class="link-card">
                    <h3>📦 API Commandes</h3>
                    <p>Gérer les commandes en cours</p>
                </a>
            </div>
        </div>
    </body>
    </html>
  `);
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