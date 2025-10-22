// SMARTCONTROL/static/js/modules/records.js
// (VERSÃO COM FLAG isPrinting PARA EVITAR IMPRESSÃO DUPLA)

import { state, fetchAllData, updateState } from '../app.js';
import { openModal, closeModal, showToast, formatDateForInput, setLoading, unsetLoading } from './ui.js';
import { API_URL, fetchItemById, handleFileUpload } from './api.js';
import { getReportHeader, printContent } from './reports.js';

// --- ADICIONADO: Flag para controlar impressão ---
let isPrinting = false;
// --- FIM DA ADIÇÃO ---

function extractTermoIdFromError(errorMessage) {
    // ... (código da função inalterado) ...
    const match = errorMessage.match(/Nº\s*(\d+)/);
    return match ? parseInt(match[1], 10) : null;
}

function showConflictModal(errorMessage, termoId) {
    // ... (código da função inalterado) ...
    const existingModal = document.getElementById('conflict-modal');
    if (existingModal) existingModal.remove();

    const modalHTML = `
        <div id="conflict-modal" class="modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" style="display: flex;">
            <div class="modal-content bg-white rounded-lg shadow-xl w-full max-w-md">
                <header class="p-4 border-b flex justify-between items-center bg-yellow-50">
                    <h2 class="text-xl font-bold text-yellow-800">⚠️ Aparelho em Uso</h2>
                    <button onclick="closeConflictModal()" class="text-2xl text-gray-600 hover:text-gray-800">&times;</button>
                </header>
                <div class="p-6">
                    <div class="bg-yellow-100 border-l-4 border-yellow-500 p-4 mb-4">
                        <p class="text-yellow-800">${errorMessage}</p>
                    </div>
                    <p class="text-gray-600 mb-4">
                        Este aparelho já possui um termo ativo. Você pode:
                    </p>
                    <div class="space-y-3">
                        <button onclick="viewExistingTermo(${termoId})" class="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center gap-2">
                            <i data-lucide="eye" class="w-5 h-5"></i>
                            Ver Termo Existente (Nº ${termoId})
                        </button>
                        <button onclick="closeConflictModal()" class="w-full px-4 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700">
                            Fechar e Escolher Outro Aparelho
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    if (window.lucide) {
        lucide.createIcons();
    }
}

window.closeConflictModal = function() {
    // ... (código da função inalterado) ...
    const modal = document.getElementById('conflict-modal');
    if (modal) {
        modal.remove();
    }
};

window.viewExistingTermo = async function(termoId) {
    // ... (código da função inalterado) ...
    window.closeConflictModal();
    const recordModal = document.getElementById('record-modal');
    closeModal(recordModal);
    await new Promise(resolve => setTimeout(resolve, 300));
    openRecordForm(termoId);
};

export async function fetchRecordsPage(page) {
    // ... (código da função inalterado) ...
    const { recordsPerPage, filter } = state.mainTable;
    try {
        const data = await fetch(`${API_URL}/api/records?page=${page}&limit=${recordsPerPage}&filter=${filter}`).then(res => res.json());
        state.mainTable.currentPage = page;
        state.mainTable.totalRecords = data.total;
        state.records = data.records;
        renderMainTable();
    } catch (error) {
        showToast("Erro ao carregar movimentações.", true);
        console.error("Falha ao buscar registros:", error);
    }
}

function renderPaginationControls() {
    // ... (código da função inalterado) ...
    const { currentPage, totalRecords, recordsPerPage } = state.mainTable;
    const totalPages = Math.ceil(totalRecords / recordsPerPage);
    const infoEl = document.getElementById('pagination-info');
    const buttonsEl = document.getElementById('pagination-buttons');

    if (!infoEl || !buttonsEl || totalRecords === 0) {
        if(infoEl) infoEl.innerHTML = '';
        if(buttonsEl) buttonsEl.innerHTML = '';
        return;
    }

    const startRecord = (currentPage - 1) * recordsPerPage + 1;
    const endRecord = Math.min(currentPage * recordsPerPage, totalRecords);
    infoEl.innerHTML = `Mostrando ${startRecord} - ${endRecord} de ${totalRecords} registos`;

    let buttonsHTML = '';
    buttonsHTML += `<button data-page="${currentPage - 1}" class="px-3 py-1 rounded-md bg-gray-200 hover:bg-gray-300" ${currentPage === 1 ? 'disabled' : ''}>Anterior</button>`;

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);

    if (currentPage > 3) {
        buttonsHTML += `<button data-page="1" class="px-3 py-1 rounded-md bg-gray-200 hover:bg-gray-300">1</button>`;
        if (currentPage > 4) buttonsHTML += `<span class="px-3 py-1">...</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        buttonsHTML += `<button data-page="${i}" class="px-3 py-1 rounded-md ${i === currentPage ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}">${i}</button>`;
    }

    if (currentPage < totalPages - 2) {
        if (currentPage < totalPages - 3) buttonsHTML += `<span class="px-3 py-1">...</span>`;
        buttonsHTML += `<button data-page="${totalPages}" class="px-3 py-1 rounded-md bg-gray-200 hover:bg-gray-300">${totalPages}</button>`;
    }

    buttonsHTML += `<button data-page="${currentPage + 1}" class="px-3 py-1 rounded-md bg-gray-200 hover:bg-gray-300" ${currentPage === totalPages ? 'disabled' : ''}>Próximo</button>`;
    buttonsEl.innerHTML = buttonsHTML;
}

