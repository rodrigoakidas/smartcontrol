// --- MÓDULO DE APARELHOS (DEVICES.JS) ---

import { state, updateState, fetchData } from '../app.js';
import { openModal, closeModal, showToast, formatDateForInput } from './ui.js';
import { API_URL } from './api.js';
import { refreshDashboard } from './dashboard.js';

function getDeviceStatusClass(status) {
    const classes = { 'Em uso': 'bg-blue-100 text-blue-800', 'Disponível': 'bg-green-100 text-green-800', 'Indisponível': 'bg-yellow-100 text-yellow-800' };
    return classes[status] || 'bg-gray-100 text-gray-800';
}

function getDeviceConditionClass(condition) {
    const classes = { 'Novo': 'bg-blue-100 text-blue-800', 'Aprovado para uso': 'bg-green-100 text-green-800', 'Em manutenção': 'bg-orange-100 text-orange-800', 'Danificado': 'bg-yellow-100 text-yellow-800', 'Sinistrado': 'bg-red-100 text-red-800', 'Com Defeito': 'bg-pink-100 text-pink-800' };
    return classes[condition] || 'bg-gray-100 text-gray-800';
}

function renderDeviceTable(deviceTableBody, noDevicesMessage, devicesToRender = state.devices) {
    deviceTableBody.innerHTML = '';
    if (!devicesToRender || devicesToRender.length === 0) {
        noDevicesMessage.classList.remove('hidden');
        return;
    }
    noDevicesMessage.classList.add('hidden');
    
    const rowsHtml = devicesToRender.map(device => {
        const statusClass = getDeviceStatusClass(device.status);
        const conditionClass = getDeviceConditionClass(device.condition);
        return `
            <tr class="border-b">
                <td class="p-3">${device.model}</td>
                <td class="p-3">${device.imei1}</td>
                <td class="p-3">${device.currentLine || '---'}</td>
                <td class="p-3"><span class="px-2 py-1 text-xs font-medium rounded-full ${statusClass}">${device.status}</span></td>
                <td class="p-3"><span class="px-2 py-1 text-xs font-medium rounded-full ${conditionClass}">${device.condition}</span></td>
                <td class="p-3 text-center space-x-1">
                    <button data-action="history-device" data-imei="${device.imei1}" class="text-blue-600 p-2" title="Histórico do Aparelho"><i data-lucide="history"></i></button>
                    <button data-action="edit-device" data-imei="${device.imei1}" class="text-gray-600 p-2" title="Editar"><i data-lucide="edit"></i></button>
                    <button data-action="delete-device" data-imei="${device.imei1}" class="text-red-600 p-2" title="Excluir"><i data-lucide="trash-2"></i></button>
                </td>
            </tr>`;
    }).join('');

    deviceTableBody.innerHTML = rowsHtml;
    if(window.lucide) lucide.createIcons();
}

function openDeviceForm(deviceFormModal, deviceForm, imei = null) {
    deviceForm.reset();
    document.getElementById('device-id-input').value = imei || '';
    const imeiInput = document.getElementById('deviceFormImei1');
    const lineSelect = document.getElementById('deviceFormLine');
    lineSelect.innerHTML = '<option value="">Nenhuma</option>';
    
    state.lines.filter(l => l.status === 'Ativa' && (!l.imeiVinculado || (imei && l.imeiVinculado === imei))).forEach(line => {
        lineSelect.innerHTML += `<option value="${line.id}">${line.numero} (${line.operadora})</option>`;
    });

    if (imei) {
        const device = state.devices.find(d => d.imei1 === imei);
        document.getElementById('device-modal-title').textContent = "Editar Aparelho";
        imeiInput.value = device.imei1;
        imeiInput.readOnly = true;
        document.getElementById('deviceFormModel').value = device.model;
        document.getElementById('deviceFormImei2').value = device.imei2 || '';
        document.getElementById('deviceFormColorNotes').value = device.colorNotes || '';
        document.getElementById('deviceFormCondition').value = device.condition;
        const linkedLine = state.lines.find(l => l.imeiVinculado === imei);
        if (linkedLine) lineSelect.value = linkedLine.id;
    } else {
        document.getElementById('device-modal-title').textContent = "Novo Aparelho";
        imeiInput.readOnly = false;
    }
    openModal(deviceFormModal);
}

