// Gestionnaire de sélection de restaurants pour les restaurateurs

class RestaurantSelector {
    constructor() {
        this.restaurants = [];
        this.selectedRestaurant = null;

        this.init();
    }

    async init() {
        // Vérifier que l'utilisateur est bien un restaurateur
        await this.checkAccess();
        this.setupEventListeners();
        await this.loadRestaurants();
    }

    async checkAccess() {
        try {
            const response = await fetch('/api/check-auth', {
                credentials: 'include'
            });

            if (!response.ok) {
                window.location.href = '/login.html';
                return;
            }

            const result = await response.json();

            if (result.user.role !== 'RESTAURATEUR') {
                // Si ce n'est pas un restaurateur, rediriger selon le rôle
                if (result.user.role === 'SUPER_ADMIN') {
                    window.location.href = '/admin.html';
                } else {
                    window.location.href = '/';
                }
                return;
            }

            // Mettre à jour l'interface utilisateur
            document.getElementById('userName').textContent = result.user.name;

        } catch (error) {
            console.error('Erreur vérification accès:', error);
            window.location.href = '/login.html';
        }
    }

    setupEventListeners() {
        const selectBtn = document.getElementById('selectBtn');
        selectBtn.addEventListener('click', () => {
            if (this.selectedRestaurant) {
                this.selectRestaurant();
            }
        });
    }

    async loadRestaurants() {
        try {
            const response = await fetch('/api/my-restaurants', {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Erreur lors du chargement des restaurants');
            }

            const restaurants = await response.json();
            this.restaurants = restaurants;

            // Si l'utilisateur n'a qu'un seul restaurant, rediriger directement
            if (restaurants.length === 1) {
                await this.setActiveRestaurant(restaurants[0].id);
                window.location.href = '/';
                return;
            }

            this.renderRestaurants();

        } catch (error) {
            console.error('Erreur chargement restaurants:', error);
            this.showError('Erreur lors du chargement des restaurants');
        }
    }

    renderRestaurants() {
        const container = document.getElementById('restaurantsGrid');

        if (this.restaurants.length === 0) {
            container.innerHTML = `
                <div class="error">
                    <h3>Aucun restaurant trouvé</h3>
                    <p>Vous n'avez accès à aucun restaurant.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';

        this.restaurants.forEach(restaurant => {
            const card = this.createRestaurantCard(restaurant);
            container.appendChild(card);
        });
    }

    createRestaurantCard(restaurant) {
        const card = document.createElement('div');
        card.className = 'restaurant-card';
        card.dataset.restaurantId = restaurant.id;

        const roleLabel = this.getRoleLabel(restaurant.user_role || restaurant.role);

        card.innerHTML = `
            <div class="restaurant-icon">🏪</div>
            <div class="restaurant-name">${restaurant.name}</div>
            <div class="restaurant-details">
                ${restaurant.address ? `📍 ${restaurant.address}<br>` : ''}
                ${restaurant.phone ? `📞 ${restaurant.phone}<br>` : ''}
                <span class="restaurant-role">${roleLabel}</span>
            </div>
        `;

        card.addEventListener('click', () => {
            this.selectRestaurantCard(card, restaurant);
        });

        return card;
    }

    getRoleLabel(role) {
        const labels = {
            'RESTAURATEUR': 'Propriétaire',
            'MANAGER': 'Manager',
            'EMPLOYE': 'Employé'
        };
        return labels[role] || role;
    }

    selectRestaurantCard(cardElement, restaurant) {
        // Désélectionner toutes les cartes
        document.querySelectorAll('.restaurant-card').forEach(card => {
            card.classList.remove('selected');
        });

        // Sélectionner la carte cliquée
        cardElement.classList.add('selected');
        this.selectedRestaurant = restaurant;

        // Activer le bouton de sélection
        const selectBtn = document.getElementById('selectBtn');
        selectBtn.classList.add('active');
    }

    async selectRestaurant() {
        if (!this.selectedRestaurant) return;

        try {
            // Enregistrer le restaurant sélectionné en session
            await this.setActiveRestaurant(this.selectedRestaurant.id);

            // Rediriger vers l'interface de gestion
            window.location.href = '/';

        } catch (error) {
            console.error('Erreur sélection restaurant:', error);
            this.showError('Erreur lors de la sélection du restaurant');
        }
    }

    async setActiveRestaurant(restaurantId) {
        const response = await fetch('/api/set-active-restaurant', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ restaurantId })
        });

        if (!response.ok) {
            throw new Error('Erreur lors de la définition du restaurant actif');
        }
    }

    showError(message) {
        const container = document.getElementById('restaurantsGrid');
        container.innerHTML = `
            <div class="error">
                <h3>❌ Erreur</h3>
                <p>${message}</p>
                <button onclick="window.location.reload()" style="margin-top: 15px; padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 6px; cursor: pointer;">
                    Réessayer
                </button>
            </div>
        `;
    }
}

// Initialiser le sélecteur de restaurants
document.addEventListener('DOMContentLoaded', () => {
    new RestaurantSelector();
});