export function renderMainTable() {
    // ... (código da função inalterado, incluindo a correção da data) ...
    const recordsTableBody = document.getElementById('records-table-body');
    const noRecordsMessage = document.getElementById('no-records-message');
    if (!recordsTableBody || !noRecordsMessage) return;

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
            const deliveryDateFormatted = r.deliveryDate
                ? new Date(r.deliveryDate.replace(/-/g, '/')).toLocaleDateString('pt-BR')
                : 'Data Inválida';

            recordsTableBody.innerHTML += `
                <tr class="border-b hover:bg-gray-50">
                    <td class="p-4">${r.employeeName || 'N/A'}<br><span class="text-xs text-gray-500">ID: ${r.employeeMatricula || 'N/A'}</span></td>
                    <td class="p-4">${r.deviceModel || 'N/A'} (IMEI: ${r.deviceImei || 'N/A'})<br><span class="text-xs text-gray-500">Linha: ${r.deviceLine || 'N/A'}</span></td>
                    <td class="p-4">${deliveryDateFormatted}</td>
                    <td class="p-4"><span class="px-2 py-1 text-sm font-medium rounded-full ${status.class}">${status.text}</span></td>
                    <td class="p-4 no-print"><div class="flex justify-center items-center gap-1"><button data-action="view-record" data-id="${r.id}" class="text-gray-600 p-1" title="Ver/Editar"><i data-lucide="file-pen-line"></i></button><button data-action="print-record" data-id="${r.id}" class="text-slate-600 p-1" title="Imprimir"><i data-lucide="printer"></i></button><button data-action="delete-record" data-id="${r.id}" class="text-red-600 p-1" title="Excluir"><i data-lucide="trash-2"></i></button></div></td>
                </tr>`;
        });
    }
    renderPaginationControls();
    if (window.lucide) lucide.createIcons();
}

