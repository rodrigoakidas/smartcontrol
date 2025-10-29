// --- MÓDULO DE LINHAS (LINES.JS) ---

import { state, updateState, fetchData } from '../app.js';
import { openModal, closeModal, showToast, formatDateForInput } from './ui.js';
import { API_URL } from './api.js';
import { refreshDashboard } from './dashboard.js';

function renderLineTable(lineTableBody, noLinesMessage, linesToRender = state.lines) {
    if (!lineTableBody || !noLinesMessage) return;
    lineTableBody.innerHTML = '';

    if (!linesToRender || linesToRender.length === 0) {
        noLinesMessage.classList.remove('hidden');
        return;
    }
    noLinesMessage.classList.add('hidden');
    const rowsHtml = linesToRender.map(line => {
        const statusClass = { 'Ativa': 'bg-green-100 text-green-800', 'Inativa': 'bg-yellow-100 text-yellow-800', 'Cancelada': 'bg-red-100 text-red-800' }[line.status] || 'bg-gray-100';
        return `
            <tr class="border-b">
                <td class="p-3">${line.numero}</td>
                <td class="p-3">${line.operadora}</td>
                <td class="p-3"><span class="px-2 py-1 text-xs font-medium rounded-full ${statusClass}">${line.status}</span></td>
                <td class="p-3">${line.imeiVinculado || '---'}</td>
                <td class="p-3 text-center space-x-1">
                    <button data-action="associate-line" data-id="${line.id}" data-number="${line.numero}" class="text-green-600 p-2" title="Criar Termo de Uso de Linha"><i data-lucide="user-plus"></i></button>
                    <button data-action="history-line" data-id="${line.id}" class="text-blue-600 p-2" title="Histórico de Vinculação"><i data-lucide="history"></i></button>
                    <button data-action="edit-line" data-id="${line.id}" class="text-gray-600 p-2" title="Editar"><i data-lucide="edit"></i></button>
                    <button data-action="delete-line" data-id="${line.id}" class="text-red-600 p-2" title="Excluir"><i data-lucide="trash-2"></i></button>
                </td>
            </tr>`;
    }).join('');

    lineTableBody.innerHTML = rowsHtml;
    if (window.lucide) lucide.createIcons();
}

function openLineForm(lineForm, lineFormModal, lineId = null) {
    lineForm.reset();
    const numberInput = document.getElementById('lineFormNumber');
    document.getElementById('line-id-input').value = lineId || '';
    if (lineId) {
        const line = state.lines.find(l => l.id === lineId);
        document.getElementById('line-modal-title').textContent = "Editar Linha";
        numberInput.value = line.numero;
        numberInput.readOnly = true;
        document.getElementById('lineFormCarrier').value = line.operadora;
        document.getElementById('lineFormPlan').value = line.plano || '';
        document.getElementById('lineFormStatus').value = line.status;
    } else {
        document.getElementById('line-modal-title').textContent = "Nova Linha";
        numberInput.readOnly = false;
    }
    openModal(lineFormModal);
}

async function showLineHistory(lineHistoryModal, lineId) {
    const line = state.lines.find(l => l.id === lineId);
    if (!line) return;

    document.getElementById('history-line-number').textContent = `${line.numero} (${line.operadora})`;
    const tbody = document.getElementById('line-history-table-body');
    const noHistoryMsg = document.getElementById('no-line-history-message');
    tbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center">A carregar...</td></tr>';
    openModal(lineHistoryModal);
    
    try {
        const response = await fetch(`${API_URL}/api/lines/${lineId}/history`);
        const historyData = await response.json();
        tbody.innerHTML = '';
        if (historyData && historyData.length > 0) {
            noHistoryMsg.classList.add('hidden');
            historyData.forEach(h => {
               tbody.innerHTML += `
    <tr class="border-b">
        <td class="p-3">${h.aparelho_imei}</td>
        <td class="p-3">${formatDateForInput(h.data_vinculacao)}</td>
        <td class="p-3">${h.data_desvinculacao ? formatDateForInput(h.data_desvinculacao) : 'Atualmente vinculado'}</td>
    </tr>`;
            });
        } else {
            noHistoryMsg.classList.remove('hidden');
        }
    } catch(error) {
        console.error("Erro ao buscar histórico da linha:", error);
        tbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-red-500">Erro ao carregar.</td></tr>';
    }
}

