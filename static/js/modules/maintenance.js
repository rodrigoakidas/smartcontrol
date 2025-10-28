// SMARTCONTROL/static/js/modules/maintenance.js
import { state, fetchAllData, fetchData } from '../app.js';
import { openModal, closeModal, showToast, formatDateForInput } from './ui.js';
import { API_URL } from './api.js';
import { getReportHeader, printContent, renderTemplate } from './reports.js';

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

// Substitua a função generateRepairOrder em maintenance.js por esta versão melhorada:
async function generateRepairOrder(maintId) {
    if (!maintId) {
        showToast("ID da manutenção não encontrado.", true);
        return;
    }
    try {
        const maintDetails = state.maintenance.find(m => m.id === maintId);
        if (!maintDetails) throw new Error("Dados da manutenção não localizados.");

        const statusColors = { 'Concluído': '#10b981', 'Em manutenção': '#f59e0b', 'Cancelado': '#ef4444' };

        const templateData = {
            header: getReportHeader(),
            numero_os: maintDetails.numero_os || 'N/A',
            status: maintDetails.status || 'Em manutenção',
            status_bg_color: statusColors[maintDetails.status] || '#6b7280',
            modelo: maintDetails.modelo || 'N/A',
            imei1: maintDetails.imei1 || 'N/A',
            fornecedor: maintDetails.fornecedor || 'Não especificado',
            data_envio: maintDetails.data_envio ? new Date(maintDetails.data_envio.replace(/-/g, '/')).toLocaleDateString('pt-BR') : 'N/A',
            data_retorno: maintDetails.data_retorno ? new Date(maintDetails.data_retorno.replace(/-/g, '/')).toLocaleDateString('pt-BR') : 'Em aberto',
            defeito_reportado: maintDetails.defeito_reportado || 'Nenhum defeito reportado.',
            custo: maintDetails.custo && parseFloat(maintDetails.custo) > 0 ? `R$ ${parseFloat(maintDetails.custo).toFixed(2)}` : 'A definir',
            operatorName: state.currentUser?.nome || 'Operador do Sistema',
            generationTimestamp: new Date().toLocaleString('pt-BR'),
            servico_realizado_section: '',
            custo_aviso_section: ''
        };

        if (maintDetails.servico_realizado) {
            templateData.servico_realizado_section = `
                <tr>
                    <td class="data-label" style="vertical-align:top;">Serviço Realizado:</td>
                    <td><div style="background:#e6f7ff; padding:8px; border-left:3px solid #1890ff;">${maintDetails.servico_realizado}</div></td>
                </tr>`;
        }

        if (maintDetails.custo && parseFloat(maintDetails.custo) > 0) {
            templateData.custo_aviso_section = `
                <div style="background:#fef3c7; border:2px solid #f59e0b; padding:16px; border-radius:8px; margin:20px 0; font-size:11px; line-height:1.6;">
                    <p style="margin:0;"><strong>⚠️ Atenção:</strong> O valor acima representa o custo autorizado para o reparo. Qualquer custo adicional deverá ser previamente aprovado pela administração.</p>
                </div>`;
        }

        const content = renderTemplate('maintenance-os-print-template', templateData);
        printContent(content);
    } catch (error) {
        showToast(error.message, true);
    }
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
                
                // Otimização: Recarrega apenas os dados de manutenção e o dashboard.
                const [updatedMaintenance, updatedDevices] = await Promise.all([fetchData('maintenance'), fetchData('devices')]);
                updateState({ maintenance: updatedMaintenance, devices: updatedDevices });
                await refreshDashboard();

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
                    
                    // Otimização: Recarrega apenas os dados de manutenção e o dashboard.
                    const [updatedMaintenance, updatedDevices] = await Promise.all([fetchData('maintenance'), fetchData('devices')]);
                    updateState({ maintenance: updatedMaintenance, devices: updatedDevices });
                    await refreshDashboard();

                    renderMaintenanceTable(maintenanceTableBody, noMaintenanceMessage);
                } catch (error) {
                    showToast(`Erro: ${error.message}`, true);
                }
            }
        });
    }

}
