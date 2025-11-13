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
            const response = await fetch('/api/me', {
                credentials: 'include'
            });

            if (!response.ok) {
                // Non authentifié, rediriger vers la page de connexion
                window.location.href = '/login.html';
                return;
            }

            const result = await response.json();
            this.currentUser = result.restaurant;

            // Mettre à jour l'interface avec les informations du restaurant
            this.updateUI();

        } catch (error) {
            console.error('Erreur de vérification auth:', error);
            window.location.href = '/login.html';
        }
    }

    updateUI() {
        // Mettre à jour le nom du restaurant dans l'interface
        const restaurantNameElements = document.querySelectorAll('.restaurant-name');
        restaurantNameElements.forEach(element => {
            element.textContent = this.currentUser.name;
        });

        // Ajouter un bouton de déconnexion
        this.addLogoutButton();
    }

    addLogoutButton() {
        const header = document.querySelector('.header');
        if (header && !header.querySelector('.logout-btn')) {
            const logoutBtn = document.createElement('button');
            logoutBtn.textContent = 'Déconnexion';
            logoutBtn.className = 'logout-btn';
            logoutBtn.style.cssText = `
                background: #e74c3c;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                position: absolute;
                top: 20px;
                right: 20px;
            `;

            logoutBtn.addEventListener('click', () => this.logout());
            header.style.position = 'relative';
            header.appendChild(logoutBtn);
        }
    }

    async logout() {
        try {
            await fetch('/api/logout', {
                method: 'POST',
                credentials: 'include'
            });
        } catch (error) {
            console.error('Erreur lors de la déconnexion:', error);
        } finally {
            window.location.href = '/login.html';
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
}

// Initialiser le gestionnaire d'authentification
const authManager = new AuthManager();