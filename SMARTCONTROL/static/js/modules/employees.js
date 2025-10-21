// --- MÓDULO DE FUNCIONÁRIOS (EMPLOYEES.JS) ---

import { state, fetchAllData } from '../app.js';
import { openModal, closeModal, showToast } from './ui.js';
import { API_URL } from './api.js';

function renderEmployeeTable(employeeTableBody, noEmployeesMessage, employeesToRender = state.employees) {
    employeeTableBody.innerHTML = '';
    if (!employeesToRender || employeesToRender.length === 0) {
        noEmployeesMessage.classList.remove('hidden');
        return;
    }
    noEmployeesMessage.classList.add('hidden');
    
    employeesToRender.forEach(employee => {
        employeeTableBody.innerHTML += `
            <tr class="border-b">
                <td class="p-3">${employee.name}</td>
                <td class="p-3">${employee.id}</td>
                <td class="p-3">${employee.position}</td>
                <td class="p-3 text-center space-x-1">
                    <button data-action="history-employee" data-id="${employee.id}" class="text-blue-600 p-2" title="Histórico de Aparelhos"><i data-lucide="history"></i></button>
                    <button data-action="edit-employee" data-id="${employee.id}" class="text-gray-600 p-2" title="Editar"><i data-lucide="edit"></i></button>
                    <button data-action="delete-employee" data-id="${employee.id}" class="text-red-600 p-2" title="Excluir"><i data-lucide="trash-2"></i></button>
                </td>
            </tr>`;
    });
    if (window.lucide) lucide.createIcons();
}

function openEmployeeForm(employeeForm, employeeFormModal, employeeId = null) {
    employeeForm.reset();
    document.getElementById('employee-id-input').value = employeeId || '';
    const matriculaInput = document.getElementById('employeeFormId');

    if (employeeId) {
        const employee = state.employees.find(e => e.id === employeeId);
        document.getElementById('employee-modal-title').textContent = "Editar Funcionário";
        document.getElementById('employeeFormName').value = employee.name;
        matriculaInput.value = employee.id;
        document.getElementById('employeeFormPosition').value = employee.position;
        document.getElementById('employeeFormEmail').value = employee.email || '';
        matriculaInput.readOnly = true;
    } else {
        document.getElementById('employee-modal-title').textContent = "Novo Funcionário";
        matriculaInput.readOnly = false;
    }
    openModal(employeeFormModal);
}

async function showEmployeeHistory(employeeHistoryModal, matricula) {
    const employee = state.employees.find(e => e.id === matricula);
    if (!employee) return;

    document.getElementById('history-employee-name').textContent = `${employee.name} (Matrícula: ${employee.id})`;
    const tbody = document.getElementById('employee-history-table-body');
    const noHistoryMessage = document.getElementById('no-history-message');
    tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center">A carregar histórico...</td></tr>';
    openModal(employeeHistoryModal);

    try {
        const response = await fetch(`${API_URL}/api/employees/${matricula}/history`);
        const historyRecords = await response.json();
        
        tbody.innerHTML = '';
        if (historyRecords.length === 0) {
            noHistoryMessage.classList.remove('hidden');
        } else {
            noHistoryMessage.classList.add('hidden');
            historyRecords.forEach(r => {
                const statusClass = r.status === 'Devolvido' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800';
                tbody.innerHTML += `
    <tr class="border-b">
        <td class="p-3">${r.deviceModel} / ${r.deviceImei}</td>
        <td class="p-3">${new Date(r.deliveryDate + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
        <td class="p-3">${r.returnDate ? new Date(r.returnDate + 'T00:00:00').toLocaleDateString('pt-BR') : '---'}</td>
        <td class="p-3"><span class="px-2 py-1 text-xs font-medium rounded-full ${statusClass}">${r.status}</span></td>
    </tr>`;
            });
        }
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">Falha ao carregar histórico.</td></tr>`;
    }
}

