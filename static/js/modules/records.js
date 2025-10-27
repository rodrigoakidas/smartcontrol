// SMARTCONTROL/static/js/modules/records.js
// (VERSÃO CORRIGIDA FINAL - Remove comentário visual e garante refresh no Novo Termo)

import { state, fetchAllData, updateState } from '../app.js';
import { openModal, closeModal, showToast, formatDateForInput, setLoading, unsetLoading } from './ui.js';
import { API_URL, fetchItemById, handleFileUpload } from './api.js';
import { getReportHeader, printContent } from './reports.js';

// Flag para controlar impressão
let isPrinting = false;

function extractTermoIdFromError(errorMessage) {
    const match = errorMessage.match(/Nº\s*(\d+)/);
    return match ? parseInt(match[1], 10) : null;
}

// Função para mostrar modal de conflito com opções
function showConflictModal(errorMessage, termoId) {
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

// Funções globais para o modal de conflito
window.closeConflictModal = function() {
    const modal = document.getElementById('conflict-modal');
    if (modal) {
        modal.remove();
    }
};

window.viewExistingTermo = async function(termoId) {
    window.closeConflictModal();
    const recordModal = document.getElementById('record-modal');
    closeModal(recordModal); // Fecha o modal de criação/edição atual
    await new Promise(resolve => setTimeout(resolve, 300)); // Espera fechar
    openRecordForm(termoId); // Abre o termo existente
};

// Busca dados E renderiza a tabela para uma página específica
export async function fetchRecordsPage(page) {
    const { recordsPerPage, filter } = state.mainTable;
    try {
        const data = await fetch(`${API_URL}/api/records?page=${page}&limit=${recordsPerPage}&filter=${filter}`).then(res => res.json());
        // Atualiza o estado ANTES de renderizar
        updateState({
            mainTable: { ...state.mainTable, currentPage: page, totalRecords: data.total },
            records: data.records
        });
        renderMainTable(); // Renderiza com os dados atualizados
    } catch (error) {
        showToast("Erro ao carregar movimentações.", true);
        console.error("Falha ao buscar registros:", error);
        // Garante que a tabela seja limpa mesmo em caso de erro
        const recordsTableBody = document.getElementById('records-table-body');
        if (recordsTableBody) recordsTableBody.innerHTML = '';
        renderPaginationControls(); // Atualiza paginação (pode mostrar 0 registos)
    }
}

// Renderiza APENAS os controlos de paginação com base no state atual
function renderPaginationControls() {
    const { currentPage, totalRecords, recordsPerPage } = state.mainTable;
    const totalPages = Math.ceil(totalRecords / recordsPerPage);
    const infoEl = document.getElementById('pagination-info');
    const buttonsEl = document.getElementById('pagination-buttons');

    if (!infoEl || !buttonsEl) return; // Sai se elementos não existem

    if (totalRecords === 0) {
        infoEl.innerHTML = 'Nenhum registo encontrado.';
        buttonsEl.innerHTML = '';
        return;
    }

    const startRecord = (currentPage - 1) * recordsPerPage + 1;
    const endRecord = Math.min(currentPage * recordsPerPage, totalRecords);
    infoEl.innerHTML = `Mostrando ${startRecord} - ${endRecord} de ${totalRecords} registos`;

    let buttonsHTML = '';
    // Botão Anterior
    buttonsHTML += `<button data-page="${currentPage - 1}" class="px-3 py-1 rounded-md bg-gray-200 hover:bg-gray-300 ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}" ${currentPage === 1 ? 'disabled' : ''}>Anterior</button>`;

    // Lógica de páginas (simplificada para mostrar sempre algumas)
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

    // Botão Próximo
    buttonsHTML += `<button data-page="${currentPage + 1}" class="px-3 py-1 rounded-md bg-gray-200 hover:bg-gray-300 ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}" ${currentPage === totalPages ? 'disabled' : ''}>Próximo</button>`;
    buttonsEl.innerHTML = buttonsHTML;
}

// Renderiza APENAS a tabela com base no state.records atual
export function renderMainTable() {
    const recordsTableBody = document.getElementById('records-table-body');
    const noRecordsMessage = document.getElementById('no-records-message');

    if (!recordsTableBody || !noRecordsMessage) {
        console.error("Elementos da tabela principal não encontrados!");
        return;
    }

    // Limpa a tabela ANTES de adicionar novas linhas
    recordsTableBody.innerHTML = '';

    if (!state.records || state.records.length === 0) {
        noRecordsMessage.classList.remove('hidden');
        recordsTableBody.style.display = 'none';
    } else {
        noRecordsMessage.classList.add('hidden');
        recordsTableBody.style.display = ''; // Garante visibilidade
        const getStatusBadge = (s) => s === 'Devolvido' ? { text: 'Devolvido', class: 'bg-green-100 text-green-800' } : { text: 'Em Uso', class: 'bg-blue-100 text-blue-800' };

        state.records.forEach(r => {
            const status = getStatusBadge(r.status);
            // Formatação de data segura
            const deliveryDateFormatted = r.deliveryDate
                ? new Date(r.deliveryDate.replace(/-/g, '/')).toLocaleDateString('pt-BR')
                : 'Data Inválida';

            // Gerar botões de anexo
            let attachmentButtons = '';
            if (r.termo_entrega_url) {
                attachmentButtons += `<a href="${r.termo_entrega_url}" target="_blank" class="text-blue-600 p-1 hover:text-blue-800" title="Ver Termo de Entrega"><i data-lucide="file-text" class="w-4 h-4"></i></a>`;
            }
            if (r.termo_devolucao_url) {
                attachmentButtons += `<a href="${r.termo_devolucao_url}" target="_blank" class="text-green-600 p-1 hover:text-green-800" title="Ver Termo de Devolução"><i data-lucide="file-check-2" class="w-4 h-4"></i></a>`;
            }
            if (r.bo_url) {
                attachmentButtons += `<a href="${r.bo_url}" target="_blank" class="text-orange-600 p-1 hover:text-orange-800" title="Ver B.O."><i data-lucide="alert-triangle" class="w-4 h-4"></i></a>`;
            }

            // Cria e adiciona a linha
            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-gray-50';
            // --- REMOÇÃO DO COMENTÁRIO VISUAL ---
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
            // --- FIM DA REMOÇÃO ---
            recordsTableBody.appendChild(row);
        });
    }
    // Renderiza paginação APÓS renderizar a tabela
    renderPaginationControls();
    // Atualiza ícones APÓS renderizar a tabela
    if (window.lucide) {
        try {
            lucide.createIcons();
        } catch (e) {
            console.error("Erro ao criar ícones Lucide:", e);
        }
    }
}

// Abre o formulário de registo
async function openRecordForm(recordId = null) {
    // --- GARANTIR DADOS ATUALIZADOS PARA NOVO TERMO ---
    if (!recordId) {
        showToast("A carregar dados atualizados...");
        try {
            await fetchAllData(); // Força a busca de TUDO antes de abrir
            // Não precisa mostrar toast de sucesso aqui, só em caso de erro
        } catch (error) {
            showToast("Erro ao carregar dados atualizados. Não é possível criar novo termo.", true);
            console.error("Falha ao carregar dados em openRecordForm:", error);
            return; // Impede abrir o modal se os dados falharam
        }
    }
    // --- FIM DA GARANTIA ---

    const form = document.getElementById('record-form');
    const modal = document.getElementById('record-modal');
    if (!form || !modal) {
        console.error("Formulário ou Modal de registo não encontrado!");
        return;
    }
    form.reset(); // Limpa campos
    document.getElementById('record-id').value = recordId || ''; // Define ID ou vazio

    // Seletores dos elementos do formulário (declarados uma vez para clareza)
    const employeeSelect = document.getElementById('employeeSelect');
    const deviceSelect = document.getElementById('deviceSelect');
    const viewDeliveryTermBtn = document.getElementById('viewDeliveryTermBtn');
    const viewReturnTermBtn = document.getElementById('viewReturnTermBtn');
    const viewPoliceReportBtn = document.getElementById('viewPoliceReportBtn');
    const deliveryTermInput = document.getElementById('deliveryTermAttachment');
    const returnTermInput = document.getElementById('returnTermAttachment');
    const policeReportInput = document.getElementById('policeReportAttachment');
    const returnTermSection = document.getElementById('return-term-attachment-section');
    const policeReportSection = document.getElementById('police-report-attachment-section');
    const returnConditionSelect = document.getElementById('returnCondition');
    const deliveryFieldset = document.getElementById('delivery-fieldset');
    const returnFieldset = document.getElementById('return-fieldset');
    const modalTitle = document.getElementById('modal-title');

    // Reset estado visual/funcional dos anexos e seções
    [viewDeliveryTermBtn, viewReturnTermBtn, viewPoliceReportBtn].forEach(btn => btn.classList.add('hidden'));
    [deliveryTermInput, returnTermInput, policeReportInput].forEach(input => { input.value = ''; input.disabled = false; }); // Garante habilitado por padrão
    [returnTermSection, policeReportSection].forEach(section => section.style.display = 'none');
    returnFieldset.classList.add('hidden'); // Esconde devolução por padrão

    // Remove listener antigo e adiciona novo para condição de devolução
    if (returnConditionSelect) {
        const newSelect = returnConditionSelect.cloneNode(true);
        returnConditionSelect.parentNode.replaceChild(newSelect, returnConditionSelect);
        newSelect.addEventListener('change', (e) => {
            const condition = e.target.value;
            // Mostra/Esconde seções corretas
            returnTermSection.style.display = (condition === 'Bom' || condition === 'Danificado') ? 'block' : 'none';
            policeReportSection.style.display = condition === 'Perda/Roubo' ? 'block' : 'none';
            // Habilita/Desabilita inputs de ficheiro correspondentes
            returnTermInput.disabled = !(condition === 'Bom' || condition === 'Danificado');
            policeReportInput.disabled = !(condition === 'Perda/Roubo');
        });
         // Garante que os inputs estão no estado correto inicial (desabilitados)
         returnTermInput.disabled = true;
         policeReportInput.disabled = true;
    }

    // --- LÓGICA DE EDIÇÃO ---
    if (recordId) {
        modalTitle.textContent = "Ver/Editar Termo";
        // Desabilita campos de entrega (exceto upload, se necessário)
        deliveryFieldset.querySelectorAll('select, input:not([type="file"]), textarea').forEach(el => el.disabled = true);
        deliveryTermInput.disabled = false; // Permite anexar/substituir termo de entrega
        // Mostra e habilita campos de devolução
        returnFieldset.classList.remove('hidden');
        returnFieldset.querySelectorAll('select, input, textarea').forEach(el => el.disabled = false); // Habilita TODOS

        try {
            // Busca dados frescos do ID específico (pode ser redundante mas garante consistência)
            const data = await fetchItemById('records', recordId);
            if (!data) { closeModal(modal); showToast("Termo não encontrado.", true); return; }

            // Preenche dados de ENTREGA (não editáveis, exceto anexo)
            const employeeData = state.employees.find(e => e.id === data.employeeMatricula);
            employeeSelect.innerHTML = `<option value="${data.employeeMatricula}" selected disabled>${employeeData ? `${employeeData.name} (${employeeData.id})` : `Matrícula: ${data.employeeMatricula}`}</option>`; // Adiciona disabled
            deviceSelect.innerHTML = `<option value="${data.deviceImei}" selected disabled>${data.deviceModel || 'Modelo Desconhecido'} (${data.deviceImei})</option>`; // Adiciona disabled
            document.getElementById('deviceLineDisplay').value = data.deviceLine || 'Nenhuma';
            document.getElementById('deliveryDate').value = formatDateForInput(data.data_entrega);
            document.getElementById('deliveryCondition').value = data.condicao_entrega || '';
            document.getElementById('deliveryNotes').value = data.notas_entrega || '';
            document.querySelectorAll('input[name="accessories"]').forEach(cb => { cb.checked = false; cb.disabled = true; }); // Desabilita checkboxes
            if (data.acessorios && Array.isArray(data.acessorios)) {
                data.acessorios.forEach(acc => {
                    const cb = form.querySelector(`input[name="accessories"][value="${acc}"]`);
                    if (cb) cb.checked = true;
                });
            }
            if (data.termo_entrega_url) { viewDeliveryTermBtn.href = data.termo_entrega_url; viewDeliveryTermBtn.classList.remove('hidden'); }

            // Preenche dados de DEVOLUÇÃO (editáveis)
            document.getElementById('returnDate').value = formatDateForInput(data.data_devolucao);
            const currentReturnConditionSelect = document.getElementById('returnCondition'); // Pega ref do select ATUALIZADO
            currentReturnConditionSelect.value = data.condicao_devolucao || ''; // Define valor
            document.getElementById('returnNotes').value = data.notas_devolucao || '';
            document.getElementById('returnChecker').value = data.return_checker || '';
            if (data.termo_devolucao_url) { viewReturnTermBtn.href = data.termo_devolucao_url; viewReturnTermBtn.classList.remove('hidden'); }
            if (data.bo_url) { viewPoliceReportBtn.href = data.bo_url; viewPoliceReportBtn.classList.remove('hidden'); }

            // Dispara 'change' para garantir visibilidade correta das seções de anexo
            currentReturnConditionSelect.dispatchEvent(new Event('change'));

        } catch (error) {
            showToast("Erro ao carregar detalhes para edição.", true);
            console.error("Erro buscar detalhes edição:", error);
            closeModal(modal);
            return;
        }

    // --- LÓGICA DE NOVO TERMO ---
    } else {
        modalTitle.textContent = "Novo Termo de Responsabilidade";
        // Garante que campos de entrega estão habilitados
        deliveryFieldset.querySelectorAll('select, input, textarea').forEach(el => el.disabled = false);
        // Garante que campos de devolução estão escondidos e desabilitados
        returnFieldset.classList.add('hidden');
        returnFieldset.querySelectorAll('select, input, textarea').forEach(el => el.disabled = true);

        // Popula dropdowns com dados JÁ ATUALIZADOS pelo fetchAllData no início
        employeeSelect.innerHTML = '<option value="">Selecione...</option>';
        if (state.employees && state.employees.length > 0) {
            state.employees.forEach(e => employeeSelect.innerHTML += `<option value="${e.id}">${e.name} (${e.id})</option>`);
        } else {
            employeeSelect.innerHTML = '<option value="">Nenhum funcionário carregado</option>';
        }

        deviceSelect.innerHTML = '<option value="">Selecione...</option>';
        // Filtra usando o estado ATUALIZADO de state.devices
        const availableDevices = state.devices.filter(d => d.status === 'Disponível');
        if (availableDevices.length > 0) {
            availableDevices.forEach(d => {
                deviceSelect.innerHTML += `<option value="${d.imei1}">${d.model} (${d.imei1})</option>`;
            });
        } else {
            deviceSelect.innerHTML = '<option value="">Nenhum aparelho disponível</option>';
        }

        // Preenche valores padrão
        document.getElementById('deliveryDate').value = formatDateForInput(new Date()); // Data atual
        document.getElementById('deliveryCondition').value = 'Novo'; // Default
        document.getElementById('deviceLineDisplay').value = ''; // Limpa linha
        document.querySelectorAll('input[name="accessories"]').forEach(cb => cb.checked = false); // Desmarca acessórios
        document.getElementById('deliveryNotes').value = ''; // Limpa notas
    }
    openModal(modal); // Abre o modal no final
}


// Gera HTML para impressão (ULTRA COMPACTA COM CLASSES)
function generatePrintableTermHTML(data) {
    // ... (código da função ultra compacta INALTERADO) ...
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
                <h3 style="font-size:12px; font-weight:700; margin: 10px 0 5px 0; border-bottom:1px solid #333; padding-bottom:3px;">4. TERMO DE DEVOLUÇÃO</h3>
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

// Função auxiliar para imprimir (COM FLAG isPrinting)
async function printSingleRecord(recordOrData) {
    if (isPrinting) { console.warn("Impressão já em andamento, ignorando."); return; }
    isPrinting = true;
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
        } else { throw new Error('Dados inválidos fornecidos para impressão.'); }
        if (!recordDataToPrint) { throw new Error('Não foi possível obter os dados para impressão.'); }
        const content = generatePrintableTermHTML(recordDataToPrint);
        printContent(content);
    } catch (error) {
        showToast(`Erro ao imprimir: ${error.message}`, true);
        console.error("Erro ao imprimir termo:", error);
    } finally {
        setTimeout(() => { isPrinting = false; }, 500); // Reseta flag após timeout
    }
}


