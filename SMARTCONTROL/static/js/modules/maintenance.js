// SMARTCONTROL/static/js/modules/maintenance.js
import { state, fetchAllData } from '../app.js';
import { openModal, closeModal, showToast, formatDateForInput } from './ui.js';
import { API_URL } from './api.js';
import { getReportHeader, printContent } from './reports.js';

function renderMaintenanceTable(maintenanceTableBody, noMaintenanceMessage) {
    if (!maintenanceTableBody || !noMaintenanceMessage) return;
    maintenanceTableBody.innerHTML = "";
    if (!state.maintenance || state.maintenance.length === 0) {
        noMaintenanceMessage.classList.remove('hidden');
        return;
    }
    noMaintenanceMessage.classList.add('hidden');

    state.maintenance.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = 'border-b';
        
        // --- CORREÇÃO: Botão de impressão adicionado ---
        tr.innerHTML = `
            <td class="p-3">${item.numero_os || 'N/A'}</td>
            <td class="p-3">${item.modelo || 'N/A'} (${item.imei1 || ''})</td>
            <td class="p-3">${formatDateForInput(item.data_envio) || '---'}</td>
            <td class="p-3">${item.status || '---'}</td>
            <td class="p-3 text-center space-x-1">
                <button data-action="print-os" data-id="${item.id}" class="text-green-600 p-2" title="Imprimir OS"><i data-lucide="printer"></i></button>
                <button data-action="edit-maintenance" data-id="${item.id}" class="text-gray-600 p-2" title="Editar/Ver"><i data-lucide="file-pen-line"></i></button>
                <button data-action="delete-maintenance" data-id="${item.id}" class="text-red-600 p-2" title="Excluir"><i data-lucide="trash-2"></i></button>
            </td>
        `;
        maintenanceTableBody.appendChild(tr);
    });
    if(window.lucide) lucide.createIcons();
}

async function openMaintenanceForm(maintenanceForm, maintenanceFormModal, maintId = null) {
    maintenanceForm.reset();
    
    const maintIdInput = document.getElementById('maintenance-id-input');
    const deviceSelect = document.getElementById('maintenanceDeviceSelect');
    const dataEnvioInput = document.getElementById('maintenanceSendDate');
    const defeitoInput = document.getElementById('maintenanceDefect');
    const fornecedorInput = document.getElementById('maintenanceSupplier');
    const returnSection = document.getElementById('maintenance-return-section');
    
    deviceSelect.innerHTML = '<option value="">A carregar aparelhos...</option>';

    if (maintId) {
        // MODO EDIÇÃO
        try {
            deviceSelect.innerHTML = '<option value="">-- selecione --</option>';
            state.devices.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.id;
                opt.textContent = `${d.model} (${d.imei1 || '-'})`;
                deviceSelect.appendChild(opt);
            });

            const data = await fetch(`${API_URL}/api/maintenance/${maintId}`).then(res => res.json());
            if(!data) throw new Error('Falha ao obter registo');

            document.getElementById('maintenance-modal-title').textContent = `Editar OS ${data.numero_os || ''}`;
            maintIdInput.value = data.id;
            deviceSelect.value = data.aparelho_id;
            deviceSelect.disabled = true; 
            dataEnvioInput.value = formatDateForInput(data.data_envio);
            dataEnvioInput.readOnly = true;
            defeitoInput.value = data.defeito_reportado || '';
            fornecedorInput.value = data.fornecedor || '';

            returnSection.style.display = 'block';
            document.getElementById('maintenanceReturnDate').value = formatDateForInput(data.data_retorno);
            document.getElementById('maintenanceService').value = data.servico_realizado || '';
            document.getElementById('maintenanceCost').value = data.custo || '';
            document.getElementById('maintenanceStatus').value = data.status || 'Em manutenção';
            
        } catch (err) {
            showToast(`Erro ao carregar: ${err.message}`, true);
            return;
        }
    } else {
        // MODO CRIAÇÃO
        document.getElementById('maintenance-modal-title').textContent = "Novo Envio para Manutenção";
        maintIdInput.value = '';
        deviceSelect.disabled = false;
        dataEnvioInput.readOnly = false;
        dataEnvioInput.value = new Date().toISOString().slice(0,10);
        returnSection.style.display = 'none';
        
        try {
            const eligibleDevices = await fetch(`${API_URL}/api/devices/eligible-for-maintenance`).then(res => res.json());
            deviceSelect.innerHTML = '<option value="">-- selecione --</option>';
            if(eligibleDevices.length > 0) {
                eligibleDevices.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d.id;
                    opt.textContent = `${d.modelo} (${d.imei1 || '-'})`;
                    deviceSelect.appendChild(opt);
                });
            } else {
                deviceSelect.innerHTML = '<option value="">Nenhum aparelho elegível</option>';
            }
        } catch(e) {
            deviceSelect.innerHTML = '<option value="">Erro ao carregar</option>';
        }
    }
    openModal(maintenanceFormModal);
}

