import { API_URL, fetchData } from './api.js';

// Variáveis para guardar as instâncias dos gráficos
let deviceStatusChart = null;
let deviceConditionChart = null;

// Função para renderizar os cartões
function renderStatsCards(stats) {
    document.getElementById('stats-total-devices').textContent = stats.totalDevices || 0;
    document.getElementById('stats-in-use-devices').textContent = stats.inUseDevices || 0;
    document.getElementById('stats-maintenance-devices').textContent = stats.maintenanceDevices || 0;
    document.getElementById('stats-total-employees').textContent = stats.totalEmployees || 0;
    if(window.lucide) lucide.createIcons();
}

// Função para renderizar o gráfico de status
function renderDeviceStatusChart(summary) {
    const ctx = document.getElementById('deviceStatusChart').getContext('2d');
    const labels = Object.keys(summary);
    const data = Object.values(summary);

    if (deviceStatusChart) {
        deviceStatusChart.destroy(); // Destrói o gráfico anterior para evitar sobreposição
    }

    deviceStatusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Status dos Aparelhos',
                data: data,
                backgroundColor: [
                    'rgba(59, 130, 246, 0.8)', // Azul para 'Em Uso'
                    'rgba(16, 185, 129, 0.8)', // Verde para 'Disponível'
                    'rgba(249, 115, 22, 0.8)'  // Laranja para 'Indisponível'
                ],
                borderColor: '#fff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                }
            }
        }
    });
}

// Função para renderizar o gráfico de condição
function renderDeviceConditionChart(conditions) {
    const ctx = document.getElementById('deviceConditionChart').getContext('2d');
    const labels = conditions.map(c => c.condicao);
    const data = conditions.map(c => c.count);
    
    if (deviceConditionChart) {
        deviceConditionChart.destroy();
    }

    deviceConditionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Nº de Aparelhos',
                data: data,
                backgroundColor: 'rgba(79, 70, 229, 0.8)', // Indigo
                borderColor: 'rgba(79, 70, 229, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

export async function initDashboard() {
    console.log("📊 Inicializando o Dashboard...");
    try {
        const stats = await fetchData('dashboard/stats');
        if (stats) {
            renderStatsCards(stats);
            renderDeviceStatusChart(stats.deviceStatusSummary);
            renderDeviceConditionChart(stats.devicesByCondition);
        }
    } catch (error) {
        console.error("Erro ao carregar dados do dashboard:", error);
    }
}