async function openRecordForm(recordId = null) {
    // ... (código da função inalterado) ...
    const form = document.getElementById('record-form');
    const modal = document.getElementById('record-modal');
    form.reset();
    document.getElementById('record-id').value = recordId || '';

    const employeeSelect = document.getElementById('employeeSelect');
    const deviceSelect = document.getElementById('deviceSelect');
    const viewDeliveryTermBtn = document.getElementById('viewDeliveryTermBtn');
    const viewReturnTermBtn = document.getElementById('viewReturnTermBtn');
    const viewPoliceReportBtn = document.getElementById('viewPoliceReportBtn');
    viewDeliveryTermBtn.classList.add('hidden');
    viewReturnTermBtn.classList.add('hidden');
    viewPoliceReportBtn.classList.add('hidden');
    document.getElementById('deliveryTermAttachment').value = '';
    document.getElementById('returnTermAttachment').value = '';
    document.getElementById('policeReportAttachment').value = '';
    document.getElementById('deliveryTermAttachment').disabled = false;
    document.getElementById('returnTermAttachment').disabled = false;
    document.getElementById('policeReportAttachment').disabled = false;
    const returnTermSection = document.getElementById('return-term-attachment-section');
    const policeReportSection = document.getElementById('police-report-attachment-section');
    const returnConditionSelect = document.getElementById('returnCondition');
    returnTermSection.style.display = 'none';
    policeReportSection.style.display = 'none';

     if(returnConditionSelect) {
         returnConditionSelect.onchange = null;
         returnConditionSelect.onchange = (e) => {
             const condition = e.target.value;
             returnTermSection.style.display = condition === 'Bom' || condition === 'Danificado' ? 'block' : 'none';
             policeReportSection.style.display = condition === 'Perda/Roubo' ? 'block' : 'none';
         };
     }

    if (recordId) {
        document.getElementById('modal-title').textContent = "Ver/Editar Termo";
        document.getElementById('delivery-fieldset').querySelectorAll('select, input:not([type="file"]), textarea').forEach(el => el.disabled = true);
        document.getElementById('deliveryTermAttachment').disabled = false;
        document.getElementById('return-fieldset').classList.remove('hidden');
        document.getElementById('return-fieldset').querySelectorAll('select, input:not([type="file"]), textarea').forEach(el => el.disabled = false);

        try {
            const data = await fetchItemById('records', recordId);
            if (!data) { closeModal(modal); return; }

            const employeeData = state.employees.find(e => e.id === data.employeeMatricula);
            employeeSelect.innerHTML = `<option value="${data.employeeMatricula}" selected>${employeeData ? `${employeeData.name} (${employeeData.id})` : data.employeeMatricula}</option>`;
            deviceSelect.innerHTML = `<option value="${data.deviceImei}" selected>${data.deviceModel} (${data.deviceImei})</option>`;
            document.getElementById('deviceLineDisplay').value = data.deviceLine || 'Nenhuma';
            document.getElementById('deliveryDate').value = formatDateForInput(data.data_entrega);
            document.getElementById('deliveryCondition').value = data.condicao_entrega || '';
            document.getElementById('deliveryNotes').value = data.notas_entrega || '';
            document.querySelectorAll('input[name="accessories"]').forEach(cb => cb.checked = false);
            if (data.acessorios && Array.isArray(data.acessorios)) {
                 data.acessorios.forEach(acc => {
                     const cb = form.querySelector(`input[name="accessories"][value="${acc}"]`);
                     if (cb) cb.checked = true;
                 });
            }

            if (data.termo_entrega_url) {
                viewDeliveryTermBtn.href = data.termo_entrega_url;
                viewDeliveryTermBtn.classList.remove('hidden');
            } else {
                 viewDeliveryTermBtn.classList.add('hidden');
            }

            document.getElementById('returnDate').value = formatDateForInput(data.data_devolucao);
            document.getElementById('returnCondition').value = data.condicao_devolucao || '';
            document.getElementById('returnNotes').value = data.notas_devolucao || '';
            document.getElementById('returnChecker').value = data.return_checker || '';

             if (data.termo_devolucao_url) {
                viewReturnTermBtn.href = data.termo_devolucao_url;
                viewReturnTermBtn.classList.remove('hidden');
            } else {
                 viewReturnTermBtn.classList.add('hidden');
            }

            if (data.bo_url) {
                viewPoliceReportBtn.href = data.bo_url;
                viewPoliceReportBtn.classList.remove('hidden');
            } else {
                 viewPoliceReportBtn.classList.add('hidden');
            }

             if (returnConditionSelect) returnConditionSelect.dispatchEvent(new Event('change'));

        } catch (error) {
             showToast("Erro ao carregar detalhes do termo.", true);
             console.error("Erro ao buscar detalhes para edição:", error);
             closeModal(modal);
             return;
        }

    } else {
        document.getElementById('modal-title').textContent = "Novo Termo de Responsabilidade";
        document.getElementById('delivery-fieldset').querySelectorAll('select, input, textarea').forEach(el => el.disabled = false);
        document.getElementById('return-fieldset').classList.add('hidden');
        document.getElementById('return-fieldset').querySelectorAll('select, input, textarea').forEach(el => el.disabled = true);

        employeeSelect.innerHTML = '<option value="">Selecione...</option>';
        state.employees.forEach(e => employeeSelect.innerHTML += `<option value="${e.id}">${e.name} (${e.id})</option>`);

        deviceSelect.innerHTML = '<option value="">Selecione...</option>';
        state.devices.filter(d => d.status === 'Disponível').forEach(d => {
            deviceSelect.innerHTML += `<option value="${d.imei1}">${d.model} (${d.imei1})</option>`;
        });

        document.getElementById('deliveryDate').value = formatDateForInput(new Date());
        document.getElementById('deliveryCondition').value = 'Novo';
        document.getElementById('deviceLineDisplay').value = '';
        document.querySelectorAll('input[name="accessories"]').forEach(cb => cb.checked = false);
        document.getElementById('deliveryNotes').value = '';
    }
    openModal(modal);
}

