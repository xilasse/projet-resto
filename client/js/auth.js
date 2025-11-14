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
}

// Initialiser le gestionnaire d'authentification
const authManager = new AuthManager();