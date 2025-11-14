// Application principale pour l'administration du restaurant

class RestaurantApp {
    constructor() {
        this.currentSection = 'menu';
        this.menuItems = [];
        this.tables = [];
        this.orders = [];
        this.rooms = [];
        this.selectedMenuItem = null;
        this.selectedTable = null;

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadData();
    }

    setupEventListeners() {
        // Navigation entre les sections
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchSection(e.target.id.replace('Tab', ''));
            });
        });

        // Boutons d'ajout
        document.getElementById('addMenuItemBtn').addEventListener('click', () => {
            this.openMenuItemModal();
        });

        // Bouton d'ajout d'utilisateur
        const addUserBtn = document.getElementById('addUserBtn');
        if (addUserBtn) {
            addUserBtn.addEventListener('click', () => {
                authManager.openCreateUserModal();
            });
        }

        // Bouton d'initialisation du menu
        document.getElementById('initMenuBtn').addEventListener('click', async () => {
            if (confirm('Voulez-vous initialiser le menu avec des plats d\'exemple ? Cela ajoutera 20 plats dans toutes les catégories.')) {
                try {
                    const response = await fetch('/api/init-menu', { method: 'POST' });
                    const result = await response.json();

                    if (result.success) {
                        alert(`Menu initialisé avec succès !\n${result.message}`);
                        // Recharger le menu
                        await this.loadMenuItems();
                    } else {
                        alert('Erreur lors de l\'initialisation du menu');
                    }
                } catch (error) {
                    console.error('Erreur:', error);
                    alert('Erreur lors de l\'initialisation du menu');
                }
            }
        });

        document.getElementById('addTableBtn').addEventListener('click', () => {
            this.openTableModal();
        });

        document.getElementById('addIngredientBtn').addEventListener('click', () => {
            this.openIngredientModal();
        });

        document.getElementById('addRoomBtn').addEventListener('click', () => {
            this.openRoomModal();
        });

        // Formulaires
        document.getElementById('menuItemForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveMenuItem();
        });

        document.getElementById('tableForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveTable();
        });

        document.getElementById('ingredientForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveIngredient();
        });

        document.getElementById('roomForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveRoom();
        });

        document.getElementById('editRoomForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateRoom();
        });

        // Fermeture des modals
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', () => {
                this.closeModals();
            });
        });

        // Fermeture modal en cliquant à l'extérieur
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModals();
            }
        });

        // Rafraîchissement automatique des commandes
        setInterval(() => {
            if (this.currentSection === 'orders') {
                this.loadOrders();
            }
        }, 10000); // Rafraîchir toutes les 10 secondes
    }

    switchSection(section) {
        // Masquer toutes les sections
        document.querySelectorAll('.section').forEach(sec => {
            sec.classList.remove('active');
        });

        // Désactiver tous les boutons de navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Activer la section et le bouton correspondants
        document.getElementById(section + 'Section').classList.add('active');
        document.getElementById(section + 'Tab').classList.add('active');

        this.currentSection = section;

        // Charger les données spécifiques à la section
        switch(section) {
            case 'menu':
                this.loadMenuItems();
                break;
            case 'tables':
                this.loadTables();
                break;
            case 'orders':
                this.loadOrders();
                break;
            case 'stock':
                this.loadStock();
                break;
            case 'team':
                // Charger les données de l'équipe via authManager
                if (typeof authManager !== 'undefined' && authManager.loadTeamData) {
                    authManager.loadTeamData();
                }
                break;
        }
    }

    async loadData() {
        await this.loadMenuItems();
        await this.loadRooms();
        await this.loadTables();
        await this.loadOrders();
    }

    // Gestion du menu
    async loadMenuItems() {
        try {
            console.log('Chargement du menu...');
            const response = await fetch('/api/menu');
            console.log('Réponse reçue:', response.status);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            this.menuItems = await response.json();
            console.log('Menu items chargés:', this.menuItems.length, 'éléments');
            console.log('Premier élément:', this.menuItems[0]);

            this.renderMenuItems();
        } catch (error) {
            console.error('Erreur lors du chargement du menu:', error);

            // Afficher un message d'aide à l'utilisateur
            const container = document.getElementById('menuGrid');
            if (container) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #666;">
                        <h3>🍽️ Aucun menu trouvé</h3>
                        <p>La base de données semble vide.</p>
                        <p><strong>Pour initialiser le menu d'exemple :</strong></p>
                        <p>Visitez : <a href="/api/init-menu" target="_blank">/api/init-menu</a></p>
                        <p>Puis rechargez cette page.</p>
                        <button onclick="window.location.reload()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; margin-top: 10px;">
                            🔄 Recharger la page
                        </button>
                    </div>
                `;
            }

            this.showError('Erreur lors du chargement du menu');
        }
    }

    renderMenuItems() {
        const container = document.getElementById('menuGrid');
        container.innerHTML = '';

        // Définir l'ordre des sections
        const sectionsOrder = [
            { category: 'aperitif', title: '🍸 Apéritifs' },
            { category: 'entree', title: '🥗 Entrées' },
            { category: 'plat', title: '🍽️ Plats Principaux' },
            { category: 'dessert', title: '🍰 Desserts' },
            { category: 'boisson_froide', title: '🧊 Boissons Froides' },
            { category: 'boisson_chaude', title: '☕ Boissons Chaudes' },
            { category: 'boisson_alcoolise', title: '🍷 Boissons Alcoolisées' }
        ];

        sectionsOrder.forEach(section => {
            const sectionItems = this.menuItems.filter(item => item.category === section.category);

            if (sectionItems.length > 0) {
                // Créer la section
                const sectionDiv = document.createElement('div');
                sectionDiv.className = `admin-menu-section ${section.category}`;

                // Titre de la section
                const titleDiv = document.createElement('div');
                titleDiv.className = 'admin-section-title';
                titleDiv.innerHTML = `
                    <h3>${section.title}</h3>
                    <span class="section-count">${sectionItems.length} élément(s)</span>
                `;

                // Conteneur des items
                const itemsDiv = document.createElement('div');
                itemsDiv.className = 'admin-section-items';

                sectionItems.forEach(item => {
                    const card = this.createMenuItemCard(item);
                    itemsDiv.appendChild(card);
                });

                sectionDiv.appendChild(titleDiv);
                sectionDiv.appendChild(itemsDiv);
                container.appendChild(sectionDiv);
            }
        });

        if (container.children.length === 0) {
            container.innerHTML = '<div class="empty-state">Aucun plat dans le menu</div>';
        }
    }

    createMenuItemCard(item) {
        const card = document.createElement('div');
        card.className = 'menu-item-card';

        const stockClass = item.stock_quantity === 0 ? 'out' :
                          item.stock_quantity < 10 ? 'low' : '';

        card.innerHTML = `
            <div class="menu-item-header">
                <div class="menu-item-title">${item.name}</div>
                <div class="menu-item-price">${item.price}€</div>
            </div>
            <div class="menu-item-description">${item.description || ''}</div>
            <div class="menu-item-meta">
                <span class="category-tag">${this.getCategoryLabel(item.category)}</span>
                <span class="stock-info ${stockClass}">Stock: ${item.stock_quantity}</span>
            </div>
            <div class="menu-item-actions">
                <button class="btn btn-primary btn-small" onclick="app.editMenuItem(${item.id})">
                    Modifier
                </button>
                <button class="btn btn-danger btn-small" onclick="app.deleteMenuItem(${item.id})">
                    Supprimer
                </button>
            </div>
        `;

        return card;
    }

    getCategoryLabel(category) {
        const labels = {
            'entree': 'Entrée',
            'plat': 'Plat principal',
            'accompagnement': 'Accompagnement',
            'dessert': 'Dessert',
            'boisson_soft': 'Boisson froide',
            'boisson_chaude': 'Boisson chaude',
            'boisson_alcool': 'Boisson alcoolisée'
        };
        return labels[category] || category;
    }

    openMenuItemModal(item = null) {
        this.selectedMenuItem = item;
        const modal = document.getElementById('menuItemModal');
        const title = document.getElementById('modalTitle');
        const form = document.getElementById('menuItemForm');

        if (item) {
            title.textContent = 'Modifier le plat';
            document.getElementById('itemName').value = item.name;
            document.getElementById('itemDescription').value = item.description || '';
            document.getElementById('itemPrice').value = item.price;
            document.getElementById('itemCategory').value = item.category;
            document.getElementById('itemStock').value = item.stock_quantity;
            document.getElementById('itemImage').value = item.image_url || '';
        } else {
            title.textContent = 'Ajouter un plat';
            form.reset();
        }

        modal.style.display = 'block';
    }

    async saveMenuItem() {
        const formData = {
            name: document.getElementById('itemName').value,
            description: document.getElementById('itemDescription').value,
            price: parseFloat(document.getElementById('itemPrice').value),
            category: document.getElementById('itemCategory').value,
            stockQuantity: parseInt(document.getElementById('itemStock').value) || 0,
            imageUrl: document.getElementById('itemImage').value
        };

        try {
            const url = this.selectedMenuItem ?
                `/api/menu/${this.selectedMenuItem.id}` : '/api/menu';
            const method = this.selectedMenuItem ? 'PUT' : 'POST';

            if (this.selectedMenuItem) {
                formData.isAvailable = this.selectedMenuItem.is_available;
            }

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                this.closeModals();
                await this.loadMenuItems();
                this.showSuccess(this.selectedMenuItem ? 'Plat modifié avec succès' : 'Plat ajouté avec succès');
            } else {
                throw new Error('Erreur lors de la sauvegarde');
            }
        } catch (error) {
            console.error('Erreur:', error);
            this.showError('Erreur lors de la sauvegarde du plat');
        }
    }

    editMenuItem(id) {
        const item = this.menuItems.find(item => item.id === id);
        if (item) {
            this.openMenuItemModal(item);
        }
    }

    async deleteMenuItem(id) {
        if (confirm('Êtes-vous sûr de vouloir supprimer ce plat ?')) {
            try {
                const response = await fetch(`/api/menu/${id}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    await this.loadMenuItems();
                    this.showSuccess('Plat supprimé avec succès');
                } else {
                    throw new Error('Erreur lors de la suppression');
                }
            } catch (error) {
                console.error('Erreur:', error);
                this.showError('Erreur lors de la suppression du plat');
            }
        }
    }

    // Gestion des tables
    async loadTables() {
        try {
            const response = await fetch('/api/tables');
            this.tables = await response.json();
            this.renderTables();
        } catch (error) {
            console.error('Erreur lors du chargement des tables:', error);
            this.showError('Erreur lors du chargement des tables');
        }
    }

    renderTables() {
        // Les tables sont maintenant affichées dans les salles via renderRooms()
        // Cette méthode met à jour l'affichage des tables dans chaque salle
        this.rooms.forEach(room => {
            this.renderTablesInRoom(room.id);
        });
    }

    createTableElement(table) {
        const tableDiv = document.createElement('div');
        tableDiv.className = `table-item ${table.status}`;
        tableDiv.style.left = table.x_position + 'px';
        tableDiv.style.top = table.y_position + 'px';
        tableDiv.innerHTML = `
            ${table.table_number}
            <div class="table-qr" title="QR Code disponible">QR</div>
            <div class="table-delete" title="Supprimer la table" onclick="app.deleteTable(${table.id})">×</div>
        `;

        // Rendre la table déplaçable
        this.makeDraggable(tableDiv, table);

        // Clic pour voir le QR code
        tableDiv.addEventListener('dblclick', () => {
            this.showQRCode(table);
        });

        return tableDiv;
    }

    makeDraggable(element, table) {
        let isDragging = false;
        let startX, startY, startLeft, startTop;

        element.addEventListener('mousedown', (e) => {
            // Éviter le conflit avec le double-clic pour le QR code
            if (e.detail > 1) return;

            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = parseInt(element.style.left) || 0;
            startTop = parseInt(element.style.top) || 0;

            element.style.cursor = 'grabbing';
            element.style.zIndex = '1000';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            const newLeft = startLeft + deltaX;
            const newTop = startTop + deltaY;

            // Contraintes de déplacement (rester dans la salle)
            const container = document.getElementById(`room-${table.room_id}-tables`);
            if (!container) return;

            const containerRect = container.getBoundingClientRect();
            const elementRect = element.getBoundingClientRect();

            // Calculer les limites en tenant compte du padding de la salle
            const minX = 10;
            const minY = 10;
            const maxX = containerRect.width - elementRect.width - 10;
            const maxY = containerRect.height - elementRect.height - 10;

            // Appliquer les contraintes
            const constrainedLeft = Math.max(minX, Math.min(newLeft, maxX));
            const constrainedTop = Math.max(minY, Math.min(newTop, maxY));

            element.style.left = constrainedLeft + 'px';
            element.style.top = constrainedTop + 'px';
        });

        document.addEventListener('mouseup', async () => {
            if (isDragging) {
                isDragging = false;
                element.style.cursor = 'move';
                element.style.zIndex = 'auto';

                // Sauvegarder la nouvelle position
                const newX = parseInt(element.style.left);
                const newY = parseInt(element.style.top);

                try {
                    const response = await fetch(`/api/tables/${table.id}/position`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ x: newX, y: newY })
                    });

                    if (response.ok) {
                        // Mettre à jour les données locales
                        const tableIndex = this.tables.findIndex(t => t.id === table.id);
                        if (tableIndex !== -1) {
                            this.tables[tableIndex].x_position = newX;
                            this.tables[tableIndex].y_position = newY;
                        }
                    }
                } catch (error) {
                    console.error('Erreur lors de la sauvegarde de la position:', error);
                    this.showError('Erreur lors de la sauvegarde de la position');
                }
            }
        });
    }

    openTableModal() {
        const modal = document.getElementById('tableModal');
        document.getElementById('tableForm').reset();
        this.populateRoomSelect();
        modal.style.display = 'block';
    }

    populateRoomSelect() {
        const select = document.getElementById('tableRoom');
        select.innerHTML = '<option value="">-- Choisir une salle --</option>';

        this.rooms.forEach(room => {
            const option = document.createElement('option');
            option.value = room.id;
            option.textContent = room.name;
            select.appendChild(option);
        });
    }

    async saveTable() {
        const tableNumber = parseInt(document.getElementById('tableNumber').value);
        const roomId = parseInt(document.getElementById('tableRoom').value);

        if (!roomId) {
            this.showError('Veuillez sélectionner une salle');
            return;
        }

        try {
            const response = await fetch('/api/tables', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    tableNumber: tableNumber,
                    roomId: roomId,
                    x: 50,
                    y: 50
                })
            });

            if (response.ok) {
                this.closeModals();
                await this.loadTables();
                // Recharger aussi l'affichage des salles
                this.renderRooms();
                this.showSuccess('Table créée avec succès');
            } else {
                throw new Error('Erreur lors de la création de la table');
            }
        } catch (error) {
            console.error('Erreur:', error);
            this.showError('Erreur lors de la création de la table');
        }
    }

    showQRCode(table) {
        if (table.qr_code) {
            const qrWindow = window.open('', '_blank', 'width=400,height=400');
            qrWindow.document.write(`
                <html>
                    <head><title>QR Code - Table ${table.table_number}</title></head>
                    <body style="text-align:center; padding:20px;">
                        <h2>Table ${table.table_number}</h2>
                        <img src="${table.qr_code}" alt="QR Code" style="max-width:300px;">
                        <p>Scannez ce code pour accéder au menu</p>
                    </body>
                </html>
            `);
        }
    }

    async deleteTable(tableId) {
        const table = this.tables.find(t => t.id === tableId);
        if (!table) return;

        const confirmMessage = `Êtes-vous sûr de vouloir supprimer la table ${table.table_number} ?\n\nCette action est irréversible.`;

        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            const response = await fetch(`/api/tables/${tableId}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (response.ok) {
                // Supprimer la table des données locales
                this.tables = this.tables.filter(t => t.id !== tableId);

                // Recharger l'affichage des salles
                this.renderRooms();

                this.showSuccess(`Table ${table.table_number} supprimée avec succès`);
            } else {
                throw new Error(result.error || 'Erreur lors de la suppression');
            }
        } catch (error) {
            console.error('Erreur lors de la suppression de la table:', error);
            this.showError('Erreur lors de la suppression de la table');
        }
    }

    // Gestion des commandes
    async loadOrders() {
        try {
            const response = await fetch('/api/orders');
            this.orders = await response.json();
            this.renderOrders();
        } catch (error) {
            console.error('Erreur lors du chargement des commandes:', error);
            this.showError('Erreur lors du chargement des commandes');
        }
    }

    renderOrders() {
        const container = document.getElementById('ordersGrid');
        container.innerHTML = '';

        if (this.orders.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#7f8c8d;">Aucune commande en cours</p>';
            return;
        }

        this.orders.forEach(order => {
            const card = this.createOrderCard(order);
            container.appendChild(card);
        });
    }

    createOrderCard(order) {
        const card = document.createElement('div');
        card.className = 'order-card';

        const statusLabel = this.getStatusLabel(order.status);
        const items = order.items.map(item =>
            `<div class="order-item">
                <span>${item.name} x${item.quantity}</span>
                <span>${(item.price * item.quantity).toFixed(2)}€</span>
            </div>`
        ).join('');

        card.innerHTML = `
            <div class="order-header">
                <div class="order-table">Table ${order.table_number}</div>
                <div class="order-status ${order.status}">${statusLabel}</div>
            </div>
            <div class="order-items">${items}</div>
            <div class="order-total">Total: ${order.total_amount.toFixed(2)}€</div>
            <div class="order-actions">
                ${this.getOrderActions(order)}
            </div>
        `;

        return card;
    }

    getStatusLabel(status) {
        const labels = {
            'en_attente': 'En attente',
            'en_preparation': 'En préparation',
            'prete': 'Prête',
            'servie': 'Servie',
            'terminee': 'Terminée'
        };
        return labels[status] || status;
    }

    getOrderActions(order) {
        switch(order.status) {
            case 'en_attente':
                return `<button class="btn btn-primary btn-small" onclick="app.updateOrderStatus(${order.id}, 'en_preparation')">
                    Commencer la préparation
                </button>`;
            case 'en_preparation':
                return `<button class="btn btn-primary btn-small" onclick="app.updateOrderStatus(${order.id}, 'prete')">
                    Marquer comme prête
                </button>`;
            case 'prete':
                return `<button class="btn btn-primary btn-small" onclick="app.updateOrderStatus(${order.id}, 'servie')">
                    Marquer comme servie
                </button>`;
            case 'servie':
                return `<button class="btn btn-primary btn-small" onclick="app.updateOrderStatus(${order.id}, 'terminee')">
                    Terminer la commande
                </button>`;
            default:
                return '';
        }
    }

    async updateOrderStatus(orderId, newStatus) {
        try {
            const response = await fetch(`/api/orders/${orderId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (response.ok) {
                await this.loadOrders();
                this.showSuccess('Statut de la commande mis à jour');
            } else {
                throw new Error('Erreur lors de la mise à jour du statut');
            }
        } catch (error) {
            console.error('Erreur:', error);
            this.showError('Erreur lors de la mise à jour du statut');
        }
    }

    // Gestion des stocks
    async loadStock() {
        try {
            const response = await fetch('/api/ingredients');
            this.ingredients = await response.json();

            const container = document.getElementById('stockGrid');
            container.innerHTML = '';

            this.ingredients.forEach(ingredient => {
                const card = this.createIngredientCard(ingredient);
                container.appendChild(card);
            });
        } catch (error) {
            console.error('Erreur lors du chargement des ingrédients:', error);
            this.showError('Erreur lors du chargement des ingrédients');
        }
    }

    createIngredientCard(ingredient) {
        const card = document.createElement('div');
        card.className = 'ingredient-card';

        const stockClass = ingredient.stock_quantity === 0 ? 'out' :
                          ingredient.stock_quantity <= ingredient.min_quantity ? 'low' : '';

        card.innerHTML = `
            <div class="ingredient-header">
                <div class="ingredient-title">${ingredient.name}</div>
                <div class="stock-info ${stockClass}">
                    ${ingredient.stock_quantity} ${ingredient.unit}
                </div>
                <button class="btn btn-danger btn-small ingredient-delete" onclick="app.deleteIngredient(${ingredient.id})" title="Supprimer l'ingrédient">×</button>
            </div>
            <div class="ingredient-meta">
                <span class="min-stock">Seuil: ${ingredient.min_quantity} ${ingredient.unit}</span>
                ${ingredient.cost_per_unit ? `<span class="cost">Coût: ${ingredient.cost_per_unit}€/${ingredient.unit}</span>` : ''}
            </div>
            <div class="ingredient-actions">
                <div class="stock-controls">
                    <input type="number" id="ingredient-input-${ingredient.id}" min="0" step="0.1" value="${ingredient.stock_quantity}" class="stock-input">
                    <span class="unit-label">${ingredient.unit}</span>
                    <button class="btn btn-primary btn-small" onclick="app.updateIngredientFromInput(${ingredient.id})">
                        Mettre à jour
                    </button>
                </div>
                <div class="quick-actions">
                    <button class="btn btn-success btn-small" onclick="app.adjustIngredient(${ingredient.id}, 10)" title="Ajouter 10">
                        +10
                    </button>
                    <button class="btn btn-warning btn-small" onclick="app.adjustIngredient(${ingredient.id}, -10)" title="Retirer 10">
                        -10
                    </button>
                    <button class="btn btn-secondary btn-small" onclick="app.setIngredientStock(${ingredient.id})" title="Définir précisément">
                        Définir
                    </button>
                </div>
            </div>
        `;

        return card;
    }

    async adjustStock(itemId, adjustment) {
        const item = this.menuItems.find(item => item.id === itemId);
        if (!item) return;

        const newStock = Math.max(0, item.stock_quantity + adjustment);
        await this.updateStock(itemId, newStock);
    }

    async updateStockFromInput(itemId) {
        const input = document.getElementById(`stock-input-${itemId}`);
        if (!input) return;

        const newStock = parseInt(input.value);
        if (isNaN(newStock) || newStock < 0) {
            this.showError('Veuillez entrer une quantité valide');
            return;
        }

        await this.updateStock(itemId, newStock);
    }

    setStock(itemId) {
        const item = this.menuItems.find(item => item.id === itemId);
        if (!item) return;

        const newStock = prompt(`Stock actuel: ${item.stock_quantity}\nNouveau stock:`, item.stock_quantity);
        if (newStock !== null && !isNaN(newStock)) {
            this.updateStock(itemId, parseInt(newStock));
        }
    }

    async updateStock(itemId, newStock) {
        const item = this.menuItems.find(item => item.id === itemId);
        if (!item) return;

        try {
            const response = await fetch(`/api/menu/${itemId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...item,
                    stock_quantity: newStock,
                    is_available: item.is_available
                })
            });

            if (response.ok) {
                // Enregistrer le mouvement de stock
                const movementType = newStock > item.stock_quantity ? 'entree' : 'sortie';
                const quantity = Math.abs(newStock - item.stock_quantity);
                await this.recordStockMovement(itemId, movementType, quantity, 'Ajustement manuel');

                await this.loadMenuItems();
                if (this.currentSection === 'stock') {
                    this.loadStock();
                }
                this.showSuccess('Stock mis à jour');
            } else {
                throw new Error('Erreur lors de la mise à jour du stock');
            }
        } catch (error) {
            console.error('Erreur:', error);
            this.showError('Erreur lors de la mise à jour du stock');
        }
    }

    async recordStockMovement(itemId, movementType, quantity, reason) {
        try {
            await fetch('/api/stock-movements', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    item_id: itemId,
                    movement_type: movementType,
                    quantity: quantity,
                    reason: reason
                })
            });
        } catch (error) {
            console.error('Erreur lors de l\'enregistrement du mouvement de stock:', error);
        }
    }

    // Gestion des ingrédients
    async adjustIngredient(ingredientId, adjustment) {
        const ingredient = this.ingredients.find(ing => ing.id === ingredientId);
        if (!ingredient) return;

        const newStock = Math.max(0, ingredient.stock_quantity + adjustment);
        await this.updateIngredientStock(ingredientId, newStock);
    }

    async updateIngredientFromInput(ingredientId) {
        const input = document.getElementById(`ingredient-input-${ingredientId}`);
        if (!input) return;

        const newStock = parseFloat(input.value);
        if (isNaN(newStock) || newStock < 0) {
            this.showError('Veuillez entrer une quantité valide');
            return;
        }

        await this.updateIngredientStock(ingredientId, newStock);
    }

    setIngredientStock(ingredientId) {
        const ingredient = this.ingredients.find(ing => ing.id === ingredientId);
        if (!ingredient) return;

        const newStock = prompt(`Stock actuel: ${ingredient.stock_quantity} ${ingredient.unit}\nNouveau stock:`, ingredient.stock_quantity);
        if (newStock !== null && !isNaN(newStock)) {
            this.updateIngredientStock(ingredientId, parseFloat(newStock));
        }
    }

    async updateIngredientStock(ingredientId, newStock) {
        const ingredient = this.ingredients.find(ing => ing.id === ingredientId);
        if (!ingredient) return;

        try {
            const response = await fetch(`/api/ingredients/${ingredientId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...ingredient,
                    stock_quantity: newStock
                })
            });

            if (response.ok) {
                // Enregistrer le mouvement de stock
                const movementType = newStock > ingredient.stock_quantity ? 'entree' : 'sortie';
                const quantity = Math.abs(newStock - ingredient.stock_quantity);
                if (quantity > 0) {
                    await this.recordIngredientMovement(ingredientId, movementType, quantity, 'Ajustement manuel');
                }

                await this.loadStock();
                this.showSuccess('Stock d\'ingrédient mis à jour');
            } else {
                throw new Error('Erreur lors de la mise à jour du stock');
            }
        } catch (error) {
            console.error('Erreur:', error);
            this.showError('Erreur lors de la mise à jour du stock d\'ingrédient');
        }
    }

    async recordIngredientMovement(ingredientId, movementType, quantity, reason) {
        try {
            await fetch('/api/ingredient-movements', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ingredient_id: ingredientId,
                    movement_type: movementType,
                    quantity: quantity,
                    reason: reason
                })
            });
        } catch (error) {
            console.error('Erreur lors de l\'enregistrement du mouvement d\'ingrédient:', error);
        }
    }

    async deleteIngredient(ingredientId) {
        const ingredient = this.ingredients.find(ing => ing.id === ingredientId);
        if (!ingredient) return;

        const confirmMessage = `Êtes-vous sûr de vouloir supprimer l'ingrédient "${ingredient.name}" ?\n\nCette action est irréversible.`;

        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            const response = await fetch(`/api/ingredients/${ingredientId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await this.loadStock();
                this.showSuccess(`Ingrédient "${ingredient.name}" supprimé avec succès`);
            } else {
                throw new Error('Erreur lors de la suppression');
            }
        } catch (error) {
            console.error('Erreur lors de la suppression de l\'ingrédient:', error);
            this.showError('Erreur lors de la suppression de l\'ingrédient');
        }
    }

    // Gestion des stocks
    openStockModal() {
        const modal = document.getElementById('stockModal');
        document.getElementById('stockForm').reset();
        this.populateStockSelect();
        modal.style.display = 'block';
    }

    populateStockSelect() {
        const select = document.getElementById('stockItemSelect');
        select.innerHTML = '<option value="">-- Choisir un plat --</option>';

        this.menuItems.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = `${item.name} (Stock actuel: ${item.stock_quantity || 0})`;
            select.appendChild(option);
        });
    }

    async addStock() {
        const itemId = document.getElementById('stockItemSelect').value;
        const quantity = parseInt(document.getElementById('stockQuantity').value);
        const reason = document.getElementById('stockReason').value;

        if (!itemId || !quantity) {
            this.showError('Veuillez sélectionner un plat et une quantité');
            return;
        }

        try {
            // Récupérer l'item actuel
            const item = this.menuItems.find(item => item.id == itemId);
            if (!item) {
                this.showError('Plat introuvable');
                return;
            }

            const newStock = (item.stock_quantity || 0) + quantity;

            // Mettre à jour le stock
            const response = await fetch(`/api/menu/${itemId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...item,
                    stock_quantity: newStock
                })
            });

            if (response.ok) {
                // Enregistrer le mouvement de stock
                await this.recordStockMovement(itemId, quantity, reason);

                await this.loadMenuItems();
                if (this.currentSection === 'stock') {
                    this.loadStock();
                }

                this.closeModals();
                this.showSuccess(`Stock mis à jour: +${quantity} pour ${item.name}`);
            } else {
                throw new Error('Erreur lors de la mise à jour du stock');
            }
        } catch (error) {
            console.error('Erreur:', error);
            this.showError('Erreur lors de l\'ajout du stock');
        }
    }

    async recordStockMovement(itemId, quantity, reason) {
        try {
            await fetch('/api/stock-movements', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    item_id: itemId,
                    quantity: quantity,
                    type: 'in',
                    reason: reason
                })
            });
        } catch (error) {
            console.error('Erreur lors de l\'enregistrement du mouvement:', error);
        }
    }

    // Gestion des salles
    async loadRooms() {
        try {
            const response = await fetch('/api/rooms');
            if (response.ok) {
                this.rooms = await response.json();
                this.renderRooms();
            }
        } catch (error) {
            console.error('Erreur lors du chargement des salles:', error);
        }
    }

    renderRooms() {
        const container = document.getElementById('roomsContainer');
        container.innerHTML = '';

        this.rooms.forEach(room => {
            const roomElement = this.createRoomElement(room);
            container.appendChild(roomElement);
            // Ajouter les tables après que l'élément soit dans le DOM
            this.renderTablesInRoom(room.id);
        });
    }

    createRoomElement(room) {
        const roomDiv = document.createElement('div');
        roomDiv.className = 'room';
        roomDiv.style.cssText = `
            border: 2px solid #ddd;
            border-radius: 8px;
            margin: 20px;
            position: relative;
            background-color: ${room.color || '#f8f9fa'};
            width: ${room.width}px;
            height: ${room.height}px;
            display: inline-block;
            vertical-align: top;
        `;

        // En-tête de la salle
        const header = document.createElement('div');
        header.className = 'room-header';
        header.style.cssText = `
            background: rgba(0,0,0,0.1);
            padding: 8px 12px;
            font-weight: bold;
            border-radius: 6px 6px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        header.innerHTML = `
            <span>${room.name} (${room.width}×${room.height})</span>
            <div class="room-actions">
                <button onclick="app.editRoom(${room.id})" class="btn-small btn-edit" title="Modifier la salle">✏️</button>
                <button onclick="app.deleteRoom(${room.id})" class="btn-small btn-danger" title="Supprimer la salle">×</button>
            </div>
        `;

        // Zone des tables
        const tablesArea = document.createElement('div');
        tablesArea.className = 'room-tables';
        tablesArea.id = `room-${room.id}-tables`;
        tablesArea.style.cssText = `
            position: relative;
            height: calc(100% - 40px);
            padding: 10px;
        `;

        roomDiv.appendChild(header);
        roomDiv.appendChild(tablesArea);

        return roomDiv;
    }

    renderTablesInRoom(roomId) {
        const tablesArea = document.getElementById(`room-${roomId}-tables`);
        if (!tablesArea) return;

        tablesArea.innerHTML = '';

        const roomTables = this.tables.filter(table => table.room_id === roomId);
        roomTables.forEach(table => {
            const tableElement = this.createTableElement(table);
            tablesArea.appendChild(tableElement);
        });
    }

    openRoomModal() {
        const modal = document.getElementById('roomModal');
        document.getElementById('roomForm').reset();
        modal.style.display = 'block';
    }

    async saveRoom() {
        const name = document.getElementById('roomName').value;
        const width = parseInt(document.getElementById('roomWidth').value);
        const height = parseInt(document.getElementById('roomHeight').value);
        const color = document.getElementById('roomColor').value;

        try {
            const response = await fetch('/api/rooms', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name,
                    width,
                    height,
                    color
                })
            });

            if (response.ok) {
                await this.loadRooms();
                this.closeModals();
                this.showSuccess('Salle créée avec succès');
            } else {
                throw new Error('Erreur lors de la création de la salle');
            }
        } catch (error) {
            console.error('Erreur:', error);
            this.showError('Erreur lors de la création de la salle');
        }
    }

    async deleteRoom(roomId) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette salle ? Toutes les tables qu\'elle contient seront également supprimées.')) {
            return;
        }

        try {
            const response = await fetch(`/api/rooms/${roomId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await this.loadRooms();
                await this.loadTables();
                this.showSuccess('Salle supprimée');
            } else {
                throw new Error('Erreur lors de la suppression');
            }
        } catch (error) {
            console.error('Erreur:', error);
            this.showError('Erreur lors de la suppression de la salle');
        }
    }

    editRoom(roomId) {
        const room = this.rooms.find(r => r.id === roomId);
        if (!room) return;

        // Remplir le formulaire avec les données existantes
        document.getElementById('editRoomId').value = room.id;
        document.getElementById('editRoomName').value = room.name;
        document.getElementById('editRoomWidth').value = room.width;
        document.getElementById('editRoomHeight').value = room.height;
        document.getElementById('editRoomColor').value = room.color || '#f8f9fa';

        // Afficher le modal
        document.getElementById('editRoomModal').style.display = 'block';
    }

    async updateRoom() {
        const roomId = document.getElementById('editRoomId').value;
        const name = document.getElementById('editRoomName').value;
        const width = parseInt(document.getElementById('editRoomWidth').value);
        const height = parseInt(document.getElementById('editRoomHeight').value);
        const color = document.getElementById('editRoomColor').value;

        try {
            const response = await fetch(`/api/rooms/${roomId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    width: width,
                    height: height,
                    color: color
                })
            });

            if (response.ok) {
                this.closeEditRoomModal();
                await this.loadRooms();
                await this.loadTables(); // Recharger pour ajuster les positions des tables si nécessaire
                this.showSuccess('Salle modifiée avec succès');
            } else {
                throw new Error('Erreur lors de la modification');
            }
        } catch (error) {
            console.error('Erreur:', error);
            this.showError('Erreur lors de la modification de la salle');
        }
    }

    closeEditRoomModal() {
        document.getElementById('editRoomModal').style.display = 'none';
        document.getElementById('editRoomForm').reset();
    }

    // Utilitaires
    closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type) {
        // Créer une notification temporaire
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 5px;
            color: white;
            font-weight: 600;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            background: ${type === 'success' ? '#27ae60' : '#e74c3c'};
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    // Gestion des ingrédients - Modal
    openIngredientModal() {
        const modal = document.getElementById('ingredientModal');
        document.getElementById('ingredientForm').reset();
        modal.style.display = 'block';
    }

    closeIngredientModal() {
        document.getElementById('ingredientModal').style.display = 'none';
        document.getElementById('ingredientForm').reset();
    }

    async saveIngredient() {
        const name = document.getElementById('ingredientName').value;
        const unit = document.getElementById('ingredientUnit').value;
        const stock_quantity = parseFloat(document.getElementById('ingredientStock').value);
        const min_quantity = parseFloat(document.getElementById('ingredientMinStock').value) || 0;
        const cost_per_unit = parseFloat(document.getElementById('ingredientCost').value) || 0;
        const supplier = document.getElementById('ingredientSupplier').value;

        try {
            const response = await fetch('/api/ingredients', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    unit: unit,
                    stock_quantity: stock_quantity,
                    min_quantity: min_quantity,
                    cost_per_unit: cost_per_unit,
                    supplier: supplier
                })
            });

            if (response.ok) {
                this.closeIngredientModal();
                await this.loadStock();
                this.showSuccess(`Ingrédient "${name}" ajouté avec succès`);
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Erreur lors de la création de l\'ingrédient');
            }
        } catch (error) {
            console.error('Erreur:', error);
            this.showError(error.message || 'Erreur lors de la création de l\'ingrédient');
        }
    }
}

// Fonctions utilitaires globales
function closeModal() {
    app.closeModals();
}

function closeTableModal() {
    app.closeModals();
}

function closeStockModal() {
    app.closeModals();
}

function closeRoomModal() {
    app.closeModals();
}

// Initialiser l'application
const app = new RestaurantApp();