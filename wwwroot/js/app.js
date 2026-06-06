// Antigravity Parking System - Main Application Logic

// API Configuration
const API_BASE_URL = window.location.origin;
let isOfflineMode = false;

// Application State
let parkingSpaces = [];
let tariffs = [];
let tickets = [];
let monthlySubscribers = [];
let systemUsers = [];
let activeView = 'dashboard';
let currentEntryVehicleType = 'Car';
let currentSubVehicleType = 'Car';
let currentPaymentMethod = 'Dinheiro';
let currentSelectedTicketForExit = null;
let currentCrudUserRole = 'Admin';

// Clock tick interval
setInterval(updateSystemClock, 1000);

// Auth and Session Management
const originalFetch = window.fetch;
window.fetch = function (url, options) {
    options = options || {};
    options.headers = options.headers || {};
    const session = getSession();
    if (session && session.token) {
        if (options.headers instanceof Headers) {
            options.headers.set('Authorization', 'Bearer ' + session.token);
        } else if (Array.isArray(options.headers)) {
            options.headers.push(['Authorization', 'Bearer ' + session.token]);
        } else {
            options.headers['Authorization'] = 'Bearer ' + session.token;
        }
    }
    return originalFetch(url, options);
};

function getSession() {
    const sessionStr = sessionStorage.getItem('ag_parking_session');
    if (!sessionStr) return null;
    try {
        return JSON.parse(sessionStr);
    } catch (e) {
        return null;
    }
}

function setSession(session) {
    sessionStorage.setItem('ag_parking_session', JSON.stringify(session));
}

function clearSession() {
    sessionStorage.removeItem('ag_parking_session');
}

function checkAuth() {
    const session = getSession();
    const loginOverlay = document.getElementById('login-overlay');
    const appContainer = document.getElementById('app-container');
    
    if (!session) {
        // Not logged in
        if (loginOverlay) loginOverlay.style.display = 'flex';
        if (appContainer) appContainer.style.display = 'none';
        return false;
    } else {
        // Logged in
        if (loginOverlay) loginOverlay.style.display = 'none';
        if (appContainer) appContainer.style.display = 'flex';
        
        // Update user profile widget
        const nameEl = document.getElementById('session-user-name');
        const roleEl = document.getElementById('session-user-role');
        
        if (nameEl) nameEl.textContent = session.name || session.username;
        if (roleEl) {
            roleEl.textContent = session.role === 'Admin' ? 'Administrador' : 'Caixa';
            roleEl.className = `user-role-badge role-${session.role.toLowerCase()}`;
        }
        
        // Apply UI privilege locks based on roles
        applyPrivilegeLocks(session.role);
        return true;
    }
}

function applyPrivilegeLocks(role) {
    const isAdmin = role === 'Admin';
    
    // 1. Pricing (Tariffs) View: Disable inputs and hide save buttons for Cashier
    const tariffSection = document.getElementById('view-tariffs-section');
    if (tariffSection) {
        const tariffInputs = tariffSection.querySelectorAll('.input-tariff');
        const tariffButtons = tariffSection.querySelectorAll('.tariff-card .btn-primary');
        
        tariffInputs.forEach(input => {
            input.disabled = !isAdmin;
        });
        tariffButtons.forEach(btn => {
            btn.style.display = isAdmin ? 'flex' : 'none';
        });
    }
    
    // 2. Monthly Subscribers View: Hide create form card completely for Cashier
    const monthlySection = document.getElementById('view-monthly-section');
    if (monthlySection) {
        const formCard = monthlySection.querySelector('.gate-form-card');
        if (formCard) {
            formCard.style.display = isAdmin ? 'block' : 'none';
        }
    }

    // 3. User Management View: Hide the users sidebar item for Cashier
    const navItemUsers = document.getElementById('nav-item-users');
    if (navItemUsers) {
        navItemUsers.style.display = isAdmin ? 'block' : 'none';
    }

    // 4. Capacity Config View: Hide the capacity sidebar item for Cashier
    const navItemCapacity = document.getElementById('nav-item-capacity');
    if (navItemCapacity) {
        navItemCapacity.style.display = isAdmin ? 'block' : 'none';
    }

    // 5. Printing Config View: Hide the printing sidebar item for Cashier
    const navItemPrinting = document.getElementById('nav-item-printing');
    if (navItemPrinting) {
        navItemPrinting.style.display = isAdmin ? 'block' : 'none';
    }
}

