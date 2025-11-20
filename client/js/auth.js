// Gestion de l'authentification
// FORCE REDEPLOY 2024-11-18 v2.0 - FIX TABLE ERROR

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

            // Charger les informations du restaurant actif si c'est un restaurateur ou manager
            if (result.user.role === 'RESTAURATEUR' || result.user.role === 'MANAGER') {
                this.loadActiveRestaurantInfo();
                this.setupSwitchRestaurantButton();
                this.showTeamTab();
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

                // Récupérer le rôle de l'utilisateur
                const userRole = await this.getUserRole();

                const switchBtn = document.getElementById('switchRestaurantBtn');
                if (switchBtn && restaurants.length > 1 && userRole === 'RESTAURATEUR') {
                    // Seuls les restaurateurs peuvent changer de restaurant
                    switchBtn.style.display = 'block';
                    // Supprimer les anciens listeners pour éviter les doublons
                    switchBtn.replaceWith(switchBtn.cloneNode(true));
                    const newSwitchBtn = document.getElementById('switchRestaurantBtn');
                    newSwitchBtn.addEventListener('click', () => {
                        this.switchRestaurant();
                    });
                }

                // Afficher le bouton de création de restaurant SEULEMENT pour les restaurateurs
                const createBtn = document.getElementById('createRestaurantBtn');
                if (createBtn && userRole === 'RESTAURATEUR') {
                    createBtn.style.display = 'block';
                    // Supprimer les anciens listeners pour éviter les doublons
                    createBtn.replaceWith(createBtn.cloneNode(true));
                    const newCreateBtn = document.getElementById('createRestaurantBtn');
                    newCreateBtn.addEventListener('click', () => {
                        this.openCreateRestaurantModal();
                    });
                } else if (createBtn) {
                    // Masquer le bouton pour les managers
                    createBtn.style.display = 'none';
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
                    this.loadUserProfile(); // Recharger seulement le profil au lieu de toute la page
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

    showTeamTab() {
        // Afficher le bouton équipe dans la navigation principale
        const teamTab = document.getElementById('teamTab');
        if (teamTab) {
            teamTab.style.display = 'block';
            console.log('✅ Bouton équipe affiché dans la navigation');
        }

        // Préparer la section équipe (laisser le CSS gérer l'affichage)
        const teamSection = document.getElementById('teamSection');
        if (teamSection) {
            // Supprimer tout style inline qui pourrait interférer avec le CSS
            teamSection.style.display = '';
            // Ne pas ajouter 'active' automatiquement - laisser l'utilisateur naviguer
            console.log('✅ Section équipe préparée (disponible pour navigation)');
        } else {
            console.log('❌ Section équipe non trouvée dans le DOM');
        }

        this.setupTeamNavigation();
        this.setupScheduleButtons();

        // S'assurer que la vue équipe par défaut est active
        this.switchTeamView('teamListView', 'teamListTab');

        // Charger immédiatement les données de l'équipe
        this.loadTeamData();
    }


    setupTeamNavigation() {
        // Navigation entre les vues équipe
        const teamNavButtons = document.querySelectorAll('.team-nav-btn');
        teamNavButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const viewId = btn.id.replace('Tab', 'View');
                this.switchTeamView(viewId, btn.id);
            });
        });

        // Event listener pour le bouton d'ajout d'utilisateur
        const addUserBtn = document.getElementById('addUserBtn');
        if (addUserBtn) {
            // Supprimer les anciens listeners pour éviter les doublons
            addUserBtn.replaceWith(addUserBtn.cloneNode(true));
            const newAddUserBtn = document.getElementById('addUserBtn');
            newAddUserBtn.addEventListener('click', () => {
                this.openCreateUserModal();
            });
        }
    }

    setupScheduleButtons() {
        // Event listener pour le bouton "Nouveau planning"
        const addScheduleBtn = document.getElementById('addScheduleBtn');
        if (addScheduleBtn) {
            // Supprimer les anciens listeners pour éviter les doublons
            addScheduleBtn.replaceWith(addScheduleBtn.cloneNode(true));
            const newAddScheduleBtn = document.getElementById('addScheduleBtn');
            newAddScheduleBtn.addEventListener('click', () => {
                this.createNewSchedule();
            });
        }

        // Event listener pour le sélecteur de semaine
        const scheduleWeekSelect = document.getElementById('scheduleWeekSelect');
        if (scheduleWeekSelect) {
            scheduleWeekSelect.addEventListener('change', () => {
                this.loadSchedules();
            });
        }
    }

    createNewSchedule() {
        // Fonction pour créer un nouveau planning
        const confirmCreate = confirm(
            '🗓️ Voulez-vous créer un nouveau planning ?\n\n' +
            'Cela va:\n' +
            '• Générer un planning vide pour la semaine\n' +
            '• Permettre de configurer les horaires de chaque employé\n' +
            '• Remplacer le planning actuel s\'il existe'
        );

        if (confirmCreate) {
            try {
                // Réinitialiser tous les créneaux
                this.resetAllScheduleSlots();

                // Afficher un message de succès
                this.showNotification('✅ Nouveau planning créé ! Vous pouvez maintenant configurer les horaires.', 'success');

                // Recharger l'affichage des plannings
                this.loadSchedules();
            } catch (error) {
                console.error('Erreur création planning:', error);
                this.showNotification('❌ Erreur lors de la création du planning', 'error');
            }
        }
    }

    resetAllScheduleSlots() {
        // Fonction pour réinitialiser tous les créneaux de planning
        const scheduleSlots = document.querySelectorAll('.schedule-slot');
        scheduleSlots.forEach(slot => {
            slot.className = 'schedule-slot'; // Reset to default state
            slot.innerHTML = '<div class="slot-status">Repos</div>';
            slot.style.backgroundColor = '';
        });

        console.log('🔄 Tous les créneaux de planning réinitialisés');
    }

    switchTeamView(viewId, tabId) {
        // Protection contre les appels multiples rapides
        if (this.switchingTeamView) {
            console.log('⏸️ Switch équipe déjà en cours, ignoré');
            return;
        }
        this.switchingTeamView = true;

        console.log('🔄 Switch vers vue équipe:', viewId, 'avec tab:', tabId);

        // Masquer toutes les vues
        const teamViews = document.querySelectorAll('.team-view');
        teamViews.forEach(view => {
            view.classList.remove('active');
        });

        // Désactiver tous les boutons
        const teamNavBtns = document.querySelectorAll('.team-nav-btn');
        teamNavBtns.forEach(btn => {
            btn.classList.remove('active');
        });

        // Activer la vue et le bouton sélectionnés
        const targetView = document.getElementById(viewId);
        const targetTab = document.getElementById(tabId);

        if (targetView) {
            targetView.classList.add('active');
        }
        if (targetTab) {
            targetTab.classList.add('active');
        }

        // Libérer le verrou après un délai
        setTimeout(() => {
            this.switchingTeamView = false;
        }, 100);

        // Charger les données selon la vue
        switch(viewId) {
            case 'teamListView':
                this.loadTeamData();
                break;
            case 'profilesView':
                this.loadProfiles();
                break;
            case 'schedulesView':
                this.loadSchedules();
                break;
        }
    }

    async loadTeamData() {
        console.log('🔄 Chargement des données équipe...');
        try {
            const response = await fetch('/api/restaurant-team', {
                credentials: 'include'
            });

            console.log('📡 Réponse API équipe:', response.status);

            if (response.ok) {
                const team = await response.json();
                console.log('👥 Données équipe reçues:', team);
                this.currentTeamData = team; // Stocker les données pour réutilisation
                this.displayTeam(team);
            } else {
                const errorText = await response.text();
                console.error('❌ Erreur chargement équipe:', response.status, errorText);
                this.displayTeamError('Erreur lors du chargement de l\'équipe');
            }
        } catch (error) {
            console.error('❌ Erreur connexion serveur équipe:', error);
            this.displayTeamError('Erreur de connexion au serveur');
        }
    }

    displayTeam(team) {
        // PRÉVENIR LES BOUCLES INFINIES
        if (this.isDisplayingTeam) {
            console.log('⚠️ Affichage équipe déjà en cours - ARRÊT pour éviter la boucle');
            return;
        }
        this.isDisplayingTeam = true;

        console.log('🎯 Affichage équipe appelé avec:', team);
        console.trace('📍 Stack trace pour voir qui appelle displayTeam:');
        const tableBody = document.getElementById('teamTableBody');
        console.log('📋 Element teamTableBody trouvé:', !!tableBody);

        if (!tableBody) {
            console.error('❌ teamTableBody non trouvé - section équipe peut-être pas visible');
            return;
        }

        const managerCountElement = document.getElementById('managerCount');
        const employeeCountElement = document.getElementById('employeeCount');

        console.log('🔢 Elements compteurs trouvés:', {
            managers: !!managerCountElement,
            employees: !!employeeCountElement
        });

        if (!tableBody) return;

        // Compter les rôles
        const managers = team.filter(user => user.role === 'MANAGER');
        const employees = team.filter(user => user.role === 'EMPLOYE');

        if (managerCountElement) managerCountElement.textContent = managers.length;
        if (employeeCountElement) employeeCountElement.textContent = employees.length;

        // Afficher la liste
        console.log('📝 Génération HTML pour', team.length, 'membres');

        if (team.length === 0) {
            console.log('❌ Équipe vide - affichage message');
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="loading-message">
                        Aucun membre d'équipe trouvé. Commencez par ajouter des utilisateurs !
                    </td>
                </tr>
            `;
            return;
        }

        console.log('🏗️ Début génération HTML tableau...');
        // Vérifier la visibilité des éléments
        const teamSection = document.getElementById('teamSection');
        const teamListView = document.getElementById('teamListView');
        console.log('🔍 Visibilité section équipe:', {
            teamSection: teamSection ? getComputedStyle(teamSection).display : 'non trouvé',
            teamListView: teamListView ? getComputedStyle(teamListView).display : 'non trouvé',
            teamSectionClasses: teamSection?.className,
            teamListViewClasses: teamListView?.className
        });

        tableBody.innerHTML = team.map(user => {
            console.log('👤 Traitement utilisateur:', user.first_name, user.last_name, user.role);
            const roleBadge = user.role === 'MANAGER' ? 'role-manager' : 'role-employee';
            const roleText = user.role === 'MANAGER' ? 'Manager' : 'Employé';
            const statusBadge = user.is_active ? 'status-active' : 'status-inactive';
            const statusText = user.is_active ? 'Actif' : 'Inactif';

            return `
                <tr>
                    <td>${user.first_name} ${user.last_name}</td>
                    <td>${user.email}</td>
                    <td>${user.phone || 'Non renseigné'}</td>
                    <td><span class="role-badge ${roleBadge}">${roleText}</span></td>
                    <td><span class="user-status ${statusBadge}">${statusText}</span></td>
                    <td>
                        <div class="user-actions">
                            <button class="btn-edit" onclick="authManager.editUser(${user.id})" title="Modifier">
                                ✏️
                            </button>
                            <button class="btn-delete" onclick="authManager.deleteUser(${user.id}, '${user.first_name} ${user.last_name}')" title="Supprimer">
                                🗑️
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        console.log('✅ HTML injecté dans tableBody');
        console.log('📋 Contenu final du tableau:', tableBody.innerHTML.substring(0, 300) + '...');
        console.log('🔍 Nombre d\'éléments tr dans tableBody:', tableBody.querySelectorAll('tr').length);

        // Les styles d'affichage sont maintenant gérés par la navigation normale
        // La section équipe ne doit être visible que quand l'onglet équipe est sélectionné
        console.log('✅ Affichage de l\'équipe terminé - géré par navigation normale');

        // Libérer le verrou après un délai pour permettre les prochains appels légitimes
        setTimeout(() => {
            this.isDisplayingTeam = false;
            console.log('🔓 Verrou displayTeam libéré');
        }, 1000);

        // Vérifier la visibilité du tableau parent (avec protection)
        if (tableBody) {
            const tableContainer = tableBody.closest('.table-container');
            const table = tableBody.closest('table');
            console.log('📊 Visibilité tableau:', {
                tableDisplay: table ? getComputedStyle(table).display : 'non trouvé',
                tableContainerDisplay: tableContainer ? getComputedStyle(tableContainer).display : 'non trouvé',
                tableHeight: table ? getComputedStyle(table).height : 'non trouvé'
            });
        } else {
            console.log('⚠️ tableBody non disponible pour vérification visibilité');
        }
    }

    displayTeamError(message) {
        const tableBody = document.getElementById('teamTableBody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="loading-message" style="color: #e74c3c;">
                        ${message}
                        <br><br>
                        <button onclick="authManager.loadTeamData()" style="padding: 8px 16px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            Réessayer
                        </button>
                    </td>
                </tr>
            `;
        }
    }

    openCreateUserModal() {
        const modal = document.getElementById('newUserModal');
        const form = document.getElementById('newUserForm');

        if (modal && form) {
            form.reset();
            modal.style.display = 'block';
            this.setupCreateUserModal();
        }
    }

    setupCreateUserModal() {
        const modal = document.getElementById('newUserModal');
        const form = document.getElementById('newUserForm');
        const cancelBtn = document.getElementById('cancelNewUser');
        const closeBtn = modal.querySelector('.close');

        // Event listener pour fermer le modal
        const closeModal = () => {
            modal.style.display = 'none';
            form.reset();
        };

        // Supprimer les anciens listeners pour éviter les doublons
        if (cancelBtn) {
            cancelBtn.replaceWith(cancelBtn.cloneNode(true));
            document.getElementById('cancelNewUser').addEventListener('click', closeModal);
        }

        if (closeBtn) {
            closeBtn.replaceWith(closeBtn.cloneNode(true));
            modal.querySelector('.close').addEventListener('click', closeModal);
        }

        // Event listener pour la soumission du formulaire
        if (form) {
            form.replaceWith(form.cloneNode(true));
            const newForm = document.getElementById('newUserForm');
            newForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.createUser();
            });
        }

        // Fermer le modal en cliquant à l'extérieur
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    async createUser() {
        const form = document.getElementById('newUserForm');
        const submitBtn = form.querySelector('button[type="submit"]');

        // Récupérer les données du formulaire
        const formData = {
            firstName: document.getElementById('newUserFirstName').value,
            lastName: document.getElementById('newUserLastName').value,
            email: document.getElementById('newUserEmail').value,
            password: document.getElementById('newUserPassword').value,
            role: document.getElementById('newUserRole').value,
            phone: document.getElementById('newUserPhone').value,
            notes: document.getElementById('newUserNotes').value
        };

        // Validation côté client
        if (!formData.firstName.trim() || !formData.lastName.trim()) {
            this.showNotification('Le prénom et le nom sont requis', 'error');
            return;
        }

        if (!formData.email.trim()) {
            this.showNotification('L\'email est requis', 'error');
            return;
        }

        if (!formData.password || formData.password.length < 6) {
            this.showNotification('Le mot de passe doit contenir au moins 6 caractères', 'error');
            return;
        }

        if (!formData.role) {
            this.showNotification('Le rôle est requis', 'error');
            return;
        }

        // Afficher le loading
        submitBtn.disabled = true;
        submitBtn.textContent = 'Création en cours...';

        try {
            const response = await fetch('/api/create-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (response.ok) {
                // Succès - fermer le modal et recharger l'équipe
                document.getElementById('newUserModal').style.display = 'none';
                form.reset();

                // Afficher le message de succès
                this.showNotification(result.message, 'success');

                // Recharger les données de l'équipe
                setTimeout(() => {
                    this.loadTeamData();
                }, 500);

            } else {
                // Erreur
                if (result.errors && result.errors.length > 0) {
                    this.showNotification(result.errors.map(err => err.msg).join(', '), 'error');
                } else {
                    this.showNotification(result.error || 'Erreur lors de la création de l\'utilisateur', 'error');
                }
            }

        } catch (error) {
            console.error('Erreur création utilisateur:', error);
            this.showNotification('Erreur de connexion au serveur', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Créer l\'utilisateur';
        }
    }

    async deleteUser(userId, userName) {
        const confirm = window.confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur "${userName}" ?\n\nCette action est irréversible.`);

        if (!confirm) return;

        try {
            const response = await fetch(`/api/delete-user/${userId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            const result = await response.json();

            if (response.ok) {
                this.showNotification(result.message, 'success');
                // Recharger les données de l'équipe
                setTimeout(() => {
                    this.loadTeamData();
                }, 500);
            } else {
                this.showNotification(result.error || 'Erreur lors de la suppression', 'error');
            }

        } catch (error) {
            console.error('Erreur suppression utilisateur:', error);
            this.showNotification('Erreur de connexion au serveur', 'error');
        }
    }

    editUser(userId) {
        // Fonctionnalité d'édition à implémenter plus tard
        this.showNotification('Fonctionnalité d\'édition en cours de développement', 'info');
    }

    editUserProfile(userId) {
        // Trouver l'utilisateur dans les données actuelles
        const user = this.currentTeamData?.find(u => u.id === userId);
        if (!user) {
            this.showNotification('Utilisateur introuvable', 'error');
            return;
        }

        // Créer et afficher un modal d'édition
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3>Modifier le profil</h3>
                    <button class="close-btn" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</button>
                </div>
                <form class="modal-content" onsubmit="authManager.updateUserProfile(event, ${userId})">
                    <div class="form-group">
                        <label for="edit-first-name">Prénom</label>
                        <input type="text" id="edit-first-name" name="firstName" value="${user.first_name}" required>
                    </div>
                    <div class="form-group">
                        <label for="edit-last-name">Nom</label>
                        <input type="text" id="edit-last-name" name="lastName" value="${user.last_name}" required>
                    </div>
                    <div class="form-group">
                        <label for="edit-email">Email</label>
                        <input type="email" id="edit-email" name="email" value="${user.email}" required>
                    </div>
                    <div class="form-group">
                        <label for="edit-phone">Téléphone</label>
                        <input type="tel" id="edit-phone" name="phone" value="${user.phone || ''}">
                    </div>
                    <div class="form-group">
                        <label for="edit-role">Rôle</label>
                        <select id="edit-role" name="role" required>
                            <option value="EMPLOYE" ${user.role === 'EMPLOYE' ? 'selected' : ''}>Employé</option>
                            <option value="MANAGER" ${user.role === 'MANAGER' ? 'selected' : ''}>Manager</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="edit-is-active" name="isActive" ${user.is_active ? 'checked' : ''}>
                            Compte actif
                        </label>
                    </div>
                    <div class="modal-actions">
                        <button type="button" onclick="this.parentElement.parentElement.parentElement.remove()" class="btn-cancel">Annuler</button>
                        <button type="submit" class="btn-submit">Sauvegarder</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
    }

    async updateUserProfile(event, userId) {
        event.preventDefault();

        const formData = new FormData(event.target);
        const data = {
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            role: formData.get('role'),
            isActive: formData.get('isActive') === 'on'
        };

        const submitBtn = event.target.querySelector('.btn-submit');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Mise à jour...';

        try {
            const response = await fetch(`/api/update-user/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data),
                credentials: 'include'
            });

            const result = await response.json();

            if (response.ok) {
                this.showNotification(result.message, 'success');
                // Fermer le modal
                event.target.closest('.modal-overlay').remove();
                // Recharger les données
                setTimeout(() => {
                    this.loadTeamData();
                    this.loadProfiles();
                }, 500);
            } else {
                this.showNotification(result.error || 'Erreur lors de la mise à jour', 'error');
            }

        } catch (error) {
            console.error('Erreur mise à jour profil:', error);
            this.showNotification('Erreur de connexion au serveur', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sauvegarder';
        }
    }

    manageUserSchedule(userId) {
        // Basculer vers l'onglet planning et mettre en évidence l'utilisateur
        this.switchTeamView('schedulesView', 'schedulesTab');

        // Trouver l'utilisateur pour afficher son planning
        const user = this.currentTeamData?.find(u => u.id === userId);
        if (user) {
            this.showNotification(`Affichage du planning de ${user.first_name} ${user.last_name}`, 'info');
            // Mettre en évidence l'utilisateur dans le planning
            setTimeout(() => {
                this.highlightUserInSchedule(userId);
            }, 100);
        }
    }

    highlightUserInSchedule(userId) {
        // Fonction pour mettre en évidence un utilisateur spécifique dans le planning
        const scheduleRows = document.querySelectorAll('.schedule-row');
        scheduleRows.forEach(row => {
            if (row.dataset.userId == userId) {
                row.style.backgroundColor = '#fff3cd';
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });

                // Retirer la mise en évidence après quelques secondes
                setTimeout(() => {
                    row.style.backgroundColor = '';
                }, 3000);
            }
        });
    }

    async loadProfiles() {
        try {
            // Utiliser les données déjà chargées si disponibles
            if (this.currentTeamData) {
                this.displayProfiles(this.currentTeamData);
                return;
            }

            const response = await fetch('/api/restaurant-team', {
                credentials: 'include'
            });

            if (response.ok) {
                const team = await response.json();
                this.currentTeamData = team;
                this.displayProfiles(team);
            } else {
                console.error('Erreur chargement profils:', response.status);
                this.displayProfilesError('Erreur lors du chargement des profils');
            }
        } catch (error) {
            console.error('Erreur chargement profils:', error);
            this.displayProfilesError('Erreur de connexion au serveur');
        }
    }

    displayProfiles(team) {
        const profilesGrid = document.getElementById('profilesGrid');

        if (!profilesGrid) return;

        if (team.length === 0) {
            profilesGrid.innerHTML = `
                <div class="loading-message">
                    Aucun membre d'équipe trouvé. Créez d'abord des comptes utilisateurs !
                </div>
            `;
            return;
        }

        profilesGrid.innerHTML = team.map(user => {
            const initials = (user.first_name.charAt(0) + user.last_name.charAt(0)).toUpperCase();
            const cardClass = user.role === 'MANAGER' ? 'manager' : 'employee';
            const roleText = user.role === 'MANAGER' ? 'Manager' : 'Employé';

            return `
                <div class="profile-card ${cardClass}">
                    <div class="profile-card-header">
                        <div class="profile-avatar">${initials}</div>
                        <div class="profile-info">
                            <h4>${user.first_name} ${user.last_name}</h4>
                            <div class="role">${roleText}</div>
                        </div>
                    </div>
                    <div class="profile-details">
                        <div>📧 ${user.email}</div>
                        <div>📞 ${user.phone || 'Non renseigné'}</div>
                        <div>📊 Statut: ${user.is_active ? 'Actif' : 'Inactif'}</div>
                        <div>📅 Créé le: ${new Date(user.created_at || Date.now()).toLocaleDateString()}</div>
                    </div>
                    <div class="profile-actions">
                        <button class="btn-profile edit" onclick="authManager.editUserProfile(${user.id})">
                            ✏️ Modifier
                        </button>
                        <button class="btn-profile schedule" onclick="authManager.manageUserSchedule(${user.id})">
                            📅 Planning
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    displayProfilesError(message) {
        const profilesGrid = document.getElementById('profilesGrid');
        if (profilesGrid) {
            profilesGrid.innerHTML = `
                <div class="loading-message" style="color: #e74c3c;">
                    ${message}
                    <br><br>
                    <button onclick="authManager.loadProfiles()" style="padding: 8px 16px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Réessayer
                    </button>
                </div>
            `;
        }
    }

    async getUserRole() {
        try {
            const response = await fetch('/api/check-auth', {
                credentials: 'include'
            });

            if (response.ok) {
                const result = await response.json();
                return result.user?.role || null;
            }
            return null;
        } catch (error) {
            console.error('Erreur récupération rôle utilisateur:', error);
            return null;
        }
    }

    async loadSchedules() {
        try {
            // Utiliser les données d'équipe déjà chargées si disponibles
            if (this.currentTeamData) {
                this.displaySchedules(this.currentTeamData);
                return;
            }

            const response = await fetch('/api/restaurant-team', {
                credentials: 'include'
            });

            if (response.ok) {
                const team = await response.json();
                this.currentTeamData = team;
                this.displaySchedules(team);
            } else {
                this.displaySchedulesError('Erreur lors du chargement de l\'équipe');
            }
        } catch (error) {
            console.error('Erreur chargement plannings:', error);
            this.displaySchedulesError('Erreur de connexion au serveur');
        }
    }

    displaySchedules(team = []) {
        const schedulesContent = document.getElementById('schedulesContent');

        if (!schedulesContent) return;

        const currentWeek = this.getCurrentWeek();

        if (team.length === 0) {
            schedulesContent.innerHTML = `
                <div class="loading-message">
                    Aucun membre d'équipe trouvé.<br>
                    Créez d'abord des comptes utilisateurs dans l'onglet "Liste équipe" !
                </div>
            `;
            return;
        }

        schedulesContent.innerHTML = `
            <div class="schedule-header">
                <h4>Planning de la semaine</h4>
                <div class="schedule-controls">
                    <button class="btn-schedule-action" onclick="authManager.generateWeeklySchedule()">
                        📅 Générer un planning type
                    </button>
                    <button class="btn-schedule-action" onclick="authManager.exportSchedule()">
                        📊 Exporter PDF
                    </button>
                </div>
            </div>
            <table class="schedule-table">
                <thead>
                    <tr>
                        <th class="employee-column">Employé</th>
                        ${currentWeek.map(day => `
                            <th class="day-column">
                                ${day.name}<br>
                                <small>${day.date}</small>
                            </th>
                        `).join('')}
                        <th class="hours-column">Total heures</th>
                    </tr>
                </thead>
                <tbody id="scheduleTableBody">
                    ${team.map(user => {
                        const initials = (user.first_name.charAt(0) + user.last_name.charAt(0)).toUpperCase();
                        const roleClass = user.role === 'MANAGER' ? 'manager' : 'employee';

                        return `
                            <tr class="schedule-row ${roleClass}" data-user-id="${user.id}">
                                <td class="employee-info">
                                    <div class="employee-avatar">${initials}</div>
                                    <div>
                                        <div class="employee-name">${user.first_name} ${user.last_name}</div>
                                        <div class="employee-role">${user.role === 'MANAGER' ? 'Manager' : 'Employé'}</div>
                                    </div>
                                </td>
                                ${currentWeek.map((day, dayIndex) => {
                                    const isWeekend = dayIndex === 5 || dayIndex === 6; // Samedi/Dimanche
                                    const isToday = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) === day.date;

                                    return `
                                    <td class="schedule-day ${isWeekend ? 'weekend' : ''} ${isToday ? 'today' : ''}" data-day="${dayIndex}">
                                        <div class="schedule-slot"
                                             onclick="authManager.editScheduleSlot(${user.id}, ${dayIndex})"
                                             data-user-id="${user.id}"
                                             data-day-index="${dayIndex}"
                                             title="Cliquer pour modifier le planning de ${day.name} ${day.date}"
                                             style="cursor: pointer;">
                                            <div class="time-slot">--:-- / --:--</div>
                                            <div class="slot-status">Repos</div>
                                        </div>
                                    </td>
                                `;
                                }).join('')}
                                <td class="total-hours">0h</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>

            <div class="schedule-legend">
                <div class="legend-item">
                    <span class="legend-color working"></span> Travail
                </div>
                <div class="legend-item">
                    <span class="legend-color rest"></span> Repos
                </div>
                <div class="legend-item">
                    <span class="legend-color vacation"></span> Congé
                </div>
            </div>
        `;

        // Ajouter des event listeners après la génération du DOM
        setTimeout(() => {
            this.setupScheduleClickHandlers();
        }, 100);
    }

    displaySchedulesError(message) {
        const schedulesContent = document.getElementById('schedulesContent');
        if (schedulesContent) {
            schedulesContent.innerHTML = `
                <div class="loading-message" style="color: #e74c3c;">
                    ${message}
                    <br><br>
                    <button onclick="authManager.loadSchedules()" style="padding: 8px 16px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Réessayer
                    </button>
                </div>
            `;
        }
    }

    getCurrentWeek() {
        const today = new Date();
        const currentDay = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - currentDay + (currentDay === 0 ? -6 : 1));

        const week = [];
        const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

        for (let i = 0; i < 7; i++) {
            const day = new Date(monday);
            day.setDate(monday.getDate() + i);
            week.push({
                name: days[i],
                date: day.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
            });
        }

        return week;
    }

    editScheduleSlot(userId, dayIndex) {
        console.log('🔄 editScheduleSlot appelé:', { userId, dayIndex });
        console.log('📋 currentTeamData:', this.currentTeamData);

        const user = this.currentTeamData?.find(u => u.id === userId);
        const currentWeek = this.getCurrentWeek();

        console.log('👤 User trouvé:', user);
        console.log('📅 Semaine actuelle:', currentWeek[dayIndex]);

        if (!user) {
            console.error('❌ Utilisateur non trouvé:', userId);
            this.showNotification('Erreur: Utilisateur non trouvé', 'error');
            return;
        }

        if (!currentWeek[dayIndex]) {
            console.error('❌ Jour non valide:', dayIndex);
            this.showNotification('Erreur: Jour non valide', 'error');
            return;
        }

        // Récupérer les données actuelles du créneau
        const row = document.querySelector(`tr[data-user-id="${userId}"]`);
        const dayCell = row?.querySelector(`td[data-day="${dayIndex}"]`);
        const slot = dayCell?.querySelector('.schedule-slot');

        let currentType = 'rest';
        let currentStartTime = '09:00';
        let currentEndTime = '17:00';

        if (slot) {
            if (slot.classList.contains('working')) {
                currentType = 'work';
                const timeSlot = slot.querySelector('.time-slot');
                if (timeSlot && timeSlot.textContent !== '--:-- / --:--') {
                    const times = timeSlot.textContent.split(' / ');
                    currentStartTime = times[0] || '09:00';
                    currentEndTime = times[1] || '17:00';
                }
            } else if (slot.classList.contains('vacation')) {
                currentType = 'vacation';
            }
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3>📅 Modifier le planning</h3>
                    <button class="close-btn" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</button>
                </div>
                <form class="modal-content" onsubmit="authManager.saveScheduleSlot(event, ${userId}, ${dayIndex})">
                    <div class="schedule-info">
                        <strong>👤 ${user.first_name} ${user.last_name}</strong> (${user.role === 'MANAGER' ? 'Manager' : 'Employé'})<br>
                        <strong>📅 ${currentWeek[dayIndex].name} ${currentWeek[dayIndex].date}</strong>
                    </div>

                    <div class="form-group">
                        <label for="schedule-type">🏷️ Type de service</label>
                        <select id="schedule-type" name="type" onchange="authManager.toggleScheduleFields(this.value)">
                            <option value="rest" ${currentType === 'rest' ? 'selected' : ''}>🛌 Repos</option>
                            <option value="work" ${currentType === 'work' ? 'selected' : ''}>💼 Travail</option>
                            <option value="vacation" ${currentType === 'vacation' ? 'selected' : ''}>🏖️ Congé</option>
                        </select>
                    </div>

                    <div id="work-fields" style="display: ${currentType === 'work' ? 'block' : 'none'};">
                        <div class="form-row">
                            <div class="form-group">
                                <label for="start-time">⏰ Heure de début</label>
                                <input type="time" id="start-time" name="startTime" value="${currentStartTime}">
                            </div>
                            <div class="form-group">
                                <label for="end-time">🕐 Heure de fin</label>
                                <input type="time" id="end-time" name="endTime" value="${currentEndTime}">
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="break-duration">☕ Pause (minutes)</label>
                            <input type="number" id="break-duration" name="breakDuration" value="60" min="0" max="300">
                        </div>
                        <div class="schedule-tips">
                            <small>💡 <strong>Astuce :</strong> Les horaires standards sont 9h-17h pour employés, 8h-16h pour managers</small>
                        </div>
                    </div>

                    <div class="modal-actions">
                        <button type="button" onclick="this.parentElement.parentElement.parentElement.remove()" class="btn-cancel">Annuler</button>
                        <button type="submit" class="btn-submit">Sauvegarder</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
    }

    toggleScheduleFields(type) {
        const workFields = document.getElementById('work-fields');
        if (workFields) {
            workFields.style.display = type === 'work' ? 'block' : 'none';
        }
    }

    saveScheduleSlot(event, userId, dayIndex) {
        event.preventDefault();

        const formData = new FormData(event.target);
        const type = formData.get('type');
        const startTime = formData.get('startTime');
        const endTime = formData.get('endTime');
        const breakDuration = formData.get('breakDuration') || 0;

        // Trouver la cellule correspondante dans le tableau
        const row = document.querySelector(`tr[data-user-id="${userId}"]`);
        const dayCell = row?.querySelector(`td[data-day="${dayIndex}"]`);

        if (!dayCell) return;

        const slot = dayCell.querySelector('.schedule-slot');

        // Mettre à jour l'affichage selon le type
        switch (type) {
            case 'work':
                const workHours = this.calculateWorkHours(startTime, endTime, breakDuration);
                slot.innerHTML = `
                    <div class="time-slot">${startTime} / ${endTime}</div>
                    <div class="slot-status working">${workHours}h</div>
                `;
                slot.className = 'schedule-slot working';
                break;

            case 'vacation':
                slot.innerHTML = `
                    <div class="time-slot">--:-- / --:--</div>
                    <div class="slot-status vacation">Congé</div>
                `;
                slot.className = 'schedule-slot vacation';
                break;

            default: // rest
                slot.innerHTML = `
                    <div class="time-slot">--:-- / --:--</div>
                    <div class="slot-status">Repos</div>
                `;
                slot.className = 'schedule-slot';
                break;
        }

        // Recalculer le total d'heures pour cet employé
        this.updateEmployeeTotalHours(userId);

        // Fermer le modal
        event.target.closest('.modal-overlay').remove();

        this.showNotification('Planning mis à jour', 'success');
    }

    calculateWorkHours(startTime, endTime, breakDuration) {
        const [startHour, startMin] = startTime.split(':').map(Number);
        const [endHour, endMin] = endTime.split(':').map(Number);

        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;

        let totalMinutes = endMinutes - startMinutes - parseInt(breakDuration);
        if (totalMinutes < 0) totalMinutes = 0;

        return (totalMinutes / 60).toFixed(1);
    }

    updateEmployeeTotalHours(userId) {
        const row = document.querySelector(`tr[data-user-id="${userId}"]`);
        if (!row) return;

        let totalHours = 0;
        const workingSlots = row.querySelectorAll('.schedule-slot.working .slot-status');

        workingSlots.forEach(slot => {
            const hoursText = slot.textContent.replace('h', '');
            totalHours += parseFloat(hoursText) || 0;
        });

        const totalCell = row.querySelector('.total-hours');
        if (totalCell) {
            totalCell.textContent = `${totalHours.toFixed(1)}h`;
        }
    }

    generateWeeklySchedule() {
        if (!this.currentTeamData || this.currentTeamData.length === 0) {
            this.showNotification('Aucun membre d\'équipe disponible', 'error');
            return;
        }

        // Générer un planning type avec horaires par défaut
        this.currentTeamData.forEach(user => {
            const row = document.querySelector(`tr[data-user-id="${user.id}"]`);
            if (!row) return;

            // Horaires par défaut selon le rôle
            const defaultShifts = user.role === 'MANAGER'
                ? { start: '08:00', end: '16:00', days: [1, 2, 3, 4, 5] } // Lun-Ven pour managers
                : { start: '09:00', end: '17:00', days: [1, 2, 3, 5, 6] }; // Lun-Mar-Mer-Ven-Sam pour employés

            for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
                const dayCell = row.querySelector(`td[data-day="${dayIndex}"]`);
                const slot = dayCell?.querySelector('.schedule-slot');

                if (!slot) continue;

                if (defaultShifts.days.includes(dayIndex)) {
                    const workHours = this.calculateWorkHours(defaultShifts.start, defaultShifts.end, 60);
                    slot.innerHTML = `
                        <div class="time-slot">${defaultShifts.start} / ${defaultShifts.end}</div>
                        <div class="slot-status working">${workHours}h</div>
                    `;
                    slot.className = 'schedule-slot working';
                } else {
                    slot.innerHTML = `
                        <div class="time-slot">--:-- / --:--</div>
                        <div class="slot-status">Repos</div>
                    `;
                    slot.className = 'schedule-slot';
                }
            }

            this.updateEmployeeTotalHours(user.id);
        });

        this.showNotification('Planning type généré avec succès', 'success');
    }

    exportSchedule() {
        this.showNotification('Export PDF en cours de développement', 'info');
    }

    setupScheduleClickHandlers() {
        console.log('🔧 Configuration des event listeners pour le planning...');

        // Supprimer les anciens listeners pour éviter les doublons
        document.querySelectorAll('.schedule-slot').forEach(slot => {
            slot.removeEventListener('click', this.handleScheduleSlotClick);
        });

        // Ajouter les nouveaux listeners
        document.querySelectorAll('.schedule-slot').forEach(slot => {
            slot.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();

                // Récupérer userId et dayIndex depuis les data attributes
                const row = slot.closest('tr[data-user-id]');
                const cell = slot.closest('td[data-day]');

                if (row && cell) {
                    const userId = parseInt(row.dataset.userId);
                    const dayIndex = parseInt(cell.dataset.day);

                    console.log('🖱️ Clic détecté sur schedule slot:', { userId, dayIndex });
                    this.editScheduleSlot(userId, dayIndex);
                } else {
                    console.error('❌ Impossible de récupérer userId ou dayIndex');
                }
            });
        });

        console.log('✅ Event listeners planning configurés:', document.querySelectorAll('.schedule-slot').length, 'slots');
    }
}

// Initialiser le gestionnaire d'authentification
const authManager = new AuthManager();