export function initEmployeesModule() {
    const employeeListModal = document.getElementById('employee-list-modal');
    const employeeFormModal = document.getElementById('employee-form-modal');
    const employeeHistoryModal = document.getElementById('employee-history-modal');
    const employeeTableBody = document.getElementById('employee-table-body');
    const employeeForm = document.getElementById('employee-form');
    const noEmployeesMessage = document.getElementById('no-employees-message');
    const manageEmployeesBtn = document.getElementById('manage-employees-btn');
    const addEmployeeBtn = document.getElementById('add-employee-btn');
    const cancelEmployeeFormBtn = document.getElementById('cancel-employee-form-btn');
    const closeHistoryModalBtn = document.getElementById('close-history-modal-btn');
    const employeeSearchInput = document.getElementById('employee-search-input');
    const employeeExportBtn = document.getElementById('employee-export-btn');
    const employeeImportInput = document.getElementById('employee-import-input');

    if (manageEmployeesBtn) {
        manageEmployeesBtn.addEventListener('click', () => {
            renderEmployeeTable(employeeTableBody, noEmployeesMessage);
            if(employeeSearchInput) employeeSearchInput.value = '';
            openModal(employeeListModal);
        });
    }
    
    if (cancelEmployeeFormBtn) cancelEmployeeFormBtn.addEventListener('click', () => closeModal(employeeFormModal));
    if (closeHistoryModalBtn) closeHistoryModalBtn.addEventListener('click', () => closeModal(employeeHistoryModal));
    if (addEmployeeBtn) addEmployeeBtn.addEventListener('click', () => openEmployeeForm(employeeForm, employeeFormModal));

    if (employeeForm) {
        employeeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const matricula = document.getElementById('employeeFormId').value;
            const isEditing = !!document.getElementById('employee-id-input').value;
            
            const employeeData = {
                name: document.getElementById('employeeFormName').value,
                position: document.getElementById('employeeFormPosition').value,
                email: document.getElementById('employeeFormEmail').value,
                currentUser: state.currentUser
            };
            if (!isEditing) {
                employeeData.id = matricula;
            }

            const url = isEditing ? `${API_URL}/api/employees/${matricula}` : `${API_URL}/api/employees/`;
            const method = isEditing ? 'PUT' : 'POST';

            try {
                const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(employeeData) });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message);
                
                showToast(result.message);
                await fetchAllData();
                renderEmployeeTable(employeeTableBody, noEmployeesMessage);
                closeModal(employeeFormModal);
            } catch (error) {
                showToast(`Erro: ${error.message}`, true);
            }
        });
    }

    if (employeeTableBody) {
        employeeTableBody.addEventListener('click', async (e) => {
            const button = e.target.closest('button[data-action]');
            if (!button) return;
            const matricula = button.dataset.id;
            const action = button.dataset.action;

            if (action === 'edit-employee') {
                openEmployeeForm(employeeForm, employeeFormModal, matricula);
            } else if (action === 'delete-employee') {
                if (!confirm(`Tem certeza que deseja excluir o funcionário de matrícula ${matricula}?`)) return;
                try {
                    const response = await fetch(`${API_URL}/api/employees/${matricula}`, { 
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ currentUser: state.currentUser })
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.message);
                    showToast(result.message);
                    await fetchAllData();
                    renderEmployeeTable(employeeTableBody, noEmployeesMessage);
                } catch (error) {
                    showToast(`Erro: ${error.message}`, true);
                }
            } else if (action === 'history-employee') {
                showEmployeeHistory(employeeHistoryModal, matricula);
            }
        });
    }
    
    if (employeeSearchInput) {
        employeeSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            const filteredEmployees = state.employees.filter(employee =>
                employee.name.toLowerCase().includes(searchTerm) ||
                String(employee.id).toLowerCase().includes(searchTerm)
            );
            renderEmployeeTable(employeeTableBody, noEmployeesMessage, filteredEmployees);
        });
    }
    
    if (employeeExportBtn) {
        employeeExportBtn.addEventListener('click', () => {
            if (!state.employees || state.employees.length === 0) {
                showToast('Nenhum funcionário para exportar.', true);
                return;
            }
            const header = 'Matricula,Nome,Cargo,E-mail\n';
            const csvContent = state.employees.map(emp => {
                const name = `"${(emp.name || '').replace(/"/g, '""')}"`;
                const position = `"${(emp.position || '').replace(/"/g, '""')}"`;
                return `${emp.id},${name},${position},${emp.email || ''}`;
            }).join('\n');
            
            const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `funcionarios_${new Date().toISOString().slice(0, 10)}.csv`;
            link.click();
            URL.revokeObjectURL(link.href);
        });
    }

    // --- LÓGICA DE IMPORTAÇÃO DE CSV ATIVADA ---
    if (employeeImportInput) {
        employeeImportInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            showToast('A importar ficheiro...');
            const formData = new FormData();
            formData.append('file', file);
            formData.append('currentUser', JSON.stringify(state.currentUser)); // Envia os dados do utilizador

            try {
                const res = await fetch(`${API_URL}/api/employees/import`, {
                    method: 'POST',
                    body: formData,
                });

                const result = await res.json();
                if (!res.ok) throw new Error(result.message);

                showToast(result.message, false);
                if (result.failures && result.failures.length > 0) {
                    console.warn("Falhas na importação:", result.failures);
                    showToast(`${result.failures.length} registos não puderam ser importados. Verifique a consola.`, true);
                }

                await fetchAllData();
                renderEmployeeTable(employeeTableBody, noEmployeesMessage);
            } catch (error) {
                showToast(`Erro na importação: ${error.message}`, true);
            } finally {
                // Limpa o input para permitir a seleção do mesmo ficheiro novamente
                e.target.value = '';
            }
        });
    }

}
