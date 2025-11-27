// --- MÓDULO DE APARELHOS (REFATORADO E PADRONIZADO) ---
import { state, fetchAllData } from '../app.js';
import { openModal, closeModal, showToast, formatDateForInput } from './ui.js';
import { api } from '../api/api.js';

function getStatusBadge(status) {
    const map = {
        'Em uso': 'bg-blue-100 text-blue-800',
        'Disponível': 'bg-green-100 text-green-800',
        'Indisponível': 'bg-yellow-100 text-yellow-800'
    };
    return map[status] || 'bg-gray-100 text-gray-800';
}

function getConditionBadge(condition) {
    const map = {
        'Novo': 'bg-blue-100 text-blue-800',
        'Aprovado para uso': 'bg-green-100 text-green-800',
        'Em manutenção': 'bg-orange-100 text-orange-800',
        'Danificado': 'bg-yellow-100 text-yellow-800',
        'Sinistrado': 'bg-red-100 text-red-800',
        'Com Defeito': 'bg-pink-100 text-pink-800'
    };
    return map[condition] || 'bg-gray-100 text-gray-800';
}

function renderDevices(devices = state.devices) {
    const tbody = document.getElementById('device-table-body');
    const empty = document.getElementById('no-devices-message');

    if (!devices || devices.length === 0) {
        empty.classList.remove('hidden');
        tbody.innerHTML = '';
        return;
    }

    empty.classList.add('hidden');
    tbody.innerHTML = devices.map(device => `
        <tr class="border-b">
            <td class="p-3">${device.model}</td>
            <td class="p-3">${device.imei1}</td>
            <td class="p-3">${device.currentLine || '---'}</td>
            <td class="p-3"><span class="px-2 py-1 text-xs rounded-full ${getStatusBadge(device.status)}">${device.status}</span></td>
            <td class="p-3"><span class="px-2 py-1 text-xs rounded-full ${getConditionBadge(device.condition)}">${device.condition}</span></td>
            <td class="p-3 text-center space-x-1">
                <button data-action="history" data-imei="${device.imei1}" class="text-blue-600 p-2"><i data-lucide="history"></i></button>
                <button data-action="edit" data-imei="${device.imei1}" class="text-gray-600 p-2"><i data-lucide="edit"></i></button>
                <button data-action="delete" data-imei="${device.imei1}" class="text-red-600 p-2"><i data-lucide="trash-2"></i></button>
            </td>
        </tr>
    `).join('');

    if (window.lucide) lucide.createIcons();
}

function openDeviceForm(imei = null) {
    const form = document.getElementById('device-form');
    form.reset();
    document.getElementById('device-id-input').value = imei || '';

    const imeiInput = document.getElementById('deviceFormImei1');
    const lineSelect = document.getElementById('deviceFormLine');
    lineSelect.innerHTML = '<option value="">Nenhuma</option>';

    state.lines.filter(l => l.status === 'Ativa').forEach(line => {
        lineSelect.innerHTML += `<option value="${line.id}">${line.numero} (${line.operadora})</option>`;
    });

    if (imei) {
        const device = state.devices.find(d => d.imei1 === imei);
        imeiInput.value = device.imei1;
        imeiInput.readOnly = true;
        document.getElementById('deviceFormModel').value = device.model;
        document.getElementById('deviceFormImei2').value = device.imei2 || '';
        document.getElementById('deviceFormColorNotes').value = device.colorNotes || '';
        document.getElementById('deviceFormCondition').value = device.condition;

        const linkedLine = state.lines.find(l => l.imeiVinculado === imei);
        if (linkedLine) lineSelect.value = linkedLine.id;

        document.getElementById('device-modal-title').textContent = "Editar Aparelho";
    } else {
        imeiInput.readOnly = false;
        document.getElementById('device-modal-title').textContent = "Novo Aparelho";
    }

    openModal('device-form-modal');
}

