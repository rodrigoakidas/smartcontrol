// --- MÓDULO PRINCIPAL DA APLICAÇÃO (APP.JS) ---

import { showToast, closeModal as closeModalFromUI } from './modules/ui.js';
export { fetchData } from './modules/api.js'; // Re-exporta para outros módulos usarem
import { initAuthModule } from './modules/auth.js';
import { initCompanyModule } from './modules/company.js';
import { initEmployeesModule } from './modules/employees.js';
import { initDevicesModule } from './modules/devices.js';
import { initLinesModule } from './modules/lines.js';
import { initUsersModule } from './modules/users.js';
import { initReportsModule } from './modules/reports.js';
import { initMaintenanceModule } from './modules/maintenance.js';
import { initRecordsModule } from './modules/records.js';
import { initDashboard } from './modules/dashboard.js';
import { initLineRecordsModule } from './modules/line_records.js';

export let state = {
    records: [],
    employees: [],
    devices: [],
    lines: [],
    maintenance: [],
    users: [],
    companyInfo: {},
    currentUser: null,
    mainTable: {
        filter: 'Todos',
        sortColumn: 'deliveryDate',
        sortDirection: 'desc',
        currentPage: 1,
        totalRecords: 0,
        recordsPerPage: 10
    }
};

let modulesInitialized = false; // Flag para controlar a inicialização

function initializeAllModules() {
    // --- CORREÇÃO: Verificar a flag ANTES de fazer qualquer coisa ---
    if (modulesInitialized) {
        // console.log("Módulos já inicializados, ignorando."); // Log opcional para depuração
        return;
    }
    // --- FIM DA CORREÇÃO ---

    console.log("✅ Inicializando todos os módulos da aplicação..."); // Log agora só executa uma vez
    initDashboard();
    initCompanyModule();
    initEmployeesModule();
    initDevicesModule();
    initLinesModule();
    initUsersModule();
    initReportsModule();
    initMaintenanceModule();
    initRecordsModule();
    initLineRecordsModule();
    modulesInitialized = true; // Marca como inicializado
}

export function updateState(newState) {
    state = { ...state, ...newState };
}

function displayCompanyInfoOnHeader() {
    const { nome, cnpj, logo } = state.companyInfo;
    const headerName = document.getElementById('header-company-name');
    const headerCnpj = document.getElementById('header-company-cnpj');
    const logoEl = document.getElementById('header-logo');

    if (headerName) headerName.textContent = nome || 'Controle de Ativos Móveis';
    if (headerCnpj) headerCnpj.textContent = cnpj ? `CNPJ: ${cnpj}` : 'Gerenciamento';

    if (logoEl) {
        if (logo) {
            logoEl.src = `data:image/png;base64,${logo}`;
            logoEl.classList.remove('hidden');
        } else {
            logoEl.classList.add('hidden');
        }
    }
}


function applyPermissions() {
    const user = state.currentUser;
    if (!user) return;

    const isAdmin = user.role === 'administrador';

    document.querySelectorAll('[data-permission]').forEach(el => {
        const p = el.dataset.permission;
        const hasPermission = isAdmin || (user.permissoes && user.permissoes[p]);
        el.disabled = !hasPermission;
        el.title = hasPermission ? "" : "Você não tem permissão para esta ação.";
        el.classList.toggle('disabled-module', !hasPermission);
    });

    const companyBtn = document.getElementById('company-info-btn');
    if (companyBtn) {
        companyBtn.disabled = !isAdmin;
        companyBtn.title = isAdmin ? "" : "Apenas administradores podem aceder.";
        companyBtn.classList.toggle('disabled-module', !isAdmin);
    }
}

export async function fetchAllData() {
    showToast("A carregar dados do servidor...");
    try {
        const [employees, devices, lines, users, maintenance, companyInfo] = await Promise.all([
            fetchData('employees'), fetchData('devices'),
            fetchData('lines'), fetchData('users'), fetchData('maintenance'), fetchData('company')
        ]);

        updateState({ employees, devices, lines, users, maintenance, companyInfo: companyInfo || {} });

        displayCompanyInfoOnHeader(); // Atualiza o cabeçalho com os dados da empresa
        showToast("Dados carregados com sucesso!");

    } catch (error) {
        console.error("Erro fatal ao carregar dados:", error);
        showToast("Erro fatal ao carregar dados. Verifique a consola.", true);
    }
}

export async function initializeApp() {
    const userStr = sessionStorage.getItem('currentUser');
    const loginScreen = document.getElementById('login-screen');
    const appContent = document.getElementById('app-content');

    if (userStr) {
        updateState({ currentUser: JSON.parse(userStr) });
        const loggedInUserEl = document.getElementById('logged-in-user');
        if (loggedInUserEl) loggedInUserEl.textContent = state.currentUser.nome;

        if (loginScreen) loginScreen.classList.add('hidden');
        if (appContent) appContent.classList.remove('hidden');

        // --- CORREÇÃO: Inicializar módulos AQUI e apenas UMA VEZ ---
        // Garante que os módulos são inicializados apenas após o login ser confirmado
        // e que isso só acontece uma vez por carregamento de página.
        if (!modulesInitialized) {
            initializeAllModules();
        }
        // --- FIM DA CORREÇÃO ---

        applyPermissions();
        await fetchAllData(); // Carrega os dados após garantir que os módulos estão prontos
    } else {
        if (loginScreen) loginScreen.classList.remove('hidden');
        if (appContent) appContent.classList.add('hidden');
        // Não inicializa os módulos principais se não estiver logado
    }

    // Inicializa ícones independentemente do login
    if (window.lucide) {
        lucide.createIcons();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initAuthModule(); // O módulo de autenticação precisa sempre ser inicializado primeiro
    // --- CORREÇÃO: REMOVIDA a chamada a initializeAllModules() daqui ---
    // A função initializeApp agora decide se e quando inicializar o resto dos módulos.
    initializeApp();
});

// Função global para fechar modais (mantida)
window.handleCloseModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        closeModalFromUI(modal);
    } else {
        console.error(`Modal com ID "${modalId}" não foi encontrado.`);
    }
}