export function initMaintenanceModule() {
    const maintenanceListModal = document.getElementById("maintenance-list-modal");
    const maintenanceFormModal = document.getElementById("maintenance-form-modal");
    const maintenanceForm = document.getElementById('maintenance-form');
    const maintenanceTableBody = document.getElementById('maintenance-table-body');
    const noMaintenanceMessage = document.getElementById('no-maintenance-message');
    const manageMaintenanceBtn = document.getElementById("manage-maintenance-btn");
    const closeMaintenanceListBtn = document.getElementById("close-maintenance-list-btn");
    const addMaintenanceBtn = document.getElementById("add-maintenance-btn");
    const cancelMaintenanceFormBtn = document.getElementById("cancel-maintenance-form-btn");

    async function generateRepairOrder(maintId) {
        if (!maintId) {
            showToast("ID da manutenção não encontrado.", true);
            return;
        }
        
        try {
            const maintDetails = state.maintenance.find(m => m.id === maintId);
            if (!maintDetails) throw new Error("Dados da manutenção não localizados.");
    
            const operatorName = state.currentUser ? state.currentUser.nome : 'Operador do Sistema';
            const custoHtml = maintDetails.custo && parseFloat(maintDetails.custo) > 0 ? `<p><strong>Custo Estimado/Final:</strong> R$ ${parseFloat(maintDetails.custo).toFixed(2)}</p>` : '';

            const content = `
                <div style="padding:16px; font-family:sans-serif; font-size:12px; color:black;">
                    ${getReportHeader()}
                    <h2 style="font-size:18px; font-weight:700; text-align:center; margin: 24px 0;">
                        ORDEM DE REPARO Nº ${maintDetails.numero_os || 'N/A'}
                    </h2>
                    
                    <h3 style="font-size:14px; font-weight:700; margin-bottom:8px; border-top:1px solid #ddd; padding-top:16px;">1. EQUIPAMENTO</h3>
                    <p><strong>Modelo:</strong> ${maintDetails.modelo || 'N/A'}</p>
                    <p><strong>IMEI:</strong> ${maintDetails.imei1 || 'N/A'}</p>
                    <p><strong>Fornecedor:</strong> ${maintDetails.fornecedor || 'N/A'}</p>
                    
                    <h3 style="font-size:14px; font-weight:700; margin: 16px 0 8px 0; border-top:1px solid #ddd; padding-top:16px;">2. DEFEITO REPORTADO</h3>
                    <p>${maintDetails.defeito_reportado || 'Nenhum defeito reportado.'}</p>

                    <h3 style="font-size:14px; font-weight:700; margin: 16px 0 8px 0; border-top:1px solid #ddd; padding-top:16px;">3. CUSTOS</h3>
                    ${custoHtml || '<p>Nenhum custo informado.</p>'}
    
                    <div style="margin-top:80px; font-size:12px; text-align:center;">
                        <p>Autorizo o envio do equipamento acima para diagnóstico e reparo.</p>
                        <div style="margin-top:64px; display:flex; justify-content:space-around; text-align:center;">
                            <div style="width:30%;"><div style="border-bottom:1px solid #333; height:48px;"></div><p>Assinatura do Funcionário</p></div>
                            <div style="width:30%;"><div style="border-bottom:1px solid #333; height:48px;"></div><p>${operatorName}</p></div>
                            <div style="width:30%;"><div style="border-bottom:1px solid #333; height:48px;"></div><p>Assinatura da Testemunha</p></div>
                        </div>
                    </div>
                </div>
            `;
            printContent(content);
        } catch (error) {
            showToast(error.message, true);
        }
    }

    if (manageMaintenanceBtn) {
        manageMaintenanceBtn.addEventListener("click", () => {
            renderMaintenanceTable(maintenanceTableBody, noMaintenanceMessage);
            openModal(maintenanceListModal);
        });
    }
    if (closeMaintenanceListBtn) closeMaintenanceListBtn.addEventListener("click", () => closeModal(maintenanceListModal));
    if (addMaintenanceBtn) addMaintenanceBtn.addEventListener("click", () => openMaintenanceForm(maintenanceForm, maintenanceFormModal));
    if (cancelMaintenanceFormBtn) cancelMaintenanceFormBtn.addEventListener("click", () => closeModal(maintenanceFormModal));

    if (maintenanceForm) {
        maintenanceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const maintId = document.getElementById('maintenance-id-input').value;
            const isEditing = !!maintId;
            
            const payload = {
                aparelho_id: parseInt(document.getElementById('maintenanceDeviceSelect').value, 10) || null,
                data_envio: document.getElementById('maintenanceSendDate').value || null,
                defeito_reportado: document.getElementById('maintenanceDefect').value || '',
                fornecedor: document.getElementById('maintenanceSupplier').value || '',
                data_retorno: document.getElementById('maintenanceReturnDate').value || null,
                servico_realizado: document.getElementById('maintenanceService').value || '',
                custo: document.getElementById('maintenanceCost').value || 0.0,
                status: document.getElementById('maintenanceStatus').value || 'Em manutenção',
                postCondition: document.getElementById('maintenancePostCondition').value,
                currentUser: state.currentUser || {}
            };

            const url = isEditing ? `${API_URL}/api/maintenance/${maintId}` : `${API_URL}/api/maintenance/`;
            const method = isEditing ? 'PUT' : 'POST';

            try {
                const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                const result = await res.json();
                if (!res.ok) throw new Error(result.message || 'Erro na requisição');
                
                showToast(result.message);
                closeModal(maintenanceFormModal);
                await fetchAllData();
                renderMaintenanceTable(maintenanceTableBody, noMaintenanceMessage);

            } catch (error) {
                showToast(`Erro: ${error.message}`, true);
            }
        });
    }
    
    // --- CORREÇÃO: Lógica para o novo botão de impressão ---
    if (maintenanceTableBody) {
        maintenanceTableBody.addEventListener('click', async (e) => {
            const button = e.target.closest('button[data-action]');
            if (!button) return;
            const maintId = parseInt(button.dataset.id, 10);
            const action = button.dataset.action;

            if (action === 'print-os') {
                generateRepairOrder(maintId);
            } else if (action === 'edit-maintenance') {
                openMaintenanceForm(maintenanceForm, maintenanceFormModal, maintId);
            } else if (action === 'delete-maintenance') {
                if (!confirm('Tem certeza que deseja excluir?')) return;
                try {
                    const res = await fetch(`${API_URL}/api/maintenance/${maintId}`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ currentUser: state.currentUser || {} })
                    });
                    if (!res.ok) {
                        const err = await res.json();
                        throw new Error(err.message || 'Erro ao excluir');
                    }
                    showToast('Registo removido.');
                    await fetchAllData();
                    renderMaintenanceTable(maintenanceTableBody, noMaintenanceMessage);
                } catch (error) {
                    showToast(`Erro: ${error.message}`, true);
                }
            }
        });
    }
}