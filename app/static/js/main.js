document.addEventListener('DOMContentLoaded', () => {
    // --- STATE & CONFIG ---
    let goals = [];
    let authToken = null;
    let currentUserEmail = null;
    let analyticsChart = null;
    const API_BASE_URL = 'http://127.0.0.1:5000';

    // --- DOM Elements ---
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
    const isMeasurableCheckbox = document.getElementById('is-measurable-checkbox');
    const measurableFields = document.getElementById('measurable-fields');
    const currentValueInput = document.getElementById('current-value-input');
    const targetValueInput = document.getElementById('target-value-input');
    const exportCsvButton = document.getElementById('export-csv-button');
    const analyticsChartCanvas = document.getElementById('analytics-chart').getContext('2d');
    const quoteTextEl = document.getElementById('quote-text');
    const quoteAuthorEl = document.getElementById('quote-author');

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
            return response.status === 204 ? null : response.json();
        } catch (error) {
            console.error(`API Fetch Error (${endpoint}):`, error);
            const errorMessage = "Could not connect to the server. Please ensure it's running.";
            loginError.textContent = errorMessage;
            signupMessage.textContent = errorMessage;
            throw error;
        }
    };

    // --- API FUNCTIONS ---
    const fetchGoals = () => apiFetch('/goals').then(data => {
        goals = data || [];
        renderGoals();
        renderAnalyticsChart();
    });

    const addGoal = (newGoalData) => apiFetch('/goals', { method: 'POST', body: JSON.stringify(newGoalData) });
    const updateGoal = (id, updates) => apiFetch(`/goals/${id}`, { method: 'PUT', body: JSON.stringify(updates) });
    const deleteGoal = (id) => apiFetch(`/goals/${id}`, { method: 'DELETE' });

    const fetchAndDisplayQuote = async () => {
        try {
            const response = await fetch("https://type.fit/api/quotes");
            if (!response.ok) throw new Error('Quote API request failed');
            const quotes = await response.json();
            const randomIndex = Math.floor(Math.random() * quotes.length);
            const randomQuote = quotes[randomIndex];
            quoteTextEl.textContent = `"${randomQuote.text}"`;
            quoteAuthorEl.textContent = `- ${randomQuote.author || 'Unknown'}`;
        } catch (error) {
            console.error("Failed to fetch quote:", error);
        }
    };

    // --- UI & RENDER LOGIC ---
    const showView = (view) => {
        loadingContainer.classList.add('hidden');
        if (view === 'auth') {
            authContainer.classList.remove('hidden');
            goalsContainer.classList.add('hidden');
            loginView.classList.remove('hidden');
            signupView.classList.add('hidden');
        } else {
            authContainer.classList.add('hidden');
            goalsContainer.classList.remove('hidden');
        }
    };

    const applyTheme = (theme) => {
        const icon = darkModeToggle.querySelector('.dark-mode-icon');
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
            if (icon) icon.textContent = '☀️';
        } else {
            document.documentElement.classList.remove('dark');
            if (icon) icon.textContent = '🌙';
        }
        if (analyticsChart) {
            renderAnalyticsChart();
        }
    };
    
    const toggleTheme = () => {
        const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    };

    const updateStats = () => {
        const totalGoals = goals.length;
        const completedGoals = goals.filter(g => g.completed).length;
        const pendingGoals = totalGoals - completedGoals;
        const progress = totalGoals > 0 ? (completedGoals / totalGoals) * 100 : 0;
        progressBar.style.width = `${progress}%`;
        stats.innerHTML = `<span>Total: ${totalGoals}</span><span>Completed: ${completedGoals}</span><span>Pending: ${pendingGoals}</span>`;
    };

    const renderAnalyticsChart = () => {
        const categoryCounts = goals.reduce((acc, goal) => {
            acc[goal.category] = (acc[goal.category] || 0) + 1;
            return acc;
        }, {});

        const chartLabels = Object.keys(categoryCounts);
        const chartData = Object.values(categoryCounts);
        const backgroundColors = ['#38bdf8', '#84cc16', '#f43f5e', '#6366f1', '#64748b'];

        if (analyticsChart) {
            analyticsChart.destroy();
        }

        const isDarkMode = document.documentElement.classList.contains('dark');
        analyticsChart = new Chart(analyticsChartCanvas, {
            type: 'doughnut',
            data: {
                labels: chartLabels,
                datasets: [{
                    label: 'Goals by Category',
                    data: chartData,
                    backgroundColor: backgroundColors,
                    borderColor: isDarkMode ? '#1e293b' : '#ffffff',
                    borderWidth: 4,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: isDarkMode ? '#cbd5e1' : '#475569',
                            font: { family: "'Inter', sans-serif", size: 14 }
                        }
                    }
                }
            }
        });
    };

    const renderGoals = () => {
        const searchTerm = searchInput.value.toLowerCase();
        const filterValue = filterSelect.value;
        const sortValue = sortSelect.value;

        let filteredGoals = goals.filter(goal =>
            goal.text.toLowerCase().includes(searchTerm) &&
            (filterValue === 'all' || (filterValue === 'completed' && goal.completed) || (filterValue === 'pending' && !goal.completed))
        );

        filteredGoals.sort((a, b) => {
            const getSortDate = (goal) => new Date(goal.created_at || goal._id);
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            switch (sortValue) {
                case 'priority': return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
                case 'due-date': return (!a.dueDate) ? 1 : (!b.dueDate) ? -1 : new Date(a.dueDate) - new Date(b.dueDate);
                case 'oldest': return getSortDate(a) - getSortDate(b);
                case 'newest': default: return getSortDate(b) - getSortDate(a);
            }
        });

        goalList.innerHTML = '';
        if (filteredGoals.length === 0) {
            goalList.innerHTML = `<p class="text-center text-slate-500 dark:text-slate-400 py-4">No goals found. Let's add one! 🚀</p>`;
        } else {
            filteredGoals.forEach(goal => {
                const goalElement = document.createElement('div');
                goalElement.className = `goal-item bg-slate-100 dark:bg-slate-900/50 p-4 rounded-lg flex flex-col gap-4 ${goal.completed ? 'completed' : ''}`;
                goalElement.dataset.id = goal._id;

                const priorityColors = { low: 'border-green-500', medium: 'border-amber-500', high: 'border-red-500' };
                const categoryColors = { Work: 'bg-sky-200 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300', Personal: 'bg-lime-200 text-lime-800 dark:bg-lime-900/50 dark:text-lime-300', Fitness: 'bg-rose-200 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300', Learning: 'bg-indigo-200 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300', Other: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300' };

                let measurableProgressHTML = '';
                if (goal.isMeasurable) {
                    const progressPercent = goal.targetValue > 0 ? (goal.currentValue / goal.targetValue) * 100 : 0;
                    measurableProgressHTML = `
                        <div class="mt-2">
                            <div class="flex justify-between items-center text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                <span>Progress</span>
                                <span>${goal.currentValue} / ${goal.targetValue}</span>
                            </div>
                            <div class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                                <div class="bg-blue-600 h-2.5 rounded-full" style="width: ${progressPercent}%"></div>
                            </div>
                            <div class="flex justify-end gap-2 mt-2">
                                <button class="measurable-update-btn px-2 py-1 text-xs bg-slate-200 dark:bg-slate-700 rounded hover:bg-slate-300" data-change="-1">-</button>
                                <button class="measurable-update-btn px-2 py-1 text-xs bg-slate-200 dark:bg-slate-700 rounded hover:bg-slate-300" data-change="1">+</button>
                            </div>
                        </div>`;
                }

                goalElement.innerHTML = `
                    <div class="flex items-start gap-4 w-full">
                        <div class="flex-shrink-0 pt-1">
                            <input type="checkbox" class="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" ${goal.completed ? 'checked' : ''}>
                        </div>
                        <div class="flex-grow border-l-4 ${priorityColors[goal.priority] || 'border-transparent'} pl-4">
                            <span class="goal-text font-medium text-slate-800 dark:text-slate-200">${goal.text}</span>
                            <div class="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs">
                               ${goal.category ? `<span class="px-2 py-0.5 font-semibold rounded-full ${categoryColors[goal.category] || ''}">${goal.category}</span>` : ''}
                               ${goal.dueDate ? `<span class="text-slate-500 dark:text-slate-400">Due: ${new Date(goal.dueDate).toLocaleDateString()}</span>` : ''}
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                             <button class="reminder-btn text-slate-500 hover:text-yellow-500" title="Set Reminder">🔔</button>
                             <button class="edit-btn text-slate-500 hover:text-blue-600" title="Edit Goal">✏️</button>
                             <button class="delete-btn text-slate-500 hover:text-red-600" title="Delete Goal">🗑️</button>
                        </div>
                    </div>
                    ${measurableProgressHTML}`;
                goalList.appendChild(goalElement);
            });
        }
        updateStats();
    };

    // --- EVENT HANDLERS ---
    const handleAddGoal = async (e) => {
        e.preventDefault();
        const goalText = goalInput.value.trim();
        if (!goalText) return;

        const isMeasurable = isMeasurableCheckbox.checked;
        const newGoalData = {
            text: goalText,
            dueDate: dueDateInput.value || null,
            category: categoryInput.value,
            priority: priorityInput.value,
            isMeasurable,
            currentValue: isMeasurable ? Number(currentValueInput.value) || 0 : null,
            targetValue: isMeasurable ? Number(targetValueInput.value) || 0 : null,
        };

        if (isMeasurable && newGoalData.targetValue <= 0) {
            alert("Target Value for a measurable goal must be greater than 0.");
            return;
        }
        try {
            await addGoal(newGoalData);
            await fetchGoals();
            addGoalForm.reset();
            measurableFields.classList.add('hidden');
            priorityInput.value = 'medium';
        } catch (error) {
            console.error("Failed to add goal:", error);
        }
    };

    const handleGoalClick = async (e) => {
        const target = e.target;
        const goalElement = target.closest('.goal-item');
        if (!goalElement) return;

        const goalId = goalElement.dataset.id;
        const goal = goals.find(g => g._id === goalId);
        if (!goal) return;

        if (target.closest('.measurable-update-btn')) {
            const change = parseInt(target.dataset.change, 10);
            const newValue = (goal.currentValue || 0) + change;
            goal.currentValue = Math.max(0, Math.min(newValue, goal.targetValue));
            goal.completed = (goal.currentValue === goal.targetValue);
            renderGoals();
            await updateGoal(goalId, { currentValue: goal.currentValue, completed: goal.completed }).catch(fetchGoals);
        } else if (target.type === 'checkbox') {
            goal.completed = target.checked;
            renderGoals();
            await updateGoal(goalId, { completed: target.checked }).catch(fetchGoals);
        } else if (target.closest('.delete-btn')) {
            if (confirm('Delete this goal?')) {
                goals = goals.filter(g => g._id !== goalId);
                renderGoals();
                await deleteGoal(goalId).catch(fetchGoals);
            }
        } else if (target.closest('.edit-btn')) {
            const newText = prompt('Edit your goal:', goal.text);
            if (newText && newText.trim() !== goal.text) {
                goal.text = newText.trim();
                renderGoals();
                await updateGoal(goalId, { text: newText.trim() }).catch(fetchGoals);
            }
        } else if (target.closest('.reminder-btn')) {
            if (!goal.dueDate) return alert("Please set a due date to create a reminder.");

            const reminderTime = new Date(goal.dueDate).getTime() - (15 * 60 * 1000); // 15 mins before
            if (reminderTime < Date.now()) return alert("Due date has passed or is too soon.");

            setTimeout(() => { new Notification('Goal Reminder!', { body: `Your goal "${goal.text}" is due soon!` }); }, reminderTime - Date.now());
            alert(`Reminder set! You'll be notified 15 minutes before the goal is due if this page is open.`);
        }
    };

    const handleClearCompleted = async () => {
        if (!confirm('Permanently remove all completed goals?')) return;
        const completedGoalIds = goals.filter(g => g.completed).map(g => g._id);
        if (completedGoalIds.length === 0) return;
        goals = goals.filter(g => !g.completed);
        renderGoals();
        try {
            await Promise.all(completedGoalIds.map(id => deleteGoal(id)));
        } catch (error) {
            console.error("Failed to clear completed goals, reloading.");
            await fetchGoals();
        }
    };

    const handleExportCsv = () => {
        if (goals.length === 0) return alert("No goals to export.");
        const headers = "ID,Text,Category,Priority,DueDate,Completed,IsMeasurable,CurrentValue,TargetValue";
        const rows = goals.map(g => [
            g._id, `"${g.text.replace(/"/g, '""')}"`, g.category, g.priority, g.dueDate || '',
            g.completed, g.isMeasurable || false, g.currentValue || 0, g.targetValue || 0
        ].join(',')).join('\n');

        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([`${headers}\n${rows}`], { type: 'text/csv;charset=utf-8;' }));
        link.download = `achievify_goals_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    };

    // --- AUTH & INITIALIZATION ---
    const handleLogin = async (e) => {
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
            await initializeApp();
        } catch (error) {
            loginError.textContent = error.message;
        }
    };

    const handleSignup = async (e) => {
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
            setTimeout(() => {
                loginView.classList.remove('hidden');
                signupView.classList.add('hidden');
            }, 2000);
        } catch (error) {
            signupMessage.className = 'text-red-500 text-sm mt-4 text-center';
            signupMessage.textContent = error.message;
        }
    };

    const handleLogout = () => {
        authToken = null;
        currentUserEmail = null;
        goals = [];
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUserEmail');
        renderGoals();
        showView('auth');
    };

    const initializeApp = async () => {
        authToken = localStorage.getItem('authToken');
        currentUserEmail = localStorage.getItem('currentUserEmail');

        if (authToken && currentUserEmail) {
            if (Notification.permission === "default") {
                Notification.requestPermission();
            }
            const username = currentUserEmail.split('@')[0];
            welcomeMessage.textContent = `Welcome, ${username}!`;
            showView('goals');
            await fetchAndDisplayQuote();
            try {
                await fetchGoals();
            } catch (error) {
                if (error.message.includes('401')) handleLogout();
            }
        } else {
            showView('auth');
        }
    };

    const checkSession = () => {
        const theme = localStorage.getItem('theme') || 'light';
        applyTheme(theme);
        setTimeout(initializeApp, 300);
    };

    // --- Event Listeners ---
    loginForm.addEventListener('submit', handleLogin);
    signupForm.addEventListener('submit', handleSignup);
    logoutButton.addEventListener('click', handleLogout);
    addGoalForm.addEventListener('submit', handleAddGoal);
    goalList.addEventListener('click', handleGoalClick);
    clearCompletedButton.addEventListener('click', handleClearCompleted);
    exportCsvButton.addEventListener('click', handleExportCsv);
    darkModeToggle.addEventListener('click', toggleTheme); // Corrected listener
    isMeasurableCheckbox.addEventListener('change', () => measurableFields.classList.toggle('hidden', !isMeasurableCheckbox.checked));
    showSignup.addEventListener('click', (e) => { e.preventDefault(); loginView.classList.add('hidden'); signupView.classList.remove('hidden'); });
    showLogin.addEventListener('click', (e) => { e.preventDefault(); signupView.classList.add('hidden'); loginView.classList.remove('hidden'); });
    [searchInput, filterSelect, sortSelect].forEach(el => el.addEventListener('input', renderGoals));

    checkSession();
});