export function initRecordsModule() {
    const recordModal = document.getElementById('record-modal');
    const recordForm = document.getElementById('record-form');
    const deviceSelect = document.getElementById('deviceSelect');
    let isSubmitting = false; // Flag para submit

    // Listener para linha vinculada (associado ao deviceSelect)
    if (deviceSelect) {
        // Remove listener antigo se houver (importante se init for chamado múltiplas vezes)
        const newSelect = deviceSelect.cloneNode(true);
        deviceSelect.parentNode.replaceChild(newSelect, deviceSelect);
        newSelect.addEventListener('change', (e) => {
            const selectedImei = e.target.value;
            const device = state.devices.find(d => d.imei1 === selectedImei);
            const lineDisplay = document.getElementById('deviceLineDisplay');
            if (lineDisplay) { lineDisplay.value = device?.currentLine || 'Nenhuma'; }
        });
    }

    const addRecordBtn = document.getElementById('add-record-btn');
    if (addRecordBtn) { addRecordBtn.addEventListener('click', () => openRecordForm()); } // Chama openRecordForm SEM ID

    const cancelBtn = document.getElementById('cancel-btn');
    if (cancelBtn) { cancelBtn.addEventListener('click', () => closeModal(recordModal)); }

    // Listener botões filtro
    const filterContainer = document.getElementById('filter-container');
    if (filterContainer) {
        filterContainer.addEventListener('click', (e) => {
            const button = e.target.closest('.filter-btn');
            if (!button || button.disabled) return;
            // Atualiza UI dos botões
            filterContainer.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.replace('bg-blue-600', 'bg-gray-200');
                btn.classList.replace('text-white', 'text-gray-700');
                btn.disabled = false;
            });
            button.classList.replace('bg-gray-200', 'bg-blue-600');
            button.classList.replace('text-gray-700', 'text-white');
            button.disabled = true; // Desabilita o botão ativo

            // Atualiza state e busca dados
            const newFilter = button.dataset.filter;
            if (state.mainTable.filter !== newFilter) {
                 updateState({ mainTable: { ...state.mainTable, filter: newFilter, currentPage: 1 } }); // Reseta para página 1
                 fetchRecordsPage(1); // Busca a página 1
            }
        });
         // Inicializa botão de filtro
         const initialFilter = state.mainTable.filter || 'Todos';
         const activeButton = filterContainer.querySelector(`.filter-btn[data-filter="${initialFilter}"]`);
         if (activeButton && !activeButton.disabled) { activeButton.click(); } // Simula clique se não estiver ativo
    }


    // Listener botões tabela principal (View, Anexos, Print, Delete)
    const recordsTableBody = document.getElementById('records-table-body');
    if (recordsTableBody) {
        recordsTableBody.addEventListener('click', async (e) => {
            const targetElement = e.target.closest('button[data-action], a[href]');
            if (!targetElement) return;

            // Deixa links de anexo funcionarem
            if (targetElement.tagName === 'A' && targetElement.hasAttribute('href') && targetElement.target === '_blank') {
                return;
            }
             // Previne ação padrão para botões
            e.preventDefault();

            const id = targetElement.dataset.id;
            const action = targetElement.dataset.action;

            if (action === 'view-record') {
                openRecordForm(id); // Chama com ID para editar/ver
            } else if (action === 'print-record') {
                printSingleRecord(id);
            } else if (action === 'delete-record') {
                if (!confirm('Tem a certeza que deseja excluir este termo?')) return;
                try {
                    setLoading(targetElement, 'Excluindo...'); // Mostra loading no botão de excluir
                    const res = await fetch(`${API_URL}/api/records/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentUser: state.currentUser }) });
                    const result = await res.json();
                    if (!res.ok) throw new Error(result.message);
                    showToast("Registo apagado.");
                    await fetchAllData(); // Recarrega TUDO
                } catch (error) {
                    showToast(`Erro ao excluir: ${error.message}`, true);
                    unsetLoading(targetElement); // Remove loading em caso de erro
                }
                // Não precisa de unsetLoading no sucesso porque a tabela será redesenhada
            }
        });
    }

    // Listener botões paginação
    const paginationControls = document.getElementById('pagination-controls');
    if(paginationControls) {
        paginationControls.addEventListener('click', (e) => {
            const button = e.target.closest('button[data-page]');
            if (!button || button.disabled) return;
            const pageToGo = parseInt(button.dataset.page, 10);
            if (pageToGo !== state.mainTable.currentPage) {
                 fetchRecordsPage(pageToGo); // Busca e renderiza a nova página
            }
        });
    }

    // Listener submit do formulário (Criar/Editar)
    if (recordForm) {
        recordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (isSubmitting) { console.warn("Submissão já em progresso."); return; }
            isSubmitting = true;

            const saveButton = recordForm.querySelector('button[type="submit"]');
            const recordId = document.getElementById('record-id').value;
            const isEditing = !!recordId;
            setLoading(saveButton);
            let success = false;
            let createdRecordDataForPrint = null;

            try {
                // Uploads
                const deliveryTermFile = document.getElementById('deliveryTermAttachment');
                const returnTermFile = document.getElementById('returnTermAttachment');
                const policeReportFile = document.getElementById('policeReportAttachment');
                const deliveryTermUrl = deliveryTermFile.files.length > 0 ? await handleFileUpload(deliveryTermFile) : null;
                const returnTermUrl = returnTermFile.files.length > 0 ? await handleFileUpload(returnTermFile) : null;
                const policeReportUrl = policeReportFile.files.length > 0 ? await handleFileUpload(policeReportFile) : null;

                // Payload
                let recordData;
                if (isEditing) {
                     recordData = { returnDate: document.getElementById('returnDate').value || null, returnCondition: document.getElementById('returnCondition').value || null, returnNotes: document.getElementById('returnNotes').value, returnChecker: document.getElementById('returnChecker').value || state.currentUser?.nome || null, currentUser: state.currentUser, ...(deliveryTermUrl && { deliveryTermUrl: deliveryTermUrl }), ...(returnTermUrl && { returnTermUrl: returnTermUrl }), ...(policeReportUrl && { policeReportUrl: policeReportUrl }), };
                } else {
                     recordData = { employeeMatricula: document.getElementById('employeeSelect').value, deviceImei: document.getElementById('deviceSelect').value, deliveryDate: document.getElementById('deliveryDate').value, deliveryCondition: document.getElementById('deliveryCondition').value, deliveryNotes: document.getElementById('deliveryNotes').value, accessories: Array.from(document.querySelectorAll('input[name="accessories"]:checked')).map(cb => cb.value), deliveryChecker: state.currentUser?.nome || 'Sistema', currentUser: state.currentUser, deliveryTermUrl: deliveryTermUrl };
                     if (!recordData.employeeMatricula || !recordData.deviceImei || !recordData.deliveryDate) { throw new Error("Funcionário, Aparelho e Data de Entrega são obrigatórios."); }
                }

                // Request
                const url = isEditing ? `${API_URL}/api/records/${recordId}` : `${API_URL}/api/records/`;
                const method = isEditing ? 'PUT' : 'POST';
                const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(recordData) });
                const result = await res.json();
                if (!res.ok) { console.error("Erro na resposta do servidor:", res.status, result); throw new Error(result.message || `Erro ${res.status}`); }

                // Sucesso
                success = true;
                showToast(result.message);
                if (method === 'POST' && result.newRecord) {
                     const employee = state.employees.find(e => e.id === recordData.employeeMatricula);
                     createdRecordDataForPrint = { ...result.newRecord, deliveryDate: recordData.deliveryDate, deliveryCondition: recordData.deliveryCondition, deliveryNotes: recordData.deliveryNotes, accessories: recordData.accessories, delivery_checker: recordData.deliveryChecker, employeePosition: employee?.position || 'N/A' };
                }

                closeModal(recordModal); // Fecha modal
                await fetchAllData(); // Recarrega TUDO

            } catch (error) {
                console.error("Erro ao salvar o termo:", error);
                success = false;
                if (error.message && error.message.includes('já está associado ao termo')) {
                    const termoId = extractTermoIdFromError(error.message);
                    if (termoId) { showConflictModal(error.message, termoId); }
                    else { showToast(error.message, true); }
                } else { showToast(`Erro ao salvar: ${error.message}`, true); }
            } finally {
                unsetLoading(saveButton);
                isSubmitting = false;

                // Imprime SE SUCESSO e SE CRIAÇÃO
                if (success && createdRecordDataForPrint) {
                    try { await printSingleRecord(createdRecordDataForPrint); }
                    catch (printError) { console.error("Erro impressão automática:", printError); showToast("Termo salvo, mas erro ao gerar impressão.", true); }
                }
            }
        });
    }

    // Listener botão Imprimir DENTRO do modal
    const printTermBtn = document.getElementById('print-term-btn');
    if(printTermBtn) {
        printTermBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (isPrinting) { console.warn("Impressão já em andamento."); return; }

            const recordId = document.getElementById('record-id').value;
            if (recordId) {
                printSingleRecord(parseInt(recordId, 10)); // Edição
            } else {
                 // Novo Termo
                 isPrinting = true;
                 try {
                     const employeeSelect = document.getElementById('employeeSelect');
                     const deviceSelect = document.getElementById('deviceSelect');
                     const selectedEmployee = state.employees.find(emp => emp.id === employeeSelect.value);
                     const selectedDevice = state.devices.find(d => d.imei1 === deviceSelect.value);
                     if (!selectedEmployee || !selectedDevice) { showToast("Selecione Funcionário e Aparelho para imprimir.", true); return; } // Valida
                     const formDataForPrint = { id: 'Novo', employeeName: selectedEmployee.name, employeeMatricula: selectedEmployee.id, employeePosition: selectedEmployee.position, deviceModel: selectedDevice.model, deviceImei: selectedDevice.imei1, deviceLine: document.getElementById('deviceLineDisplay').value || 'N/A', deliveryDate: document.getElementById('deliveryDate').value, deliveryCondition: document.getElementById('deliveryCondition').value, deliveryNotes: document.getElementById('deliveryNotes').value, accessories: Array.from(document.querySelectorAll('input[name="accessories"]:checked')).map(cb => cb.value), delivery_checker: state.currentUser?.nome || 'N/A', data_devolucao: null, condicao_devolucao: null, notas_devolucao: null, return_checker: null };
                     const content = generatePrintableTermHTML(formDataForPrint);
                     printContent(content);
                 } finally {
                    setTimeout(() => { isPrinting = false; }, 500); // Reseta flag
                 }
            }
        });
    }

} // Fim de initRecordsModule
