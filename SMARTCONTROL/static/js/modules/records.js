import { state, fetchAllData, updateState } from '../app.js';
import { openModal, closeModal, showToast, formatDateForInput, setLoading, unsetLoading } from './ui.js';
import { API_URL, fetchItemById, handleFileUpload } from './api.js';
import { getReportHeader, printContent } from './reports.js';

function extractTermoIdFromError(errorMessage) {
    const match = errorMessage.match(/Nº\s*(\d+)/);
    return match ? parseInt(match[1], 10) : null;
}

// Função para mostrar modal de conflito com opções
function showConflictModal(errorMessage, termoId) {
    // Remove modais de conflito anteriores se existirem
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
    
    // Inicializa os ícones do Lucide
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
}

window.viewExistingTermo = async function(termoId) {
    window.closeConflictModal();
    const recordModal = document.getElementById('record-modal');
    closeModal(recordModal);
    
    // Aguarda um momento para fechar o modal atual
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Abre o termo existente
    openRecordForm(termoId);
}


// Função para buscar uma página específica de registos
export async function fetchRecordsPage(page) {
    const { recordsPerPage, filter } = state.mainTable;
    try {
        const data = await fetch(`${API_URL}/api/records?page=${page}&limit=${recordsPerPage}&filter=${filter}`).then(res => res.json());

        // Atualiza o estado global com os dados recebidos
        state.mainTable.currentPage = page;
        state.mainTable.totalRecords = data.total;
        state.records = data.records;

        renderMainTable(); // Re-renderiza a tabela principal
    } catch (error) {
        showToast("Erro ao carregar movimentações.", true);
        console.error("Falha ao buscar registros:", error);
    }
}

