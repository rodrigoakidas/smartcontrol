// SMARTCONTROL/static/js/modules/records_table.js

import { state, updateState } from '../app.js';
import { showToast, setLoading, unsetLoading } from './ui.js';
import { API_URL } from './api.js';
import { openRecordForm } from './records_form.js';
import { printSingleRecord } from './records.js'; // printSingleRecord is still in records.js

// Busca dados E renderiza a tabela para uma página específica
export async function fetchRecordsPage(page) {
    const { recordsPerPage, filter, sortColumn, sortDirection } = state.mainTable;
    try {
        const data = await fetch(`${API_URL}/api/records?page=${page}&limit=${recordsPerPage}&filter=${filter}&sort_column=${sortColumn}&sort_direction=${sortDirection}`).then(res => res.json());
        updateState({
            mainTable: { ...state.mainTable, currentPage: page, totalRecords: data.total },
            records: data.records
        });
        renderMainTable();
    } catch (error) {
        showToast("Erro ao carregar movimentações.", true);
        console.error("Falha ao buscar registros:", error);
        const recordsTableBody = document.getElementById('records-table-body');
        if (recordsTableBody) recordsTableBody.innerHTML = '';
        renderPaginationControls();
    }
}

// Renderiza APENAS os controlos de paginação com base no state atual
function renderPaginationControls() {
    const { currentPage, totalRecords, recordsPerPage } = state.mainTable;
    const totalPages = Math.ceil(totalRecords / recordsPerPage);
    const infoEl = document.getElementById('pagination-info');
    const buttonsEl = document.getElementById('pagination-buttons');

    if (!infoEl || !buttonsEl) return;

    if (totalRecords === 0) {
        infoEl.innerHTML = 'Nenhum registo encontrado.';
        buttonsEl.innerHTML = '';
        return;
    }

    const startRecord = (currentPage - 1) * recordsPerPage + 1;
    const endRecord = Math.min(currentPage * recordsPerPage, totalRecords);
    infoEl.innerHTML = `Mostrando ${startRecord} - ${endRecord} de ${totalRecords} registos`;

    let buttonsHTML = '';
    buttonsHTML += `<button data-page="${currentPage - 1}" class="px-3 py-1 rounded-md bg-gray-200 hover:bg-gray-300 ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}" ${currentPage === 1 ? 'disabled' : ''}>Anterior</button>`;

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);

    if (startPage > 1) {
        buttonsHTML += `<button data-page="1" class="px-3 py-1 rounded-md bg-gray-200 hover:bg-gray-300">1</button>`;
        if (startPage > 2) buttonsHTML += `<span class="px-3 py-1">...</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        buttonsHTML += `<button data-page="${i}" class="px-3 py-1 rounded-md ${i === currentPage ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}">${i}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) buttonsHTML += `<span class="px-3 py-1">...</span>`;
        buttonsHTML += `<button data-page="${totalPages}" class="px-3 py-1 rounded-md bg-gray-200 hover:bg-gray-300">${totalPages}</button>`;
    }

    buttonsHTML += `<button data-page="${currentPage + 1}" class="px-3 py-1 rounded-md bg-gray-200 hover:bg-gray-300 ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}" ${currentPage === totalPages ? 'disabled' : ''}>Próximo</button>`;
    buttonsEl.innerHTML = buttonsHTML;
}

// Renderiza APENAS a tabela com base no state.records atual
export function renderMainTable() {
    const recordsTableBody = document.getElementById('records-table-body');
    const noRecordsMessage = document.getElementById('no-records-message');
    const mainTableHeader = document.getElementById('main-table-header');

    if (!recordsTableBody || !noRecordsMessage || !mainTableHeader) return;

    recordsTableBody.innerHTML = '';

    if (!state.records || state.records.length === 0) {
        noRecordsMessage.classList.remove('hidden');
        recordsTableBody.style.display = 'none';
    } else {
        noRecordsMessage.classList.add('hidden');
        recordsTableBody.style.display = '';
        const getStatusBadge = (s) => s === 'Devolvido' ? { text: 'Devolvido', class: 'bg-green-100 text-green-800' } : { text: 'Em Uso', class: 'bg-blue-100 text-blue-800' };

        state.records.forEach(r => {
            const status = getStatusBadge(r.status);
            const deliveryDateFormatted = r.deliveryDate ? new Date(r.deliveryDate.replace(/-/g, '/')).toLocaleDateString('pt-BR') : 'Data Inválida';

            let attachmentButtons = '';
            if (r.termo_entrega_url) attachmentButtons += `<a href="${r.termo_entrega_url}" target="_blank" class="text-blue-600 p-1 hover:text-blue-800" title="Ver Termo de Entrega"><i data-lucide="file-text" class="w-4 h-4"></i></a>`;
            if (r.termo_devolucao_url) attachmentButtons += `<a href="${r.termo_devolucao_url}" target="_blank" class="text-green-600 p-1 hover:text-green-800" title="Ver Termo de Devolução"><i data-lucide="file-check-2" class="w-4 h-4"></i></a>`;
            if (r.bo_url) attachmentButtons += `<a href="${r.bo_url}" target="_blank" class="text-orange-600 p-1 hover:text-orange-800" title="Ver B.O."><i data-lucide="alert-triangle" class="w-4 h-4"></i></a>`;

            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-gray-50';
            row.innerHTML = `
                <td class="p-3 align-top">${r.employeeName || 'N/A'}<br><span class="text-xs text-gray-500">ID: ${r.employeeMatricula || 'N/A'}</span></td>
                <td class="p-3 align-top">${r.deviceModel || 'N/A'} (IMEI: ${r.deviceImei || 'N/A'})<br><span class="text-xs text-gray-500">Linha: ${r.deviceLine || 'N/A'}</span></td>
                <td class="p-3 align-top">${deliveryDateFormatted}</td>
                <td class="p-3 align-top"><span class="px-2 py-1 text-xs font-medium rounded-full ${status.class}">${status.text}</span></td>
                <td class="p-3 no-print align-top">
                    <div class="flex justify-center items-center gap-1 flex-wrap">
                        <button data-action="view-record" data-id="${r.id}" class="text-gray-600 p-1 hover:text-gray-800" title="Ver/Editar"><i data-lucide="file-pen-line" class="w-4 h-4"></i></button>
                        ${attachmentButtons}
                        <button data-action="print-record" data-id="${r.id}" class="text-slate-600 p-1 hover:text-slate-800" title="Imprimir"><i data-lucide="printer" class="w-4 h-4"></i></button>
                        <button data-action="delete-record" data-id="${r.id}" class="text-red-600 p-1 hover:text-red-800" title="Excluir"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </div>
                </td>
            `;
            recordsTableBody.appendChild(row);
        });
    }
    renderPaginationControls();
    
    // Update sort indicators
    mainTableHeader.querySelectorAll('th[data-sort]').forEach(th => {
        const sortIndicator = th.querySelector('.sort-indicator');
        if (sortIndicator) {
            sortIndicator.innerHTML = ''; // Clear previous indicator
            if (th.dataset.sort === state.mainTable.sortColumn) {
                sortIndicator.innerHTML = state.mainTable.sortDirection === 'asc' ? '<i data-lucide="arrow-up" class="w-3 h-3 inline-block ml-1"></i>' : '<i data-lucide="arrow-down" class="w-3 h-3 inline-block ml-1"></i>';
            }
        }
    });

    if (window.lucide) {
        try { lucide.createIcons(); } catch (e) { console.error("Erro ao criar ícones Lucide:", e); }
    }
}