async function showDeviceHistory(deviceHistoryModal, imei) {
    const device = state.devices.find(d => d.imei1 === imei);
    if (!device) return;

    document.getElementById('history-device-name').textContent = `${device.model} (IMEI: ${device.imei1})`;
    const usageTbody = document.getElementById('device-history-table-body');
    const maintTbody = document.getElementById('device-maintenance-history-table-body');
    const auditTbody = document.getElementById('device-audit-history-table-body');
    
    usageTbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center">A carregar...</td></tr>';
    maintTbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center">A carregar...</td></tr>';
    auditTbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center">A carregar...</td></tr>';
    openModal(deviceHistoryModal);

    try {
        const response = await fetch(`${API_URL}/api/devices/${imei}/history`);
        const historyData = await response.json();
        
        usageTbody.innerHTML = '';
        if (historyData.utilizacao && historyData.utilizacao.length > 0) {
            document.getElementById('no-device-history-message').classList.add('hidden');
            historyData.utilizacao.forEach(r => {
                usageTbody.innerHTML += `<tr class="border-b"><td class="p-3">${r.employeeName}</td><td class="p-3">${formatDateForInput(r.deliveryDate)}</td><td class="p-3">${r.returnDate ? formatDateForInput(r.returnDate) : 'Em uso'}</td></tr>`;
            });
        } else {
            document.getElementById('no-device-history-message').classList.remove('hidden');
        }
        
        maintTbody.innerHTML = '';
        if (historyData.manutencao && historyData.manutencao.length > 0) {
            document.getElementById('no-device-maintenance-history-message').classList.add('hidden');
            historyData.manutencao.forEach(m => {
                maintTbody.innerHTML += `<tr class="border-b"><td class="p-3">${formatDateForInput(m.data_envio)}</td><td class="p-3">${m.data_retorno ? formatDateForInput(m.data_retorno) : '---'}</td><td class="p-3">${m.defeito_reportado}</td><td class="p-3">${m.custo ? 'R$ ' + parseFloat(m.custo).toFixed(2) : '---'}</td><td class="p-3">${m.status}</td></tr>`;
            });
        } else {
            document.getElementById('no-device-maintenance-history-message').classList.remove('hidden');
        }

        const noAuditMsg = document.getElementById('no-device-audit-history-message');
        const auditRes = await fetch(`${API_URL}/api/audit/device/${imei}`);
        const auditData = await auditRes.json();
        
        auditTbody.innerHTML = '';
        if (auditData && auditData.length > 0) {
            noAuditMsg.classList.add('hidden');
            auditData.forEach(log => {
                auditTbody.innerHTML += `
                    <tr class="border-b">
                        <td class="p-3">${new Date(log.timestamp).toLocaleString('pt-BR')}</td>
                        <td class="p-3">${log.username || 'N/A'}</td>
                        <td class="p-3">${log.action_type}</td>
                        <td class="p-3 text-xs">${log.details}</td>
                    </tr>
                `;
            });
        } else {
            noAuditMsg.classList.remove('hidden');
        }

    } catch(error) {
        console.error("Erro ao buscar histórico do aparelho:", error);
        usageTbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-red-500">Erro ao carregar.</td></tr>';
        maintTbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-red-500">Erro ao carregar.</td></tr>';
        auditTbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-red-500">Erro ao carregar.</td></tr>';
    }
}