async function showDeviceHistory(imei) {
    openModal('device-history-modal');

    const usageTbody = document.getElementById('device-history-table-body');
    const maintTbody = document.getElementById('device-maintenance-history-table-body');
    const auditTbody = document.getElementById('device-audit-history-table-body');

    usageTbody.innerHTML = maintTbody.innerHTML = auditTbody.innerHTML =
        `<tr><td colspan="5" class="p-4 text-center">Carregando...</td></tr>`;

    try {
        const history = await api(`/api/devices/${imei}/history`);

        // Histórico de uso
        usageTbody.innerHTML = history.utilizacao.length ?
            history.utilizacao.map(r =>
                `<tr class="border-b"><td class="p-3">${r.employeeName}</td><td class="p-3">${formatDateForInput(r.deliveryDate)}</td><td class="p-3">${r.returnDate ? formatDateForInput(r.returnDate) : 'Em uso'}</td></tr>`
            ).join('') :
            `<tr><td colspan="3" class="p-4 text-center">Sem histórico.</td></tr>`;

        // Histórico de manutenção
        maintTbody.innerHTML = history.manutencao.length ?
            history.manutencao.map(m =>
                `<tr class="border-b"><td class="p-3">${formatDateForInput(m.data_envio)}</td><td class="p-3">${m.data_retorno ? formatDateForInput(m.data_retorno) : '---'}</td><td class="p-3">${m.defeito_reportado}</td><td class="p-3">${m.custo ? 'R$ ' + parseFloat(m.custo).toFixed(2) : '---'}</td><td class="p-3">${m.status}</td></tr>`
            ).join('') :
            `<tr><td colspan="5" class="p-4 text-center">Sem histórico.</td></tr>`;

        // Histórico de auditoria
        const audit = await api(`/api/audit/device/${imei}`);
        auditTbody.innerHTML = audit.length ?
            audit.map(log =>
                `<tr class="border-b"><td class="p-3">${new Date(log.timestamp).toLocaleString('pt-BR')}</td><td class="p-3">${log.username || 'N/A'}</td><td class="p-3">${log.action_type}</td><td class="p-3 text-xs">${log.details}</td></tr>`
            ).join('') :
            `<tr><td colspan="4" class="p-4 text-center">Sem histórico.</td></tr>`;

    } catch (err) {
        showToast("Erro ao carregar histórico.", true);
    }
}

async function saveDevice(e) {
    e.preventDefault();

    const imeiOriginal = document.getElementById('device-id-input').value;
    const payload = Object.fromEntries(new FormData(e.target).entries());
    payload.currentUser = state.currentUser;

    try {
        if (imeiOriginal) {
            await api(`/api/devices/${imeiOriginal}`, "PUT", payload);
        } else {
            await api(`/api/devices/`, "POST", payload);
        }
        showToast("Aparelho salvo.");
        closeModal('device-form-modal');
        await fetchAllData();
        renderDevices();
    } catch (err) {
        showToast(err.message, true);
    }
}

async function deleteDevice(imei) {
    if (!confirm(`Excluir aparelho IMEI ${imei}?`)) return;

    try {
        await api(`/api/devices/${imei}`, "DELETE", { currentUser: state.currentUser });
        showToast("Aparelho excluído.");
        await fetchAllData();
        renderDevices();
    } catch (err) {
        showToast(err.message, true);
    }
}

export function initDevicesModule() {
    document.getElementById('manage-devices-btn')?.addEventListener('click', () => {
        renderDevices();
        openModal('device-list-modal');
    });

    document.getElementById('add-device-btn')?.addEventListener('click', () => openDeviceForm());

    document.getElementById('device-form')?.addEventListener('submit', saveDevice);

    document.getElementById('device-table-body')?.addEventListener('click', e => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const imei = btn.dataset.imei;
        if (btn.dataset.action === 'edit') return openDeviceForm(imei);
        if (btn.dataset.action === 'delete') return deleteDevice(imei);
        if (btn.dataset.action === 'history') return showDeviceHistory(imei);
    });

    document.getElementById('device-search-input')?.addEventListener('input', e => {
        const term = e.target.value.toLowerCase();
        renderDevices(state.devices.filter(d =>
            d.model.toLowerCase().includes(term) || d.imei1.includes(term)
        ));
    });

    document.getElementById('device-import-input')?.addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;
        const fd = new FormData();
        fd.append('file', file);
        fd.append('currentUser', JSON.stringify(state.currentUser));
        try {
            const res = await fetch(`/api/devices/import`, { method: 'POST', body: fd });
            const result = await res.json();
            if (!res.ok) throw new Error(result.message);
            showToast(result.message);
            await fetchAllData();
            renderDevices();
        } catch (err) {
            showToast(err.message, true);
        }
        e.target.value = '';
    });
}