// Função para renderizar os controlos de paginação
function renderPaginationControls() {
    const { currentPage, totalRecords, recordsPerPage } = state.mainTable;
    const totalPages = Math.ceil(totalRecords / recordsPerPage);
    const infoEl = document.getElementById('pagination-info');
    const buttonsEl = document.getElementById('pagination-buttons');

    // Limpa controlos se não houver registos
    if (!infoEl || !buttonsEl || totalRecords === 0) {
        if(infoEl) infoEl.innerHTML = '';
        if(buttonsEl) buttonsEl.innerHTML = '';
        return;
    }

    // Informação de registos mostrados
    const startRecord = (currentPage - 1) * recordsPerPage + 1;
    const endRecord = Math.min(currentPage * recordsPerPage, totalRecords);
    infoEl.innerHTML = `Mostrando ${startRecord} - ${endRecord} de ${totalRecords} registos`;

    // Lógica para gerar botões de paginação (Anterior, números, Próximo)
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

// Função para renderizar a tabela principal de registos
export function renderMainTable() {
    const recordsTableBody = document.getElementById('records-table-body');
    const noRecordsMessage = document.getElementById('no-records-message');
    if (!recordsTableBody || !noRecordsMessage) return;

    recordsTableBody.innerHTML = ''; // Limpa tabela
    if (!state.records || state.records.length === 0) { // Verifica se state.records existe
        noRecordsMessage.classList.remove('hidden');
        recordsTableBody.style.display = 'none';
    } else {
        noRecordsMessage.classList.add('hidden');
        recordsTableBody.style.display = ''; // Garante que a tabela é visível
        const getStatusBadge = (s) => s === 'Devolvido' ? { text: 'Devolvido', class: 'bg-green-100 text-green-800' } : { text: 'Em Uso', class: 'bg-blue-100 text-blue-800' };

        // Preenche a tabela com os dados
        state.records.forEach(r => {
            const status = getStatusBadge(r.status);
            // Formata data corretamente para exibição
            const deliveryDateFormatted = r.deliveryDate ? new Date(r.deliveryDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Data Inválida';
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
    renderPaginationControls(); // Atualiza controlos de paginação
    if (window.lucide) lucide.createIcons(); // Atualiza ícones
}

// Função para abrir o formulário de registo (novo ou edição)
async function openRecordForm(recordId = null) {
    const form = document.getElementById('record-form');
    const modal = document.getElementById('record-modal');
    form.reset(); // Limpa o formulário
    document.getElementById('record-id').value = recordId || ''; // Define o ID (ou vazio se for novo)

    const employeeSelect = document.getElementById('employeeSelect');
    const deviceSelect = document.getElementById('deviceSelect');

    // Elementos dos links "Ver Anexo"
    const viewDeliveryTermBtn = document.getElementById('viewDeliveryTermBtn');
    const viewReturnTermBtn = document.getElementById('viewReturnTermBtn');
    const viewPoliceReportBtn = document.getElementById('viewPoliceReportBtn');
    viewDeliveryTermBtn.classList.add('hidden'); // Esconde links por padrão
    viewReturnTermBtn.classList.add('hidden');
    viewPoliceReportBtn.classList.add('hidden');

    // Limpa seleções de ficheiros anteriores
    document.getElementById('deliveryTermAttachment').value = '';
    document.getElementById('returnTermAttachment').value = '';
    document.getElementById('policeReportAttachment').value = '';

    // Habilita inputs de ficheiro por padrão
    document.getElementById('deliveryTermAttachment').disabled = false;
    document.getElementById('returnTermAttachment').disabled = false;
    document.getElementById('policeReportAttachment').disabled = false;

    // Controla a visibilidade das secções de anexo de devolução
    const returnTermSection = document.getElementById('return-term-attachment-section');
    const policeReportSection = document.getElementById('police-report-attachment-section');
    const returnConditionSelect = document.getElementById('returnCondition');

    returnTermSection.style.display = 'none'; // Esconde por padrão
    policeReportSection.style.display = 'none';

    // Listener para mostrar/esconder campos de anexo de devolução conforme a condição
     if(returnConditionSelect) {
         returnConditionSelect.onchange = null; // Remove listener antigo
         returnConditionSelect.onchange = (e) => {
             const condition = e.target.value;
             returnTermSection.style.display = condition === 'Bom' || condition === 'Danificado' ? 'block' : 'none';
             policeReportSection.style.display = condition === 'Perda/Roubo' ? 'block' : 'none';
         };
     }

    // Lógica para modo EDIÇÃO
    if (recordId) {
        document.getElementById('modal-title').textContent = "Ver/Editar Termo";
        // Desabilita campos de entrega (exceto upload de anexo)
        document.getElementById('delivery-fieldset').querySelectorAll('select, input:not([type="file"]), textarea').forEach(el => el.disabled = true);
        document.getElementById('deliveryTermAttachment').disabled = false; // Permite anexar mesmo editando

        document.getElementById('return-fieldset').classList.remove('hidden'); // Mostra secção de devolução
        // Habilita campos de devolução para edição
        document.getElementById('return-fieldset').querySelectorAll('select, input:not([type="file"]), textarea').forEach(el => el.disabled = false);

        try {
            const data = await fetchItemById('records', recordId); // Busca dados do registo
            if (!data) { closeModal(modal); return; } // Fecha se não encontrar

            // Preenche dados de entrega (não editáveis)
            const employeeData = state.employees.find(e => e.id === data.employeeMatricula);
            employeeSelect.innerHTML = `<option value="${data.employeeMatricula}" selected>${employeeData ? `${employeeData.name} (${employeeData.id})` : data.employeeMatricula}</option>`;
            deviceSelect.innerHTML = `<option value="${data.deviceImei}" selected>${data.deviceModel} (${data.deviceImei})</option>`;
            document.getElementById('deviceLineDisplay').value = data.deviceLine || 'Nenhuma';
            document.getElementById('deliveryDate').value = formatDateForInput(data.data_entrega);
            document.getElementById('deliveryCondition').value = data.condicao_entrega || ''; // Default para vazio se null
            document.getElementById('deliveryNotes').value = data.notas_entrega || '';
             // Marca os acessórios
            document.querySelectorAll('input[name="accessories"]').forEach(cb => cb.checked = false);
            if (data.acessorios && Array.isArray(data.acessorios)) {
                 data.acessorios.forEach(acc => {
                     const cb = form.querySelector(`input[name="accessories"][value="${acc}"]`);
                     if (cb) cb.checked = true;
                 });
            }

            // Mostra link do termo de entrega se existir
            if (data.termo_entrega_url) {
                viewDeliveryTermBtn.href = data.termo_entrega_url;
                viewDeliveryTermBtn.classList.remove('hidden');
            } else {
                 viewDeliveryTermBtn.classList.add('hidden');
            }

            // Preenche dados de devolução (editáveis)
            document.getElementById('returnDate').value = formatDateForInput(data.data_devolucao);
            document.getElementById('returnCondition').value = data.condicao_devolucao || '';
            document.getElementById('returnNotes').value = data.notas_devolucao || '';
            document.getElementById('returnChecker').value = data.return_checker || '';

            // Mostra link do termo de devolução se existir
             if (data.termo_devolucao_url) {
                viewReturnTermBtn.href = data.termo_devolucao_url;
                viewReturnTermBtn.classList.remove('hidden');
            } else {
                 viewReturnTermBtn.classList.add('hidden');
            }

            // Mostra link do BO se existir
            if (data.bo_url) {
                viewPoliceReportBtn.href = data.bo_url;
                viewPoliceReportBtn.classList.remove('hidden');
            } else {
                 viewPoliceReportBtn.classList.add('hidden');
            }

             // Dispara o evento 'change' no select de condição para mostrar/esconder anexos corretamente
             if (returnConditionSelect) returnConditionSelect.dispatchEvent(new Event('change'));

        } catch (error) {
             showToast("Erro ao carregar detalhes do termo.", true);
             console.error("Erro ao buscar detalhes para edição:", error);
             closeModal(modal);
             return;
        }

    } else {
        // Lógica para modo NOVO TERMO
        document.getElementById('modal-title').textContent = "Novo Termo de Responsabilidade";
        // Habilita campos de entrega
        document.getElementById('delivery-fieldset').querySelectorAll('select, input, textarea').forEach(el => el.disabled = false);
        document.getElementById('return-fieldset').classList.add('hidden'); // Esconde secção de devolução
        // Desabilita campos de devolução
        document.getElementById('return-fieldset').querySelectorAll('select, input, textarea').forEach(el => el.disabled = true);

        // Preenche dropdowns com opções
        employeeSelect.innerHTML = '<option value="">Selecione...</option>';
        state.employees.forEach(e => employeeSelect.innerHTML += `<option value="${e.id}">${e.name} (${e.id})</option>`);

        deviceSelect.innerHTML = '<option value="">Selecione...</option>';
        // Filtra apenas aparelhos 'Disponível'
        state.devices.filter(d => d.status === 'Disponível').forEach(d => {
            deviceSelect.innerHTML += `<option value="${d.imei1}">${d.model} (${d.imei1})</option>`;
        });

        // Preenche valores padrão para novo termo
        document.getElementById('deliveryDate').value = formatDateForInput(new Date()); // Data atual
        document.getElementById('deliveryCondition').value = 'Novo';
        document.getElementById('deviceLineDisplay').value = ''; // Limpa linha
        document.querySelectorAll('input[name="accessories"]').forEach(cb => cb.checked = false); // Desmarca acessórios
        document.getElementById('deliveryNotes').value = ''; // Limpa notas
    }
    openModal(modal); // Abre o modal
}

// Função para gerar o HTML do termo para impressão
// Função melhorada para gerar o HTML do termo para impressão
function generatePrintableTermHTML(data) {
    const accessories = data.acessorios || data.accessories || [];
    const accessoriesList = accessories.length > 0 ? accessories.join(', ') : 'Nenhum';

    // Formatação segura da data de entrega
    const deliveryDateStr = data.data_entrega || data.deliveryDate;
    const deliveryDate = deliveryDateStr ? new Date(deliveryDateStr.replace(/-/g, '/')).toLocaleDateString('pt-BR') : 'Data Inválida';

    // Define o nome de quem entregou
    const delivererName = data.delivery_checker || state.currentUser?.nome || 'N/A';

    // --- Seção de Devolução ---
    let returnSectionHTML = '';
    const returnDateStr = data.data_devolucao || data.returnDate;
    
    if (returnDateStr) {
        const returnDate = new Date(returnDateStr.replace(/-/g, '/')).toLocaleDateString('pt-BR');
        const receiverName = data.return_checker || state.currentUser?.nome || 'N/A';

        returnSectionHTML = `
            <div style="page-break-before: always; padding-top: 40px;">
                <h3 style="font-size:16px; font-weight:700; margin: 24px 0 16px 0; border-bottom:2px solid #333; padding-bottom:8px;">
                    4. TERMO DE DEVOLUÇÃO
                </h3>
                
                <table style="width:100%; border-collapse: collapse; margin-bottom: 20px;">
                    <tr>
                        <td style="padding:8px; border:1px solid #ddd; background:#f9f9f9; width:30%; font-weight:600;">Data de Devolução:</td>
                        <td style="padding:8px; border:1px solid #ddd;">${returnDate}</td>
                    </tr>
                    <tr>
                        <td style="padding:8px; border:1px solid #ddd; background:#f9f9f9; font-weight:600;">Condição:</td>
                        <td style="padding:8px; border:1px solid #ddd;">${data.condicao_devolucao || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td style="padding:8px; border:1px solid #ddd; background:#f9f9f9; font-weight:600;">Observações:</td>
                        <td style="padding:8px; border:1px solid #ddd;">${data.notas_devolucao || 'Nenhuma observação'}</td>
                    </tr>
                    <tr>
                        <td style="padding:8px; border:1px solid #ddd; background:#f9f9f9; font-weight:600;">Recebido por:</td>
                        <td style="padding:8px; border:1px solid #ddd;">${receiverName}</td>
                    </tr>
                </table>
                
                <div style="background:#f0f0f0; padding:16px; border-radius:8px; margin:24px 0;">
                    <p style="font-size:11px; line-height:1.6; margin:0;">
                        <strong>Declaração do Funcionário:</strong><br>
                        Declaro que devolvi o equipamento e todos os acessórios acima descritos, 
                        nas condições informadas, e que não possuo mais a posse ou responsabilidade sobre os mesmos.
                    </p>
                </div>
                
                <div style="margin-top:80px; display:flex; justify-content:space-around; text-align:center;">
                    <div style="width:40%;">
                        <div style="border-bottom:2px solid #000; height:60px; margin-bottom:8px;"></div>
                        <p style="font-weight:600; margin:0;">${data.employeeName || 'N/A'}</p>
                        <p style="font-size:10px; color:#666; margin:0;">Assinatura do Funcionário</p>
                    </div>
                    <div style="width:40%;">
                        <div style="border-bottom:2px solid #000; height:60px; margin-bottom:8px;"></div>
                        <p style="font-weight:600; margin:0;">${receiverName}</p>
                        <p style="font-size:10px; color:#666; margin:0;">Assinatura do Receptor</p>
                    </div>
                </div>
            </div>`;
    }

    // --- Estrutura Principal do Termo ---
    return `
        <div style="padding:24px; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size:12px; color:#000; max-width:800px; margin:0 auto;">
            ${getReportHeader()}
            
            <h1 style="font-size:22px; font-weight:700; text-align:center; margin: 32px 0; text-transform:uppercase; border-bottom:3px solid #333; padding-bottom:12px;">
                Termo de Responsabilidade Nº ${data.id && data.id !== 'Novo' ? String(data.id).padStart(5, '0') : '_____'}
            </h1>
            
            <!-- SEÇÃO 1: FUNCIONÁRIO -->
            <h3 style="font-size:16px; font-weight:700; margin: 24px 0 12px 0; border-bottom:2px solid #333; padding-bottom:8px;">
                1. DADOS DO FUNCIONÁRIO
            </h3>
            
            <table style="width:100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr>
                    <td style="padding:8px; border:1px solid #ddd; background:#f9f9f9; width:30%; font-weight:600;">Nome Completo:</td>
                    <td style="padding:8px; border:1px solid #ddd;">${data.employeeName || 'N/A'}</td>
                </tr>
                <tr>
                    <td style="padding:8px; border:1px solid #ddd; background:#f9f9f9; font-weight:600;">Matrícula:</td>
                    <td style="padding:8px; border:1px solid #ddd;">${data.employeeMatricula || 'N/A'}</td>
                </tr>
                <tr>
                    <td style="padding:8px; border:1px solid #ddd; background:#f9f9f9; font-weight:600;">Cargo:</td>
                    <td style="padding:8px; border:1px solid #ddd;">${data.employeePosition || 'N/A'}</td>
                </tr>
            </table>
            
            <!-- SEÇÃO 2: EQUIPAMENTO -->
            <h3 style="font-size:16px; font-weight:700; margin: 24px 0 12px 0; border-bottom:2px solid #333; padding-bottom:8px;">
                2. DADOS DO EQUIPAMENTO
            </h3>
            
            <table style="width:100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr>
                    <td style="padding:8px; border:1px solid #ddd; background:#f9f9f9; width:30%; font-weight:600;">Modelo:</td>
                    <td style="padding:8px; border:1px solid #ddd;">${data.deviceModel || 'N/A'}</td>
                </tr>
                <tr>
                    <td style="padding:8px; border:1px solid #ddd; background:#f9f9f9; font-weight:600;">IMEI Principal:</td>
                    <td style="padding:8px; border:1px solid #ddd;">${data.deviceImei || 'N/A'}</td>
                </tr>
                <tr>
                    <td style="padding:8px; border:1px solid #ddd; background:#f9f9f9; font-weight:600;">Linha Telefónica:</td>
                    <td style="padding:8px; border:1px solid #ddd;">${data.deviceLine || 'Sem linha vinculada'}</td>
                </tr>
                <tr>
                    <td style="padding:8px; border:1px solid #ddd; background:#f9f9f9; font-weight:600;">Acessórios Inclusos:</td>
                    <td style="padding:8px; border:1px solid #ddd;">${accessoriesList}</td>
                </tr>
            </table>
            
            <!-- SEÇÃO 3: ENTREGA -->
            <h3 style="font-size:16px; font-weight:700; margin: 24px 0 12px 0; border-bottom:2px solid #333; padding-bottom:8px;">
                3. TERMO DE ENTREGA
            </h3>
            
            <table style="width:100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr>
                    <td style="padding:8px; border:1px solid #ddd; background:#f9f9f9; width:30%; font-weight:600;">Data de Entrega:</td>
                    <td style="padding:8px; border:1px solid #ddd;">${deliveryDate}</td>
                </tr>
                <tr>
                    <td style="padding:8px; border:1px solid #ddd; background:#f9f9f9; font-weight:600;">Condição:</td>
                    <td style="padding:8px; border:1px solid #ddd;">${data.condicao_entrega || data.deliveryCondition || 'N/A'}</td>
                </tr>
                <tr>
                    <td style="padding:8px; border:1px solid #ddd; background:#f9f9f9; font-weight:600;">Observações:</td>
                    <td style="padding:8px; border:1px solid #ddd;">${data.notas_entrega || data.deliveryNotes || 'Nenhuma observação'}</td>
                </tr>
                <tr>
                    <td style="padding:8px; border:1px solid #ddd; background:#f9f9f9; font-weight:600;">Entregue por:</td>
                    <td style="padding:8px; border:1px solid #ddd;">${delivererName}</td>
                </tr>
            </table>
            
            <div style="background:#f0f0f0; padding:16px; border-radius:8px; margin:24px 0;">
                <p style="font-size:11px; line-height:1.6; margin:0;">
                    <strong>Declaração do Funcionário:</strong><br>
                    Declaro que recebi o equipamento e acessórios acima descritos em perfeitas condições, 
                    responsabilizando-me por sua guarda, conservação e uso adequado durante o período em que 
                    estiver sob minha posse. Comprometo-me a devolver o equipamento nas mesmas condições de uso, 
                    ressalvado o desgaste natural. Em caso de perda, roubo ou dano intencional, assumo a 
                    responsabilidade pelos prejuízos causados.
                </p>
            </div>
            
            <div style="margin-top:80px; display:flex; justify-content:space-around; text-align:center;">
                <div style="width:40%;">
                    <div style="border-bottom:2px solid #000; height:60px; margin-bottom:8px;"></div>
                    <p style="font-weight:600; margin:0;">${data.employeeName || 'N/A'}</p>
                    <p style="font-size:10px; color:#666; margin:0;">Assinatura do Funcionário</p>
                </div>
                <div style="width:40%;">
                    <div style="border-bottom:2px solid #000; height:60px; margin-bottom:8px;"></div>
                    <p style="font-weight:600; margin:0;">${delivererName}</p>
                    <p style="font-size:10px; color:#666; margin:0;">Assinatura do Responsável</p>
                </div>
            </div>
            
            ${returnSectionHTML}
            
            <!-- Rodapé com data de impressão -->
            <div style="margin-top:60px; padding-top:16px; border-top:1px solid #ccc; text-align:center; font-size:10px; color:#666;">
                <p style="margin:0;">Documento gerado eletronicamente em ${new Date().toLocaleString('pt-BR')}</p>
            </div>
        </div>`;
}


// Função auxiliar para imprimir - Aceita ID numérico ou objeto de dados completo
async function printSingleRecord(recordOrData) {
    showToast('A gerar termo para impressão...');
    let recordDataToPrint;

    try {
        // Se recebeu um objeto (do formulário antes de salvar ou da resposta do POST)
        if (typeof recordOrData === 'object' && recordOrData !== null) {
            // Busca dados atualizados do funcionário se não vieram no objeto
            const employee = state.employees.find(e => e.id === recordOrData.employeeMatricula);
            recordDataToPrint = {
                ...recordOrData, // Usa os dados recebidos
                employeeName: employee?.name || recordOrData.employeeName || recordOrData.employeeMatricula, // Garante nome
                employeePosition: employee?.position || recordOrData.employeePosition || 'N/A' // Garante cargo
            };
        }
        // Se recebeu um ID (número ou string numérica)
        else if (typeof recordOrData === 'number' || (typeof recordOrData === 'string' && !isNaN(parseInt(recordOrData)))) {
             const recordId = parseInt(recordOrData, 10);
             const record = await fetchItemById('records', recordId); // Busca dados frescos do backend
             if (!record) throw new Error('Registo não encontrado para impressão.');

             const employee = state.employees.find(e => e.id === record.employeeMatricula);
             recordDataToPrint = {
                ...record,
                employeeName: employee?.name || record.employeeMatricula,
                employeePosition: employee?.position || 'N/A'
            };
        } else {
            throw new Error('Dados inválidos fornecidos para impressão.');
        }

        // Se, após tudo, não conseguiu montar os dados, lança erro
        if (!recordDataToPrint) {
            throw new Error('Não foi possível obter os dados para impressão.');
        }

        // Gera e imprime o HTML
        const content = generatePrintableTermHTML(recordDataToPrint);
        printContent(content);

    } catch (error) {
        showToast(`Erro ao imprimir: ${error.message}`, true);
        console.error("Erro ao imprimir termo:", error);
    }
}


// Função principal de inicialização do módulo
export function initRecordsModule() {
    const recordModal = document.getElementById('record-modal');
    const recordForm = document.getElementById('record-form');
    const deviceSelect = document.getElementById('deviceSelect');

    // Flag para prevenir submissão dupla
    let isSubmitting = false;

    // Atualiza campo "Linha Vinculada" ao mudar o aparelho selecionado no formulário
    if (deviceSelect) {
        deviceSelect.addEventListener('change', (e) => {
            const selectedImei = e.target.value;
            const device = state.devices.find(d => d.imei1 === selectedImei);
            const lineDisplay = document.getElementById('deviceLineDisplay');
            if (lineDisplay) {
                lineDisplay.value = device?.currentLine || 'Nenhuma';
            }
        });
    }

    // Botão "Novo Termo"
    const addRecordBtn = document.getElementById('add-record-btn');
    if (addRecordBtn) {
         addRecordBtn.addEventListener('click', () => openRecordForm()); // Abre formulário em modo de criação
    }

    // Botão "Cancelar" ou "X" do modal do formulário
    const cancelBtn = document.getElementById('cancel-btn');
     if (cancelBtn) {
         cancelBtn.addEventListener('click', () => closeModal(recordModal));
     }

    // Botões de filtro ("Todos", "Em Uso", "Devolvido") da tabela principal
    const filterContainer = document.getElementById('filter-container');
     if (filterContainer) {
        filterContainer.addEventListener('click', (e) => {
            const button = e.target.closest('.filter-btn');
            if (!button) return;
            // Atualiza estilo dos botões de filtro
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.replace('bg-blue-600', 'bg-gray-200'));
            button.classList.replace('bg-gray-200', 'bg-blue-600');
            // Atualiza filtro no estado global e recarrega a primeira página
            state.mainTable.filter = button.dataset.filter;
            fetchRecordsPage(1);
        });
    }


    // Listener para cliques nos botões da tabela principal (Ver/Editar, Imprimir, Excluir)
    const recordsTableBody = document.getElementById('records-table-body');
     if (recordsTableBody) {
        recordsTableBody.addEventListener('click', async (e) => {
            const button = e.target.closest('button[data-action]');
            if (!button) return;
            const id = button.dataset.id;
            const action = button.dataset.action;

            if (action === 'view-record') {
                openRecordForm(id); // Abre formulário em modo de edição
            } else if (action === 'print-record') {
                printSingleRecord(id); // Imprime termo existente (busca dados atualizados)
            } else if (action === 'delete-record') {
                if (!confirm('Tem a certeza que deseja excluir este termo?')) return;
                try {
                    // Envia requisição DELETE para o backend
                    const res = await fetch(`${API_URL}/api/records/${id}`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ currentUser: state.currentUser })
                    });
                    const result = await res.json();
                    if (!res.ok) throw new Error(result.message);
                    showToast("Registo apagado.");
                    // Recarrega a página atual da tabela
                    await fetchRecordsPage(state.mainTable.currentPage);
                } catch (error) { showToast(`Erro ao excluir: ${error.message}`, true); }
            }
        });
    }


    // Listener para cliques nos botões de paginação
     const paginationControls = document.getElementById('pagination-controls');
     if(paginationControls) {
        paginationControls.addEventListener('click', (e) => {
            const button = e.target.closest('button[data-page]');
            if (!button || button.disabled) return;
            fetchRecordsPage(parseInt(button.dataset.page, 10)); // Busca a página clicada
        });
    }


    // Listener para submissão do formulário (Criar ou Editar)
    recordForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Previne recarregamento da página

        // --- INÍCIO: Prevenção de submissão dupla ---
        if (isSubmitting) {
            console.warn("Submissão já em progresso. Ignorando clique.");
            return;
        }
        isSubmitting = true;
        // --- FIM: Prevenção de submissão dupla ---

        const saveButton = recordForm.querySelector('button[type="submit"]');
        const recordId = document.getElementById('record-id').value;
        const isEditing = !!recordId;

        setLoading(saveButton); // Mostra estado de carregamento no botão
        let success = false;    // Flag para controlar se a operação foi bem sucedida
        let printData = null;   // Variável para guardar dados para impressão após sucesso

        try {
            // Processa uploads PRIMEIRO para obter as URLs
            const deliveryTermFile = document.getElementById('deliveryTermAttachment');
            const returnTermFile = document.getElementById('returnTermAttachment');
            const policeReportFile = document.getElementById('policeReportAttachment');

            // Só faz upload se um ficheiro foi selecionado
            const deliveryTermUrl = deliveryTermFile.files.length > 0 ? await handleFileUpload(deliveryTermFile) : null;
            const returnTermUrl = returnTermFile.files.length > 0 ? await handleFileUpload(returnTermFile) : null;
            const policeReportUrl = policeReportFile.files.length > 0 ? await handleFileUpload(policeReportFile) : null;

            let recordData; // Payload a ser enviado para o backend
            if (isEditing) {
                // Monta o payload para ATUALIZAÇÃO (PUT)
                 recordData = {
                    returnDate: document.getElementById('returnDate').value || null,
                    returnCondition: document.getElementById('returnCondition').value || null,
                    returnNotes: document.getElementById('returnNotes').value,
                    returnChecker: document.getElementById('returnChecker').value || state.currentUser?.nome || null, // Usa user logado como fallback
                    currentUser: state.currentUser,
                    // Inclui URLs apenas se um NOVO ficheiro foi enviado nesta edição
                    ...(deliveryTermUrl && { deliveryTermUrl: deliveryTermUrl }),
                    ...(returnTermUrl && { returnTermUrl: returnTermUrl }),
                    ...(policeReportUrl && { policeReportUrl: policeReportUrl }),
                 };
            } else {
                 // Monta o payload para CRIAÇÃO (POST)
                 recordData = {
                    employeeMatricula: document.getElementById('employeeSelect').value,
                    deviceImei: document.getElementById('deviceSelect').value,
                    deliveryDate: document.getElementById('deliveryDate').value,
                    deliveryCondition: document.getElementById('deliveryCondition').value,
                    deliveryNotes: document.getElementById('deliveryNotes').value,
                    accessories: Array.from(document.querySelectorAll('input[name="accessories"]:checked')).map(cb => cb.value),
                    deliveryChecker: state.currentUser.nome, // Preenche automaticamente
                    currentUser: state.currentUser,
                    deliveryTermUrl: deliveryTermUrl, // Pode ser null se não houver upload
                 };
                 // Validação básica para criação
                 if (!recordData.employeeMatricula || !recordData.deviceImei || !recordData.deliveryDate) {
                    throw new Error("Funcionário, Aparelho e Data de Entrega são obrigatórios.");
                 }
            }

            // Define URL e método (POST para criar, PUT para editar)
            const url = isEditing ? `${API_URL}/api/records/${recordId}` : `${API_URL}/api/records/`;
            const method = isEditing ? 'PUT' : 'POST';

            // Envia a requisição para o backend
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(recordData) });
            const result = await res.json();

            // Verifica se a resposta NÃO foi bem sucedida
            if (!res.ok) {
                console.error("Erro na resposta do servidor:", res.status, result);
                throw new Error(result.message || `Erro ${res.status}`);
            }

            // Se chegou aqui, a operação foi bem sucedida
            success = true; // Marca como sucesso
            showToast(result.message); // Exibe mensagem de sucesso

            // Prepara dados para impressão automática APENAS SE for criação (POST) e sucesso
            if (method === 'POST' && result.newRecord) {
                 const employee = state.employees.find(e => e.id === recordData.employeeMatricula);
                 printData = {
                    ...result.newRecord, // Dados retornados pelo backend (inclui o novo ID)
                    // Adiciona dados do formulário que podem não vir do backend
                    deliveryDate: recordData.deliveryDate,
                    deliveryCondition: recordData.deliveryCondition,
                    deliveryNotes: recordData.deliveryNotes,
                    accessories: recordData.accessories,
                    delivery_checker: recordData.deliveryChecker,
                    employeePosition: employee?.position || 'N/A' // Busca cargo
                 };
            }

            // Recarrega a tabela (vai para pág 1 se criou, mantém pág atual se editou)
            await fetchRecordsPage(isEditing ? state.mainTable.currentPage : 1);
            closeModal(recordModal); // Fecha o modal

        } catch (error) {
        // Se chegou aqui, a operação falhou
        console.error("Erro ao salvar o termo:", error);
        
        // Verifica se é erro de conflito (aparelho em uso)
        if (error.message && error.message.includes('já está associado ao termo')) {
            const termoId = extractTermoIdFromError(error.message);
            if (termoId) {
                showConflictModal(error.message, termoId);
            } else {
                showToast(error.message, true);
            }
        } else {
            showToast(`Erro ao salvar: ${error.message}`, true);
        }
        success = false;
        
    } finally {
        // Este bloco executa SEMPRE
        unsetLoading(saveButton);
        isSubmitting = false;

        // Imprime automaticamente APENAS se sucesso E for POST
        if (success && printData) {
            try {
                await printSingleRecord(printData);
            } catch (printError) {
                 console.error("Erro durante a impressão automática:", printError);
                 showToast("Termo salvo, mas houve erro ao gerar a impressão.", true);
            }
        }
    }
    });

    // Listener para o botão "Imprimir" DENTRO do modal
     const printTermBtn = document.getElementById('print-term-btn');
     if(printTermBtn) {
        printTermBtn.addEventListener('click', () => {
            const recordId = document.getElementById('record-id').value;
            if (recordId) {
                // Se está a editar (tem ID), busca os dados mais recentes para imprimir
                printSingleRecord(parseInt(recordId, 10));
            } else {
                 // Se é um novo termo (sem ID), imprime com os dados atuais do formulário
                 const employeeSelect = document.getElementById('employeeSelect');
                 const deviceSelect = document.getElementById('deviceSelect');
                 const selectedEmployee = state.employees.find(e => e.id === employeeSelect.value);
                 const selectedDevice = state.devices.find(d => d.imei1 === deviceSelect.value);

                 // Verifica se selecionou funcionário e aparelho
                 if (!selectedEmployee || !selectedDevice) {
                    showToast("Selecione Funcionário e Aparelho para imprimir.", true);
                    return;
                 }

                 // Monta o objeto de dados a partir do formulário
                const formDataForPrint = {
                    id: 'Novo', // Identifica como não salvo
                    employeeName: selectedEmployee.name,
                    employeeMatricula: selectedEmployee.id,
                    employeePosition: selectedEmployee.position,
                    deviceModel: selectedDevice.model,
                    deviceImei: selectedDevice.imei1,
                    deviceLine: document.getElementById('deviceLineDisplay').value || 'N/A',
                    deliveryDate: document.getElementById('deliveryDate').value,
                    deliveryCondition: document.getElementById('deliveryCondition').value,
                    deliveryNotes: document.getElementById('deliveryNotes').value,
                    accessories: Array.from(document.querySelectorAll('input[name="accessories"]:checked')).map(cb => cb.value),
                    delivery_checker: state.currentUser?.nome || 'N/A',
                    // Campos de devolução vazios para novo termo
                    data_devolucao: null,
                    condicao_devolucao: null,
                    notas_devolucao: null,
                    return_checker: null
                };
                 // Chama diretamente a função de gerar HTML, sem precisar buscar dados
                 const content = generatePrintableTermHTML(formDataForPrint);
                 printContent(content);
            }
        });
    }


} // Fim de initRecordsModule

