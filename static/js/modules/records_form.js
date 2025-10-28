// SMARTCONTROL/static/js/modules/records_form.js

import { state, fetchAllData, fetchData } from '../app.js';
import { openModal, closeModal, showToast, formatDateForInput, setLoading, unsetLoading } from './ui.js';
import { API_URL, fetchItemById, handleFileUpload } from './api.js';
import { printSingleRecord } from './records.js'; // Importa a função de impressão
import { fetchRecordsPage } from './records_table.js';
import { refreshDashboard } from './dashboard.js';

let isSubmitting = false; // Flag para controlar submissão do formulário

function extractTermoIdFromError(errorMessage) {
    const match = errorMessage.match(/Nº\s*(\d+)/);
    return match ? parseInt(match[1], 10) : null;
}

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

window.closeConflictModal = function() {
    const modal = document.getElementById('conflict-modal');
    if (modal) modal.remove();
};

window.viewExistingTermo = async function(termoId) {
    window.closeConflictModal();
    const recordModal = document.getElementById('record-modal');
    closeModal(recordModal);
    await new Promise(resolve => setTimeout(resolve, 300));
    openRecordForm(termoId);
};

export async function openRecordForm(recordId = null) {
    const form = document.getElementById('record-form');
    const modal = document.getElementById('record-modal');
    if (!form || !modal) {
        console.error("Formulário ou Modal de registo não encontrado!");
        return;
    }

    if (!recordId) {
        showToast("A carregar dados atualizados...");
        try {
            await fetchAllData();
        } catch (error) {
            showToast("Erro ao carregar dados atualizados. Não é possível criar novo termo.", true);
            console.error("Falha ao carregar dados em openRecordForm:", error);
            return;
        }
    }

    form.reset();
    document.getElementById('record-id').value = recordId || '';

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

    [viewDeliveryTermBtn, viewReturnTermBtn, viewPoliceReportBtn].forEach(btn => btn.classList.add('hidden'));
    [deliveryTermInput, returnTermInput, policeReportInput].forEach(input => { input.value = ''; input.disabled = false; });
    [returnTermSection, policeReportSection].forEach(section => section.style.display = 'none');
    returnFieldset.classList.add('hidden');

    const newSelect = returnConditionSelect.cloneNode(true);
    returnConditionSelect.parentNode.replaceChild(newSelect, returnConditionSelect);
    newSelect.addEventListener('change', (e) => {
        const condition = e.target.value;
        returnTermSection.style.display = (condition === 'Bom' || condition === 'Danificado') ? 'block' : 'none';
        policeReportSection.style.display = condition === 'Perda/Roubo' ? 'block' : 'none';
        returnTermInput.disabled = !(condition === 'Bom' || condition === 'Danificado');
        policeReportInput.disabled = !(condition === 'Perda/Roubo');
    });
    returnTermInput.disabled = true;
    policeReportInput.disabled = true;

    if (recordId) {
        modalTitle.textContent = "Ver/Editar Termo";
        deliveryFieldset.querySelectorAll('select, input:not([type="file"]), textarea').forEach(el => el.disabled = true);
        deliveryTermInput.disabled = false;
        returnFieldset.classList.remove('hidden');
        returnFieldset.querySelectorAll('select, input, textarea').forEach(el => el.disabled = false);

        try {
            const data = await fetchItemById('records', recordId);
            if (!data) { closeModal(modal); showToast("Termo não encontrado.", true); return; }

            // CORREÇÃO: Comparar a matrícula do funcionário (e.matricula) com a matrícula do registro (data.employeeMatricula).
            const employeeData = state.employees.find(e => e.matricula === data.employeeMatricula);
            employeeSelect.innerHTML = `<option value="${data.employeeMatricula}" selected disabled>${employeeData ? `${employeeData.name} (${employeeData.matricula})` : `Matrícula: ${data.employeeMatricula}`}</option>`;
            deviceSelect.innerHTML = `<option value="${data.deviceImei}" selected disabled>${data.deviceModel || 'Modelo Desconhecido'} (${data.deviceImei})</option>`;
            document.getElementById('deviceLineDisplay').value = data.deviceLine || 'Nenhuma';
            document.getElementById('deliveryDate').value = formatDateForInput(data.data_entrega);
            document.getElementById('deliveryCondition').value = data.condicao_entrega || '';
            document.getElementById('deliveryNotes').value = data.notas_entrega || '';
            document.querySelectorAll('input[name="accessories"]').forEach(cb => { cb.checked = false; cb.disabled = true; });
            if (data.acessorios && Array.isArray(data.acessorios)) {
                data.acessorios.forEach(acc => {
                    const cb = form.querySelector(`input[name="accessories"][value="${acc}"]`);
                    if (cb) cb.checked = true;
                });
            }
            if (data.termo_entrega_url) { viewDeliveryTermBtn.href = data.termo_entrega_url; viewDeliveryTermBtn.classList.remove('hidden'); }

            document.getElementById('returnDate').value = formatDateForInput(data.data_devolucao);
            const currentReturnConditionSelect = document.getElementById('returnCondition');
            currentReturnConditionSelect.value = data.condicao_devolucao || '';
            document.getElementById('returnNotes').value = data.notas_devolucao || '';
            document.getElementById('returnChecker').value = data.return_checker || '';
            if (data.termo_devolucao_url) { viewReturnTermBtn.href = data.termo_devolucao_url; viewReturnTermBtn.classList.remove('hidden'); }
            if (data.bo_url) { viewPoliceReportBtn.href = data.bo_url; viewPoliceReportBtn.classList.remove('hidden'); }

            currentReturnConditionSelect.dispatchEvent(new Event('change'));

        } catch (error) {
            showToast("Erro ao carregar detalhes para edição.", true);
            console.error("Erro buscar detalhes edição:", error);
            closeModal(modal);
            return;
        }
    } else {
        modalTitle.textContent = "Novo Termo de Responsabilidade";
        deliveryFieldset.querySelectorAll('select, input, textarea').forEach(el => el.disabled = false);
        returnFieldset.classList.add('hidden');
        returnFieldset.querySelectorAll('select, input, textarea').forEach(el => el.disabled = true);

        employeeSelect.innerHTML = '<option value="">Selecione um funcionário...</option>';
        if (state.employees && Array.isArray(state.employees) && state.employees.length > 0) {
            state.employees.forEach(e => {
                employeeSelect.innerHTML += `<option value="${e.matricula}">${e.name} (${e.matricula})</option>`;
            });
        }

        deviceSelect.innerHTML = '<option value="">Selecione um aparelho...</option>';
        if (state.devices && Array.isArray(state.devices)) {
            const availableDevices = state.devices.filter(d => d.status === 'Disponível');
            if (availableDevices.length > 0) {
                availableDevices.forEach(d => {
                    deviceSelect.innerHTML += `<option value="${d.imei1}">${d.model} (${d.imei1})</option>`;
                });
            } else {
                deviceSelect.innerHTML = '<option value="">Nenhum aparelho disponível</option>';
            }
        }

        document.getElementById('deliveryDate').value = formatDateForInput(new Date());
        document.getElementById('deliveryCondition').value = 'Novo';
        document.getElementById('deviceLineDisplay').value = '';
        document.querySelectorAll('input[name="accessories"]').forEach(cb => cb.checked = false);
        document.getElementById('deliveryNotes').value = '';
    }
    openModal(modal);
}

