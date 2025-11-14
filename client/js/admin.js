// Interface Super Admin

class SuperAdminApp {
    constructor() {
        this.currentSection = 'dashboard';
        this.restaurants = [];
        this.users = [];
        this.stats = {};

        this.init();
    }

    async init() {
        // Vérifier que l'utilisateur est bien Super Admin
        await this.checkSuperAdminAccess();
        this.setupEventListeners();
        await this.loadDashboard();
    }

    async checkSuperAdminAccess() {
        try {
            const response = await fetch('/api/check-auth', { credentials: 'include' });
            const data = await response.json();

            if (!response.ok || data.user.role !== 'SUPER_ADMIN') {
                window.location.href = '/';
                return;
            }

            // Mettre à jour l'interface avec les informations de l'utilisateur
            document.getElementById('userName').textContent = data.user.name;
        } catch (error) {
            console.error('Erreur vérification accès:', error);
            window.location.href = '/login.html';
        }
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.target.id.replace('Tab', '');
                this.switchSection(section);
            });
        });

        // La déconnexion est maintenant gérée par auth.js

        // Modals
        this.setupModals();
    }

    setupModals() {
        // Modal restaurant
        const restaurantModal = document.getElementById('restaurantModal');
        const addRestaurantBtn = document.getElementById('addRestaurantBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        const modalClose = document.querySelector('.modal-close');

        addRestaurantBtn.addEventListener('click', () => {
            restaurantModal.classList.add('show');
        });

        [cancelBtn, modalClose].forEach(btn => {
            btn.addEventListener('click', () => {
                restaurantModal.classList.remove('show');
            });
        });

        // Fermer modal en cliquant à l'extérieur
        restaurantModal.addEventListener('click', (e) => {
            if (e.target === restaurantModal) {
                restaurantModal.classList.remove('show');
            }
        });

        // Formulaire restaurant
        document.getElementById('restaurantForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createRestaurant();
        });
    }

    async switchSection(section) {
        // Masquer toutes les sections
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

        // Afficher la section sélectionnée
        document.getElementById(section + 'Section').classList.add('active');
        document.getElementById(section + 'Tab').classList.add('active');

        this.currentSection = section;

        // Charger les données selon la section
        switch (section) {
            case 'dashboard':
                await this.loadDashboard();
                break;
            case 'restaurants':
                await this.loadRestaurants();
                break;
            case 'users':
                await this.loadUsers();
                break;
            case 'stats':
                await this.loadStats();
                break;
        }
    }

    async loadDashboard() {
        try {
            const response = await fetch('/api/admin/stats', { credentials: 'include' });
            const stats = await response.json();

            // Mettre à jour les cartes de statistiques
            document.getElementById('totalRestaurants').textContent = stats.restaurants || 0;
            document.getElementById('totalUsers').textContent = stats.users || 0;
            document.getElementById('ordersToday').textContent = stats.orders_today || 0;
            document.getElementById('ordersMonth').textContent = stats.orders_month || 0;

            this.stats = stats;
        } catch (error) {
            console.error('Erreur chargement dashboard:', error);
        }
    }

    async loadRestaurants() {
        try {
            const response = await fetch('/api/admin/restaurants', { credentials: 'include' });
            const restaurants = await response.json();

            this.restaurants = restaurants;
            this.renderRestaurantsTable();
        } catch (error) {
            console.error('Erreur chargement restaurants:', error);
        }
    }

    renderRestaurantsTable() {
        const tbody = document.querySelector('#restaurantsTable tbody');
        tbody.innerHTML = '';

        this.restaurants.forEach(restaurant => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${restaurant.name}</strong></td>
                <td>${restaurant.owner_name}</td>
                <td>${restaurant.email}</td>
                <td><span class="badge">${restaurant.user_count} utilisateurs</span></td>
                <td><span class="badge">${restaurant.orders_30_days} commandes</span></td>
                <td>
                    <span class="status-badge ${restaurant.is_active ? 'status-active' : 'status-inactive'}">
                        ${restaurant.is_active ? 'Actif' : 'Inactif'}
                    </span>
                </td>
                <td>
                    <button class="action-btn view" onclick="admin.viewRestaurant(${restaurant.id})">Voir</button>
                    <button class="action-btn edit" onclick="admin.editRestaurant(${restaurant.id})">Modifier</button>
                    <button class="action-btn delete" onclick="admin.toggleRestaurant(${restaurant.id})">
                        ${restaurant.is_active ? 'Désactiver' : 'Activer'}
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    async loadUsers() {
        try {
            const response = await fetch('/api/admin/users', { credentials: 'include' });
            const users = await response.json();

            this.users = users;
            this.renderUsersTable();
        } catch (error) {
            console.error('Erreur chargement utilisateurs:', error);
        }
    }

    renderUsersTable() {
        const tbody = document.querySelector('#usersTable tbody');
        tbody.innerHTML = '';

        this.users.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${user.first_name} ${user.last_name}</strong></td>
                <td>${user.email}</td>
                <td>
                    <span class="role-badge role-${user.role.toLowerCase()}">
                        ${this.getRoleLabel(user.role)}
                    </span>
                </td>
                <td>${user.restaurants || 'Aucun'}</td>
                <td>
                    <span class="status-badge ${user.is_active ? 'status-active' : 'status-inactive'}">
                        ${user.is_active ? 'Actif' : 'Inactif'}
                    </span>
                </td>
                <td>
                    <button class="action-btn view" onclick="admin.viewUser(${user.id})">Voir</button>
                    <button class="action-btn edit" onclick="admin.editUser(${user.id})">Modifier</button>
                    <button class="action-btn delete" onclick="admin.toggleUser(${user.id})">
                        ${user.is_active ? 'Désactiver' : 'Activer'}
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    getRoleLabel(role) {
        const labels = {
            'RESTAURATEUR': 'Restaurateur',
            'MANAGER': 'Manager',
            'EMPLOYE': 'Employé'
        };
        return labels[role] || role;
    }

    async createRestaurant() {
        const form = document.getElementById('restaurantForm');
        const formData = new FormData(form);

        const data = {
            restaurantName: document.getElementById('modalRestaurantName').value,
            firstName: document.getElementById('modalOwnerFirstName').value,
            lastName: document.getElementById('modalOwnerLastName').value,
            email: document.getElementById('modalOwnerEmail').value,
            phone: document.getElementById('modalOwnerPhone').value,
            password: this.generatePassword()
        };

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
                alert(`Restaurant créé avec succès!\nMot de passe temporaire: ${data.password}\nDemandez au propriétaire de le changer lors de sa première connexion.`);
                document.getElementById('restaurantModal').classList.remove('show');
                form.reset();
                await this.loadRestaurants();
            } else {
                alert('Erreur: ' + (result.error || 'Erreur inconnue'));
            }
        } catch (error) {
            console.error('Erreur création restaurant:', error);
            alert('Erreur lors de la création du restaurant');
        }
    }

    generatePassword() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let password = '';
        for (let i = 0; i < 8; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }

    async loadStats() {
        // Ici on pourrait charger des statistiques plus détaillées
        // et créer des graphiques avec Chart.js par exemple
        console.log('Chargement des statistiques détaillées...');
    }

    // Méthodes pour les actions sur les restaurants et utilisateurs
    async viewRestaurant(id) {
        console.log('Voir restaurant:', id);
        // Implémenter la vue détaillée du restaurant
    }

    async editRestaurant(id) {
        console.log('Modifier restaurant:', id);
        // Implémenter la modification du restaurant
    }

    async toggleRestaurant(id) {
        console.log('Basculer statut restaurant:', id);
        // Implémenter l'activation/désactivation du restaurant
    }

    async viewUser(id) {
        console.log('Voir utilisateur:', id);
        // Implémenter la vue détaillée de l'utilisateur
    }

    async editUser(id) {
        console.log('Modifier utilisateur:', id);
        // Implémenter la modification de l'utilisateur
    }

    async toggleUser(id) {
        console.log('Basculer statut utilisateur:', id);
        // Implémenter l'activation/désactivation de l'utilisateur
    }
}

// Initialiser l'application Super Admin
const admin = new SuperAdminApp();