async function getSha256(str) {
    if (window.crypto && crypto.subtle) {
        try {
            const utf8 = new TextEncoder().encode(str);
            const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (e) {
            console.warn(e);
        }
    }
    // Fallback overrides for defaults, and basic hash for other strings
    if (str === 'admin') return '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918';
    if (str === 'caixa') return 'e3d7b71d78b2fcdf81575b07832bd28ac63949df11aa6f55dbba726333b77780';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return 'fallback_' + Math.abs(hash).toString(16);
}

async function handleLoginSubmit(event) {
    event.preventDefault();
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const btnSubmit = document.getElementById('btn-login-submit');
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    
    if (!username || !password) {
        showToast("Por favor, preencha o usuário e senha.", "error");
        return;
    }
    
    btnSubmit.disabled = true;
    btnSubmit.textContent = "Autenticando...";
    
    if (isOfflineMode) {
        // SIMULATED LOGIN
        setTimeout(async () => {
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Entrar no Sistema";
            
            const simUsers = JSON.parse(localStorage.getItem('ag_sim_users')) || [
                { id: 1, name: "Administrador Geral", username: "admin", role: "Admin", passwordHash: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918" },
                { id: 2, name: "Operador de Caixa", username: "caixa", role: "Cashier", passwordHash: "e3d7b71d78b2fcdf81575b07832bd28ac63949df11aa6f55dbba726333b77780" }
            ];
            
            const inputHash = await getSha256(password);
            const user = simUsers.find(u => u.username.toLowerCase() === username.toLowerCase() && u.passwordHash === inputHash);
            
            if (user) {
                const session = {
                    token: "simulated_token_" + Math.random().toString(36).substring(2),
                    username: user.username,
                    name: user.name,
                    role: user.role
                };
                
                setSession(session);
                showToast(`Bem-vindo, ${user.name}! (Modo Simulação)`, "success");
                
                usernameInput.value = '';
                passwordInput.value = '';
                
                checkAuth();
                renderActiveView();
            } else {
                showToast("Usuário ou senha incorretos (Simulação).", "error");
            }
        }, 800);
    } else {
        // API SERVER LOGIN
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Entrar no Sistema";
            
            if (response.ok) {
                const result = await response.json();
                setSession(result);
                showToast(`Bem-vindo, ${result.name}!`, "success");
                
                usernameInput.value = '';
                passwordInput.value = '';
                
                checkAuth();
                renderActiveView();
            } else {
                // Safely read response message to avoid SyntaxError (e.g. on 404 HTML)
                let errorMsg = "Usuário ou senha incorretos.";
                try {
                    const contentType = response.headers.get("content-type");
                    if (contentType && contentType.includes("application/json")) {
                        const result = await response.json();
                        errorMsg = result.message || errorMsg;
                    } else if (response.status === 404) {
                        // Old backend detected. Fall back to local contingency login.
                        console.warn("Backend retornado 404 para login. Ativando login local.");
                        showToast("Servidor antigo. Ativando login local de contingência...", "warning");
                        
                        const simUsers = JSON.parse(localStorage.getItem('ag_sim_users')) || [
                            { id: 1, name: "Administrador Geral", username: "admin", role: "Admin", passwordHash: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918" },
                            { id: 2, name: "Operador de Caixa", username: "caixa", role: "Cashier", passwordHash: "e3d7b71d78b2fcdf81575b07832bd28ac63949df11aa6f55dbba726333b77780" }
                        ];
                        const inputHash = await getSha256(password);
                        const user = simUsers.find(u => u.username.toLowerCase() === username.toLowerCase() && u.passwordHash === inputHash);
                        
                        if (user) {
                            const session = {
                                token: "simulated_token_" + Math.random().toString(36).substring(2),
                                username: user.username,
                                name: user.name,
                                role: user.role
                            };
                            
                            setSession(session);
                            showToast(`Bem-vindo, ${user.name}! (Contingência)`, "success");
                            
                            usernameInput.value = '';
                            passwordInput.value = '';
                            
                            checkAuth();
                            renderActiveView();
                            return;
                        } else {
                            showToast("Usuário ou senha incorretos.", "error");
                            return;
                        }
                    } else {
                        const txt = await response.text();
                        if (txt && txt.length < 150) {
                            errorMsg = txt;
                        }
                    }
                } catch (e) {
                    console.warn("Falha ao analisar resposta de erro do servidor", e);
                }
                
                showToast(errorMsg, "error");
            }
        } catch (error) {
            console.error("Erro ao autenticar", error);
            showToast("Erro ao autenticar. Tentando login local...", "warning");
            
            // Network fallback to local simulated accounts
            const simUsers = JSON.parse(localStorage.getItem('ag_sim_users')) || [
                { id: 1, name: "Administrador Geral", username: "admin", role: "Admin", passwordHash: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918" },
                { id: 2, name: "Operador de Caixa", username: "caixa", role: "Cashier", passwordHash: "e3d7b71d78b2fcdf81575b07832bd28ac63949df11aa6f55dbba726333b77780" }
            ];
            const inputHash = await getSha256(password);
            const user = simUsers.find(u => u.username.toLowerCase() === username.toLowerCase() && u.passwordHash === inputHash);
            
            if (user) {
                const session = {
                    token: "simulated_token_" + Math.random().toString(36).substring(2),
                    username: user.username,
                    name: user.name,
                    role: user.role
                };
                
                setSession(session);
                showToast(`Bem-vindo, ${user.name}! (Contingência)`, "success");
                
                usernameInput.value = '';
                passwordInput.value = '';
                
                checkAuth();
                renderActiveView();
            } else {
                showToast("Erro ao conectar ao servidor de autenticação.", "error");
                btnSubmit.disabled = false;
                btnSubmit.textContent = "Entrar no Sistema";
            }
        }
    }
}

function handleLogout() {
    clearSession();
    showToast("Sessão finalizada com sucesso.", "info");
    checkAuth();
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initializePrintingConfig();
    updateSystemClock();
    checkAuth();
    checkConnectionAndLoad();
});

// Update the system clock on header
function updateSystemClock() {
    const clockElement = document.getElementById('clock-display');
    if (clockElement) {
        const now = new Date();
        clockElement.textContent = now.toLocaleTimeString('pt-BR');
    }
}

// -------------------------------------------------------------
// CONNECTION & LOADING LOGIC
// -------------------------------------------------------------
async function checkConnectionAndLoad() {
    try {
        // Attempt a ping test to the API
        const response = await fetch(`${API_BASE_URL}/api/spaces/stats`);
        if (response.ok) {
            isOfflineMode = false;
            updateConnectionStatus(true);
            await loadDataFromServer();
        } else {
            throw new Error("Server returned error status");
        }
    } catch (error) {
        console.warn("API Backend offline. Executando em modo de simulação Client-Side.");
        isOfflineMode = true;
        updateConnectionStatus(false);
        initializeSimulatedData();
        loadSimulatedData();
    }
    
    // Initial Render
    renderActiveView();
}

function updateConnectionStatus(isConnected) {
    const indicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    
    if (isConnected) {
        indicator.className = 'indicator';
        statusText.textContent = 'Servidor .NET Conectado';
        showToast("Conectado ao servidor de banco de dados!", "info");
    } else {
        indicator.className = 'indicator simulated';
        statusText.textContent = 'Modo Simulação (Offline)';
        showToast("Servidor local offline. Ativando simulação local inteligente.", "info");
    }
}

// -------------------------------------------------------------
// DATA LOADING (SERVER VS SIMULATION)
// -------------------------------------------------------------
async function loadDataFromServer() {
    try {
        const session = getSession();
        const isAdmin = session && session.role === 'Admin';
        
        const fetches = [
            fetch(`${API_BASE_URL}/api/spaces`),
            fetch(`${API_BASE_URL}/api/tariffs`),
            fetch(`${API_BASE_URL}/api/tickets`),
            fetch(`${API_BASE_URL}/api/monthlysubscribers`)
        ];
        
        if (isAdmin) {
            fetches.push(fetch(`${API_BASE_URL}/api/users`));
        }
        
        const results = await Promise.all(fetches);
        
        parkingSpaces = await results[0].json();
        tariffs = await results[1].json();
        tickets = await results[2].json();
        monthlySubscribers = await results[3].json();
        
        if (isAdmin && results[4]) {
            systemUsers = await results[4].json();
        }
    } catch (err) {
        console.error("Falha ao recuperar dados do servidor.", err);
        showToast("Erro ao carregar dados do servidor .NET.", "error");
    }
}

// -------------------------------------------------------------
// SYSTEM SIMULATOR LOGIC (LOCALSTORAGE FALLBACK)
// -------------------------------------------------------------
function initializeSimulatedData() {
    // Check if simulation exists in localStorage
    if (!localStorage.getItem('ag_sim_spaces')) {
        // Seed default spaces
        const spaces = [];
        let idCounter = 1;
        // 10 Cars
        for (let i = 1; i <= 10; i++) {
            spaces.push({ id: idCounter++, code: `A-${String(i).padStart(2, '0')}`, allowedType: 'Car', isOccupied: false, occupiedByPlate: null });
        }
        // 10 Motorcycles
        for (let i = 1; i <= 10; i++) {
            spaces.push({ id: idCounter++, code: `B-${String(i).padStart(2, '0')}`, allowedType: 'Motorcycle', isOccupied: false, occupiedByPlate: null });
        }
        // 5 Trucks
        for (let i = 1; i <= 5; i++) {
            spaces.push({ id: idCounter++, code: `C-${String(i).padStart(2, '0')}`, allowedType: 'Truck', isOccupied: false, occupiedByPlate: null });
        }
        localStorage.setItem('ag_sim_spaces', JSON.stringify(spaces));
    }

    if (!localStorage.getItem('ag_sim_tariffs')) {
        const defaultTariffs = [
            { id: 1, vehicleType: 'Car', firstHourRate: 10.00, additionalHourRate: 5.00, toleranceMinutes: 15, dailyMaxRate: 60.00 },
            { id: 2, vehicleType: 'Motorcycle', firstHourRate: 5.00, additionalHourRate: 2.50, toleranceMinutes: 15, dailyMaxRate: 30.00 },
            { id: 3, vehicleType: 'Truck', firstHourRate: 20.00, additionalHourRate: 10.00, toleranceMinutes: 15, dailyMaxRate: 120.00 }
        ];
        localStorage.setItem('ag_sim_tariffs', JSON.stringify(defaultTariffs));
    }

    if (!localStorage.getItem('ag_sim_monthly')) {
        const defaultSubs = [
            {
                id: 1,
                name: "João Silva",
                cpf: "123.456.789-00",
                plate: "MEN-1010",
                vehicleType: "Car",
                brand: "Chevrolet",
                model: "Onix",
                color: "Preto",
                monthlyFee: 150.00,
                startDate: "2026-05-01",
                endDate: "2026-07-01",
                isActive: true
            },
            {
                id: 2,
                name: "Maria Oliveira",
                cpf: "987.654.321-11",
                plate: "MEN-2020",
                vehicleType: "Motorcycle",
                brand: "Honda",
                model: "CB 500",
                color: "Azul",
                monthlyFee: 80.00,
                startDate: "2026-05-01",
                endDate: "2026-07-01",
                isActive: true
            }
        ];
        localStorage.setItem('ag_sim_monthly', JSON.stringify(defaultSubs));
    }

    if (!localStorage.getItem('ag_sim_tickets')) {
        // Seed some history tickets
        const now = new Date();
        
        // 1 active ticket for immediate checkout test
        const activeTktTime = new Date(now.getTime() - 2.5 * 60 * 60 * 1000); // 2h 30m ago
        const histTickets = [
            {
                id: 1,
                ticketNumber: 'TKT-202605201015-182',
                plate: 'ABC-1234',
                vehicleType: 'Car',
                parkingSpaceId: 1,
                entryTime: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString(),
                exitTime: new Date(now.getTime() - 3.5 * 60 * 60 * 1000).toISOString(),
                isPaid: true,
                amountPaid: 15.00,
                paymentTime: new Date(now.getTime() - 3.5 * 60 * 60 * 1000).toISOString(),
                paymentMethod: 'Cartão',
                isMonthly: false,
                brand: "Fiat",
                model: "Uno",
                color: "Branco"
            },
            {
                id: 2,
                ticketNumber: 'TKT-202605201130-942',
                plate: 'XYZ-9876',
                vehicleType: 'Motorcycle',
                parkingSpaceId: 11,
                entryTime: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
                exitTime: new Date(now.getTime() - 3.8 * 60 * 60 * 1000).toISOString(),
                isPaid: true,
                amountPaid: 0.00, // Tolerance free exit
                paymentTime: new Date(now.getTime() - 3.8 * 60 * 60 * 1000).toISOString(),
                paymentMethod: 'Dinheiro',
                isMonthly: false,
                brand: "Yamaha",
                model: "Factor",
                color: "Vermelha"
            },
            {
                id: 3,
                ticketNumber: 'TKT-202605210100-345',
                plate: 'BRA2E26',
                vehicleType: 'Car',
                parkingSpaceId: 2,
                entryTime: activeTktTime.toISOString(),
                exitTime: null,
                isPaid: false,
                amountPaid: 0.00,
                paymentTime: null,
                paymentMethod: null,
                isMonthly: false,
                brand: "Volkswagen",
                model: "Gol",
                color: "Cinza"
            }
        ];
        
        localStorage.setItem('ag_sim_tickets', JSON.stringify(histTickets));
        
        // Mark space 2 occupied by BRA2E26 in simulation
        const spaces = JSON.parse(localStorage.getItem('ag_sim_spaces'));
        const targetSpace = spaces.find(s => s.id === 2);
        if (targetSpace) {
            targetSpace.isOccupied = true;
            targetSpace.occupiedByPlate = 'BRA2E26';
            localStorage.setItem('ag_sim_spaces', JSON.stringify(spaces));
        }
    }

    if (!localStorage.getItem('ag_sim_users')) {
        const defaultUsers = [
            { id: 1, name: "Administrador Geral", username: "admin", role: "Admin", passwordHash: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918" },
            { id: 2, name: "Operador de Caixa", username: "caixa", role: "Cashier", passwordHash: "e3d7b71d78b2fcdf81575b07832bd28ac63949df11aa6f55dbba726333b77780" }
        ];
        localStorage.setItem('ag_sim_users', JSON.stringify(defaultUsers));
    }
}

function loadSimulatedData() {
    parkingSpaces = JSON.parse(localStorage.getItem('ag_sim_spaces'));
    tariffs = JSON.parse(localStorage.getItem('ag_sim_tariffs'));
    tickets = JSON.parse(localStorage.getItem('ag_sim_tickets'));
    monthlySubscribers = JSON.parse(localStorage.getItem('ag_sim_monthly')) || [];
    systemUsers = JSON.parse(localStorage.getItem('ag_sim_users')) || [];
}

function saveSimulatedData() {
    localStorage.setItem('ag_sim_spaces', JSON.stringify(parkingSpaces));
    localStorage.setItem('ag_sim_tariffs', JSON.stringify(tariffs));
    localStorage.setItem('ag_sim_tickets', JSON.stringify(tickets));
    localStorage.setItem('ag_sim_monthly', JSON.stringify(monthlySubscribers));
    localStorage.setItem('ag_sim_users', JSON.stringify(systemUsers));
}

// -------------------------------------------------------------
// NAVIGATION VIEW SWITCHING
// -------------------------------------------------------------
function switchView(viewName) {
    activeView = viewName;
    
    // Update Navbar active states
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    const targetLink = document.getElementById(`nav-${viewName}`);
    if (targetLink) targetLink.classList.add('active');
    
    // Toggle View CSS display classes
    document.querySelectorAll('.app-view').forEach(view => {
        view.classList.remove('active-view');
    });
    const targetView = document.getElementById(`view-${viewName}-section`);
    if (targetView) targetView.classList.add('active-view');
    
    // Set Header titles
    updateHeaderTitles(viewName);
    
    // Reload and redraw
    renderActiveView();
}

function updateHeaderTitles(viewName) {
    const title = document.getElementById('view-title');
    const subtitle = document.getElementById('view-subtitle');
    
    switch (viewName) {
        case 'dashboard':
            title.textContent = 'Dashboard Operacional';
            subtitle.textContent = 'Resumo estatístico das operações e ocupação atual.';
            break;
        case 'gate':
            title.textContent = 'Controle de Portaria';
            subtitle.textContent = 'Emissão de tickets de entrada e processamento de saídas e cobrança.';
            break;
        case 'map':
            title.textContent = 'Mapa Físico de Ocupação';
            subtitle.textContent = 'Visualização interativa das vagas e setores em tempo real.';
            break;
        case 'tariffs':
            title.textContent = 'Configurações de Preços';
            subtitle.textContent = 'Configure as regras de tolerância, primeira hora e horas adicionais por tipo de veículo.';
            break;
        case 'monthly':
            title.textContent = 'Gestão de Mensalistas';
            subtitle.textContent = 'Cadastro, CPF, veículos e datas de vigência dos planos.';
            break;
        case 'history':
            title.textContent = 'Histórico Financeiro & Movimentação';
            subtitle.textContent = 'Relatório completo de estadias finalizadas, ativas e receitas fiscais.';
            break;
        case 'users':
            title.textContent = 'Configurações de Usuários';
            subtitle.textContent = 'Gerenciamento de credenciais e permissões dos operadores.';
            break;
        case 'logs':
            title.textContent = 'Logs e Notificações';
            subtitle.textContent = 'Histórico detalhado de logs e mensagens do sistema.';
            break;
        case 'capacity':
            title.textContent = 'Configurar Capacidade de Vagas';
            subtitle.textContent = 'Gerencie o limite máximo de vagas do complexo por categoria de veículo.';
            break;
        case 'printing':
            title.textContent = 'Configurações de Impressão';
            subtitle.textContent = 'Configure as opções de impressoras, textos dos cupons e impressão automática.';
            break;
    }
}

async function renderActiveView() {
    // Ensure data is fresh
    if (!isOfflineMode) {
        await loadDataFromServer();
    } else {
        loadSimulatedData();
    }
    
    switch (activeView) {
        case 'dashboard':
            renderDashboard();
            break;
        case 'gate':
            // Simply refresh lists or calculations if active
            if (currentSelectedTicketForExit) {
                // recalculate live duration
                refreshExitTicketCalculation();
            }
            break;
        case 'map':
            renderMap();
            break;
        case 'tariffs':
            renderTariffs();
            break;
        case 'monthly':
            renderMonthlySubscribers();
            break;
        case 'history':
            renderHistory();
            break;
        case 'users':
            renderUsers();
            break;
        case 'logs':
            renderLogs();
            break;
        case 'capacity':
            renderCapacity();
            break;
        case 'printing':
            renderPrinting();
            break;
    }

    // Apply UI privilege locks after rendering any view
    const session = getSession();
    if (session) {
        applyPrivilegeLocks(session.role);
    }
}

// -------------------------------------------------------------
// VIEW RENDERERS
// -------------------------------------------------------------

// 1. Dashboard View
function renderDashboard() {
    const total = parkingSpaces.length;
    const occupied = parkingSpaces.filter(s => s.isOccupied).length;
    const free = total - occupied;
    
    // Calculate today's revenue (completed tickets paid today)
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const revenue = tickets
        .filter(t => t.isPaid && new Date(t.paymentTime) >= today)
        .reduce((sum, t) => sum + t.amountPaid, 0);

    // Apply values to Cards
    document.getElementById('stats-total-spaces').textContent = total;
    document.getElementById('stats-occupied-spaces').textContent = occupied;
    document.getElementById('stats-free-spaces').textContent = free;
    document.getElementById('stats-revenue').textContent = formatCurrency(revenue);
    
    // Subtitle dynamic text
    document.getElementById('stats-free-desc').textContent = `${free} vagas vagas imediatamente`;
    
    // Progress Donut
    const percentage = total > 0 ? Math.round((occupied / total) * 100) : 0;
    document.getElementById('occupancy-percentage').textContent = `${percentage}%`;
    
    // SVG Donut animation
    const progressCircle = document.getElementById('occupancy-donut-progress');
    const radius = progressCircle.r.baseVal.value;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;
    progressCircle.style.strokeDashoffset = offset;

    // Vehicle Category Specific ratios
    const carSpaces = parkingSpaces.filter(s => s.allowedType === 'Car');
    const carOccupied = carSpaces.filter(s => s.isOccupied).length;
    const carTotal = carSpaces.length;
    document.getElementById('stats-car-ratio').textContent = `${carOccupied} / ${carTotal}`;
    const carPct = carTotal > 0 ? (carOccupied / carTotal) * 100 : 0;
    document.getElementById('stats-car-bar').style.width = `${carPct}%`;

    const motoSpaces = parkingSpaces.filter(s => s.allowedType === 'Motorcycle');
    const motoOccupied = motoSpaces.filter(s => s.isOccupied).length;
    const motoTotal = motoSpaces.length;
    document.getElementById('stats-moto-ratio').textContent = `${motoOccupied} / ${motoTotal}`;
    const motoPct = motoTotal > 0 ? (motoOccupied / motoTotal) * 100 : 0;
    document.getElementById('stats-moto-bar').style.width = `${motoPct}%`;

    const truckSpaces = parkingSpaces.filter(s => s.allowedType === 'Truck');
    const truckOccupied = truckSpaces.filter(s => s.isOccupied).length;
    const truckTotal = truckSpaces.length;
    document.getElementById('stats-truck-ratio').textContent = `${truckOccupied} / ${truckTotal}`;
    const truckPct = truckTotal > 0 ? (truckOccupied / truckTotal) * 100 : 0;
    document.getElementById('stats-truck-bar').style.width = `${truckPct}%`;
}

// 2. Interactive Parking Grid Map View
let activeMapFilter = 'all';
function filterMapSector(type) {
    activeMapFilter = type;
    document.querySelectorAll('.sector-btn').forEach(btn => btn.classList.remove('active'));
    
    const filterIds = { 'all': 'all', 'Car': 'car', 'Motorcycle': 'moto', 'Truck': 'truck' };
    const btn = document.getElementById(`sector-btn-${filterIds[type]}`);
    if (btn) btn.classList.add('active');
    
    renderMap();
}

function renderMap() {
    const container = document.getElementById('parking-map-grid-container');
    container.innerHTML = '';
    
    const filteredSpaces = activeMapFilter === 'all' 
        ? parkingSpaces 
        : parkingSpaces.filter(s => s.allowedType === activeMapFilter);
        
    filteredSpaces.forEach(space => {
        const cell = document.createElement('div');
        cell.className = `space-cell ${space.isOccupied ? 'space-occupied' : 'space-free'}`;
        cell.onclick = () => openSpaceDetailsModal(space);
        
        // Icons inside grid cell
        let typeIcon = '';
        if (space.allowedType === 'Car') {
            typeIcon = `<svg viewBox="0 0 24 24"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3C13 6.9 11.5 6 10 6H4c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h2m10-5c0-1.1-.9-2-2-2s-2 .9-2 2 .9 2 2 2 2-.9 2-2zM6 15c0-1.1-.9-2-2-2s-2 .9-2 2 .9 2 2 2 2-.9 2-2z" stroke="currentColor" stroke-width="2"/></svg>`;
        } else if (space.allowedType === 'Motorcycle') {
            typeIcon = `<svg viewBox="0 0 24 24"><circle cx="5.5" cy="14.5" r="2.5"/><circle cx="18.5" cy="14.5" r="2.5"/><path d="M5.5 12h2.5l2.5-4h4.5l2 4h1.5" stroke="currentColor" stroke-width="2"/></svg>`;
        } else {
            typeIcon = `<svg viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="2"/><circle cx="5" cy="18" r="2"/><circle cx="18" cy="18" r="2" stroke="currentColor" stroke-width="2"/></svg>`;
        }

        // Check if there is an active ticket for this space and if it is monthly
        const ticket = tickets.find(t => !t.isPaid && t.parkingSpaceId === space.id);
        const isMonthlyBadge = ticket && ticket.isMonthly ? `<span class="badge-monthly" style="font-size: 8px; padding: 1px 4px; border-radius: 2px; position: absolute; bottom: 8px; right: 8px;">M</span>` : '';
        
        cell.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
                <span class="space-code">${space.code}</span>
                <span class="space-type-icon">${typeIcon}</span>
            </div>
            ${space.isOccupied 
                ? `<div class="space-plate">${space.occupiedByPlate}</div>${isMonthlyBadge}` 
                : `<div class="space-status-text">LIVRE</div>`
            }
        `;
        
        container.appendChild(cell);
    });
}

// 3. Tariffs View Config
function renderTariffs() {
    const container = document.getElementById('tariff-cards-container');
    container.innerHTML = '';
    
    const translatedNames = { 'Car': 'Carros', 'Motorcycle': 'Motocicletas', 'Truck': 'Utilitários' };
    const tariffIcons = {
        'Car': `<svg viewBox="0 0 24 24"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3C13 6.9 11.5 6 10 6H4c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h2"/></svg>`,
        'Motorcycle': `<svg viewBox="0 0 24 24"><circle cx="5.5" cy="14.5" r="2.5"/><circle cx="18.5" cy="14.5" r="2.5"/><path d="M5.5 12h2.5l2.5-4h4.5l2 4h1.5"/></svg>`,
        'Truck': `<svg viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="2"/><circle cx="5" cy="18" r="2"/></svg>`
    };
    
    tariffs.forEach(tariff => {
        const card = document.createElement('div');
        card.className = 'tariff-card';
        
        card.innerHTML = `
            <div class="tariff-card-header">
                ${tariffIcons[tariff.vehicleType]}
                <h3>Tarifa de ${translatedNames[tariff.vehicleType]}</h3>
            </div>
            <div class="tariff-inputs">
                <div class="form-group">
                    <label>Preço Primeira Hora</label>
                    <div class="currency-input-wrapper">
                        <span class="currency-input-prefix">R$</span>
                        <input type="number" step="0.50" min="0" class="input-tariff" id="tariff-first-${tariff.id}" value="${tariff.firstHourRate.toFixed(2)}">
                    </div>
                </div>
                <div class="form-group">
                    <label>Hora Adicional (ou fração)</label>
                    <div class="currency-input-wrapper">
                        <span class="currency-input-prefix">R$</span>
                        <input type="number" step="0.50" min="0" class="input-tariff" id="tariff-add-${tariff.id}" value="${tariff.additionalHourRate.toFixed(2)}">
                    </div>
                </div>
                <div class="form-group">
                    <label>Tempo de Tolerância (minutos)</label>
                    <input type="number" min="0" max="60" class="input-tariff input-duration" id="tariff-tol-${tariff.id}" value="${tariff.toleranceMinutes}">
                </div>
                <div class="form-group">
                    <label>Limite Diário Máximo (Teto)</label>
                    <div class="currency-input-wrapper">
                        <span class="currency-input-prefix">R$</span>
                        <input type="number" step="1.00" min="0" class="input-tariff" id="tariff-max-${tariff.id}" value="${tariff.dailyMaxRate.toFixed(2)}">
                    </div>
                </div>
            </div>
            <button class="btn-primary" onclick="updateTariffRates(${tariff.id}, '${tariff.vehicleType}')">
                Salvar Configurações
            </button>
        `;
        container.appendChild(card);
    });
}

// 4. History View Tables
function renderHistory() {
    const tableBody = document.getElementById('history-table-body');
    const emptyMsg = document.getElementById('history-empty-message');
    tableBody.innerHTML = '';
    
    const searchVal = document.getElementById('history-search').value.toUpperCase().trim();
    const filterStatus = document.getElementById('history-filter-status').value;
    const filterModality = document.getElementById('history-filter-modality').value;
    const filterType = document.getElementById('history-filter-type').value;
    
    // Sort tickets descending by entryTime
    const sortedTickets = [...tickets].sort((a,b) => new Date(b.entryTime) - new Date(a.entryTime));
    
    let displayedCount = 0;
    
    const typeTranslations = { 'Car': 'Carro', 'Motorcycle': 'Moto', 'Truck': 'Utilitário' };
    
    sortedTickets.forEach(ticket => {
        // Apply search query filters
        if (searchVal && !ticket.plate.includes(searchVal) && !ticket.ticketNumber.includes(searchVal)) {
            return;
        }
        
        // Apply status filter
        if (filterStatus === 'active' && ticket.isPaid) return;
        if (filterStatus === 'paid' && !ticket.isPaid) return;
        
        // Apply modality filter
        if (filterModality === 'casual' && ticket.isMonthly) return;
        if (filterModality === 'monthly' && !ticket.isMonthly) return;
        
        // Apply type filter
        if (filterType !== 'all' && ticket.vehicleType !== filterType) return;
        
        displayedCount++;
        
        // Resolve parking space code
        const space = parkingSpaces.find(s => s.id === ticket.parkingSpaceId);
        const spaceCode = space ? space.code : `ID:${ticket.parkingSpaceId}`;
        
        const modalityBadge = ticket.isMonthly 
            ? '<span class="badge-monthly">Mensalista</span>' 
            : '<span class="badge-casual">Avulso</span>';
            
        const vehDetails = `${ticket.brand || ''} ${ticket.model || ''} ${ticket.color ? `(${ticket.color})` : ''}`.trim() || '--';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="font-weight: 600; font-family: monospace;">${ticket.ticketNumber}</td>
            <td style="font-weight: 700; letter-spacing: 0.5px;">${ticket.plate}</td>
            <td>${modalityBadge}</td>
            <td>${typeTranslations[ticket.vehicleType] || ticket.vehicleType}</td>
            <td>${vehDetails}</td>
            <td><span style="font-weight: bold; color: var(--color-primary);">${spaceCode}</span></td>
            <td>${formatDate(ticket.entryTime)}</td>
            <td>${ticket.exitTime ? formatDate(ticket.exitTime) : '--:--'}</td>
            <td style="font-weight: bold; color: ${ticket.amountPaid > 0 ? 'var(--color-success)' : 'inherit'}">
                ${ticket.isPaid ? formatCurrency(ticket.amountPaid) : '--'}
            </td>
            <td>
                <span class="table-status ${ticket.isPaid ? 'status-paid' : 'status-active'}">
                    ${ticket.isPaid ? 'Pago' : 'No Estacionamento'}
                </span>
            </td>
            <td style="text-align: center;">
                <div style="display: inline-flex; gap: 8px; justify-content: center; align-items: center;">
                    <button class="btn-search" style="padding: 6px 10px; height: auto; width: auto; font-size: 11px; background: rgba(59, 130, 246, 0.1); border-color: rgba(59, 130, 246, 0.2); color: var(--color-primary);" onclick="viewTicketReceiptFromHistory('${ticket.ticketNumber}')" title="Visualizar Cupom">
                        👁️
                    </button>
                    <button class="btn-search" style="padding: 6px 10px; height: auto; width: auto; font-size: 11px; background: rgba(245, 158, 11, 0.1); border-color: rgba(245, 158, 11, 0.2); color: var(--color-warning);" onclick="reprintTicketFromHistory('${ticket.ticketNumber}')" title="Reimprimir Cupom">
                        🖨️
                    </button>
                    <button class="btn-success" style="padding: 6px 10px; height: auto; width: auto; font-size: 11px; background: rgba(37, 211, 102, 0.1); border-color: rgba(37, 211, 102, 0.2); color: #25d366;" onclick="openWhatsAppChatbot('${ticket.ticketNumber}')" title="Enviar WhatsApp">
                        💬
                    </button>
                </div>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    if (displayedCount === 0) {
        emptyMsg.style.display = 'block';
    } else {
        emptyMsg.style.display = 'none';
    }
}

function applyHistoryFilters() {
    renderHistory();
}

// -------------------------------------------------------------
// CORE BUSINESS OPERATIONS
// -------------------------------------------------------------

// Vehicle Entry selection
function selectEntryVehicleType(type) {
    currentEntryVehicleType = type;
    document.querySelectorAll('#view-gate-section .type-option').forEach(opt => opt.classList.remove('selected'));
    
    const optMap = { 'Car': 'car', 'Motorcycle': 'motorcycle', 'Truck': 'truck' };
    const selectedOpt = document.getElementById(`type-opt-${optMap[type]}`);
    if (selectedOpt) selectedOpt.classList.add('selected');
}

// Auto detection of monthly subscriber in Gate
function handleEntryPlateInput() {
    const plateInput = document.getElementById('entry-plate');
    const badge = document.getElementById('entry-subscriber-badge');
    const plate = plateInput.value.toUpperCase().trim();
    
    const brandInput = document.getElementById('entry-brand');
    const modelInput = document.getElementById('entry-model');
    const colorInput = document.getElementById('entry-color');
    
    if (!plate) {
        badge.style.display = 'none';
        resetLockedTypeOptions();
        return;
    }
    
    // Find active subscriber with matching plate
    const sub = monthlySubscribers.find(s => s.plate === plate && s.isActive && new Date(s.endDate) >= new Date());
    
    if (sub) {
        badge.innerHTML = `<span class="badge-monthly" style="display: block; width: 100%; text-align: center; padding: 10px; border-radius: 6px; font-weight: bold;">MENSALISTA DETECTADO: ${sub.name} (CPF: ${sub.cpf})</span>`;
        badge.style.display = 'block';
        
        // Lock to subscriber's vehicle type
        selectEntryVehicleType(sub.vehicleType);
        document.querySelectorAll('#view-gate-section .type-option').forEach(opt => {
            if (!opt.classList.contains('selected')) {
                opt.style.opacity = '0.35';
                opt.style.pointerEvents = 'none';
            }
        });
        
        // Prefill vehicle details and lock
        brandInput.value = sub.brand || '';
        modelInput.value = sub.model || '';
        colorInput.value = sub.color || '';
        brandInput.disabled = true;
        modelInput.disabled = true;
        colorInput.disabled = true;
    } else {
        badge.style.display = 'none';
        resetLockedTypeOptions();
        
        // Unlock details if they were locked
        if (brandInput.disabled) {
            brandInput.value = '';
            modelInput.value = '';
            colorInput.value = '';
        }
        brandInput.disabled = false;
        modelInput.disabled = false;
        colorInput.disabled = false;
    }
}

function resetLockedTypeOptions() {
    document.querySelectorAll('#view-gate-section .type-option').forEach(opt => {
        opt.style.opacity = '1';
        opt.style.pointerEvents = 'all';
    });
}

// Register entry vehicle
async function handleVehicleEntry(event) {
    event.preventDefault();
    const plateInput = document.getElementById('entry-plate');
    const plate = plateInput.value.toUpperCase().trim();
    const brand = document.getElementById('entry-brand').value.trim();
    const model = document.getElementById('entry-model').value.trim();
    const color = document.getElementById('entry-color').value.trim();
    
    if (!plate) {
        showToast("Por favor, preencha a placa do veículo.", "error");
        return;
    }
    
    if (isOfflineMode) {
        // SIMULATED REGISTRATION
        // Check if vehicle is already parked
        if (tickets.some(t => !t.isPaid && t.plate === plate)) {
            showToast(`O veículo com placa ${plate} já está no estacionamento!`, "error");
            return;
        }
        
        // Check active monthly subscriber
        const sub = monthlySubscribers.find(s => s.plate === plate && s.isActive && new Date(s.endDate) >= new Date());
        const isMonthly = sub != null;
        
        const resolvedType = isMonthly ? sub.vehicleType : currentEntryVehicleType;
        const resolvedBrand = brand || (isMonthly ? sub.brand : null);
        const resolvedModel = model || (isMonthly ? sub.model : null);
        const resolvedColor = color || (isMonthly ? sub.color : null);
        
        // Find empty space
        const space = parkingSpaces.find(s => s.allowedType === resolvedType && !s.isOccupied);
        if (!space) {
            showToast(`Desculpe! Estacionamento lotado para a categoria: ${resolvedType}.`, "error");
            return;
        }
        
        // Generate simulated ticket
        const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
        const rand = Math.floor(100 + Math.random() * 900);
        const ticketNumber = `TKT-${timestamp}-${rand}`;
        
        const newTicket = {
            id: tickets.length + 1,
            ticketNumber: ticketNumber,
            plate: plate,
            vehicleType: resolvedType,
            parkingSpaceId: space.id,
            entryTime: new Date().toISOString(),
            exitTime: null,
            isPaid: false,
            amountPaid: 0.00,
            paymentTime: null,
            paymentMethod: null,
            isMonthly: isMonthly,
            brand: resolvedBrand,
            model: resolvedModel,
            color: resolvedColor
        };
        
        // Update local arrays
        space.isOccupied = true;
        space.occupiedByPlate = plate;
        tickets.push(newTicket);
        
        saveSimulatedData();
        showToast(`Entrada registrada! Vaga ${space.code} reservada para ${plate}.`, "success");
        
        // Clean fields
        plateInput.value = '';
        document.getElementById('entry-brand').value = '';
        document.getElementById('entry-model').value = '';
        document.getElementById('entry-color').value = '';
        handleEntryPlateInput();
        
        renderTicketReceipt(newTicket, space);
        
    } else {
        // API SERVER REGISTRATION
        try {
            const response = await fetch(`${API_BASE_URL}/api/tickets/entry`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    plate: plate, 
                    vehicleType: currentEntryVehicleType,
                    brand: brand,
                    model: model,
                    color: color
                })
            });
            
            const result = await response.json();
            if (response.ok) {
                showToast(`Entrada efetuada! Vaga ${result.parkingSpace.code} atribuída a ${result.plate}.`, "success");
                plateInput.value = '';
                document.getElementById('entry-brand').value = '';
                document.getElementById('entry-model').value = '';
                document.getElementById('entry-color').value = '';
                handleEntryPlateInput();
                
                // Redraw states and display ticket receipt
                renderTicketReceipt(result, result.parkingSpace);
            } else {
                showToast(result.message || "Erro ao registrar entrada.", "error");
            }
        } catch (error) {
            console.error(error);
            showToast("Erro de rede ao conectar à API.", "error");
        }
    }
    
    // Refresh dashboard / grid if they are shown
    renderActiveView();
}

// Payment method selection
function selectPaymentMethod(method) {
    currentPaymentMethod = method;
    document.querySelectorAll('.method-option').forEach(opt => opt.classList.remove('selected'));
    
    const optIds = { 'Dinheiro': 'money', 'Cartão': 'card', 'PIX': 'pix', 'Mensalista': 'monthly' };
    const selectedOpt = document.getElementById(`method-opt-${optIds[method] || 'money'}`);
    if (selectedOpt) selectedOpt.classList.add('selected');
}

// Search plate or ticket for exit payment calculation
async function searchTicketForExit() {
    const searchVal = document.getElementById('exit-search-input').value.toUpperCase().trim();
    if (!searchVal) {
        showToast("Digite o número do ticket ou a placa do veículo.", "error");
        return;
    }
    
    if (isOfflineMode) {
        // SIMULATED CALCULATION
        const ticket = tickets.find(t => !t.isPaid && (t.plate === searchVal || t.ticketNumber === searchVal));
        if (!ticket) {
            showToast("Nenhum veículo ativo localizado com essa placa/ticket.", "error");
            hideCheckoutPanel();
            return;
        }
        
        currentSelectedTicketForExit = ticket;
        displayCheckoutCalculation(ticket, new Date());
        
    } else {
        // API CALCULATION
        try {
            // First locate the active ticket
            const ticketsResponse = await fetch(`${API_BASE_URL}/api/tickets?activeOnly=true&search=${searchVal}`);
            const matchingTickets = await ticketsResponse.json();
            
            if (matchingTickets.length === 0) {
                showToast("Veículo não encontrado ou já finalizado no sistema.", "error");
                hideCheckoutPanel();
                return;
            }
            
            const ticket = matchingTickets[0];
            
            // Calculate fee using core endpoint
            const calcResponse = await fetch(`${API_BASE_URL}/api/tickets/calculate/${ticket.id}`);
            const result = await calcResponse.json();
            
            if (calcResponse.ok) {
                currentSelectedTicketForExit = ticket;
                displayCheckoutDetailsFromServer(result);
            } else {
                showToast("Erro ao computar o valor de cobrança.", "error");
            }
            
        } catch (error) {
            console.error(error);
            showToast("Falha de comunicação ao buscar ticket.", "error");
        }
    }
}

function hideCheckoutPanel() {
    document.getElementById('checkout-calculation-panel').style.display = 'none';
    document.getElementById('checkout-empty-message').style.display = 'block';
    currentSelectedTicketForExit = null;
}

// Refresh live countdown pricing
function refreshExitTicketCalculation() {
    if (!currentSelectedTicketForExit) return;
    
    if (isOfflineMode) {
        displayCheckoutCalculation(currentSelectedTicketForExit, new Date());
    } else {
        // Silent API refresh
        fetch(`${API_BASE_URL}/api/tickets/calculate/${currentSelectedTicketForExit.id}`)
            .then(res => res.json())
            .then(result => {
                displayCheckoutDetailsFormatted(result);
            }).catch(e => console.warn(e));
    }
}

// Client Side Calculation algorithm (Mirroring backend C# code)
function displayCheckoutCalculation(ticket, exitTime) {
    const entryTime = new Date(ticket.entryTime);
    const durationMs = exitTime.getTime() - entryTime.getTime();
    const durationMinutes = Math.max(0, Math.round(durationMs / 60000));
    
    // Find tariff
    const tariff = tariffs.find(t => t.vehicleType === ticket.vehicleType);
    let fee = 0.00;
    
    if (ticket.isMonthly) {
        fee = 0.00;
    } else if (tariff) {
        if (durationMinutes <= tariff.toleranceMinutes) {
            fee = 0.00;
        } else {
            fee += tariff.firstHourRate;
            if (durationMinutes > 60) {
                const extraMin = durationMinutes - 60;
                const extraHours = Math.ceil(extraMin / 60);
                fee += extraHours * tariff.additionalHourRate;
            }
            if (fee > tariff.dailyMaxRate) {
                fee = tariff.dailyMaxRate;
            }
        }
    }
    
    // Display in calculation elements
    document.getElementById('calc-ticket-number').textContent = ticket.ticketNumber;
    document.getElementById('calc-plate').textContent = ticket.plate;
    document.getElementById('calc-entry-time').textContent = formatDate(ticket.entryTime);
    document.getElementById('calc-duration').textContent = formatDurationMinutes(durationMinutes);
    document.getElementById('calc-tariff-rate').textContent = ticket.isMonthly 
        ? 'Mensalista (Isento)' 
        : (tariff ? `R$ ${tariff.firstHourRate.toFixed(2)}/h (Tolerância: ${tariff.toleranceMinutes}min)` : 'R$ 0,00');
        
    document.getElementById('calc-total-amount').textContent = formatCurrency(fee);
    
    const typeBadge = document.getElementById('calc-type-badge');
    typeBadge.innerHTML = ticket.isMonthly ? '<span class="badge-monthly">Mensalista</span>' : '<span class="badge-casual">Avulso</span>';
    
    const vehStr = `${ticket.brand || ''} ${ticket.model || ''} ${ticket.color ? `(${ticket.color})` : ''}`.trim() || '--';
    document.getElementById('calc-vehicle-details').textContent = vehStr;
    
    // Default payment method for monthly is 'Mensalista'
    if (ticket.isMonthly) {
        selectPaymentMethod('Mensalista');
    } else {
        selectPaymentMethod('Dinheiro');
    }
    
    // Open container
    document.getElementById('checkout-empty-message').style.display = 'none';
    document.getElementById('checkout-calculation-panel').style.display = 'block';
    
    // Cache total fee calculated for submission
    currentSelectedTicketForExit.calculatedFee = fee;
}

function displayCheckoutDetailsFromServer(calcDetails) {
    const t = calcDetails.ticket;
    document.getElementById('calc-ticket-number').textContent = t.ticketNumber;
    document.getElementById('calc-plate').textContent = t.plate;
    document.getElementById('calc-entry-time').textContent = formatDate(t.entryTime);
    document.getElementById('calc-duration').textContent = calcDetails.durationFormatted;
    
    const rateText = t.isMonthly 
        ? 'Mensalista (Isento)' 
        : (calcDetails.tariffUsed ? `R$ ${calcDetails.tariffUsed.firstHourRate.toFixed(2)}/h (Tolerância: ${calcDetails.tariffUsed.toleranceMinutes}m)` : 'N/A');
    document.getElementById('calc-tariff-rate').textContent = rateText;
    document.getElementById('calc-total-amount').textContent = formatCurrency(calcDetails.fee);
    
    const typeBadge = document.getElementById('calc-type-badge');
    typeBadge.innerHTML = t.isMonthly ? '<span class="badge-monthly">Mensalista</span>' : '<span class="badge-casual">Avulso</span>';
    
    const vehStr = `${t.brand || ''} ${t.model || ''} ${t.color ? `(${t.color})` : ''}`.trim() || '--';
    document.getElementById('calc-vehicle-details').textContent = vehStr;
    
    if (t.isMonthly) {
        selectPaymentMethod('Mensalista');
    } else {
        selectPaymentMethod('Dinheiro');
    }
    
    document.getElementById('checkout-empty-message').style.display = 'none';
    document.getElementById('checkout-calculation-panel').style.display = 'block';
    
    currentSelectedTicketForExit.calculatedFee = calcDetails.fee;
}

// Format duration from server object
function displayCheckoutDetailsFormatted(details) {
    document.getElementById('calc-duration').textContent = details.durationFormatted;
    document.getElementById('calc-total-amount').textContent = formatCurrency(details.fee);
    currentSelectedTicketForExit.calculatedFee = details.fee;
}

// Finalize ticket checkout
async function confirmPaymentAndExit() {
    if (!currentSelectedTicketForExit) return;
    
    const ticketId = currentSelectedTicketForExit.id;
    
    if (isOfflineMode) {
        // SIMULATED CHECKOUT EXIT
        const ticket = tickets.find(t => t.id === ticketId);
        const space = parkingSpaces.find(s => s.id === ticket.parkingSpaceId);
        
        const exitTime = new Date().toISOString();
        
        ticket.exitTime = exitTime;
        ticket.isPaid = true;
        ticket.amountPaid = currentSelectedTicketForExit.calculatedFee;
        ticket.paymentTime = exitTime;
        ticket.paymentMethod = ticket.isMonthly ? "Mensalista" : currentPaymentMethod;
        
        if (space) {
            space.isOccupied = false;
            space.occupiedByPlate = null;
        }
        
        saveSimulatedData();
        showToast(`Saída processada! Liberação confirmada.`, "success");
        
        // Print checkout tax receipt
        renderPaidReceipt(ticket, space);
        hideCheckoutPanel();
        document.getElementById('exit-search-input').value = '';
        
    } else {
        // SERVER WEB API CHECKOUT
        try {
            const resolvedMethod = currentSelectedTicketForExit.isMonthly ? "Mensalista" : currentPaymentMethod;
            const response = await fetch(`${API_BASE_URL}/api/tickets/exit/${ticketId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paymentMethod: resolvedMethod })
            });
            
            const result = await response.json();
            if (response.ok) {
                showToast(`Saída autorizada para veículo ${result.ticket.plate}!`, "success");
                
                // Display paid tax receipt
                renderPaidReceipt(result.ticket, result.ticket.parkingSpace);
                hideCheckoutPanel();
                document.getElementById('exit-search-input').value = '';
            } else {
                showToast(result.message || "Erro ao processar pagamento.", "error");
            }
        } catch (error) {
            console.error(error);
            showToast("Falha de rede ao fechar estadia.", "error");
        }
    }
    
    // Refresh
    renderActiveView();
}

// -------------------------------------------------------------
// UPDATE TARIFF CONFIGS
// -------------------------------------------------------------
async function updateTariffRates(id, type) {
    const firstRate = parseFloat(document.getElementById(`tariff-first-${id}`).value);
    const addRate = parseFloat(document.getElementById(`tariff-add-${id}`).value);
    const tolerance = parseInt(document.getElementById(`tariff-tol-${id}`).value);
    const maxRate = parseFloat(document.getElementById(`tariff-max-${id}`).value);
    
    if (isNaN(firstRate) || isNaN(addRate) || isNaN(tolerance) || isNaN(maxRate)) {
        showToast("Valores inseridos são inválidos.", "error");
        return;
    }
    
    const updatedTariff = {
        id: id,
        vehicleType: type,
        firstHourRate: firstRate,
        additionalHourRate: addRate,
        toleranceMinutes: tolerance,
        dailyMaxRate: maxRate
    };
    
    if (isOfflineMode) {
        const index = tariffs.findIndex(t => t.id === id);
        if (index !== -1) {
            tariffs[index] = updatedTariff;
            saveSimulatedData();
            showToast("Tarifas simuladas atualizadas com sucesso!", "success");
        }
    } else {
        try {
            const response = await fetch(`${API_BASE_URL}/api/tariffs/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedTariff)
            });
            
            if (response.ok) {
                showToast("Configurações salvas no servidor .NET!", "success");
            } else {
                const err = await response.json();
                showToast(err.message || "Erro ao atualizar tarifas.", "error");
            }
        } catch (error) {
            console.error(error);
            showToast("Erro ao conectar à API de configurações.", "error");
        }
    }
    
    renderActiveView();
}

// -------------------------------------------------------------
// PRINT RECEIPT & TICKETS (VIRTUAL THERMAL PRINTER)
// -------------------------------------------------------------

// Ticket at Entry
function renderTicketReceipt(ticket, space) {
    const previewContainer = document.getElementById('receipt-preview-container');
    const emptyState = document.getElementById('receipt-empty-state');
    
    const typeNames = { 'Car': 'CARRO', 'Motorcycle': 'MOTO', 'Truck': 'UTILITARIO' };
    const modName = ticket.isMonthly ? 'MENSALISTA' : 'AVULSO';
    const vehDetails = `${ticket.brand || ''} ${ticket.model || ''} ${ticket.color ? `(${ticket.color})` : ''}`.trim() || 'N/A';
    
    const receiptHtml = `
        <div class="receipt-card">
            <div class="receipt-header">
                <h3>ANTIGRAVITY PARKING</h3>
                <p>CNPJ: 12.345.678/0001-99</p>
                <p>AV. TECNOLOGIA, 2026 - BRAZIL</p>
                <p style="font-size: 10px; margin-top: 5px;">TICKET DE ENTRADA</p>
            </div>
            <div class="receipt-body">
                <div class="receipt-row">
                    <span>NUMERO:</span>
                    <span style="font-weight: bold;">${ticket.ticketNumber}</span>
                </div>
                <div class="receipt-row">
                    <span>PLACA:</span>
                    <span style="font-weight: bold; font-size: 14px;">${ticket.plate}</span>
                </div>
                <div class="receipt-row">
                    <span>MODALIDADE:</span>
                    <span style="font-weight: bold; color: var(--color-monthly);">${modName}</span>
                </div>
                <div class="receipt-row">
                    <span>VEICULO:</span>
                    <span>${vehDetails}</span>
                </div>
                <div class="receipt-row">
                    <span>CATEGORIA:</span>
                    <span>${typeNames[ticket.vehicleType]}</span>
                </div>
                <div class="receipt-row">
                    <span>VAGA DESIGNADA:</span>
                    <span style="font-weight: bold; color: #1d4ed8;">${space.code}</span>
                </div>
                <div class="receipt-divider"></div>
                <div class="receipt-row">
                    <span>ENTRADA:</span>
                    <span>${formatDate(ticket.entryTime)}</span>
                </div>
            </div>
            <div class="receipt-divider"></div>
            <div class="receipt-qr">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(ticket.ticketNumber)}" alt="QR Code" style="width: 110px; height: 110px; background: #fff; padding: 4px; border: 1px solid #ddd; border-radius: 4px;" />
                <p style="font-size: 8px; color: #6b7280; text-align: center; margin-top: 5px;">
                    Guarde este cupom. Sujeito a cobrança em caso de extravio de acordo com as normas.
                </p>
            </div>
        </div>
        <div class="receipt-actions-row" style="display: flex; gap: 10px; margin-top: 15px; width: 100%;">
            <button class="btn-primary" style="flex: 1; height: 40px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px;" onclick="printActiveReceipt()">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Imprimir
            </button>
            <button class="btn-success" style="flex: 1; height: 40px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px; background: #25d366; border-color: #25d366;" onclick="sendActiveReceiptWhatsApp()">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12.031 2c-5.506 0-9.975 4.469-9.975 9.975 0 1.761.459 3.478 1.33 4.992l-1.416 5.176 5.297-1.391c1.468.802 3.12 1.226 4.764 1.226 5.506 0 9.975-4.469 9.975-9.975 0-2.656-1.033-5.153-2.909-7.031-1.875-1.878-4.373-2.909-7.066-2.909zm.006 1.831c2.197 0 4.263.856 5.819 2.412 1.556 1.556 2.412 3.622 2.412 5.819 0 4.524-3.682 8.207-8.207 8.207-1.488 0-2.947-.403-4.223-1.164l-.303-.18-3.136.822.837-3.056-.197-.314c-.832-1.328-1.272-2.871-1.272-4.457 0-4.524 3.682-8.207 8.207-8.207zm-3.536 2.923c-.194 0-.419.043-.606.246-.188.203-.719.703-.719 1.716s.738 1.992.838 2.128c.1.135 1.452 2.217 3.518 3.109.492.212.876.339 1.176.434.494.157.943.134 1.299.081.397-.059 1.219-.498 1.394-.98.175-.481.175-.895.123-.98-.052-.085-.192-.135-.403-.241-.212-.106-1.253-.618-1.447-.687-.194-.069-.336-.103-.478.11-.142.212-.55.687-.674.825-.125.137-.249.154-.461.049-.211-.105-.894-.329-1.704-1.053-.63-.562-1.056-1.255-1.18-1.466-.123-.211-.013-.326.093-.431.096-.095.212-.246.318-.369.106-.123.142-.211.212-.352.069-.142.035-.266-.017-.372-.052-.106-.478-1.15-.656-1.579-.174-.419-.364-.359-.478-.359z"/></svg>
                WhatsApp
            </button>
        </div>
    `;
    
    previewContainer.innerHTML = receiptHtml;
    emptyState.style.display = 'none';
    previewContainer.style.display = 'block';
    
    // Set global references for print/whatsapp actions
    currentActiveReceiptTicket = ticket;
    currentActiveReceiptSpace = space;
    
    // Auto-print on entry if configured
    const config = JSON.parse(localStorage.getItem('ag_printing_config')) || {};
    if (config.autoPrintEntry) {
        printActiveReceipt();
    }
}

// Receipt Paid at Exit
function renderPaidReceipt(ticket, space) {
    const previewContainer = document.getElementById('receipt-preview-container');
    const emptyState = document.getElementById('receipt-empty-state');
    
    const typeNames = { 'Car': 'CARRO', 'Motorcycle': 'MOTO', 'Truck': 'UTILITARIO' };
    const modName = ticket.isMonthly ? 'MENSALISTA' : 'AVULSO';
    const vehDetails = `${ticket.brand || ''} ${ticket.model || ''} ${ticket.color ? `(${ticket.color})` : ''}`.trim() || 'N/A';
    
    // Calculate total duration in receipt if offline or format string directly
    let durText = '';
    if (ticket.exitTime) {
        const diffMs = new Date(ticket.exitTime) - new Date(ticket.entryTime);
        const mins = Math.max(0, Math.round(diffMs / 60000));
        durText = formatDurationMinutes(mins);
    }
    
    const receiptHtml = `
        <div class="receipt-card" style="border-top: 10px solid #10b981;">
            <div class="receipt-header">
                <h3>ANTIGRAVITY PARKING</h3>
                <p>CNPJ: 12.345.678/0001-99</p>
                <p>AV. TECNOLOGIA, 2026 - BRAZIL</p>
                <p style="font-size: 10px; margin-top: 5px; color: #047857; font-weight: bold;">CUPOM FISCAL DE PAGAMENTO</p>
            </div>
            <div class="receipt-body">
                <div class="receipt-row">
                    <span>TICKET ID:</span>
                    <span style="font-weight: bold;">${ticket.ticketNumber}</span>
                </div>
                <div class="receipt-row">
                    <span>PLACA:</span>
                    <span style="font-weight: bold; font-size: 14px;">${ticket.plate}</span>
                </div>
                <div class="receipt-row">
                    <span>MODALIDADE:</span>
                    <span style="font-weight: bold;">${modName}</span>
                </div>
                <div class="receipt-row">
                    <span>VEICULO:</span>
                    <span>${vehDetails}</span>
                </div>
                <div class="receipt-row">
                    <span>CATEGORIA:</span>
                    <span>${typeNames[ticket.vehicleType]}</span>
                </div>
                <div class="receipt-row">
                    <span>VAGA LIBERADA:</span>
                    <span style="font-weight: bold;">${space ? space.code : '--'}</span>
                </div>
                <div class="receipt-divider"></div>
                <div class="receipt-row">
                    <span>ENTRADA:</span>
                    <span>${formatDate(ticket.entryTime)}</span>
                </div>
                <div class="receipt-row">
                    <span>SAIDA:</span>
                    <span>${formatDate(ticket.exitTime)}</span>
                </div>
                <div class="receipt-row">
                    <span>PERMANENCIA:</span>
                    <span style="font-weight: bold;">${durText || 'N/A'}</span>
                </div>
                <div class="receipt-row">
                    <span>METODO PGTO:</span>
                    <span>${ticket.paymentMethod || 'Dinheiro'}</span>
                </div>
                <div class="receipt-divider"></div>
                <div class="receipt-total">
                    <span>PAGO TOTAL:</span>
                    <span style="color: #047857;">${formatCurrency(ticket.amountPaid)}</span>
                </div>
            </div>
            <div class="receipt-divider"></div>
            <div class="receipt-qr">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(ticket.ticketNumber)}" alt="QR Code" style="width: 110px; height: 110px; background: #fff; padding: 4px; border: 1px solid #ddd; border-radius: 4px;" />
                <p style="font-size: 8px; color: #047857; text-align: center; font-weight: bold; margin-top: 5px;">
                    SAÍDA AUTOMÁTICA AUTORIZADA.<br>VOCÊ TEM 15 MINUTOS PARA SAIR.
                </p>
            </div>
        </div>
        <div class="receipt-actions-row" style="display: flex; gap: 10px; margin-top: 15px; width: 100%;">
            <button class="btn-primary" style="flex: 1; height: 40px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px;" onclick="printActiveReceipt()">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Imprimir
            </button>
            <button class="btn-success" style="flex: 1; height: 40px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px; background: #25d366; border-color: #25d366;" onclick="sendActiveReceiptWhatsApp()">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12.031 2c-5.506 0-9.975 4.469-9.975 9.975 0 1.761.459 3.478 1.33 4.992l-1.416 5.176 5.297-1.391c1.468.802 3.12 1.226 4.764 1.226 5.506 0 9.975-4.469 9.975-9.975 0-2.656-1.033-5.153-2.909-7.031-1.875-1.878-4.373-2.909-7.066-2.909zm.006 1.831c2.197 0 4.263.856 5.819 2.412 1.556 1.556 2.412 3.622 2.412 5.819 0 4.524-3.682 8.207-8.207 8.207-1.488 0-2.947-.403-4.223-1.164l-.303-.18-3.136.822.837-3.056-.197-.314c-.832-1.328-1.272-2.871-1.272-4.457 0-4.524 3.682-8.207 8.207-8.207zm-3.536 2.923c-.194 0-.419.043-.606.246-.188.203-.719.703-.719 1.716s.738 1.992.838 2.128c.1.135 1.452 2.217 3.518 3.109.492.212.876.339 1.176.434.494.157.943.134 1.299.081.397-.059 1.219-.498 1.394-.98.175-.481.175-.895.123-.98-.052-.085-.192-.135-.403-.241-.212-.106-1.253-.618-1.447-.687-.194-.069-.336-.103-.478.11-.142.212-.55.687-.674.825-.125.137-.249.154-.461.049-.211-.105-.894-.329-1.704-1.053-.63-.562-1.056-1.255-1.18-1.466-.123-.211-.013-.326.093-.431.096-.095.212-.246.318-.369.106-.123.142-.211.212-.352.069-.142.035-.266-.017-.372-.052-.106-.478-1.15-.656-1.579-.174-.419-.364-.359-.478-.359z"/></svg>
                WhatsApp
            </button>
        </div>
    `;
    
    previewContainer.innerHTML = receiptHtml;
    emptyState.style.display = 'none';
    previewContainer.style.display = 'block';
    
    // Set global references for print/whatsapp actions
    currentActiveReceiptTicket = ticket;
    currentActiveReceiptSpace = space;
    
    // Auto-print on exit if configured
    const config = JSON.parse(localStorage.getItem('ag_printing_config')) || {};
    if (config.autoPrintExit) {
        printActiveReceipt();
    }
}

// -------------------------------------------------------------
// INTERACTIVE MAP GRID CELL ACTIONS MODAL
// -------------------------------------------------------------
function openSpaceDetailsModal(space) {
    const modal = document.getElementById('space-modal');
    const title = document.getElementById('modal-space-title');
    const body = document.getElementById('modal-space-details');
    
    title.textContent = `Vaga de Estacionamento: ${space.code}`;
    
    const categoryNames = { 'Car': 'Carro', 'Motorcycle': 'Motocicleta', 'Truck': 'Utilitário / Caminhão' };
    
    let contentHtml = '';
    
    if (space.isOccupied) {
        // Find active ticket linked
        const activeTicket = tickets.find(t => !t.isPaid && t.parkingSpaceId === space.id);
        const entryStr = activeTicket ? formatDate(activeTicket.entryTime) : 'N/A';
        const ticketNum = activeTicket ? activeTicket.ticketNumber : 'N/A';
        const modalLabel = activeTicket && activeTicket.isMonthly ? '<span class="badge-monthly">Mensalista</span>' : '<span class="badge-casual">Avulso</span>';
        const vehDetails = activeTicket ? `${activeTicket.brand || ''} ${activeTicket.model || ''} ${activeTicket.color ? `(${activeTicket.color})` : ''}`.trim() : 'N/A';
        
        const session = getSession();
        const isAdmin = session && session.role === 'Admin';
        
        contentHtml = `
            <div style="display: flex; flex-direction: column; gap: 15px; font-size: 14px; margin-top: 10px;">
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
                    <span style="color: var(--text-secondary);">Status da Vaga:</span>
                    <span style="font-weight: bold; color: var(--color-danger);">OCUPADA</span>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
                    <span style="color: var(--text-secondary);">Modalidade:</span>
                    <span>${modalLabel}</span>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
                    <span style="color: var(--text-secondary);">Veículo Placa:</span>
                    <span style="font-weight: bold; font-size: 16px; color: #fff;">${space.occupiedByPlate}</span>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
                    <span style="color: var(--text-secondary);">Detalhes:</span>
                    <span>${vehDetails}</span>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
                    <span style="color: var(--text-secondary);">Ticket ID:</span>
                    <span style="font-family: monospace;">${ticketNum}</span>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
                    <span style="color: var(--text-secondary);">Horário Entrada:</span>
                    <span>${entryStr}</span>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
                    <span style="color: var(--text-secondary);">Categoria Permitida:</span>
                    <span>${categoryNames[space.allowedType]}</span>
                </div>
                
                ${isAdmin ? `
                <button class="btn-primary" style="background: var(--gradient-danger); box-shadow: 0 5px 15px var(--color-danger-glow); margin-top: 15px; height: 50px;" onclick="shortcutReleaseSpace(${space.id}, '${space.occupiedByPlate}')">
                    Liberar Vaga (Forçar Saída/Perda)
                </button>
                ` : ''}
            </div>
        `;
    } else {
        contentHtml = `
            <div style="display: flex; flex-direction: column; gap: 15px; font-size: 14px; margin-top: 10px;">
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
                    <span style="color: var(--text-secondary);">Status da Vaga:</span>
                    <span style="font-weight: bold; color: var(--color-success);">DISPONÍVEL</span>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
                    <span style="color: var(--text-secondary);">Categoria Permitida:</span>
                    <span style="font-weight: bold; color: var(--color-primary);">${categoryNames[space.allowedType]}</span>
                </div>
                
                <div style="margin-top: 15px;">
                    <label style="font-size: 13px; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 8px;">Estacionar veículo imediatamente nesta vaga:</label>
                    <div style="display: flex; gap: 10px;">
                        <input type="text" id="shortcut-plate-input" class="input-search" placeholder="PLACA..." style="height: 48px; font-family: var(--font-heading); font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">
                        <button class="btn-primary" style="width: auto; padding: 0 20px; height: 48px; box-shadow: none;" onclick="shortcutParkSpace(${space.id}, '${space.allowedType}')">Estacionar</button>
                    </div>
                </div>
            </div>
        `;
    }
    
    body.innerHTML = contentHtml;
    modal.classList.add('active');
}

// Close popup modal
function closeSpaceModal() {
    const modal = document.getElementById('space-modal');
    modal.classList.remove('active');
}

// Rapid Force release a space
async function shortcutReleaseSpace(spaceId, plate) {
    if (!confirm(`Deseja realmente desocupar manualmente a vaga vinculada ao veículo ${plate}? O ticket associado será marcado como concluído de forma administrativa.`)) {
        return;
    }
    
    if (isOfflineMode) {
        const space = parkingSpaces.find(s => s.id === spaceId);
        const ticket = tickets.find(t => !t.isPaid && t.parkingSpaceId === spaceId);
        
        if (space) {
            space.isOccupied = false;
            space.occupiedByPlate = null;
        }
        
        if (ticket) {
            ticket.isPaid = true;
            ticket.exitTime = new Date().toISOString();
            ticket.paymentTime = new Date().toISOString();
            ticket.amountPaid = 0.00;
            ticket.paymentMethod = "Liberado Adm";
        }
        
        saveSimulatedData();
        showToast("Vaga liberada administrativamente!", "success");
    } else {
        // If server, search active ticket and post standard checkout free
        try {
            const ticketRes = await fetch(`${API_BASE_URL}/api/tickets?activeOnly=true&search=${plate}`);
            const matching = await ticketRes.json();
            if (matching.length > 0) {
                await fetch(`${API_BASE_URL}/api/tickets/exit/${matching[0].id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ paymentMethod: "Liberado Adm" })
                });
                showToast("Vaga liberada com sucesso no servidor .NET!", "success");
            } else {
                showToast("Nenhum ticket ativo vinculado.", "error");
            }
        } catch (e) {
            showToast("Erro ao liberar vaga.", "error");
        }
    }
    
    closeSpaceModal();
    renderActiveView();
}

// Rapid entry park
async function shortcutParkSpace(spaceId, allowedType) {
    const plateInput = document.getElementById('shortcut-plate-input');
    const plate = plateInput.value.toUpperCase().trim();
    
    if (!plate) {
        showToast("Insira a placa do veículo para estacionar.", "error");
        return;
    }
    
    if (isOfflineMode) {
        if (tickets.some(t => !t.isPaid && t.plate === plate)) {
            showToast("Veículo já está estacionado no pátio.", "error");
            return;
        }
        
        const space = parkingSpaces.find(s => s.id === spaceId);
        const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
        const rand = Math.floor(100 + Math.random() * 900);
        
        // Check Monthly Subscriber
        const sub = monthlySubscribers.find(s => s.plate === plate && s.isActive && new Date(s.endDate) >= new Date());
        const isMonthly = sub != null;
        
        const newTicket = {
            id: tickets.length + 1,
            ticketNumber: `TKT-${timestamp}-${rand}`,
            plate: plate,
            vehicleType: isMonthly ? sub.vehicleType : allowedType,
            parkingSpaceId: spaceId,
            entryTime: new Date().toISOString(),
            exitTime: null,
            isPaid: false,
            amountPaid: 0.00,
            paymentTime: null,
            paymentMethod: null,
            isMonthly: isMonthly,
            brand: isMonthly ? sub.brand : null,
            model: isMonthly ? sub.model : null,
            color: isMonthly ? sub.color : null
        };
        
        space.isOccupied = true;
        space.occupiedByPlate = plate;
        tickets.push(newTicket);
        
        saveSimulatedData();
        showToast(`Veículo ${plate} estacionado na vaga ${space.code}!`, "success");
    } else {
        try {
            const response = await fetch(`${API_BASE_URL}/api/tickets/entry`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plate: plate, vehicleType: allowedType })
            });
            
            if (response.ok) {
                showToast(`Entrada registrada com sucesso!`, "success");
            } else {
                const err = await response.json();
                showToast(err.message || "Erro ao registrar.", "error");
            }
        } catch (e) {
            showToast("Erro ao efetuar requisição de entrada.", "error");
        }
    }
    
    closeSpaceModal();
    renderActiveView();
}

// -------------------------------------------------------------
// MONTHLY SUBSCRIBERS CRUD MANAGEMENT
// -------------------------------------------------------------
function selectSubVehicleType(type) {
    currentSubVehicleType = type;
    document.querySelectorAll('#subscriber-form .type-option').forEach(opt => opt.classList.remove('selected'));
    
    const optMap = { 'Car': 'car', 'Motorcycle': 'motorcycle', 'Truck': 'truck' };
    const selectedOpt = document.getElementById(`sub-type-${optMap[type]}`);
    if (selectedOpt) selectedOpt.classList.add('selected');
}

function renderMonthlySubscribers() {
    const tableBody = document.getElementById('subscribers-table-body');
    const emptyMsg = document.getElementById('sub-empty-message');
    tableBody.innerHTML = '';
    
    const searchVal = document.getElementById('sub-search').value.toLowerCase().trim();
    let displayedCount = 0;
    
    const typeTranslations = { 'Car': 'Carro', 'Motorcycle': 'Moto', 'Truck': 'Utilitário' };
    
    // Autofill start and end date default values in form if blank
    const startInput = document.getElementById('sub-start');
    const endInput = document.getElementById('sub-end');
    if (!startInput.value) {
        const today = new Date();
        startInput.value = today.toISOString().split('T')[0];
        
        const nextMonth = new Date(today.setMonth(today.getMonth() + 1));
        endInput.value = nextMonth.toISOString().split('T')[0];
    }
    
    monthlySubscribers.forEach(sub => {
        if (searchVal && 
            !sub.name.toLowerCase().includes(searchVal) && 
            !sub.cpf.includes(searchVal) && 
            !sub.plate.toLowerCase().includes(searchVal)) {
            return;
        }
        
        displayedCount++;
        const statusBadge = sub.isActive && new Date(sub.endDate) >= new Date()
            ? '<span class="table-status status-paid">Vigente</span>'
            : '<span class="table-status status-active" style="background: rgba(244, 63, 94, 0.1); color: var(--color-danger); border-color: rgba(244, 63, 94, 0.2)">Vencido / Inativo</span>';
            
        const vehDetails = `${sub.brand || ''} ${sub.model || ''} ${sub.color ? `(${sub.color})` : ''}`.trim() || '--';
        
        const session = getSession();
        const isAdmin = session && session.role === 'Admin';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div style="font-weight: bold; color: #fff;">${sub.name}</div>
                <div style="font-size: 11px; color: var(--text-secondary);">${sub.cpf}</div>
            </td>
            <td>
                <div style="font-weight: bold; font-family: monospace; letter-spacing: 0.5px;">${sub.plate}</div>
                <div style="font-size: 11px; color: var(--text-secondary);">${typeTranslations[sub.vehicleType]}</div>
            </td>
            <td>${vehDetails}</td>
            <td style="font-weight: bold; color: var(--color-primary);">${formatCurrency(sub.monthlyFee)}</td>
            <td>
                <div style="font-weight: 500;">${new Date(sub.endDate).toLocaleDateString('pt-BR')}</div>
                <div style="font-size: 10px; color: var(--text-muted);">Início: ${new Date(sub.startDate).toLocaleDateString('pt-BR')}</div>
            </td>
            <td>${statusBadge}</td>
            ${isAdmin ? `
            <td>
                <div style="display: flex; gap: 8px;">
                    <button class="btn-search" style="width: 34px; height: 34px;" onclick="editSubscriber(${sub.id})" title="Editar">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="btn-search" style="width: 34px; height: 34px; border-color: rgba(244,63,94,0.2);" onclick="deleteSubscriber(${sub.id})" title="Excluir">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--color-danger)" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            </td>
            ` : ''}
        `;
        tableBody.appendChild(row);
        
        // Hide Actions header if Cashier
        const actionHeaders = document.querySelectorAll('.data-table th:last-child');
        actionHeaders.forEach(th => {
            if (th.closest('#view-monthly-section')) {
                th.style.display = isAdmin ? 'table-cell' : 'none';
            }
        });
    });
    
    emptyMsg.style.display = displayedCount === 0 ? 'block' : 'none';
}

async function handleSaveSubscriber(event) {
    event.preventDefault();
    const idVal = document.getElementById('sub-id').value;
    const name = document.getElementById('sub-name').value.trim();
    const cpf = document.getElementById('sub-cpf').value.trim();
    const plate = document.getElementById('sub-plate').value.toUpperCase().trim();
    const brand = document.getElementById('sub-brand').value.trim();
    const model = document.getElementById('sub-model').value.trim();
    const color = document.getElementById('sub-color').value.trim();
    const fee = parseFloat(document.getElementById('sub-fee').value);
    const isActive = document.getElementById('sub-active').checked;
    const startDate = document.getElementById('sub-start').value;
    const endDate = document.getElementById('sub-end').value;
    
    if (!name || !cpf || !plate || !startDate || !endDate) {
        showToast("Preencha todos os campos obrigatórios.", "error");
        return;
    }
    
    const payload = {
        name: name,
        cpf: cpf,
        plate: plate,
        vehicleType: currentSubVehicleType,
        brand: brand || null,
        model: model || null,
        color: color || null,
        monthlyFee: fee,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        isActive: isActive
    };
    
    if (idVal) {
        payload.id = parseInt(idVal);
    }
    
    if (isOfflineMode) {
        // SIMULATION SAVE
        if (idVal) {
            // Edit
            const index = monthlySubscribers.findIndex(s => s.id === parseInt(idVal));
            if (index !== -1) {
                // Check duplicate plate in other subscribers
                if (monthlySubscribers.some(s => s.plate === plate && s.id !== parseInt(idVal))) {
                    showToast(`Já existe outro mensalista cadastrado com a placa ${plate}.`, "error");
                    return;
                }
                monthlySubscribers[index] = { ...payload, id: parseInt(idVal) };
                showToast("Cadastro de mensalista atualizado localmente!", "success");
            }
        } else {
            // New
            if (monthlySubscribers.some(s => s.plate === plate)) {
                showToast(`Já existe um mensalista cadastrado com a placa ${plate}.`, "error");
                return;
            }
            const newId = monthlySubscribers.length > 0 ? Math.max(...monthlySubscribers.map(s => s.id)) + 1 : 1;
            monthlySubscribers.push({ ...payload, id: newId });
            showToast("Mensalista cadastrado com sucesso localmente!", "success");
        }
        saveSimulatedData();
        resetSubscriberForm();
        renderMonthlySubscribers();
    } else {
        // API SERVER SAVE
        try {
            const url = idVal ? `${API_BASE_URL}/api/monthlysubscribers/${idVal}` : `${API_BASE_URL}/api/monthlysubscribers`;
            const method = idVal ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                showToast(idVal ? "Cadastro atualizado com sucesso no servidor!" : "Mensalista cadastrado com sucesso!", "success");
                resetSubscriberForm();
                await loadDataFromServer();
                renderMonthlySubscribers();
            } else {
                showToast(result.message || "Erro ao salvar cadastro de mensalista.", "error");
            }
        } catch (error) {
            console.error(error);
            showToast("Erro ao conectar à API de mensalistas.", "error");
        }
    }
}

function editSubscriber(id) {
    const sub = monthlySubscribers.find(s => s.id === id);
    if (!sub) return;
    
    document.getElementById('subscriber-form-title').innerHTML = `
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="var(--color-monthly)" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Editar Cadastro de Mensalista
    `;
    
    document.getElementById('sub-id').value = sub.id;
    document.getElementById('sub-name').value = sub.name;
    document.getElementById('sub-cpf').value = sub.cpf;
    document.getElementById('sub-plate').value = sub.plate;
    document.getElementById('sub-brand').value = sub.brand || '';
    document.getElementById('sub-model').value = sub.model || '';
    document.getElementById('sub-color').value = sub.color || '';
    document.getElementById('sub-fee').value = sub.monthlyFee;
    document.getElementById('sub-active').checked = sub.isActive;
    document.getElementById('sub-start').value = sub.startDate.split('T')[0];
    document.getElementById('sub-end').value = sub.endDate.split('T')[0];
    
    selectSubVehicleType(sub.vehicleType);
    
    document.getElementById('btn-cancel-sub-edit').style.display = 'block';
}

function cancelSubscriberEdit() {
    resetSubscriberForm();
}

function resetSubscriberForm() {
    document.getElementById('sub-id').value = '';
    document.getElementById('subscriber-form').reset();
    
    document.getElementById('subscriber-form-title').innerHTML = `
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="var(--color-monthly)" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
        Novo Cadastro de Mensalista
    `;
    
    // Reset vehicle selector default
    selectSubVehicleType('Car');
    
    // Set default dates
    const today = new Date();
    document.getElementById('sub-start').value = today.toISOString().split('T')[0];
    const nextMonth = new Date(today.setMonth(today.getMonth() + 1));
    document.getElementById('sub-end').value = nextMonth.toISOString().split('T')[0];
    
    document.getElementById('btn-cancel-sub-edit').style.display = 'none';
}

async function deleteSubscriber(id) {
    if (!confirm("Tem certeza que deseja excluir o cadastro deste mensalista?")) {
        return;
    }
    
    if (isOfflineMode) {
        monthlySubscribers = monthlySubscribers.filter(s => s.id !== id);
        saveSimulatedData();
        showToast("Cadastro excluído localmente.", "success");
        renderMonthlySubscribers();
    } else {
        try {
            const response = await fetch(`${API_BASE_URL}/api/monthlysubscribers/${id}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                showToast("Cadastro removido com sucesso no servidor!", "success");
                await loadDataFromServer();
                renderMonthlySubscribers();
            } else {
                const err = await response.json();
                showToast(err.message || "Erro ao deletar mensalista.", "error");
            }
        } catch (error) {
            console.error(error);
            showToast("Falha de rede ao remover mensalista.", "error");
        }
    }
}

function applySubscriberSearch() {
    renderMonthlySubscribers();
}

// -------------------------------------------------------------
// UTILITIES & FORMATTERS
// -------------------------------------------------------------
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDurationMinutes(totalMinutes) {
    if (totalMinutes < 60) {
        return `${totalMinutes}m`;
    }
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hrs}h ${mins}m`;
}

// Global Custom Toast system
function showToast(message, type = 'info') {
    // 1. Log to localStorage
    const timestamp = new Date().toISOString();
    const logs = JSON.parse(localStorage.getItem('ag_system_logs')) || [];
    logs.unshift({ timestamp, message, type });
    localStorage.setItem('ag_system_logs', JSON.stringify(logs.slice(0, 100))); // Keep last 100
    
    // Refresh Logs view dynamically if active
    if (activeView === 'logs') {
        renderLogs();
    }

    const container = document.getElementById('toast-container');
    if (!container) return;
    
    // 2. Limit active toasts in the container to a maximum of 2 to avoid cluttering
    while (container.childNodes.length >= 2) {
        container.removeChild(container.firstChild);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconSvg = '';
    if (type === 'success') {
        iconSvg = `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`;
    } else if (type === 'error') {
        iconSvg = `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;
    } else if (type === 'warning') {
        iconSvg = `<svg viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`;
    } else {
        iconSvg = `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`;
    }
    
    toast.innerHTML = `
        ${iconSvg}
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease-out forwards';
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 3000);
}

// -------------------------------------------------------------
// USER CONFIGURATION & CRUD MANAGEMENT
// -------------------------------------------------------------
function selectCrudUserRole(role) {
    currentCrudUserRole = role;
    document.querySelectorAll('#user-crud-form .type-option').forEach(opt => opt.classList.remove('selected'));
    
    const optMap = { 'Admin': 'admin', 'Cashier': 'cashier' };
    const selectedOpt = document.getElementById(`crud-role-${optMap[role]}`);
    if (selectedOpt) selectedOpt.classList.add('selected');
}

function renderUsers() {
    const tableBody = document.getElementById('users-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    
    const session = getSession();
    const currentUsername = session ? session.username : null;
    
    systemUsers.forEach(user => {
        const isSelf = currentUsername && user.username.toLowerCase() === currentUsername.toLowerCase();
        
        const roleBadge = user.role === 'Admin'
            ? '<span class="user-role-badge role-admin" style="display: inline-block;">Administrador</span>'
            : '<span class="user-role-badge role-cashier" style="display: inline-block;">Caixa</span>';
            
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div style="font-weight: bold; color: #fff;">${user.name} ${isSelf ? '<span style="font-size: 11px; color: var(--color-primary); font-weight: normal; margin-left: 5px;">(Você)</span>' : ''}</div>
            </td>
            <td>
                <div style="font-family: monospace; letter-spacing: 0.5px;">${user.username}</div>
            </td>
            <td>${roleBadge}</td>
            <td>
                <div style="display: flex; gap: 8px;">
                    <button class="btn-search" style="width: 34px; height: 34px;" onclick="editUser(${user.id})" title="Editar">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    ${isSelf ? '' : `
                    <button class="btn-search" style="width: 34px; height: 34px; border-color: rgba(244,63,94,0.2);" onclick="deleteUser(${user.id})" title="Excluir">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--color-danger)" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                    `}
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function editUser(id) {
    const user = systemUsers.find(u => u.id === id);
    if (!user) return;
    
    document.getElementById('user-form-title').innerHTML = `
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="var(--color-primary)" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Editar Usuário
    `;
    
    document.getElementById('crud-user-id').value = user.id;
    document.getElementById('crud-user-name').value = user.name;
    document.getElementById('crud-user-username').value = user.username;
    
    const passwordInput = document.getElementById('crud-user-password');
    passwordInput.required = false;
    passwordInput.value = '';
    
    document.getElementById('crud-user-password-hint').style.display = 'block';
    
    selectCrudUserRole(user.role);
    
    document.getElementById('btn-cancel-user-edit').style.display = 'block';
}

function cancelUserEdit() {
    resetUserForm();
}

function resetUserForm() {
    document.getElementById('crud-user-id').value = '';
    document.getElementById('user-crud-form').reset();
    
    document.getElementById('user-form-title').innerHTML = `
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="var(--color-primary)" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
        Novo Usuário
    `;
    
    const passwordInput = document.getElementById('crud-user-password');
    passwordInput.required = true;
    passwordInput.value = '';
    
    document.getElementById('crud-user-password-hint').style.display = 'none';
    
    selectCrudUserRole('Admin');
    
    document.getElementById('btn-cancel-user-edit').style.display = 'none';
}

async function handleSaveUser(event) {
    event.preventDefault();
    const idVal = document.getElementById('crud-user-id').value;
    const name = document.getElementById('crud-user-name').value.trim();
    const username = document.getElementById('crud-user-username').value.trim();
    const password = document.getElementById('crud-user-password').value;
    
    if (!name || !username) {
        showToast("Preencha todos os campos obrigatórios.", "error");
        return;
    }
    
    if (!idVal && password.length < 4) {
        showToast("A senha deve ter no mínimo 4 caracteres.", "error");
        return;
    }
    
    if (idVal && password && password.length < 4) {
        showToast("A nova senha deve ter no mínimo 4 caracteres.", "error");
        return;
    }
    
    const payload = {
        name: name,
        username: username,
        role: currentCrudUserRole
    };
    
    if (password) {
        payload.password = password;
    }
    
    if (idVal) {
        payload.id = parseInt(idVal);
    }
    
    if (isOfflineMode) {
        const simUsers = JSON.parse(localStorage.getItem('ag_sim_users')) || [];
        
        if (idVal) {
            const userIdInt = parseInt(idVal);
            const index = simUsers.findIndex(u => u.id === userIdInt);
            if (index !== -1) {
                if (simUsers.some(u => u.username.toLowerCase() === username.toLowerCase() && u.id !== userIdInt)) {
                    showToast("Este nome de usuário já está em uso.", "error");
                    return;
                }
                
                const userToUpdate = simUsers[index];
                if (userToUpdate.role === 'Admin' && currentCrudUserRole !== 'Admin') {
                    const adminCount = simUsers.filter(u => u.role === 'Admin').length;
                    if (adminCount <= 1) {
                        showToast("Não é permitido alterar o cargo do único administrador do sistema.", "error");
                        return;
                    }
                }
                
                simUsers[index].name = name;
                simUsers[index].username = username;
                simUsers[index].role = currentCrudUserRole;
                if (password) {
                    simUsers[index].passwordHash = await getSha256(password);
                }
                
                const session = getSession();
                if (session && session.username.toLowerCase() === userToUpdate.username.toLowerCase()) {
                    session.username = username;
                    session.name = name;
                    session.role = currentCrudUserRole;
                    setSession(session);
                    checkAuth();
                }
                
                localStorage.setItem('ag_sim_users', JSON.stringify(simUsers));
                showToast("Usuário atualizado com sucesso localmente!", "success");
            }
        } else {
            if (simUsers.some(u => u.username.toLowerCase() === username.toLowerCase())) {
                showToast("Este nome de usuário já está em uso.", "error");
                return;
            }
            
            const newId = simUsers.length > 0 ? Math.max(...simUsers.map(u => u.id)) + 1 : 1;
            const passwordHash = await getSha256(password);
            simUsers.push({
                id: newId,
                name: name,
                username: username,
                role: currentCrudUserRole,
                passwordHash: passwordHash
            });
            
            localStorage.setItem('ag_sim_users', JSON.stringify(simUsers));
            showToast("Usuário cadastrado com sucesso localmente!", "success");
        }
        
        loadSimulatedData();
        resetUserForm();
        renderUsers();
    } else {
        try {
            const url = idVal ? `${API_BASE_URL}/api/users/${idVal}` : `${API_BASE_URL}/api/users`;
            const method = idVal ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                showToast(idVal ? "Usuário atualizado com sucesso!" : "Usuário cadastrado com sucesso!", "success");
                
                if (idVal) {
                    const session = getSession();
                    const editedUser = systemUsers.find(u => u.id === parseInt(idVal));
                    if (session && editedUser && session.username.toLowerCase() === editedUser.username.toLowerCase()) {
                        session.username = username;
                        session.name = name;
                        session.role = currentCrudUserRole;
                        setSession(session);
                        checkAuth();
                    }
                }
                
                resetUserForm();
                await loadDataFromServer();
                renderUsers();
            } else {
                showToast(result.message || "Erro ao salvar usuário.", "error");
            }
        } catch (error) {
            console.error(error);
            showToast("Erro ao conectar à API de usuários.", "error");
        }
    }
}

async function deleteUser(id) {
    if (!confirm("Tem certeza que deseja excluir este usuário?")) {
        return;
    }
    
    const session = getSession();
    const currentUsername = session ? session.username : null;
    
    if (isOfflineMode) {
        const simUsers = JSON.parse(localStorage.getItem('ag_sim_users')) || [];
        const userToDelete = simUsers.find(u => u.id === id);
        
        if (!userToDelete) {
            showToast("Usuário não encontrado.", "error");
            return;
        }
        
        if (currentUsername && userToDelete.username.toLowerCase() === currentUsername.toLowerCase()) {
            showToast("Você não pode excluir o seu próprio usuário enquanto estiver conectado.", "error");
            return;
        }
        
        if (userToDelete.role === 'Admin') {
            const adminCount = simUsers.filter(u => u.role === 'Admin').length;
            if (adminCount <= 1) {
                showToast("Não é possível excluir o último administrador do sistema.", "error");
                return;
            }
        }
        
        const updatedUsers = simUsers.filter(u => u.id !== id);
        localStorage.setItem('ag_sim_users', JSON.stringify(updatedUsers));
        showToast("Usuário excluído localmente.", "success");
        
        loadSimulatedData();
        renderUsers();
    } else {
        try {
            const response = await fetch(`${API_BASE_URL}/api/users/${id}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                showToast("Usuário excluído com sucesso!", "success");
                await loadDataFromServer();
                renderUsers();
            } else {
                const err = await response.json();
                showToast(err.message || "Erro ao deletar usuário.", "error");
            }
        } catch (error) {
            console.error(error);
            showToast("Falha de rede ao remover usuário.", "error");
        }
    }
}

// -------------------------------------------------------------
// CHANGE PASSWORD MODAL & LOGIC
// -------------------------------------------------------------
function openChangePasswordModal() {
    const modal = document.getElementById('change-password-modal');
    if (modal) modal.classList.add('active');
}

function closeChangePasswordModal() {
    const modal = document.getElementById('change-password-modal');
    if (modal) modal.classList.remove('active');
    const form = document.getElementById('change-password-form');
    if (form) form.reset();
}

async function handleChangePassword(event) {
    event.preventDefault();
    const currentPassword = document.getElementById('change-pwd-current').value;
    const newPassword = document.getElementById('change-pwd-new').value;
    const confirmPassword = document.getElementById('change-pwd-confirm').value;

    if (!currentPassword || !newPassword || !confirmPassword) {
        showToast("Por favor, preencha todos os campos.", "error");
        return;
    }

    if (newPassword.length < 4) {
        showToast("A nova senha deve ter no mínimo 4 caracteres.", "error");
        return;
    }

    if (newPassword !== confirmPassword) {
        showToast("A nova senha e a confirmação não conferem.", "error");
        return;
    }

    if (isOfflineMode) {
        // SIMULATION PASSWORD UPDATE
        const session = getSession();
        if (!session) {
            showToast("Nenhuma sessão ativa encontrada.", "error");
            return;
        }

        const simUsers = JSON.parse(localStorage.getItem('ag_sim_users')) || [];
        const userIndex = simUsers.findIndex(u => u.username.toLowerCase() === session.username.toLowerCase());

        if (userIndex === -1) {
            showToast("Usuário não encontrado na simulação.", "error");
            return;
        }

        const currentHash = await getSha256(currentPassword);
        if (simUsers[userIndex].passwordHash !== currentHash) {
            showToast("A senha atual está incorreta na simulação.", "error");
            return;
        }

        // Update password hash
        const newHash = await getSha256(newPassword);
        simUsers[userIndex].passwordHash = newHash;
        localStorage.setItem('ag_sim_users', JSON.stringify(simUsers));

        showToast("Senha alterada com sucesso localmente!", "success");
        closeChangePasswordModal();
    } else {
        // API SERVER PASSWORD UPDATE
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const result = await response.json();

            if (response.ok) {
                showToast("Senha alterada com sucesso!", "success");
                closeChangePasswordModal();
            } else {
                showToast(result.message || "Erro ao alterar senha.", "error");
            }
        } catch (error) {
            console.error(error);
            showToast("Erro de rede ao conectar à API de alteração de senha.", "error");
        }
    }
}

// -------------------------------------------------------------
// SYSTEM LOGS & NOTIFICATIONS VIEW
// -------------------------------------------------------------
function renderLogs() {
    const tableBody = document.getElementById('logs-table-body');
    const emptyMsg = document.getElementById('logs-empty-message');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    
    const logs = JSON.parse(localStorage.getItem('ag_system_logs')) || [];
    
    if (logs.length === 0) {
        if (emptyMsg) emptyMsg.style.display = 'block';
        return;
    }
    if (emptyMsg) emptyMsg.style.display = 'none';
    
    logs.forEach(log => {
        const row = document.createElement('tr');
        
        let typeBadge = '';
        if (log.type === 'success') {
            typeBadge = '<span class="table-status status-paid" style="background: rgba(16, 185, 129, 0.1); color: var(--color-success); border-color: rgba(16, 185, 129, 0.2)">Sucesso</span>';
        } else if (log.type === 'error') {
            typeBadge = '<span class="table-status status-active" style="background: rgba(244, 63, 94, 0.1); color: var(--color-danger); border-color: rgba(244, 63, 94, 0.2)">Erro</span>';
        } else if (log.type === 'warning') {
            typeBadge = '<span class="table-status status-active" style="background: rgba(245, 158, 11, 0.1); color: var(--color-warning); border-color: rgba(245, 158, 11, 0.2)">Alerta</span>';
        } else {
            typeBadge = '<span class="table-status status-paid" style="background: rgba(59, 130, 246, 0.1); color: var(--color-primary); border-color: rgba(59, 130, 246, 0.2)">Info</span>';
        }
        
        row.innerHTML = `
            <td style="color: var(--text-secondary); font-size: 13px;">${formatDate(log.timestamp)}</td>
            <td>${typeBadge}</td>
            <td style="font-weight: 500;">${log.message}</td>
        `;
        tableBody.appendChild(row);
    });
}

function clearSystemLogs() {
    if (confirm("Deseja realmente limpar todos os logs do sistema?")) {
        localStorage.removeItem('ag_system_logs');
        showToast("Histórico de logs limpo com sucesso.", "success");
        renderLogs();
    }
}

// -------------------------------------------------------------
// CAPACITY MANAGEMENT VIEW & LOGIC
// -------------------------------------------------------------
function renderCapacity() {
    if (!parkingSpaces) return;
    
    // Calculate total and occupied by category
    const carSpaces = parkingSpaces.filter(s => s.allowedType === 'Car');
    const totalCars = carSpaces.length;
    const occupiedCars = carSpaces.filter(s => s.isOccupied).length;
    
    const motoSpaces = parkingSpaces.filter(s => s.allowedType === 'Motorcycle');
    const totalMotos = motoSpaces.length;
    const occupiedMotos = motoSpaces.filter(s => s.isOccupied).length;
    
    const truckSpaces = parkingSpaces.filter(s => s.allowedType === 'Truck');
    const totalTrucks = truckSpaces.length;
    const occupiedTrucks = truckSpaces.filter(s => s.isOccupied).length;
    
    // Fill inputs (only if they are not currently active element to prevent losing cursor/selection)
    const carsInput = document.getElementById('capacity-cars');
    if (carsInput && document.activeElement !== carsInput) {
        carsInput.value = totalCars;
    }
    const motosInput = document.getElementById('capacity-motorcycles');
    if (motosInput && document.activeElement !== motosInput) {
        motosInput.value = totalMotos;
    }
    const trucksInput = document.getElementById('capacity-trucks');
    if (trucksInput && document.activeElement !== trucksInput) {
        trucksInput.value = totalTrucks;
    }
    
    // Set hints
    const carsHint = document.getElementById('occupied-cars-hint');
    if (carsHint) {
        carsHint.textContent = `Carros ativos no pátio: ${occupiedCars}. Mínimo permitido: ${occupiedCars}`;
    }
    const motosHint = document.getElementById('occupied-motorcycles-hint');
    if (motosHint) {
        motosHint.textContent = `Motos ativas no pátio: ${occupiedMotos}. Mínimo permitido: ${occupiedMotos}`;
    }
    const trucksHint = document.getElementById('occupied-trucks-hint');
    if (trucksHint) {
        trucksHint.textContent = `Utilitários ativos no pátio: ${occupiedTrucks}. Mínimo permitido: ${occupiedTrucks}`;
    }
    
    // Update summaries and badges
    updateSectorSummary('A', occupiedCars, totalCars, 'sector-a-summary', 'sector-a-badge');
    updateSectorSummary('B', occupiedMotos, totalMotos, 'sector-b-summary', 'sector-b-badge');
    updateSectorSummary('C', occupiedTrucks, totalTrucks, 'sector-c-summary', 'sector-c-badge');
}

function updateSectorSummary(prefix, occupied, total, summaryId, badgeId) {
    const summaryEl = document.getElementById(summaryId);
    const badgeEl = document.getElementById(badgeId);
    if (!summaryEl || !badgeEl) return;
    
    const percent = total > 0 ? Math.round((occupied / total) * 100) : 0;
    summaryEl.textContent = `Ocupação: ${occupied} / ${total} vagas (${percent}%)`;
    
    if (percent >= 100) {
        badgeEl.textContent = 'LOTADO';
        badgeEl.style.background = 'rgba(239, 68, 68, 0.1)';
        badgeEl.style.color = '#ef4444';
        badgeEl.style.borderColor = 'rgba(239, 68, 68, 0.2)';
    } else if (percent >= 80) {
        badgeEl.textContent = 'CRÍTICO';
        badgeEl.style.background = 'rgba(249, 115, 22, 0.1)';
        badgeEl.style.color = '#f97316';
        badgeEl.style.borderColor = 'rgba(249, 115, 22, 0.2)';
    } else {
        badgeEl.textContent = 'OK';
        badgeEl.style.background = 'rgba(34, 197, 94, 0.1)';
        badgeEl.style.color = '#22c55e';
        badgeEl.style.borderColor = 'rgba(34, 197, 94, 0.2)';
    }
}

async function handleSaveCapacity(event) {
    event.preventDefault();
    
    const carCapacity = parseInt(document.getElementById('capacity-cars').value);
    const motorcycleCapacity = parseInt(document.getElementById('capacity-motorcycles').value);
    const truckCapacity = parseInt(document.getElementById('capacity-trucks').value);
    
    if (isNaN(carCapacity) || isNaN(motorcycleCapacity) || isNaN(truckCapacity) || 
        carCapacity < 0 || motorcycleCapacity < 0 || truckCapacity < 0) {
        showToast("As capacidades devem ser números inteiros maiores ou iguais a zero.", "error");
        return;
    }
    
    // Safety check in frontend
    const carSpaces = parkingSpaces.filter(s => s.allowedType === 'Car');
    const occupiedCars = carSpaces.filter(s => s.isOccupied).length;
    if (carCapacity < occupiedCars) {
        showToast(`Não é possível reduzir a capacidade de carros abaixo do total ocupado (${occupiedCars}).`, "error");
        return;
    }
    
    const motoSpaces = parkingSpaces.filter(s => s.allowedType === 'Motorcycle');
    const occupiedMotos = motoSpaces.filter(s => s.isOccupied).length;
    if (motorcycleCapacity < occupiedMotos) {
        showToast(`Não é possível reduzir a capacidade de motos abaixo do total ocupado (${occupiedMotos}).`, "error");
        return;
    }
    
    const truckSpaces = parkingSpaces.filter(s => s.allowedType === 'Truck');
    const occupiedTrucks = truckSpaces.filter(s => s.isOccupied).length;
    if (truckCapacity < occupiedTrucks) {
        showToast(`Não é possível reduzir a capacidade de utilitários abaixo do total ocupado (${occupiedTrucks}).`, "error");
        return;
    }
    
    const saveButton = document.getElementById('btn-save-capacity');
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = 'Salvando...';
    }
    
    try {
        if (isOfflineMode) {
            // Offline simulation mode
            adjustSimulatedCapacity('Car', carCapacity, 'A');
            adjustSimulatedCapacity('Motorcycle', motorcycleCapacity, 'B');
            adjustSimulatedCapacity('Truck', truckCapacity, 'C');
            saveSimulatedData();
            showToast("Capacidades atualizadas com sucesso no modo simulado!", "success");
            renderCapacity();
        } else {
            // Online mode: API Request
            const session = getSession();
            if (!session) {
                showToast("Sessão expirada. Por favor, faça login novamente.", "error");
                window.location.reload();
                return;
            }
            
            try {
                const response = await fetch(`${API_BASE_URL}/api/spaces/capacity`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.token}`
                    },
                    body: JSON.stringify({
                        carCapacity: carCapacity,
                        motorcycleCapacity: motorcycleCapacity,
                        truckCapacity: truckCapacity
                    })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    showToast(data.message || "Capacidades de vagas atualizadas no servidor!", "success");
                    await loadDataFromServer();
                    renderCapacity();
                } else if (response.status === 404) {
                    // Endpoint not found (old server version is running)
                    console.warn("Endpoint api/spaces/capacity retornado 404. Servidor precisa ser reiniciado.");
                    showToast("Recurso indisponível no servidor atual. Salvando as capacidades em contingência local (offline)...", "warning");
                    
                    // Contingency local fallback
                    adjustSimulatedCapacity('Car', carCapacity, 'A');
                    adjustSimulatedCapacity('Motorcycle', motorcycleCapacity, 'B');
                    adjustSimulatedCapacity('Truck', truckCapacity, 'C');
                    saveSimulatedData();
                    renderCapacity();
                } else {
                    const errData = await response.json().catch(() => ({ message: "Erro desconhecido." }));
                    showToast(errData.message || "Erro ao atualizar capacidade no servidor.", "error");
                }
            } catch (err) {
                console.error("Erro de conexão. Ativando contingência local offline para capacidade.", err);
                showToast("Erro de rede. Alterações salvas localmente em contingência...", "warning");
                
                // Connection error fallback
                adjustSimulatedCapacity('Car', carCapacity, 'A');
                adjustSimulatedCapacity('Motorcycle', motorcycleCapacity, 'B');
                adjustSimulatedCapacity('Truck', truckCapacity, 'C');
                saveSimulatedData();
                renderCapacity();
            }
        }
    } catch (ex) {
        console.error("Erro ao ajustar capacidade:", ex);
        showToast(ex.message || "Ocorreu um erro ao atualizar as capacidades.", "error");
    } finally {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = 'Salvar Nova Capacidade';
        }
    }
}

function adjustSimulatedCapacity(type, targetCapacity, prefix) {
    const existingSpaces = parkingSpaces.filter(s => s.allowedType === type);
    const currentCount = existingSpaces.length;
    
    if (targetCapacity > currentCount) {
        // Add spaces
        let startNum = 1;
        if (existingSpaces.length > 0) {
            const sorted = [...existingSpaces].sort((a, b) => a.code.localeCompare(b.code));
            const lastSpace = sorted[sorted.length - 1];
            const parts = lastSpace.code.split('-');
            if (parts.length === 2 && !isNaN(parseInt(parts[1]))) {
                startNum = parseInt(parts[1]) + 1;
            }
        }
        
        let maxId = parkingSpaces.length > 0 ? Math.max(...parkingSpaces.map(s => s.id)) : 0;
        
        for (let i = 0; i < (targetCapacity - currentCount); i++) {
            const nextNum = startNum + i;
            parkingSpaces.push({
                id: ++maxId,
                code: `${prefix}-${String(nextNum).padStart(2, '0')}`,
                allowedType: type,
                isOccupied: false,
                occupiedByPlate: null
            });
        }
    } else if (targetCapacity < currentCount) {
        // Remove spaces from the end
        const sorted = [...existingSpaces].sort((a, b) => a.code.localeCompare(b.code));
        const spacesToRemove = sorted.slice(targetCapacity);
        
        if (spacesToRemove.some(s => s.isOccupied)) {
            const categoryName = type === 'Car' ? 'Carros' : (type === 'Motorcycle' ? 'Motos' : 'Utilitários');
            throw new Error(`Não é possível reduzir a capacidade de ${categoryName} porque uma ou mais vagas a serem removidas estão ocupadas.`);
        }
        
        const removeIds = new Set(spacesToRemove.map(s => s.id));
        parkingSpaces = parkingSpaces.filter(s => !removeIds.has(s.id));
    }
}

// Global active ticket references for printing and sharing
let currentActiveReceiptTicket = null;
let currentActiveReceiptSpace = null;
let chatbotActiveTicket = null;

// Initialize printing configuration in localStorage
function initializePrintingConfig() {
    if (!localStorage.getItem('ag_printing_config')) {
        const defaultConfig = {
            profile: 'virtual',
            headerText: 'ESTACIONAMENTO AG PARKING',
            footerText: 'Guarde este cupom. Sujeito a cobrança em caso de extravio.',
            autoPrintEntry: false,
            autoPrintExit: false
        };
        localStorage.setItem('ag_printing_config', JSON.stringify(defaultConfig));
    }
}

// Render printing config view
function renderPrinting() {
    const config = JSON.parse(localStorage.getItem('ag_printing_config'));
    if (!config) return;
    
    document.getElementById('printer-profile').value = config.profile || 'virtual';
    document.getElementById('print-header').value = config.headerText || '';
    document.getElementById('print-footer').value = config.footerText || '';
    document.getElementById('print-auto-entry').checked = !!config.autoPrintEntry;
    document.getElementById('print-auto-exit').checked = !!config.autoPrintExit;
    
    updateLiveTicketPreview();
}

// Update live preview widths and badges
function updateLiveTicketPreview() {
    const profile = document.getElementById('printer-profile').value;
    const headerVal = document.getElementById('print-header').value;
    const footerVal = document.getElementById('print-footer').value;
    
    const headerEl = document.getElementById('preview-header-text');
    const footerEl = document.getElementById('preview-footer-text');
    const wrapper = document.getElementById('live-ticket-preview-wrapper');
    const badge = document.getElementById('preview-width-badge');
    
    if (headerEl) headerEl.textContent = headerVal || 'AG PARKING';
    if (footerEl) footerEl.textContent = footerVal || 'Guarde este cupom.';
    
    if (!wrapper || !badge) return;
    
    if (profile === 'thermal58') {
        wrapper.style.maxWidth = '200px';
        badge.textContent = 'Térmica 58mm';
    } else if (profile === 'thermal80') {
        wrapper.style.maxWidth = '280px';
        badge.textContent = 'Térmica 80mm';
    } else if (profile === 'standard') {
        wrapper.style.maxWidth = '100%';
        badge.textContent = 'Padrão A4 / PDF';
    } else {
        wrapper.style.maxWidth = '280px';
        badge.textContent = 'Apenas Tela';
    }
}

// Save printer configurations
function handleSavePrintingConfig(event) {
    if (event) event.preventDefault();
    
    const config = {
        profile: document.getElementById('printer-profile').value,
        headerText: document.getElementById('print-header').value,
        footerText: document.getElementById('print-footer').value,
        autoPrintEntry: document.getElementById('print-auto-entry').checked,
        autoPrintExit: document.getElementById('print-auto-exit').checked
    };
    
    localStorage.setItem('ag_printing_config', JSON.stringify(config));
    showToast("Configurações de impressão salvas com sucesso!", "success");
}

// Trigger test print ticket
function triggerTestPrint() {
    const config = JSON.parse(localStorage.getItem('ag_printing_config')) || {};
    const header = config.headerText || 'AG PARKING';
    const footer = config.footerText || 'Guarde este cupom.';
    const profile = config.profile || 'virtual';
    
    if (profile === 'virtual') {
        showToast("O Perfil da Impressora está definido como 'Apenas na Tela'. Mude o perfil para imprimir.", "warning");
        return;
    }
    
    const htmlContent = `
        <div style="text-align: center; font-family: monospace; padding: 10px;">
            <h3>${header}</h3>
            <p>CNPJ: 12.345.678/0001-99</p>
            <p>AV. TECNOLOGIA, 2026 - BRAZIL</p>
            <p>-----------------------------</p>
            <p><strong>CUPOM DE TESTE DE IMPRESSÃO</strong></p>
            <p>DATA: ${new Date().toLocaleString('pt-BR')}</p>
            <p>STATUS: IMPRESSORA OK</p>
            <p>PERFIL: ${profile === 'thermal58' ? 'Térmica 58mm' : (profile === 'thermal80' ? 'Térmica 80mm' : 'Padrão A4')}</p>
            <p>-----------------------------</p>
            <div style="display: flex; flex-direction: column; align-items: center; margin: 10px 0; gap: 5px;">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=TEST-TKT" alt="QR" style="width: 100px; height: 100px; background: #fff; padding: 4px; border: 1px solid #ddd; border-radius: 4px;" />
            </div>
            <p>${footer}</p>
        </div>
    `;
    
    triggerPhysicalPrint(htmlContent);
}

// Print ticket/label physically via hidden iframe
function triggerPhysicalPrint(htmlContent) {
    const config = JSON.parse(localStorage.getItem('ag_printing_config')) || {};
    const profile = config.profile || 'virtual';
    
    if (profile === 'virtual') {
        console.log("Virtual printer mode. Skipping physical print.");
        return;
    }
    
    let printWidthStyle = 'width: 100%;';
    if (profile === 'thermal58') {
        printWidthStyle = 'width: 58mm; max-width: 58mm; padding: 2px;';
    } else if (profile === 'thermal80') {
        printWidthStyle = 'width: 80mm; max-width: 80mm; padding: 5px;';
    } else if (profile === 'standard') {
        printWidthStyle = 'width: 210mm; max-width: 210mm; padding: 20px;';
    }
    
    let iframe = document.getElementById('ag-print-iframe');
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'ag-print-iframe';
        iframe.style.position = 'absolute';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);
    }
    
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
        <html>
            <head>
                <title>Imprimir Cupom</title>
                <style>
                    @page {
                        margin: 0;
                    }
                    body {
                        margin: 0;
                        padding: 0;
                        background: #fff;
                        color: #000;
                        font-family: 'Courier New', Courier, monospace;
                        font-size: 12px;
                    }
                    .print-wrapper {
                        ${printWidthStyle}
                        margin: 0 auto;
                        box-sizing: border-box;
                    }
                    h3 { margin: 5px 0; font-size: 14px; text-align: center; }
                    p { margin: 3px 0; }
                    .receipt-row {
                        display: flex;
                        justify-content: space-between;
                        margin: 3px 0;
                    }
                    .receipt-divider {
                        border-top: 1px dashed #000;
                        margin: 8px 0;
                    }
                </style>
            </head>
            <body>
                <div class="print-wrapper">
                    ${htmlContent}
                </div>
                <script>
                    window.onload = function() {
                        window.print();
                    };
                </script>
            </body>
        </html>
    `);
    doc.close();
    showToast("Impressão enviada à fila do sistema.", "success");
}

// Print currently active preview receipt
function printActiveReceipt() {
    if (!currentActiveReceiptTicket || !currentActiveReceiptSpace) {
        showToast("Nenhum cupom ativo carregado para impressão.", "error");
        return;
    }
    
    const config = JSON.parse(localStorage.getItem('ag_printing_config')) || {};
    const header = config.headerText || 'AG PARKING';
    const footer = config.footerText || 'Guarde este cupom.';
    const ticket = currentActiveReceiptTicket;
    const space = currentActiveReceiptSpace;
    const typeNames = { 'Car': 'CARRO', 'Motorcycle': 'MOTO', 'Truck': 'UTILITARIO' };
    const modName = ticket.isMonthly ? 'MENSALISTA' : 'AVULSO';
    
    let detailHtml = '';
    if (ticket.exitTime) {
        let durText = '';
        const diffMs = new Date(ticket.exitTime) - new Date(ticket.entryTime);
        const mins = Math.max(0, Math.round(diffMs / 60000));
        durText = formatDurationMinutes(mins);
        
        detailHtml = `
            <p style="font-size: 11px; text-align: center; font-weight: bold; margin-top: 5px;">CUPOM FISCAL DE PAGAMENTO</p>
            <div class="receipt-divider"></div>
            <div class="receipt-row"><span>TICKET ID:</span><span>${ticket.ticketNumber}</span></div>
            <div class="receipt-row"><span>PLACA:</span><strong>${ticket.plate}</strong></div>
            <div class="receipt-row"><span>MODALIDADE:</span><span>${modName}</span></div>
            <div class="receipt-row"><span>CATEGORIA:</span><span>${typeNames[ticket.vehicleType]}</span></div>
            <div class="receipt-row"><span>VAGA OCUPADA:</span><span>${space ? space.code : '--'}</span></div>
            <div class="receipt-divider"></div>
            <div class="receipt-row"><span>ENTRADA:</span><span>${formatDate(ticket.entryTime)}</span></div>
            <div class="receipt-row"><span>SAIDA:</span><span>${formatDate(ticket.exitTime)}</span></div>
            <div class="receipt-row"><span>PERMANENCIA:</span><span>${durText}</span></div>
            <div class="receipt-row"><span>METODO PGTO:</span><span>${ticket.paymentMethod || 'Dinheiro'}</span></div>
            <div class="receipt-divider"></div>
            <div class="receipt-row"><span>PAGO TOTAL:</span><strong>R$ ${ticket.amountPaid.toFixed(2)}</strong></div>
        `;
    } else {
        detailHtml = `
            <p style="font-size: 11px; text-align: center; font-weight: bold; margin-top: 5px;">TICKET DE ENTRADA</p>
            <div class="receipt-divider"></div>
            <div class="receipt-row"><span>NUMERO:</span><span>${ticket.ticketNumber}</span></div>
            <div class="receipt-row"><span>PLACA:</span><strong>${ticket.plate}</strong></div>
            <div class="receipt-row"><span>MODALIDADE:</span><span>${modName}</span></div>
            <div class="receipt-row"><span>CATEGORIA:</span><span>${typeNames[ticket.vehicleType]}</span></div>
            <div class="receipt-row"><span>VAGA DESIGNADA:</span><strong>${space.code}</strong></div>
            <div class="receipt-divider"></div>
            <div class="receipt-row"><span>ENTRADA:</span><span>${formatDate(ticket.entryTime)}</span></div>
        `;
    }
    
    const htmlContent = `
        <div style="text-align: center; font-family: monospace; padding: 10px;">
            <h3>${header}</h3>
            <p>CNPJ: 12.345.678/0001-99</p>
            <p>AV. TECNOLOGIA, 2026 - BRAZIL</p>
            ${detailHtml}
            <div class="receipt-divider"></div>
            <div style="display: flex; flex-direction: column; align-items: center; margin: 10px 0; gap: 5px;">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(ticket.ticketNumber)}" alt="QR" style="width: 100px; height: 100px; background: #fff; padding: 4px; border: 1px solid #ddd; border-radius: 4px;" />
            </div>
            <div class="receipt-divider"></div>
            <p style="font-size: 9px; text-align: center; margin-top: 5px;">${footer}</p>
        </div>
    `;
    
    triggerPhysicalPrint(htmlContent);
}

// Redirect receipt to simulated WhatsApp Chatbot modal
function sendActiveReceiptWhatsApp() {
    if (!currentActiveReceiptTicket) {
        showToast("Nenhum cupom ativo carregado para envio.", "error");
        return;
    }
    openWhatsAppChatbot(currentActiveReceiptTicket.ticketNumber);
}

// Open simulated WhatsApp smartphone interface
function openWhatsAppChatbot(ticketNumber) {
    const ticket = tickets.find(t => t.ticketNumber === ticketNumber);
    if (!ticket) {
        showToast("Ticket não encontrado para envio.", "error");
        return;
    }
    
    chatbotActiveTicket = ticket;
    
    const modal = document.getElementById('whatsapp-chatbot-modal');
    if (modal) modal.classList.add('active');
    
    const phoneInput = document.getElementById('whatsapp-phone-input');
    if (phoneInput) phoneInput.value = '';
    
    const chatBody = document.getElementById('whatsapp-chat-body');
    if (chatBody) {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        chatBody.innerHTML = `
            <div class="whatsapp-bubble whatsapp-msg-in">
                Olá! Sou o assistente de notificações digitais do <strong>AG Parking</strong>. 🚗
                <br><br>
                Por favor, insira o número de telefone celular do cliente no campo abaixo e confirme para enviar o ticket digital.
                <span class="whatsapp-time">${timeStr}</span>
            </div>
        `;
    }
    
    const realLinkContainer = document.getElementById('whatsapp-real-link-container');
    if (realLinkContainer) realLinkContainer.style.display = 'none';
}

// Close WhatsApp modal
function closeWhatsAppModal() {
    const modal = document.getElementById('whatsapp-chatbot-modal');
    if (modal) modal.classList.remove('active');
    chatbotActiveTicket = null;
}

// Trigger simulated chat messages sequence
function sendWhatsAppSimulated() {
    const phoneInput = document.getElementById('whatsapp-phone-input');
    const phone = phoneInput.value.replace(/\D/g, '').trim();
    const chatBody = document.getElementById('whatsapp-chat-body');
    const ticket = chatbotActiveTicket;
    
    if (!phone || phone.length < 10) {
        showToast("Por favor, insira um número de telefone celular válido (DDD + 9 dígitos).", "error");
        return;
    }
    
    if (!ticket || !chatBody) return;
    
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // 1. Append User command message
    const userMsg = document.createElement('div');
    userMsg.className = 'whatsapp-bubble whatsapp-msg-out';
    userMsg.innerHTML = `
        Enviar ticket para: <strong>+55 ${phone}</strong>
        <span class="whatsapp-time">${timeStr}</span>
    `;
    chatBody.appendChild(userMsg);
    chatBody.scrollTop = chatBody.scrollHeight;
    
    // Clear field
    phoneInput.value = '';
    
    // 2. Timeout for typing...
    setTimeout(() => {
        const typingMsg = document.createElement('div');
        typingMsg.className = 'whatsapp-bubble whatsapp-msg-in';
        typingMsg.id = 'whatsapp-typing-indicator';
        typingMsg.innerHTML = `
            Enviando cupom digital... 🕒
            <span class="whatsapp-time">${timeStr}</span>
        `;
        chatBody.appendChild(typingMsg);
        chatBody.scrollTop = chatBody.scrollHeight;
    }, 1000);
    
    // 3. Deliver digital ticket message
    setTimeout(() => {
        // Remove typing indicator
        const indicator = document.getElementById('whatsapp-typing-indicator');
        if (indicator) indicator.remove();
        
        const typeNames = { 'Car': 'CARRO', 'Motorcycle': 'MOTO', 'Truck': 'UTILITARIO' };
        
        const ticketUrl = `${window.location.origin}/ticket.html?ticket=${encodeURIComponent(ticket.ticketNumber)}`;
        
        const successMsg = document.createElement('div');
        successMsg.className = 'whatsapp-bubble whatsapp-msg-in';
        successMsg.innerHTML = `
            O cupom digital foi disparado! Seguem os dados integrados do veículo:
            
            <div class="whatsapp-card">
                <div class="whatsapp-card-title">COMPROVANTE AG PARKING</div>
                <div><strong>Nº Ticket:</strong> ${ticket.ticketNumber}</div>
                <div><strong>Placa:</strong> ${ticket.plate}</div>
                <div><strong>Categoria:</strong> ${typeNames[ticket.vehicleType]}</div>
                <div><strong>Modalidade:</strong> ${ticket.isMonthly ? 'MENSALISTA' : 'AVULSO'}</div>
                <div><strong>Entrada:</strong> ${formatDate(ticket.entryTime)}</div>
                ${ticket.exitTime ? `<div><strong>Saída:</strong> ${formatDate(ticket.exitTime)}</div>` : ''}
                ${ticket.exitTime ? `<div><strong>Valor Pago:</strong> R$ ${ticket.amountPaid.toFixed(2)}</div>` : ''}
                <div style="display: flex; justify-content: center; margin-top: 10px;">
                    <a href="${ticketUrl}" target="_blank" title="Clique para ampliar">
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(ticket.ticketNumber)}" alt="QR Code" style="width: 80px; height: 80px; border-radius: 4px; background: white; padding: 3px;" />
                    </a>
                </div>
                <a href="${ticketUrl}" target="_blank" style="display: block; text-align: center; background: #25d366; color: #fff; text-decoration: none; padding: 8px 12px; border-radius: 8px; font-weight: 700; font-size: 12px; margin-top: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.15);">Visualizar Ticket Digital</a>
            </div>
            
            Obrigado e boa viagem! 🤝
            <span class="whatsapp-time">${timeStr}</span>
        `;
        chatBody.appendChild(successMsg);
        chatBody.scrollTop = chatBody.scrollHeight;
        
        showToast("Mensagem enviada com sucesso no simulador do WhatsApp!", "success");
        
        // Build actual redirect link to open real WhatsApp Web
        const text = `Olá! Segue o seu ticket digital do *AG Parking* 🚗\n\n*Ticket:* ${ticket.ticketNumber}\n*Placa:* ${ticket.plate}\n*Entrada:* ${new Date(ticket.entryTime).toLocaleString('pt-BR')}\n${ticket.exitTime ? `*Saída:* ${new Date(ticket.exitTime).toLocaleString('pt-BR')}\n*Pago:* R$ ${ticket.amountPaid.toFixed(2)}\n` : ''}\n*Acesse seu ticket digital com o QR Code para leitura na cancela:*\n${ticketUrl}\n\nObrigado por utilizar nossos serviços!`;
        const encodedText = encodeURIComponent(text);
        const url = `https://api.whatsapp.com/send?phone=55${phone}&text=${encodedText}`;
        
        const linkEl = document.getElementById('whatsapp-real-link');
        const linkContainer = document.getElementById('whatsapp-real-link-container');
        if (linkEl && linkContainer) {
            linkEl.href = url;
            linkContainer.style.display = 'block';
        }
    }, 2500);
}