export function initRecordsFormModule() {
    const recordModal = document.getElementById('record-modal');
    const recordForm = document.getElementById('record-form');
    const deviceSelect = document.getElementById('deviceSelect');

    if (deviceSelect) {
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
    if (addRecordBtn) { addRecordBtn.addEventListener('click', () => openRecordForm()); }

    const cancelBtn = document.getElementById('cancel-btn');
    if (cancelBtn) { cancelBtn.addEventListener('click', () => closeModal(recordModal)); }

    if (recordForm) {
        recordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (isSubmitting) { console.warn("Submissão já em progresso."); return; }
            isSubmitting = true;

            const saveButton = recordForm.querySelector('button[type="submit"]');
            const recordId = document.getElementById('record-id').value;
            const isEditing = !!recordId;
            setLoading(saveButton);
            saveButton.disabled = true; // Desabilita o botão imediatamente
            let success = false;
            let createdRecordDataForPrint = null;

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
                     recordData = { employeeMatricula: document.getElementById('employeeSelect').value, deviceImei: document.getElementById('deviceSelect').value, deliveryDate: document.getElementById('deliveryDate').value, deliveryCondition: document.getElementById('deliveryCondition').value, deliveryNotes: document.getElementById('deliveryNotes').value, accessories: Array.from(document.querySelectorAll('input[name="accessories"]:checked')).map(cb => cb.value), deliveryChecker: state.currentUser?.nome || 'Sistema', currentUser: state.currentUser, deliveryTermUrl: deliveryTermUrl };
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
                     const employee = state.employees.find(e => e.matricula === recordData.employeeMatricula);
                     createdRecordDataForPrint = { ...result.newRecord, deliveryDate: recordData.deliveryDate, deliveryCondition: recordData.deliveryCondition, deliveryNotes: recordData.deliveryNotes, accessories: recordData.accessories, delivery_checker: recordData.deliveryChecker, employeePosition: employee?.position || 'N/A' };
                }

                closeModal(recordModal);
                // Otimização: Em vez de recarregar TUDO, recarregamos apenas o necessário.
                await Promise.all([
                    fetchRecordsPage(isEditing ? state.mainTable.currentPage : 1), // Atualiza a tabela de registros
                    refreshDashboard() // Atualiza os cartões e gráficos do dashboard
                ]);

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
                saveButton.disabled = false; // Reabilita o botão
                isSubmitting = false;

                if (success && createdRecordDataForPrint) {
                    try {
                        // A função printSingleRecord agora é importada de records.js
                        await printSingleRecord(createdRecordDataForPrint);
                    }
                    catch (printError) { console.error("Erro impressão automática:", printError); showToast("Termo salvo, mas erro ao gerar impressão.", true); }
                }
            }
        });
    }
}