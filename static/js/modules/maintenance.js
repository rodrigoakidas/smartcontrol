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

// Substitua a função generateRepairOrder em maintenance.js por esta versão melhorada:

async function generateRepairOrder(maintId) {
    if (!maintId) {
        showToast("ID da manutenção não encontrado.", true);
        return;
    }
    
    try {
        const maintDetails = state.maintenance.find(m => m.id === maintId);
        if (!maintDetails) throw new Error("Dados da manutenção não localizados.");

        const operatorName = state.currentUser ? state.currentUser.nome : 'Operador do Sistema';
        const custoDisplay = maintDetails.custo && parseFloat(maintDetails.custo) > 0 
            ? `R$ ${parseFloat(maintDetails.custo).toFixed(2)}` 
            : 'A definir';

        const dataEnvio = maintDetails.data_envio 
            ? new Date(maintDetails.data_envio + 'T00:00:00').toLocaleDateString('pt-BR') 
            : 'N/A';
        
        const dataRetorno = maintDetails.data_retorno 
            ? new Date(maintDetails.data_retorno + 'T00:00:00').toLocaleDateString('pt-BR') 
            : 'Em aberto';

        const content = `
            <div style="padding:24px; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size:12px; color:#000; max-width:800px; margin:0 auto;">
                ${getReportHeader()}
                
                <h1 style="font-size:22px; font-weight:700; text-align:center; margin: 32px 0; text-transform:uppercase; border:3px solid #333; padding:16px; background:#f8f8f8;">
                    Ordem de Reparo Nº ${maintDetails.numero_os || 'N/A'}
                </h1>
                
                <!-- Status Badge -->
                <div style="text-align:center; margin:20px 0;">
                    <span style="display:inline-block; padding:8px 20px; background:${maintDetails.status === 'Concluído' ? '#10b981' : '#f59e0b'}; color:white; border-radius:20px; font-weight:600; font-size:14px;">
                        ${maintDetails.status || 'Em manutenção'}
                    </span>
                </div>
                
                <!-- SEÇÃO 1: EQUIPAMENTO -->
                <h3 style="font-size:16px; font-weight:700; margin: 24px 0 12px 0; border-bottom:2px solid #333; padding-bottom:8px;">
                    1. DADOS DO EQUIPAMENTO
                </h3>
                
                <table style="width:100%; border-collapse: collapse; margin-bottom: 20px;">
                    <tr>
                        <td style="padding:10px; border:1px solid #ddd; background:#f9f9f9; width:35%; font-weight:600;">Modelo:</td>
                        <td style="padding:10px; border:1px solid #ddd;">${maintDetails.modelo || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td style="padding:10px; border:1px solid #ddd; background:#f9f9f9; font-weight:600;">IMEI:</td>
                        <td style="padding:10px; border:1px solid #ddd; font-family:monospace; font-size:14px;">${maintDetails.imei1 || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td style="padding:10px; border:1px solid #ddd; background:#f9f9f9; font-weight:600;">Fornecedor/Assistência:</td>
                        <td style="padding:10px; border:1px solid #ddd;">${maintDetails.fornecedor || 'Não especificado'}</td>
                    </tr>
                </table>
                
                <!-- SEÇÃO 2: DETALHES DO REPARO -->
                <h3 style="font-size:16px; font-weight:700; margin: 24px 0 12px 0; border-bottom:2px solid #333; padding-bottom:8px;">
                    2. DETALHES DO REPARO
                </h3>
                
                <table style="width:100%; border-collapse: collapse; margin-bottom: 20px;">
                    <tr>
                        <td style="padding:10px; border:1px solid #ddd; background:#f9f9f9; width:35%; font-weight:600;">Data de Envio:</td>
                        <td style="padding:10px; border:1px solid #ddd;">${dataEnvio}</td>
                    </tr>
                    <tr>
                        <td style="padding:10px; border:1px solid #ddd; background:#f9f9f9; font-weight:600;">Data de Retorno:</td>
                        <td style="padding:10px; border:1px solid #ddd;">${dataRetorno}</td>
                    </tr>
                    <tr>
                        <td style="padding:10px; border:1px solid #ddd; background:#f9f9f9; font-weight:600; vertical-align:top;">Defeito Reportado:</td>
                        <td style="padding:10px; border:1px solid #ddd;">
                            <div style="background:#fff9e6; padding:8px; border-left:3px solid #f59e0b;">
                                ${maintDetails.defeito_reportado || 'Nenhum defeito reportado.'}
                            </div>
                        </td>
                    </tr>
                    ${maintDetails.servico_realizado ? `
                    <tr>
                        <td style="padding:10px; border:1px solid #ddd; background:#f9f9f9; font-weight:600; vertical-align:top;">Serviço Realizado:</td>
                        <td style="padding:10px; border:1px solid #ddd;">
                            <div style="background:#e6f7ff; padding:8px; border-left:3px solid #1890ff;">
                                ${maintDetails.servico_realizado}
                            </div>
                        </td>
                    </tr>
                    ` : ''}
                </table>
                
                <!-- SEÇÃO 3: CUSTOS -->
                <h3 style="font-size:16px; font-weight:700; margin: 24px 0 12px 0; border-bottom:2px solid #333; padding-bottom:8px;">
                    3. INFORMAÇÕES FINANCEIRAS
                </h3>
                
                <table style="width:100%; border-collapse: collapse; margin-bottom: 20px;">
                    <tr>
                        <td style="padding:10px; border:1px solid #ddd; background:#f9f9f9; width:35%; font-weight:600;">Custo Total:</td>
                        <td style="padding:10px; border:1px solid #ddd; font-size:18px; font-weight:700; color:#059669;">${custoDisplay}</td>
                    </tr>
                </table>
                
                ${maintDetails.custo && parseFloat(maintDetails.custo) > 0 ? `
                <div style="background:#fef3c7; border:2px solid #f59e0b; padding:16px; border-radius:8px; margin:20px 0;">
                    <p style="margin:0; font-size:11px; line-height:1.6;">
                        <strong>⚠️ Atenção:</strong> O valor acima representa o custo autorizado para o reparo. 
                        Qualquer custo adicional deverá ser previamente aprovado pela administração.
                    </p>
                </div>
                ` : ''}
                
                <!-- SEÇÃO 4: AUTORIZAÇÕES -->
                <h3 style="font-size:16px; font-weight:700; margin: 40px 0 12px 0; border-bottom:2px solid #333; padding-bottom:8px;">
                    4. AUTORIZAÇÕES
                </h3>
                
                <div style="background:#f0f0f0; padding:16px; border-radius:8px; margin:20px 0;">
                    <p style="font-size:11px; line-height:1.6; margin:0;">
                        Autorizamos o envio do equipamento acima descrito para diagnóstico e reparo, 
                        conforme os termos e condições estabelecidos pela empresa.
                    </p>
                </div>
                
                <div style="margin-top:80px; display:grid; grid-template-columns: repeat(3, 1fr); gap:20px; text-align:center;">
                    <div>
                        <div style="border-bottom:2px solid #000; height:60px; margin-bottom:8px;"></div>
                        <p style="font-weight:600; margin:4px 0;">Gestor</p>
                        <p style="font-size:10px; color:#666; margin:0;">Autorização</p>
                    </div>
                    <div>
                        <div style="border-bottom:2px solid #000; height:60px; margin-bottom:8px;"></div>
                        <p style="font-weight:600; margin:4px 0;">${operatorName}</p>
                        <p style="font-size:10px; color:#666; margin:0;">Responsável Técnico</p>
                    </div>
                    <div>
                        <div style="border-bottom:2px solid #000; height:60px; margin-bottom:8px;"></div>
                        <p style="font-weight:600; margin:4px 0;">Testemunha</p>
                        <p style="font-size:10px; color:#666; margin:0;">Testemunha</p>
                    </div>
                </div>
                
                <!-- Rodapé -->
                <div style="margin-top:60px; padding-top:16px; border-top:1px solid #ccc; text-align:center; font-size:10px; color:#666;">
                    <p style="margin:0;">Documento gerado eletronicamente em ${new Date().toLocaleString('pt-BR')}</p>
                    <p style="margin:4px 0;">OS: ${maintDetails.numero_os || 'N/A'} | Sistema SMARTCONTROL</p>
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
