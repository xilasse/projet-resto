// Gestion de l'authentification

class AuthManager {
    constructor() {
        this.init();
    }

    init() {
        // Vérifier si on est sur la page de connexion ou d'inscription
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');

        if (loginForm) {
            this.setupLoginForm();
        }

        if (registerForm) {
            this.setupRegisterForm();
        }

        // Vérifier l'authentification si on est sur une page protégée
        this.checkAuth();
    }

    setupLoginForm() {
        const form = document.getElementById('loginForm');
        const errorDiv = document.getElementById('authError');
        const submitBtn = form.querySelector('button[type="submit"]');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(form);
            const data = Object.fromEntries(formData);

            // Afficher le loading
            submitBtn.disabled = true;
            submitBtn.textContent = 'Connexion...';
            this.hideError();

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify(data)
                });

                const result = await response.json();

                if (response.ok) {
                    // Connexion réussie
                    this.showSuccess('Connexion réussie ! Redirection...');
                    setTimeout(() => {
                        window.location.href = '/';
                    }, 1500);
                } else {
                    // Erreur de connexion
                    this.showError(result.error || 'Erreur de connexion');
                }
            } catch (error) {
                console.error('Erreur:', error);
                this.showError('Erreur de connexion au serveur');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Se connecter';
            }
        });
    }

    setupRegisterForm() {
        const form = document.getElementById('registerForm');
        const errorDiv = document.getElementById('authError');
        const submitBtn = form.querySelector('button[type="submit"]');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(form);
            const data = Object.fromEntries(formData);

            // Validation côté client
            if (data.password.length < 6) {
                this.showError('Le mot de passe doit contenir au moins 6 caractères');
                return;
            }

            // Afficher le loading
            submitBtn.disabled = true;
            submitBtn.textContent = 'Création du compte...';
            this.hideError();

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
                    // Inscription réussie
                    this.showSuccess('Compte créé avec succès ! Redirection...');
                    setTimeout(() => {
                        window.location.href = '/';
                    }, 1500);
                } else {
                    // Erreur d'inscription
                    if (result.errors && result.errors.length > 0) {
                        this.showError(result.errors.map(err => err.msg).join(', '));
                    } else {
                        this.showError(result.error || 'Erreur lors de la création du compte');
                    }
                }
            } catch (error) {
                console.error('Erreur:', error);
                this.showError('Erreur de connexion au serveur');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Créer mon compte';
            }
        });
    }

    async checkAuth() {
        // Ne pas vérifier l'auth sur les pages publiques
        const publicPages = ['/login.html', '/register.html'];
        const currentPath = window.location.pathname;

        if (publicPages.some(page => currentPath.includes(page))) {
            return;
        }

        try {
            const response = await fetch('/api/check-auth', {
                credentials: 'include'
            });

            if (!response.ok) {
                // Non authentifié, rediriger vers la page de connexion
                window.location.href = '/login.html';
                return;
            }

            const result = await response.json();
            this.currentUser = result.user;
            this.userRestaurants = result.restaurants || [];

            // Mettre à jour l'interface avec les informations de l'utilisateur
            this.updateUI();

            // Configurer le bouton de déconnexion s'il existe
            this.setupLogoutButton();

            // Charger les informations du restaurant actif si c'est un restaurateur
            if (result.user.role === 'RESTAURATEUR') {
                this.loadActiveRestaurantInfo();
            }

        } catch (error) {
            console.error('Erreur de vérification auth:', error);
            window.location.href = '/login.html';
        }
    }

    updateUI() {
        // Mettre à jour le nom d'utilisateur dans l'interface
        const userNameElements = document.querySelectorAll('.user-name');
        userNameElements.forEach(element => {
            element.textContent = this.currentUser.name;
        });

        // Mettre à jour le nom du restaurant (pour les restaurateurs)
        const restaurantNameElements = document.querySelectorAll('.restaurant-name');
        if (this.userRestaurants.length > 0) {
            restaurantNameElements.forEach(element => {
                element.textContent = this.userRestaurants[0].name;
            });
        }

        // Configurer le bouton de déconnexion
        this.setupLogoutButton();
    }

    setupLogoutButton() {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            // Supprimer les anciens event listeners pour éviter les doublons
            logoutBtn.replaceWith(logoutBtn.cloneNode(true));

            // Récupérer la nouvelle référence après clonage
            const newLogoutBtn = document.getElementById('logoutBtn');

            // Ajouter l'event listener
            newLogoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }
    }

    async logout() {
        console.log('Déconnexion en cours...');
        try {
            const response = await fetch('/api/logout', {
                method: 'POST',
                credentials: 'include'
            });

            if (response.ok) {
                console.log('Déconnexion réussie');
            } else {
                console.error('Erreur serveur lors de la déconnexion:', response.status);
            }
        } catch (error) {
            console.error('Erreur lors de la déconnexion:', error);
        } finally {
            // Rediriger vers la page de connexion dans tous les cas
            console.log('Redirection vers login.html');
            window.location.href = '/login.html';
        }
    }

    async loadActiveRestaurantInfo() {
        try {
            const response = await fetch('/api/active-restaurant', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                this.updateRestaurantInfo(data);
                await this.setupSwitchRestaurantButton();
            }
        } catch (error) {
            console.error('Erreur chargement restaurant actif:', error);
        }
    }

    updateRestaurantInfo(restaurantData) {
        const currentRestaurantElement = document.getElementById('currentRestaurant');
        if (currentRestaurantElement) {
            if (restaurantData.restaurantName) {
                currentRestaurantElement.textContent = `🏪 ${restaurantData.restaurantName}`;
            } else {
                currentRestaurantElement.textContent = 'Aucun restaurant sélectionné';
            }
        }

        // Mettre à jour le nom du restaurant dans le titre
        const restaurantNameElements = document.querySelectorAll('.restaurant-name');
        if (restaurantData.restaurantName) {
            restaurantNameElements.forEach(element => {
                element.textContent = restaurantData.restaurantName;
            });
        }
    }

    async setupSwitchRestaurantButton() {
        try {
            const response = await fetch('/api/my-restaurants', {
                credentials: 'include'
            });

            if (response.ok) {
                const restaurants = await response.json();

                const switchBtn = document.getElementById('switchRestaurantBtn');
                if (switchBtn && restaurants.length > 1) {
                    switchBtn.style.display = 'block';
                    switchBtn.addEventListener('click', () => {
                        this.switchRestaurant();
                    });
                }

                // Afficher le bouton de création de restaurant pour les restaurateurs
                const createBtn = document.getElementById('createRestaurantBtn');
                if (createBtn) {
                    createBtn.style.display = 'block';
                    createBtn.addEventListener('click', () => {
                        this.openCreateRestaurantModal();
                    });
                }
            }
        } catch (error) {
            console.error('Erreur setup bouton changement restaurant:', error);
        }
    }

    switchRestaurant() {
        // Supprimer le restaurant actif de la session et rediriger vers le sélecteur
        fetch('/api/clear-active-restaurant', {
            method: 'POST',
            credentials: 'include'
        }).then(() => {
            window.location.href = '/restaurant-selector.html';
        }).catch(error => {
            console.error('Erreur changement restaurant:', error);
            // Rediriger quand même en cas d'erreur
            window.location.href = '/restaurant-selector.html';
        });
    }

    openCreateRestaurantModal() {
        const modal = document.getElementById('newRestaurantModal');
        const form = document.getElementById('newRestaurantForm');

        if (modal && form) {
            form.reset();
            modal.style.display = 'block';

            // Ajouter les event listeners si ce n'est pas déjà fait
            this.setupCreateRestaurantModal();
        }
    }

    setupCreateRestaurantModal() {
        const modal = document.getElementById('newRestaurantModal');
        const form = document.getElementById('newRestaurantForm');
        const cancelBtn = document.getElementById('cancelNewRestaurant');
        const closeBtn = modal.querySelector('.close');

        // Event listener pour fermer le modal
        const closeModal = () => {
            modal.style.display = 'none';
            form.reset();
        };

        // Supprimer les anciens listeners pour éviter les doublons
        if (cancelBtn) {
            cancelBtn.replaceWith(cancelBtn.cloneNode(true));
            document.getElementById('cancelNewRestaurant').addEventListener('click', closeModal);
        }

        if (closeBtn) {
            closeBtn.replaceWith(closeBtn.cloneNode(true));
            modal.querySelector('.close').addEventListener('click', closeModal);
        }

        // Event listener pour la soumission du formulaire
        if (form) {
            form.replaceWith(form.cloneNode(true));
            const newForm = document.getElementById('newRestaurantForm');
            newForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.createRestaurant();
            });
        }

        // Fermer le modal en cliquant à l'extérieur
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    async createRestaurant() {
        const form = document.getElementById('newRestaurantForm');
        const submitBtn = form.querySelector('button[type="submit"]');

        // Récupérer les données du formulaire
        const formData = {
            name: document.getElementById('newRestaurantName').value,
            email: document.getElementById('newRestaurantEmail').value,
            phone: document.getElementById('newRestaurantPhone').value,
            address: document.getElementById('newRestaurantAddress').value,
            description: document.getElementById('newRestaurantDescription').value
        };

        // Validation côté client
        if (!formData.name.trim()) {
            this.showNotification('Le nom du restaurant est requis', 'error');
            return;
        }

        // Afficher le loading
        submitBtn.disabled = true;
        submitBtn.textContent = 'Création en cours...';

        try {
            const response = await fetch('/api/create-restaurant', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (response.ok) {
                // Succès - fermer le modal et recharger l'interface
                document.getElementById('newRestaurantModal').style.display = 'none';
                form.reset();

                // Afficher le message de succès
                this.showNotification(result.message, 'success');

                // Recharger les informations du restaurant actif
                setTimeout(() => {
                    window.location.reload();
                }, 1500);

            } else {
                // Erreur
                if (result.errors && result.errors.length > 0) {
                    this.showNotification(result.errors.map(err => err.msg).join(', '), 'error');
                } else {
                    this.showNotification(result.error || 'Erreur lors de la création du restaurant', 'error');
                }
            }

        } catch (error) {
            console.error('Erreur création restaurant:', error);
            this.showNotification('Erreur de connexion au serveur', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Créer le restaurant';
        }
    }

    showError(message) {
        const errorDiv = document.getElementById('authError');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            errorDiv.className = 'auth-error';
        }
    }

    showSuccess(message) {
        const errorDiv = document.getElementById('authError');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            errorDiv.className = 'auth-success';
        }
    }

    hideError() {
        const errorDiv = document.getElementById('authError');
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
    }

    showNotification(message, type = 'info') {
        // Créer une notification temporaire
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            max-width: 400px;
            background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 4000);
    }
}

// Initialiser le gestionnaire d'authentification
const authManager = new AuthManager();