export function initLinesModule() {
    const lineListModal = document.getElementById('line-list-modal');
    const lineFormModal = document.getElementById('line-form-modal');
    const lineHistoryModal = document.getElementById('line-history-modal');
    const lineForm = document.getElementById('line-form');
    const lineTableBody = document.getElementById('line-table-body');
    const noLinesMessage = document.getElementById('no-lines-message');
    const lineExportBtn = document.getElementById('line-export-btn');
    const manageLinesBtn = document.getElementById('manage-lines-btn');
    const closeLineListBtn = document.getElementById('close-line-list-btn');
    const cancelLineFormBtn = document.getElementById('cancel-line-form-btn');
    const closeLineHistoryBtn = document.getElementById('close-line-history-modal-btn');
    const addLineBtn = document.getElementById('add-line-btn');
    const lineSearchInput = document.getElementById('line-search-input');
    const lineImportInput = document.getElementById('line-import-input');

    
    if (manageLinesBtn) {
        manageLinesBtn.addEventListener('click', () => { 
            renderLineTable(lineTableBody, noLinesMessage); 
            if (lineSearchInput) lineSearchInput.value = '';
            openModal(lineListModal); 
        });
    }

    if (closeLineListBtn) closeLineListBtn.addEventListener('click', () => closeModal(lineListModal));
    if (cancelLineFormBtn) cancelLineFormBtn.addEventListener('click', () => closeModal(lineFormModal));
    if (closeLineHistoryBtn) closeLineHistoryBtn.addEventListener('click', () => closeModal(lineHistoryModal));
    if (addLineBtn) addLineBtn.addEventListener('click', () => openLineForm(lineForm, lineFormModal));

    if (lineForm) {
        lineForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const lineId = document.getElementById('line-id-input').value;
            const isEditing = !!lineId;
            const data = {
                numero: document.getElementById('lineFormNumber').value,
                operadora: document.getElementById('lineFormCarrier').value,
                plano: document.getElementById('lineFormPlan').value,
                status: document.getElementById('lineFormStatus').value,
                currentUser: state.currentUser
            };
            const url = isEditing ? `${API_URL}/api/lines/${lineId}` : `${API_URL}/api/lines/`;
            const method = isEditing ? 'PUT' : 'POST';
            try {
                const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                const result = await res.json();
                if (!res.ok) throw new Error(result.message);
                showToast(result.message);

                // Otimização: Recarrega apenas os dados de linhas e o dashboard.
                const updatedLines = await fetchData('lines');
                updateState({ lines: updatedLines });
                await refreshDashboard();
                closeModal(lineFormModal);
                renderLineTable(lineTableBody, noLinesMessage, updatedLines);
            } catch (error) {
                showToast(`Erro: ${error.message}`, true);
            }
        });
    }

    if (lineTableBody) {
        lineTableBody.addEventListener('click', async (e) => {
            const button = e.target.closest('button[data-action]');
            if (!button) return;
            const lineId = parseInt(button.dataset.id);
            const action = button.dataset.action;

            if (action === 'associate-line') {
                const lineNumber = button.dataset.number;
                openLineTermForm(lineId, lineNumber);
            } else if (action === 'edit-line') {
                openLineForm(lineForm, lineFormModal, lineId);
            } else if (action === 'delete-line') {
                if (!confirm('Tem certeza que deseja excluir esta linha?')) return;
                try {
                    const res = await fetch(`${API_URL}/api/lines/${lineId}`, { 
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ currentUser: state.currentUser })
                    });
                    const result = await res.json();
                    if (!res.ok) throw new Error(result.message);
                    showToast(result.message);

                    // Otimização
                    const updatedLines = await fetchData('lines');
                    updateState({ lines: updatedLines });
                    await refreshDashboard();
                    renderLineTable(lineTableBody, noLinesMessage, updatedLines);
                } catch (error) {
                    showToast(`Erro: ${error.message}`, true);
                }
            } else if (action === 'history-line') {
                showLineHistory(lineHistoryModal, lineId);
            }
        });
    }

    if (lineSearchInput) {
        lineSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            const filteredLines = state.lines.filter(line =>
                line.numero.toLowerCase().includes(searchTerm) ||
                line.operadora.toLowerCase().includes(searchTerm)
            );
            renderLineTable(lineTableBody, noLinesMessage, filteredLines);
        });
    }
    
    if (lineExportBtn) {
        lineExportBtn.addEventListener('click', () => {
             if (!state.lines || state.lines.length === 0) {
                showToast('Nenhuma linha para exportar.', true);
                return;
            }
            const header = 'Numero,Operadora,Plano,Status,IMEI Vinculado\n';
            const csvContent = state.lines.map(line => {
                return `${line.numero},${line.operadora},${line.plano || ''},${line.status},${line.imeiVinculado || ''}`;
            }).join('\n');
            
            const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `linhas_${new Date().toISOString().slice(0, 10)}.csv`;
            link.click();
            URL.revokeObjectURL(link.href);
        });
    }
    
    if (lineImportInput) {
        lineImportInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            showToast('A importar ficheiro de linhas...');
            const formData = new FormData();
            formData.append('file', file);
            formData.append('currentUser', JSON.stringify(state.currentUser));

            try {
                const res = await fetch(`${API_URL}/api/lines/import`, {
                    method: 'POST',
                    body: formData,
                });

                const result = await res.json();
                if (!res.ok) throw new Error(result.message);

                showToast(result.message, false);
                if (result.failures && result.failures.length > 0) {
                    console.warn("Falhas na importação de linhas:", result.failures);
                    showToast(`${result.failures.length} linhas não puderam ser importadas. Verifique a consola.`, true);
                }

                await fetchAllData();
                
                const searchTerm = lineSearchInput ? lineSearchInput.value.toLowerCase().trim() : '';
                if (searchTerm) {
                    const filteredLines = state.lines.filter(line =>
                        line.numero.toLowerCase().includes(searchTerm) ||
                        line.operadora.toLowerCase().includes(searchTerm)
                    );
                    renderLineTable(lineTableBody, noLinesMessage, filteredLines);
                } else {
                    renderLineTable(lineTableBody, noLinesMessage, state.lines);
                }

            } catch (error) {
                showToast(`Erro na importação: ${error.message}`, true);
            } finally {
                e.target.value = '';
            }
        });
    }

}
