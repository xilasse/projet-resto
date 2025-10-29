// Application client pour le menu via QR code

class ClientMenuApp {
    constructor() {
        this.tableNumber = null;
        this.tableId = null;
        this.menuItems = [];
        this.categories = [];
        this.cart = [];
        this.currentCategory = 'all';

        this.init();
    }

    init() {
        this.getTableInfo();
        this.setupEventListeners();
        this.loadMenu();
    }

    getTableInfo() {
        // Extraire le numéro de table depuis l'URL
        const pathParts = window.location.pathname.split('/');
        this.tableNumber = pathParts[pathParts.length - 1];

        if (this.tableNumber) {
            document.getElementById('tableNumber').textContent = `Table ${this.tableNumber}`;
            this.loadTableInfo();
        }
    }

    async loadTableInfo() {
        try {
            const response = await fetch(`/api/table/${this.tableNumber}`);
            if (response.ok) {
                const tableData = await response.json();
                this.tableId = tableData.id;
            }
        } catch (error) {
            console.error('Erreur lors du chargement des informations de la table:', error);
        }
    }

    setupEventListeners() {
        // Bouton de commande
        document.getElementById('orderBtn').addEventListener('click', () => {
            this.showOrderConfirmation();
        });

        // Modals
        document.getElementById('confirmOrderBtn').addEventListener('click', () => {
            this.processOrder();
        });

        document.getElementById('cancelOrderBtn').addEventListener('click', () => {
            this.closeModal('confirmModal');
        });

        // Méthodes de paiement
        document.querySelectorAll('.payment-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectPaymentMethod(e.target.dataset.method);
            });
        });

        // Fermeture des modals en cliquant à l'extérieur
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target.id);
            }
        });
    }

    async loadMenu() {
        try {
            const response = await fetch('/api/menu');
            this.menuItems = await response.json();
            this.extractCategories();
            this.renderCategories();
            this.renderMenuItems();
        } catch (error) {
            console.error('Erreur lors du chargement du menu:', error);
            this.showError('Erreur lors du chargement du menu');
        }
    }

    extractCategories() {
        const categoriesSet = new Set();
        this.menuItems.forEach(item => {
            if (item.is_available) {
                categoriesSet.add(item.category);
            }
        });
        this.categories = Array.from(categoriesSet);
    }

    renderCategories() {
        const container = document.getElementById('categories');
        container.innerHTML = '';

        // Bouton "Tout"
        const allBtn = document.createElement('button');
        allBtn.className = 'category-btn active';
        allBtn.textContent = 'Tout';
        allBtn.addEventListener('click', () => {
            this.filterByCategory('all');
        });
        container.appendChild(allBtn);

        // Boutons des catégories
        this.categories.forEach(category => {
            const btn = document.createElement('button');
            btn.className = 'category-btn';
            btn.textContent = this.getCategoryLabel(category);
            btn.addEventListener('click', () => {
                this.filterByCategory(category);
            });
            container.appendChild(btn);
        });
    }

    getCategoryLabel(category) {
        const labels = {
            'entree': 'Entrées',
            'plat': 'Plats principaux',
            'dessert': 'Desserts',
            'boisson': 'Boissons'
        };
        return labels[category] || category;
    }

    filterByCategory(category) {
        this.currentCategory = category;

        // Mettre à jour les boutons
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');

        this.renderMenuItems();
    }

    renderMenuItems() {
        const container = document.getElementById('menuItems');
        container.innerHTML = '';

        const filteredItems = this.currentCategory === 'all' ?
            this.menuItems.filter(item => item.is_available) :
            this.menuItems.filter(item => item.is_available && item.category === this.currentCategory);

        if (filteredItems.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#7f8c8d; margin:20px;">Aucun plat disponible dans cette catégorie</p>';
            return;
        }

        filteredItems.forEach(item => {
            const itemElement = this.createMenuItemElement(item);
            container.appendChild(itemElement);
        });
    }

    createMenuItemElement(item) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'menu-item';

        const isOutOfStock = item.stock_quantity === 0;

        itemDiv.innerHTML = `
            <div class="menu-item-content">
                <div class="menu-item-image ${item.image_url ? '' : 'no-image'}">
                    ${item.image_url ?
                        `<img src="${item.image_url}" alt="${item.name}">` :
                        '🍽️'
                    }
                </div>
                <div class="menu-item-info">
                    <div class="menu-item-name">${item.name}</div>
                    <div class="menu-item-description">${item.description || ''}</div>
                    <div class="menu-item-footer">
                        <div class="menu-item-price">${item.price.toFixed(2)}€</div>
                        ${isOutOfStock ?
                            '<div class="stock-indicator">Rupture de stock</div>' :
                            `<button class="add-to-cart-btn" ${isOutOfStock ? 'disabled' : ''}>
                                Ajouter
                            </button>`
                        }
                    </div>
                </div>
            </div>
        `;

        // Ajouter l'événement pour le bouton d'ajout au panier
        if (!isOutOfStock) {
            const addBtn = itemDiv.querySelector('.add-to-cart-btn');
            addBtn.addEventListener('click', () => {
                this.addToCart(item);
            });
        }

        return itemDiv;
    }

    addToCart(item) {
        const existingItem = this.cart.find(cartItem => cartItem.id === item.id);

        if (existingItem) {
            if (existingItem.quantity < item.stock_quantity) {
                existingItem.quantity++;
            } else {
                this.showError('Stock insuffisant');
                return;
            }
        } else {
            this.cart.push({
                id: item.id,
                name: item.name,
                price: item.price,
                quantity: 1
            });
        }

        this.updateCartDisplay();
        this.showSuccess(`${item.name} ajouté au panier`);
    }

    removeFromCart(itemId) {
        this.cart = this.cart.filter(item => item.id !== itemId);
        this.updateCartDisplay();
    }

    updateCartQuantity(itemId, newQuantity) {
        const item = this.cart.find(cartItem => cartItem.id === itemId);
        if (item) {
            if (newQuantity <= 0) {
                this.removeFromCart(itemId);
            } else {
                // Vérifier le stock disponible
                const menuItem = this.menuItems.find(mi => mi.id === itemId);
                if (menuItem && newQuantity <= menuItem.stock_quantity) {
                    item.quantity = newQuantity;
                    this.updateCartDisplay();
                } else {
                    this.showError('Stock insuffisant');
                }
            }
        }
    }

    updateCartDisplay() {
        const cartItems = document.getElementById('cartItems');
        const cartCount = document.getElementById('cartCount');
        const cartTotal = document.getElementById('cartTotal');
        const orderBtn = document.getElementById('orderBtn');

        cartCount.textContent = this.cart.reduce((sum, item) => sum + item.quantity, 0);

        if (this.cart.length === 0) {
            cartItems.innerHTML = '<p style="text-align:center; color:#7f8c8d;">Votre panier est vide</p>';
            cartTotal.textContent = '0.00';
            orderBtn.disabled = true;
            return;
        }

        cartItems.innerHTML = '';
        let total = 0;

        this.cart.forEach(item => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;

            const cartItem = document.createElement('div');
            cartItem.className = 'cart-item';
            cartItem.innerHTML = `
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">${item.price.toFixed(2)}€ x ${item.quantity}</div>
                </div>
                <div class="cart-item-controls">
                    <button class="quantity-btn" onclick="clientApp.updateCartQuantity(${item.id}, ${item.quantity - 1})">-</button>
                    <span class="quantity-display">${item.quantity}</span>
                    <button class="quantity-btn" onclick="clientApp.updateCartQuantity(${item.id}, ${item.quantity + 1})">+</button>
                </div>
            `;
            cartItems.appendChild(cartItem);
        });

        cartTotal.textContent = total.toFixed(2);
        orderBtn.disabled = false;
    }

    showOrderConfirmation() {
        if (this.cart.length === 0) return;

        const modal = document.getElementById('confirmModal');
        const summary = document.getElementById('orderSummary');

        let summaryHTML = '';
        let total = 0;

        this.cart.forEach(item => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;

            summaryHTML += `
                <div class="order-summary-item">
                    <span>${item.name} x${item.quantity}</span>
                    <span>${itemTotal.toFixed(2)}€</span>
                </div>
            `;
        });

        summaryHTML += `
            <div class="order-total">
                <span>Total</span>
                <span>${total.toFixed(2)}€</span>
            </div>
        `;

        summary.innerHTML = summaryHTML;
        modal.style.display = 'block';
    }

    async processOrder() {
        if (!this.tableId) {
            this.showError('Erreur: Table non identifiée');
            return;
        }

        try {
            const orderData = {
                tableId: this.tableId,
                items: this.cart,
                totalAmount: this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
            };

            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(orderData)
            });

            if (response.ok) {
                this.closeModal('confirmModal');
                this.showPaymentModal();
            } else {
                throw new Error('Erreur lors de la création de la commande');
            }
        } catch (error) {
            console.error('Erreur:', error);
            this.showError('Erreur lors de la création de la commande');
        }
    }

    showPaymentModal() {
        const modal = document.getElementById('paymentModal');
        modal.style.display = 'block';
    }

    selectPaymentMethod(method) {
        // Marquer la méthode comme sélectionnée
        document.querySelectorAll('.payment-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        event.target.classList.add('selected');

        // Afficher le formulaire de paiement approprié
        this.showPaymentForm(method);
    }

    showPaymentForm(method) {
        const paymentForm = document.getElementById('paymentForm');

        switch(method) {
            case 'card':
                paymentForm.innerHTML = `
                    <div class="status-message info">
                        <p>Simulation de paiement par carte bancaire</p>
                        <p>Dans un vrai système, ici serait intégré Stripe ou un autre processeur de paiement.</p>
                    </div>
                    <button class="btn btn-primary" onclick="clientApp.simulatePayment('Carte bancaire')">
                        Simuler le paiement
                    </button>
                `;
                break;
            case 'cash':
                paymentForm.innerHTML = `
                    <div class="status-message info">
                        <p>Paiement en espèces</p>
                        <p>Veuillez vous présenter au comptoir pour régler votre commande.</p>
                    </div>
                    <button class="btn btn-primary" onclick="clientApp.simulatePayment('Espèces')">
                        Confirmer le paiement en espèces
                    </button>
                `;
                break;
            case 'mobile':
                paymentForm.innerHTML = `
                    <div class="status-message info">
                        <p>Paiement mobile</p>
                        <p>Scannez le QR code avec votre application de paiement mobile.</p>
                    </div>
                    <button class="btn btn-primary" onclick="clientApp.simulatePayment('Paiement mobile')">
                        Simuler le paiement mobile
                    </button>
                `;
                break;
        }
    }

    simulatePayment(method) {
        // Simulation du paiement
        this.showSuccess(`Paiement par ${method} simulé avec succès!`);

        setTimeout(() => {
            this.closeModal('paymentModal');
            this.showOrderSuccess();
        }, 1500);
    }

    showOrderSuccess() {
        // Vider le panier
        this.cart = [];
        this.updateCartDisplay();

        // Afficher un message de succès
        const successMessage = document.createElement('div');
        successMessage.className = 'status-message success';
        successMessage.innerHTML = `
            <h3>Commande confirmée !</h3>
            <p>Votre commande a été transmise à la cuisine.</p>
            <p>Vous recevrez une notification quand elle sera prête.</p>
        `;

        // Remplacer temporairement le contenu principal
        const mainContent = document.querySelector('.menu-content');
        const originalContent = mainContent.innerHTML;

        mainContent.innerHTML = '';
        mainContent.appendChild(successMessage);

        // Restaurer le contenu original après 5 secondes
        setTimeout(() => {
            mainContent.innerHTML = originalContent;
            this.renderCategories();
            this.renderMenuItems();
        }, 5000);
    }

    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
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
}

// Initialiser l'application client
const clientApp = new ClientMenuApp();