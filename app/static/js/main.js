document.addEventListener('DOMContentLoaded', () => {
    // --- STATE & CONFIG ---
    let goals = [];
    let authToken = null;
    let currentUserEmail = null;
    const API_BASE_URL = 'http://127.0.0.1:5000'; // Flask server address

    // --- DOM Elements (Keep all your existing element variables) ---
    const loadingContainer = document.getElementById('loading-container');
    const authContainer = document.getElementById('auth-container');
    const goalsContainer = document.getElementById('goals-container');
    const loginView = document.getElementById('login-view');
    const signupView = document.getElementById('signup-view');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const showSignup = document.getElementById('show-signup');
    const showLogin = document.getElementById('show-login');
    const loginError = document.getElementById('login-error');
    const signupMessage = document.getElementById('signup-message');
    const logoutButton = document.getElementById('logout-button');
    const welcomeMessage = document.getElementById('welcome-message');
    const addGoalForm = document.getElementById('add-goal-form');
    const goalInput = document.getElementById('goal-input');
    const dueDateInput = document.getElementById('due-date-input');
    const categoryInput = document.getElementById('category-input');
    const priorityInput = document.getElementById('priority-input');
    const goalList = document.getElementById('goal-list');
    const progressBar = document.getElementById('progress-bar');
    const stats = document.getElementById('stats');
    const searchInput = document.getElementById('search-input');
    const filterSelect = document.getElementById('filter-select');
    const sortSelect = document.getElementById('sort-select');
    const clearCompletedButton = document.getElementById('clear-completed-button');
    const darkModeToggle = document.getElementById('dark-mode-toggle');

    // --- API HELPER ---
    const apiFetch = async (endpoint, options = {}) => {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            // Handle responses with no content (like DELETE)
            return response.status === 204 ? null : response.json();
        } catch (error) {
            console.error(`API Fetch Error (${endpoint}):`, error);
            // Display a more user-friendly error on the UI
            loginError.textContent = "Couldn't connect to server. Is it running?";
            throw error;
        }
    };


    // --- API FUNCTIONS ---
    const fetchGoals = () => apiFetch('/goals').then(data => {
        goals = data;
        renderGoals();
    });
    const addGoal = (newGoalData) => apiFetch('/goals', { method: 'POST', body: JSON.stringify(newGoalData) });
    const updateGoal = (id, updates) => apiFetch(`/goals/${id}`, { method: 'PUT', body: JSON.stringify(updates) });
    const deleteGoal = (id) => apiFetch(`/goals/${id}`, { method: 'DELETE' });

    // --- RENDER & UI LOGIC (Key change: use goal._id) ---
    const renderGoals = () => {
        const searchTerm = searchInput.value.toLowerCase();
        const filterValue = filterSelect.value;
        const sortValue = sortSelect.value;

        let filteredGoals = goals.filter(goal => {
            const matchesSearch = goal.text.toLowerCase().includes(searchTerm);
            const matchesFilter = (filterValue === 'all') ||
                (filterValue === 'completed' && goal.completed) ||
                (filterValue === 'pending' && !goal.completed);
            return matchesSearch && matchesFilter;
        });

        filteredGoals.sort((a, b) => {
            const getSortDate = (goal) => goal.created_at || goal._id;
            switch (sortValue) {
                case 'priority':
                    const priorityOrder = { high: 3, medium: 2, low: 1 };
                    return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
                case 'due-date':
                    if (!a.dueDate) return 1;
                    if (!b.dueDate) return -1;
                    return new Date(a.dueDate) - new Date(b.dueDate);
                case 'oldest':
                    return new Date(getSortDate(a)) - new Date(getSortDate(b));
                case 'newest':
                default:
                    return new Date(getSortDate(b)) - new Date(getSortDate(a));
            }
        });

        goalList.innerHTML = '';
        if (filteredGoals.length === 0) {
            goalList.innerHTML = `<p class="text-center text-slate-500 dark:text-slate-400 py-4">No goals found. Let's add one! 🚀</p>`;
        } else {
            filteredGoals.forEach(goal => {
                const goalElement = document.createElement('div');
                goalElement.className = `goal-item flex items-center justify-between p-4 bg-slate-100 dark:bg-slate-700/50 rounded-lg ${goal.completed ? 'completed' : ''}`;
                goalElement.dataset.id = goal._id; // <-- USE _id FROM MONGO

                const priorityColors = { low: 'border-green-500', medium: 'border-yellow-500', high: 'border-red-500' };
                const categoryColors = { Work: 'bg-sky-500', Personal: 'bg-lime-500', Fitness: 'bg-rose-500', Learning: 'bg-indigo-500', Other: 'bg-slate-500' };

                goalElement.innerHTML = `
                    <div class="flex items-center gap-4 flex-grow">
                        <input type="checkbox" class="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" ${goal.completed ? 'checked' : ''}>
                        <div class="flex-grow">
                            <span class="goal-text font-medium text-slate-800 dark:text-slate-200">${goal.text}</span>
                            <div class="flex items-center gap-2 text-xs mt-1 text-slate-500 dark:text-slate-400">
                                ${goal.category ? `<span class="px-2 py-0.5 rounded-full text-white ${categoryColors[goal.category] || categoryColors['Other']}">${goal.category}</span>` : ''}
                                ${goal.dueDate ? `<span>Due: ${new Date(goal.dueDate).toLocaleDateString()}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                         <span class="w-3 h-3 rounded-full ${priorityColors[goal.priority] || ''} border-2" title="Priority: ${goal.priority}"></span>
                         <button class="edit-btn text-slate-500 hover:text-blue-600">✏️</button>
                         <button class="delete-btn text-slate-500 hover:text-red-600">🗑️</button>
                    </div>`;
                goalElement.classList.add(priorityColors[goal.priority]);
                goalList.appendChild(goalElement);
            });
        }
        updateStats();
    };

    // --- EVENT LISTENERS ---
    addGoalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const goalText = goalInput.value.trim();
        if (goalText) {
            const newGoalData = {
                text: goalText,
                dueDate: dueDateInput.value || null,
                category: categoryInput.value,
                priority: priorityInput.value
            };
            try {
                const newGoal = await addGoal(newGoalData);
                goals.push(newGoal);
                renderGoals();
                addGoalForm.reset();
                priorityInput.value = 'medium';
            } catch (error) {
                console.error("Failed to add goal:", error);
            }
        }
    });

    goalList.addEventListener('click', async (e) => {
        const target = e.target;
        const goalElement = target.closest('.goal-item');
        if (!goalElement) return;

        const goalId = goalElement.dataset.id;
        const goal = goals.find(g => g._id === goalId);

        if (target.type === 'checkbox') {
            await updateGoal(goalId, { completed: target.checked });
            goal.completed = target.checked;
            renderGoals();
        }

        if (target.classList.contains('delete-btn')) {
            if (confirm('Are you sure you want to delete this goal?')) {
                await deleteGoal(goalId);
                goals = goals.filter(g => g._id !== goalId);
                renderGoals();
            }
        }

        if (target.classList.contains('edit-btn')) {
            const newText = prompt('Edit your goal:', goal.text);
            if (newText && newText.trim() !== '' && newText.trim() !== goal.text) {
                await updateGoal(goalId, { text: newText.trim() });
                goal.text = newText.trim();
                renderGoals();
            }
        }
    });

    clearCompletedButton.addEventListener('click', async () => {
        if (confirm('This will permanently remove all completed goals. Continue?')) {
            const completedGoals = goals.filter(goal => goal.completed);
            await Promise.all(completedGoals.map(goal => deleteGoal(goal._id)));
            await fetchGoals(); // Re-fetch from server to be sure
        }
    });

    // --- AUTHENTICATION FLOW ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.textContent = '';
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        try {
            const data = await apiFetch('/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });
            authToken = data.token;
            currentUserEmail = data.email;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUserEmail', currentUserEmail);
            initializeApp();
        } catch (error) {
            loginError.textContent = error.message;
        }
    });

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        signupMessage.textContent = '';
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        try {
            const data = await apiFetch('/signup', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });
            signupMessage.className = 'text-green-500 text-sm mt-4 text-center';
            signupMessage.textContent = data.message;
            signupForm.reset();
            setTimeout(() => showView('login'), 2000);
        } catch (error) {
            signupMessage.className = 'text-red-500 text-sm mt-4 text-center';
            signupMessage.textContent = error.message;
        }
    });

    logoutButton.addEventListener('click', () => {
        authToken = null;
        currentUserEmail = null;
        goals = [];
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUserEmail');
        renderGoals(); // Clear the UI
        showView('login');
    });

    // --- INITIALIZATION ---
    const initializeApp = async () => {
        if (authToken && currentUserEmail) {
            welcomeMessage.textContent = `Welcome, ${currentUserEmail}!`;
            showView('goals');
            await fetchGoals();
        } else {
            showView('login');
        }
    };

    const checkSession = () => {
        applyTheme();
        authToken = localStorage.getItem('authToken');
        currentUserEmail = localStorage.getItem('currentUserEmail');
        setTimeout(() => initializeApp(), 300); // Simulate loading
    };

    // --- Other UI functions (no changes needed) ---
    const showView = (view) => {
        loadingContainer.classList.add('hidden');
        authContainer.classList.toggle('hidden', view === 'goals');
        goalsContainer.classList.toggle('hidden', view !== 'goals');
        loginView.classList.toggle('hidden', view !== 'login');
        signupView.classList.toggle('hidden', view !== 'signup');
        loginError.textContent = '';
        signupMessage.textContent = '';
    };
    const applyTheme = () => { /* ... same as before ... */ const isDarkMode=localStorage.getItem('theme')==='dark';document.documentElement.classList.toggle('dark',isDarkMode);const icon=document.querySelector('.dark-mode-icon');if(icon)icon.textContent=isDarkMode?'☀️':'🌙'; };
    darkModeToggle.addEventListener('click', () => { const isDarkMode=document.documentElement.classList.toggle('dark');localStorage.setItem('theme',isDarkMode?'dark':'light');applyTheme(); });
    const updateStats = () => { /* ... same as before ... */ const totalGoals=goals.length;const completedGoals=goals.filter(g=>g.completed).length;const progress=totalGoals>0?(completedGoals/totalGoals)*100:0;progressBar.style.width=`${progress}%`;stats.innerHTML=`<span>Total: ${totalGoals}</span><span>Completed: ${completedGoals}</span><span>Pending: ${totalGoals-completedGoals}</span>`; };
    showSignup.addEventListener('click', (e) => { e.preventDefault(); showView('signup'); });
    showLogin.addEventListener('click', (e) => { e.preventDefault(); showView('login'); });
    searchInput.addEventListener('input', renderGoals);
    filterSelect.addEventListener('change', renderGoals);
    sortSelect.addEventListener('change', renderGoals);

    // --- Start the App ---
    checkSession();
});