// Generate beautiful corporate executive PDF report on A4 size
function generatePDFReport() {
    if (!tickets || tickets.length === 0) {
        showToast("Não há tickets no histórico para gerar relatórios.", "warning");
        return;
    }
    
    // Filter history based on UI active criteria if they exist
    let reportTickets = [...tickets];
    const searchVal = document.getElementById('history-search').value.toLowerCase().trim();
    const statusVal = document.getElementById('history-filter-status').value;
    const modVal = document.getElementById('history-filter-modality').value;
    const typeVal = document.getElementById('history-filter-type').value;
    
    if (searchVal) {
        reportTickets = reportTickets.filter(t => 
            t.plate.toLowerCase().includes(searchVal) || 
            t.ticketNumber.toLowerCase().includes(searchVal)
        );
    }
    if (statusVal === 'active') {
        reportTickets = reportTickets.filter(t => !t.isPaid);
    } else if (statusVal === 'paid') {
        reportTickets = reportTickets.filter(t => t.isPaid);
    }
    if (modVal === 'casual') {
        reportTickets = reportTickets.filter(t => !t.isMonthly);
    } else if (modVal === 'monthly') {
        reportTickets = reportTickets.filter(t => t.isMonthly);
    }
    if (typeVal !== 'all') {
        reportTickets = reportTickets.filter(t => t.vehicleType === typeVal);
    }
    
    // Consolidate values
    const totalCount = reportTickets.length;
    const paidTickets = reportTickets.filter(t => t.isPaid);
    const completedCount = paidTickets.length;
    const activeCount = totalCount - completedCount;
    
    const totalRevenue = paidTickets.reduce((sum, t) => sum + (t.amountPaid || 0), 0);
    
    const cars = reportTickets.filter(t => t.vehicleType === 'Car');
    const motos = reportTickets.filter(t => t.vehicleType === 'Motorcycle');
    const trucks = reportTickets.filter(t => t.vehicleType === 'Truck');
    
    const carsRevenue = cars.filter(t => t.isPaid).reduce((sum, t) => sum + t.amountPaid, 0);
    const motosRevenue = motos.filter(t => t.isPaid).reduce((sum, t) => sum + t.amountPaid, 0);
    const trucksRevenue = trucks.filter(t => t.isPaid).reduce((sum, t) => sum + t.amountPaid, 0);
    
    let avgMinutes = 0;
    if (completedCount > 0) {
        const totalMin = paidTickets.reduce((sum, t) => {
            const diffMs = new Date(t.exitTime) - new Date(t.entryTime);
            return sum + (diffMs / 60000);
        }, 0);
        avgMinutes = Math.round(totalMin / completedCount);
    }
    
    // Build report table HTML
    let tableRowsHtml = '';
    reportTickets.slice(0, 50).forEach(t => {
        const dateEnt = new Date(t.entryTime).toLocaleString('pt-BR');
        const dateExit = t.exitTime ? new Date(t.exitTime).toLocaleString('pt-BR') : 'Ativo';
        const typeNames = { 'Car': 'Carro', 'Motorcycle': 'Moto', 'Truck': 'Utilitário' };
        tableRowsHtml += `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; font-size: 11px;">${t.ticketNumber}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">${t.plate}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${t.isMonthly ? 'Mensalista' : 'Avulso'}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${typeNames[t.vehicleType]}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${dateEnt}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${dateExit}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold; text-align: right;">R$ ${(t.amountPaid || 0).toFixed(2)}</td>
            </tr>
        `;
    });
    
    if (totalCount > 50) {
        tableRowsHtml += `
            <tr>
                <td colspan="7" style="padding: 12px; text-align: center; color: #666; font-style: italic; font-size: 11px;">
                    Exibindo as primeiras 50 transações do filtro ativo de um total de ${totalCount} registros.
                </td>
            </tr>
        `;
    }
    
    // Open a new print window and inject beautifully structured PDF layout
    const printWindow = window.open('', '_blank');
    printWindow.document.open();
    printWindow.document.write(`
        <html>
            <head>
                <title>Relatorio Gerencial - AG Parking</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        color: #333;
                        padding: 30px;
                        margin: 0;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 3px solid #075e54;
                        padding-bottom: 15px;
                        margin-bottom: 30px;
                    }
                    .header h1 {
                        margin: 0;
                        font-size: 24px;
                        color: #075e54;
                    }
                    .header p {
                        margin: 3px 0;
                        font-size: 12px;
                        color: #666;
                    }
                    .kpi-row {
                        display: flex;
                        gap: 20px;
                        margin-bottom: 30px;
                    }
                    .kpi-card {
                        flex: 1;
                        background: #f8f9fa;
                        border: 1px solid #e9ecef;
                        padding: 15px;
                        border-radius: 8px;
                        text-align: center;
                    }
                    .kpi-val {
                        font-size: 22px;
                        font-weight: bold;
                        color: #075e54;
                        margin-top: 5px;
                    }
                    .kpi-lbl {
                        font-size: 11px;
                        color: #6c757d;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .section-title {
                        font-size: 16px;
                        font-weight: bold;
                        border-left: 4px solid #075e54;
                        padding-left: 10px;
                        margin: 25px 0 15px 0;
                        color: #333;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 25px;
                    }
                    th {
                        background: #f1f3f5;
                        padding: 10px;
                        text-align: left;
                        font-size: 12px;
                        border-bottom: 2px solid #dee2e6;
                    }
                    td {
                        font-size: 12px;
                    }
                    .footer {
                        margin-top: 50px;
                        border-top: 1px solid #dee2e6;
                        padding-top: 15px;
                        text-align: center;
                        font-size: 10px;
                        color: #999;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <h1>AG PARKING</h1>
                        <p>Sistema Inteligente de Estacionamento</p>
                    </div>
                    <div style="text-align: right;">
                        <h3>RELATÓRIO GERENCIAL</h3>
                        <p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
                    </div>
                </div>
                
                <div class="kpi-row">
                    <div class="kpi-card">
                        <div class="kpi-lbl">Receita Consolidada</div>
                        <div class="kpi-val">R$ ${totalRevenue.toFixed(2)}</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-lbl">Estadias Finalizadas</div>
                        <div class="kpi-val">${completedCount}</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-lbl">Veículos Ativos</div>
                        <div class="kpi-val">${activeCount}</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-lbl">Permanência Média</div>
                        <div class="kpi-val">${avgMinutes} min</div>
                    </div>
                </div>
                
                <div class="section-title">Resumo Financeiro por Categoria</div>
                <table>
                    <thead>
                        <tr>
                            <th>Categoria</th>
                            <th>Total de Veículos</th>
                            <th>Percentual</th>
                            <th style="text-align: right;">Receita Acumulada</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">Setor A - Carros</td>
                            <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${cars.length}</td>
                            <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${totalCount > 0 ? Math.round((cars.length / totalCount) * 100) : 0}%</td>
                            <td style="padding: 10px; border-bottom: 1px solid #dee2e6; font-weight: bold; text-align: right;">R$ ${carsRevenue.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">Setor B - Motos</td>
                            <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${motos.length}</td>
                            <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${totalCount > 0 ? Math.round((motos.length / totalCount) * 100) : 0}%</td>
                            <td style="padding: 10px; border-bottom: 1px solid #dee2e6; font-weight: bold; text-align: right;">R$ ${motosRevenue.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">Setor C - Utilitários</td>
                            <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${trucks.length}</td>
                            <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${totalCount > 0 ? Math.round((trucks.length / totalCount) * 100) : 0}%</td>
                            <td style="padding: 10px; border-bottom: 1px solid #dee2e6; font-weight: bold; text-align: right;">R$ ${trucksRevenue.toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>
                
                <div class="section-title">Detalhamento das Estadias Recentes</div>
                <table>
                    <thead>
                        <tr>
                            <th>Ticket</th>
                            <th>Placa</th>
                            <th>Modalidade</th>
                            <th>Categoria</th>
                            <th>Entrada</th>
                            <th>Saída</th>
                            <th style="text-align: right;">Valor Pago</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml}
                    </tbody>
                </table>
                
                <div class="footer">
                    Relatório Administrativo Oficial - AG Parking. Todos os direitos reservados.
                </div>
                
                <script>
                    window.onload = function() {
                        window.print();
                    };
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
    showToast("Relatório gerencial gerado. Abra o painel de impressão.", "success");
}

function viewTicketReceiptFromHistory(ticketNumber) {
    const ticket = tickets.find(t => t.ticketNumber === ticketNumber);
    if (!ticket) return;
    
    // Switch to gate view where the receipt panel is
    switchView('gate');
    
    // Render the receipt on the right panel
    const space = parkingSpaces.find(s => s.id === ticket.parkingSpaceId);
    if (ticket.isPaid) {
        renderPaidReceipt(ticket, space);
    } else {
        renderTicketReceipt(ticket, space);
    }
    
    showToast(`Mostrando comprovante do ticket ${ticketNumber}`, "info");
}

function reprintTicketFromHistory(ticketNumber) {
    const ticket = tickets.find(t => t.ticketNumber === ticketNumber);
    if (!ticket) {
        showToast("Ticket não localizado.", "error");
        return;
    }
    
    // Switch active receipt references temporarily
    const oldActiveTicket = currentActiveReceiptTicket;
    const oldActiveSpace = currentActiveReceiptSpace;
    
    currentActiveReceiptTicket = ticket;
    currentActiveReceiptSpace = parkingSpaces.find(s => s.id === ticket.parkingSpaceId);
    
    // Trigger print
    printActiveReceipt();
    
    // Restore previous active references
    currentActiveReceiptTicket = oldActiveTicket;
    currentActiveReceiptSpace = oldActiveSpace;
    
    showToast(`Reimpressão enviada para o ticket ${ticketNumber}`, "success");
}