function generatePrintableTermHTML(data) {
    // ... (código da função ultra compacta inalterado) ...
    const accessories = data.acessorios || data.accessories || [];
    const accessoriesList = accessories.length > 0 ? accessories.join(', ') : 'Nenhum';
    const deliveryDateStr = data.data_entrega || data.deliveryDate;
    const deliveryDate = deliveryDateStr ? new Date(deliveryDateStr.replace(/-/g, '/')).toLocaleDateString('pt-BR') : 'Data Inválida';
    const delivererName = data.delivery_checker || state.currentUser?.nome || 'N/A';
    let returnSectionHTML = '';
    const returnDateStr = data.data_devolucao || data.returnDate;

    if (returnDateStr) {
        const returnDate = new Date(returnDateStr.replace(/-/g, '/')).toLocaleDateString('pt-BR');
        const receiverName = data.return_checker || state.currentUser?.nome || 'N/A';

        returnSectionHTML = `
            <div style="padding-top: 10px;">
                <h3 style="font-size:12px; font-weight:700; margin: 10px 0 5px 0; border-bottom:1px solid #333; padding-bottom:3px;">
                    4. TERMO DE DEVOLUÇÃO
                </h3>
                <table style="width:100%; border-collapse: collapse; margin-bottom: 8px; font-size: 9px;">
                     <tr> <td style="padding:3px 4px; border:1px solid #ddd; background:#f9f9f9; width:30%; font-weight:600;">Data de Devolução:</td> <td style="padding:3px 4px; border:1px solid #ddd;">${returnDate}</td> </tr>
                     <tr> <td style="padding:3px 4px; border:1px solid #ddd; background:#f9f9f9; font-weight:600;">Condição:</td> <td style="padding:3px 4px; border:1px solid #ddd;">${data.condicao_devolucao || 'N/A'}</td> </tr>
                     <tr> <td style="padding:3px 4px; border:1px solid #ddd; background:#f9f9f9; font-weight:600;">Observações:</td> <td style="padding:3px 4px; border:1px solid #ddd;">${data.notas_devolucao || 'Nenhuma observação'}</td> </tr>
                     <tr> <td style="padding:3px 4px; border:1px solid #ddd; background:#f9f9f9; font-weight:600;">Recebido por:</td> <td style="padding:3px 4px; border:1px solid #ddd;">${receiverName}</td> </tr>
                </table>
                <div style="background:#f0f0f0; padding:6px 8px; border-radius:4px; margin:10px 0;"> <p style="font-size:8px; line-height:1.3; margin:0;"> <strong>Declaração do Funcionário:</strong><br> Declaro que devolvi o equipamento e todos os acessórios acima descritos, nas condições informadas, e que não possuo mais a posse ou responsabilidade sobre os mesmos. </p> </div>
                <div style="margin-top:15px; display:flex; justify-content:space-around; text-align:center;">
                    <div style="width:40%;"> <div style="border-bottom:1px solid #000; height:20px; margin-bottom:3px;"></div> <p style="font-weight:600; margin:0; font-size:9px;">${data.employeeName || 'N/A'}</p> <p style="font-size:7px; color:#666; margin:0;">Assinatura do Funcionário</p> </div>
                    <div style="width:40%;"> <div style="border-bottom:1px solid #000; height:20px; margin-bottom:3px;"></div> <p style="font-weight:600; margin:0; font-size:9px;">${receiverName}</p> <p style="font-size:7px; color:#666; margin:0;">Assinatura do Receptor</p> </div>
                </div>
            </div>`;
    }

    return `
        <div class="print-container">
            ${getReportHeader()}
            <h1 class="term-title"> TERMO DE RESPONSABILIDADE Nº ${data.id && data.id !== 'Novo' ? String(data.id).padStart(5, '0') : '_____'} </h1>
            <h3 class="section-title">1. DADOS DO FUNCIONÁRIO</h3>
            <table class="data-table">
                <tr> <td class="data-label">Nome Completo:</td> <td>${data.employeeName || 'N/A'}</td> </tr>
                <tr> <td class="data-label">Matrícula:</td> <td>${data.employeeMatricula || 'N/A'}</td> </tr>
                <tr> <td class="data-label">Cargo:</td> <td>${data.employeePosition || 'N/A'}</td> </tr>
            </table>
            <h3 class="section-title">2. DADOS DO EQUIPAMENTO</h3>
            <table class="data-table">
                <tr> <td class="data-label">Modelo:</td> <td>${data.deviceModel || 'N/A'}</td> </tr>
                <tr> <td class="data-label">IMEI Principal:</td> <td>${data.deviceImei || 'N/A'}</td> </tr>
                <tr> <td class="data-label">Linha Telefónica:</td> <td>${data.deviceLine || 'Sem linha vinculada'}</td> </tr>
                <tr> <td class="data-label">Acessórios Inclusos:</td> <td>${accessoriesList}</td> </tr>
            </table>
            <h3 class="section-title">3. TERMO DE ENTREGA</h3>
            <table class="data-table">
                <tr> <td class="data-label">Data de Entrega:</td> <td>${deliveryDate}</td> </tr>
                <tr> <td class="data-label">Condição:</td> <td>${data.condicao_entrega || data.deliveryCondition || 'N/A'}</td> </tr>
                <tr> <td class="data-label">Observações:</td> <td>${data.notas_entrega || data.deliveryNotes || 'Nenhuma observação'}</td> </tr>
                <tr> <td class="data-label">Entregue por:</td> <td>${delivererName}</td> </tr>
            </table>
            <div class="declaration-box"> <p><strong>Declaração do Funcionário:</strong><br> Declaro que recebi o equipamento e acessórios acima descritos em perfeitas condições, responsabilizando-me por sua guarda, conservação e uso adequado durante o período em que estiver sob minha posse. Comprometo-me a devolver o equipamento nas mesmas condições de uso, ressalvado o desgaste natural. Em caso de perda, roubo ou dano intencional, assumo a responsabilidade pelos prejuízos causados. </p> </div>
            <div class="signatures">
                <div class="signature-block"> <div class="signature-line"></div> <p class="signature-name">${data.employeeName || 'N/A'}</p> <p class="signature-role">Assinatura do Funcionário</p> </div>
                <div class="signature-block"> <div class="signature-line"></div> <p class="signature-name">${delivererName}</p> <p class="signature-role">Assinatura do Responsável</p> </div>
            </div>
            ${returnSectionHTML}
            <div class="footer-print"> <p>Documento gerado eletronicamente em ${new Date().toLocaleString('pt-BR')}</p> </div>
        </div>`;
}