export function initDevicesModule() {
    const deviceListModal = document.getElementById('device-list-modal');
    const deviceFormModal = document.getElementById('device-form-modal');
    const deviceHistoryModal = document.getElementById('device-history-modal');
    const deviceTableBody = document.getElementById('device-table-body');
    const deviceForm = document.getElementById('device-form');
    const noDevicesMessage = document.getElementById('no-devices-message');
    const deviceExportBtn = document.getElementById('device-export-btn');
    const manageDevicesBtn = document.getElementById('manage-devices-btn');
    const closeDeviceListBtn = document.getElementById('close-device-list-btn');
    const cancelDeviceFormBtn = document.getElementById('cancel-device-form-btn');
    const closeDeviceHistoryBtn = document.getElementById('close-device-history-modal-btn');
    const addDeviceBtn = document.getElementById('add-device-btn');
    const deviceImportInput = document.getElementById('device-import-input');
    const deviceSearchInput = document.getElementById('device-search-input');

    if (manageDevicesBtn) {
        manageDevicesBtn.addEventListener('click', () => {
            renderDeviceTable(deviceTableBody, noDevicesMessage);
            if (deviceSearchInput) deviceSearchInput.value = '';
            openModal(deviceListModal);
        });
    }

    if (closeDeviceListBtn) closeDeviceListBtn.addEventListener('click', () => closeModal(deviceListModal));
    if (cancelDeviceFormBtn) cancelDeviceFormBtn.addEventListener('click', () => closeModal(deviceFormModal));
    if (closeDeviceHistoryBtn) closeDeviceHistoryBtn.addEventListener('click', () => closeModal(deviceHistoryModal));
    if (addDeviceBtn) addDeviceBtn.addEventListener('click', () => openDeviceForm(deviceFormModal, deviceForm));

    if (deviceForm) {
        deviceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const imeiOriginal = document.getElementById('device-id-input').value;
            const isEditing = !!imeiOriginal;
            
            const deviceData = {
                model: document.getElementById('deviceFormModel').value,
                imei1: document.getElementById('deviceFormImei1').value,
                imei2: document.getElementById('deviceFormImei2').value,
                colorNotes: document.getElementById('deviceFormColorNotes').value,
                condition: document.getElementById('deviceFormCondition').value,
                linha_id: document.getElementById('deviceFormLine').value || null,
                currentUser: state.currentUser
            };

            const url = isEditing ? `${API_URL}/api/devices/${imeiOriginal}` : `${API_URL}/api/devices/`;
            const method = isEditing ? 'PUT' : 'POST';

            try {
                const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(deviceData) });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message);
                
                showToast(result.message);
                // Otimização: Recarrega apenas os dados de aparelhos e o dashboard.
                const updatedDevices = await fetchData('devices');
                updateState({ devices: updatedDevices });
                await refreshDashboard();

                // Re-renderiza a tabela com os dados atualizados do state.
                renderDeviceTable(deviceTableBody, noDevicesMessage, updatedDevices);
                closeModal(deviceFormModal);
            } catch (error) {
                showToast(`Erro: ${error.message}`, true);
            }
        });
    }

    if (deviceTableBody) {
        deviceTableBody.addEventListener('click', async (e) => {
            const button = e.target.closest('button[data-action]');
            if (!button) return;
            
            const imei = button.dataset.imei;
            const action = button.dataset.action;

            if (action === 'edit-device') {
                openDeviceForm(deviceFormModal, deviceForm, imei);
            } else if (action === 'delete-device') {
                if (!confirm(`Tem certeza que deseja excluir o aparelho de IMEI ${imei}?`)) return;
                try {
                    const response = await fetch(`${API_URL}/api/devices/${imei}`, { 
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ currentUser: state.currentUser })
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.message);
                    showToast(result.message);
                    // Otimização: Recarrega apenas os dados de aparelhos e o dashboard.
                    const updatedDevices = await fetchData('devices');
                    updateState({ devices: updatedDevices });
                    await refreshDashboard();

                    // Re-renderiza a tabela com os dados atualizados do state.
                    renderDeviceTable(deviceTableBody, noDevicesMessage, updatedDevices);
                } catch (error) {
                    showToast(`Erro: ${error.message}`, true);
                }
            } else if (action === 'history-device') {
                showDeviceHistory(deviceHistoryModal, imei);
            }
        });
    }
    
    if (deviceSearchInput) {
        deviceSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            const filteredDevices = state.devices.filter(device =>
                device.model.toLowerCase().includes(searchTerm) ||
                device.imei1.toLowerCase().includes(searchTerm)
            );
            renderDeviceTable(deviceTableBody, noDevicesMessage, filteredDevices);
        });
    }

    // --- LÓGICA DE IMPORTAÇÃO DE CSV ATIVADA ---
    if (deviceImportInput) {
        deviceImportInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            showToast('A importar ficheiro de aparelhos...');
            const formData = new FormData();
            formData.append('file', file);
            formData.append('currentUser', JSON.stringify(state.currentUser));

            try {
                const res = await fetch(`${API_URL}/api/devices/import`, {
                    method: 'POST',
                    body: formData,
                });

                const result = await res.json();
                if (!res.ok) throw new Error(result.message);

                showToast(result.message, false);
                if (result.failures && result.failures.length > 0) {
                    console.warn("Falhas na importação de aparelhos:", result.failures);
                    showToast(`${result.failures.length} aparelhos não puderam ser importados. Verifique a consola.`, true);
                }

                await fetchAllData();
                renderDeviceTable(deviceTableBody, noDevicesMessage);
            } catch (error) {
                showToast(`Erro na importação: ${error.message}`, true);
            } finally {
                e.target.value = '';
            }
        });
    }
}