export function initRecordsTableModule() {
    const filterContainer = document.getElementById('filter-container');
    if (filterContainer) {
        filterContainer.addEventListener('click', (e) => {
            const button = e.target.closest('.filter-btn');
            if (!button || button.disabled) return;
            filterContainer.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.replace('bg-blue-600', 'bg-gray-200');
                btn.classList.replace('text-white', 'text-gray-700');
                btn.disabled = false;
            });
            button.classList.replace('bg-gray-200', 'bg-blue-600');
            button.classList.replace('text-gray-700', 'text-white');
            button.disabled = true;

            const newFilter = button.dataset.filter;
            if (state.mainTable.filter !== newFilter) {
                 updateState({ mainTable: { ...state.mainTable, filter: newFilter, currentPage: 1 } });
                 fetchRecordsPage(1);
            }
        });
         const initialFilter = state.mainTable.filter || 'Todos';
         const activeButton = filterContainer.querySelector(`.filter-btn[data-filter="${initialFilter}"]`);
         if (activeButton && !activeButton.disabled) { activeButton.click(); }
    }

    const recordsTableBody = document.getElementById('records-table-body');
    if (recordsTableBody) {
        recordsTableBody.addEventListener('click', async (e) => {
            const targetElement = e.target.closest('button[data-action], a[href]');
            if (!targetElement) return;

            if (targetElement.tagName === 'A' && targetElement.hasAttribute('href') && targetElement.target === '_blank') return;
            e.preventDefault();

            const id = targetElement.dataset.id;
            const action = targetElement.dataset.action;

            if (action === 'view-record') openRecordForm(id);
            else if (action === 'print-record') printSingleRecord(id);
            else if (action === 'delete-record') {
                if (!confirm('Tem a certeza que deseja excluir este termo?')) return;
                try {
                    setLoading(targetElement, 'Excluindo...');
                    const res = await fetch(`${API_URL}/api/records/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentUser: state.currentUser }) });
                    const result = await res.json();
                    if (!res.ok) throw new Error(result.message);
                    showToast("Registo apagado.");                    
                    await fetchRecordsPage(state.mainTable.currentPage);
                } catch (error) {
                    showToast(`Erro ao excluir: ${error.message}`, true);
                    unsetLoading(targetElement);
                }
            }
        });
    }

    const paginationControls = document.getElementById('pagination-controls');
    if(paginationControls) {
        paginationControls.addEventListener('click', (e) => {
            const button = e.target.closest('button[data-page]');
            if (!button || button.disabled) return;
            const pageToGo = parseInt(button.dataset.page, 10);
            if (pageToGo !== state.mainTable.currentPage) {
                 fetchRecordsPage(pageToGo);
            }
        });
    }

    // Event listener for table header sorting
    const mainTableHeader = document.getElementById('main-table-header');
    if (mainTableHeader) {
        mainTableHeader.addEventListener('click', (e) => {
            const th = e.target.closest('th[data-sort]');
            if (!th) return;

            const newSortColumn = th.dataset.sort;
            let newSortDirection = 'asc';

            if (state.mainTable.sortColumn === newSortColumn) {
                newSortDirection = state.mainTable.sortDirection === 'asc' ? 'desc' : 'asc';
            }

            updateState({ mainTable: { ...state.mainTable, sortColumn: newSortColumn, sortDirection: newSortDirection, currentPage: 1 } });
            fetchRecordsPage(1);
        });
    }
}