// Função auxiliar para imprimir - MODIFICADA COM FLAG isPrinting
async function printSingleRecord(recordOrData) {
    // --- ADICIONADO: Verifica flag ---
    if (isPrinting) {
        console.log("Impressão já em andamento, ignorando.");
        return;
    }
    // --- FIM DA ADIÇÃO ---

    isPrinting = true; // --- ADICIONADO: Define flag ---
    showToast('A gerar termo para impressão...');
    let recordDataToPrint;

    try {
        if (typeof recordOrData === 'object' && recordOrData !== null) {
            const employee = state.employees.find(e => e.id === recordOrData.employeeMatricula);
            recordDataToPrint = { ...recordOrData, employeeName: employee?.name || recordOrData.employeeName || recordOrData.employeeMatricula, employeePosition: employee?.position || recordOrData.employeePosition || 'N/A' };
        }
        else if (typeof recordOrData === 'number' || (typeof recordOrData === 'string' && !isNaN(parseInt(recordOrData)))) {
             const recordId = parseInt(recordOrData, 10);
             const record = await fetchItemById('records', recordId);
             if (!record) throw new Error('Registo não encontrado para impressão.');
             const employee = state.employees.find(e => e.id === record.employeeMatricula);
             recordDataToPrint = { ...record, employeeName: employee?.name || record.employeeMatricula, employeePosition: employee?.position || 'N/A' };
        } else {
            throw new Error('Dados inválidos fornecidos para impressão.');
        }

        if (!recordDataToPrint) {
            throw new Error('Não foi possível obter os dados para impressão.');
        }

        const content = generatePrintableTermHTML(recordDataToPrint);
        printContent(content); // Chama a função que executa window.print()

    } catch (error) {
        showToast(`Erro ao imprimir: ${error.message}`, true);
        console.error("Erro ao imprimir termo:", error);
    } finally {
        // --- ADICIONADO: Reseta flag após impressão ---
        // Usamos um pequeno timeout para garantir que o navegador resetou do window.print()
        setTimeout(() => {
            isPrinting = false;
        }, 500); // Meio segundo deve ser suficiente
        // --- FIM DA ADIÇÃO ---
    }
}


export function initRecordsModule() {
    // ... (código da função inalterado até o listener do #print-term-btn) ...
    const recordModal = document.getElementById('record-modal');
    const recordForm = document.getElementById('record-form');
    const deviceSelect = document.getElementById('deviceSelect');
    let isSubmitting = false;

    if (deviceSelect) { /* ... listener 'change' inalterado ... */
        deviceSelect.addEventListener('change', (e) => {
            const selectedImei = e.target.value;
            const device = state.devices.find(d => d.imei1 === selectedImei);
            const lineDisplay = document.getElementById('deviceLineDisplay');
            if (lineDisplay) {
                lineDisplay.value = device?.currentLine || 'Nenhuma';
            }
        });
    }

    const addRecordBtn = document.getElementById('add-record-btn');
    if (addRecordBtn) { /* ... listener 'click' inalterado ... */
         addRecordBtn.addEventListener('click', () => openRecordForm());
    }

    const cancelBtn = document.getElementById('cancel-btn');
     if (cancelBtn) { /* ... listener 'click' inalterado ... */
         cancelBtn.addEventListener('click', () => closeModal(recordModal));
     }

    const filterContainer = document.getElementById('filter-container');
     if (filterContainer) { /* ... listener 'click' inalterado ... */
        filterContainer.addEventListener('click', (e) => {
            const button = e.target.closest('.filter-btn');
            if (!button) return;
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.replace('bg-blue-600', 'bg-gray-200'));
            button.classList.replace('bg-gray-200', 'bg-blue-600');
            state.mainTable.filter = button.dataset.filter;
            fetchRecordsPage(1);
        });
    }

    const recordsTableBody = document.getElementById('records-table-body');
     if (recordsTableBody) {
        recordsTableBody.addEventListener('click', async (e) => {
            const button = e.target.closest('button[data-action]');
            if (!button) return;
            const id = button.dataset.id;
            const action = button.dataset.action;

            if (action === 'view-record') {
                openRecordForm(id);
            } else if (action === 'print-record') {
                // --- MODIFICADO: Chama printSingleRecord com a flag ---
                printSingleRecord(id);
            } else if (action === 'delete-record') {
                // ... (código do delete inalterado) ...
                if (!confirm('Tem a certeza que deseja excluir este termo?')) return;
                try {
                    const res = await fetch(`${API_URL}/api/records/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentUser: state.currentUser }) });
                    const result = await res.json();
                    if (!res.ok) throw new Error(result.message);
                    showToast("Registo apagado.");
                    await fetchAllData();
                } catch (error) { showToast(`Erro ao excluir: ${error.message}`, true); }
            }
        });
    }

     const paginationControls = document.getElementById('pagination-controls');
     if(paginationControls) { /* ... listener 'click' inalterado ... */
        paginationControls.addEventListener('click', (e) => {
            const button = e.target.closest('button[data-page]');
            if (!button || button.disabled) return;
            fetchRecordsPage(parseInt(button.dataset.page, 10));
        });
    }

    if (recordForm) { /* ... listener 'submit' inalterado ... */
        recordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (isSubmitting) { console.warn("Submissão já em progresso."); return; }
            isSubmitting = true;
            const saveButton = recordForm.querySelector('button[type="submit"]');
            const recordId = document.getElementById('record-id').value;
            const isEditing = !!recordId;
            setLoading(saveButton);
            let success = false;
            let printData = null;

            try {
                const deliveryTermFile = document.getElementById('deliveryTermAttachment');
                const returnTermFile = document.getElementById('returnTermAttachment');
                const policeReportFile = document.getElementById('policeReportAttachment');
                const deliveryTermUrl = deliveryTermFile.files.length > 0 ? await handleFileUpload(deliveryTermFile) : null;
                const returnTermUrl = returnTermFile.files.length > 0 ? await handleFileUpload(returnTermFile) : null;
                const policeReportUrl = policeReportFile.files.length > 0 ? await handleFileUpload(policeReportFile) : null;
                let recordData;
                if (isEditing) {
                     recordData = { returnDate: document.getElementById('returnDate').value || null, returnCondition: document.getElementById('returnCondition').value || null, returnNotes: document.getElementById('returnNotes').value, returnChecker: document.getElementById('returnChecker').value || state.currentUser?.nome || null, currentUser: state.currentUser, ...(deliveryTermUrl && { deliveryTermUrl: deliveryTermUrl }), ...(returnTermUrl && { returnTermUrl: returnTermUrl }), ...(policeReportUrl && { policeReportUrl: policeReportUrl }), };
                } else {
                     recordData = { employeeMatricula: document.getElementById('employeeSelect').value, deviceImei: document.getElementById('deviceSelect').value, deliveryDate: document.getElementById('deliveryDate').value, deliveryCondition: document.getElementById('deliveryCondition').value, deliveryNotes: document.getElementById('deliveryNotes').value, accessories: Array.from(document.querySelectorAll('input[name="accessories"]:checked')).map(cb => cb.value), deliveryChecker: state.currentUser.nome, currentUser: state.currentUser, deliveryTermUrl: deliveryTermUrl, };
                     if (!recordData.employeeMatricula || !recordData.deviceImei || !recordData.deliveryDate) { throw new Error("Funcionário, Aparelho e Data de Entrega são obrigatórios."); }
                }
                const url = isEditing ? `${API_URL}/api/records/${recordId}` : `${API_URL}/api/records/`;
                const method = isEditing ? 'PUT' : 'POST';
                const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(recordData) });
                const result = await res.json();
                if (!res.ok) { console.error("Erro na resposta do servidor:", res.status, result); throw new Error(result.message || `Erro ${res.status}`); }
                success = true;
                showToast(result.message);
                if (method === 'POST' && result.newRecord) {
                     const employee = state.employees.find(e => e.id === recordData.employeeMatricula);
                     printData = { ...result.newRecord, deliveryDate: recordData.deliveryDate, deliveryCondition: recordData.deliveryCondition, deliveryNotes: recordData.deliveryNotes, accessories: recordData.accessories, delivery_checker: recordData.deliveryChecker, employeePosition: employee?.position || 'N/A' };
                }
                await fetchAllData();
                closeModal(recordModal);
            } catch (error) {
                console.error("Erro ao salvar o termo:", error);
                if (error.message && error.message.includes('já está associado ao termo')) {
                    const termoId = extractTermoIdFromError(error.message);
                    if (termoId) { showConflictModal(error.message, termoId); } else { showToast(error.message, true); }
                } else { showToast(`Erro ao salvar: ${error.message}`, true); }
                success = false;
            } finally {
                unsetLoading(saveButton);
                isSubmitting = false;
                if (success && printData) {
                    try {
                        // --- MODIFICADO: Chama printSingleRecord com a flag ---
                        await printSingleRecord(printData);
                    } catch (printError) { console.error("Erro durante a impressão automática:", printError); showToast("Termo salvo, mas houve erro ao gerar a impressão.", true); }
                }
            }
        });
    }

    const printTermBtn = document.getElementById('print-term-btn');
     if(printTermBtn) {
        printTermBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();

            // --- ADICIONADO: Verifica flag ---
            if (isPrinting) {
                console.log("Impressão já em andamento, ignorando.");
                return;
            }
            // --- FIM DA ADIÇÃO ---

            const recordId = document.getElementById('record-id').value;
            if (recordId) {
                // --- MODIFICADO: Chama printSingleRecord com a flag ---
                printSingleRecord(parseInt(recordId, 10));
            } else {
                 // --- ADICIONADO: Define flag e try/finally ---
                 isPrinting = true;
                 try {
                     const employeeSelect = document.getElementById('employeeSelect');
                     const deviceSelect = document.getElementById('deviceSelect');
                     const selectedEmployee = state.employees.find(emp => emp.id === employeeSelect.value);
                     const selectedDevice = state.devices.find(d => d.imei1 === deviceSelect.value);
                     if (!selectedEmployee || !selectedDevice) { showToast("Selecione Funcionário e Aparelho para imprimir.", true); return; }
                     const formDataForPrint = { id: 'Novo', employeeName: selectedEmployee.name, employeeMatricula: selectedEmployee.id, employeePosition: selectedEmployee.position, deviceModel: selectedDevice.model, deviceImei: selectedDevice.imei1, deviceLine: document.getElementById('deviceLineDisplay').value || 'N/A', deliveryDate: document.getElementById('deliveryDate').value, deliveryCondition: document.getElementById('deliveryCondition').value, deliveryNotes: document.getElementById('deliveryNotes').value, accessories: Array.from(document.querySelectorAll('input[name="accessories"]:checked')).map(cb => cb.value), delivery_checker: state.currentUser?.nome || 'N/A', data_devolucao: null, condicao_devolucao: null, notas_devolucao: null, return_checker: null };
                     const content = generatePrintableTermHTML(formDataForPrint);
                     printContent(content);
                 } finally {
                    // Usamos um pequeno timeout para garantir que o navegador resetou do window.print()
                    setTimeout(() => {
                        isPrinting = false;
                    }, 500);
                 }
                 // --- FIM DA ADIÇÃO ---
            }
        });
    }

} // Fim de initRecordsModule
