// SMARTCONTROL/static/js/modules/line_records.js
// VERSÃO CORRIGIDA - Substitua TODO o conteúdo do arquivo por este código

import { state } from '../app.js';
import { openModal, closeModal, showToast, formatDateForInput, setLoading, unsetLoading } from './ui.js';
import { API_URL } from './api.js';
import { getReportHeader, printContent, renderTemplate } from './reports.js';

function printLineTerm(recordData) {
    const deliveryDate = recordData.data_entrega
        ? new Date(recordData.data_entrega.replace(/-/g, '/')).toLocaleDateString('pt-BR')
        : 'Data Inválida';

    const templateData = {
        header: getReportHeader(),
        id: recordData.id ? String(recordData.id).padStart(5, '0') : '_____',
        employeeName: recordData.employeeName || 'N/A',
        employeeMatricula: recordData.employeeMatricula || 'N/A',
        numero: recordData.numero || 'N/A',
        deliveryDate: deliveryDate,
        delivererName: state.currentUser?.nome || 'Sistema',
        generationTimestamp: new Date().toLocaleString('pt-BR')
    };

    const content = renderTemplate('line-term-print-template', templateData);
    printContent(content);
}

window.openLineTermForm = (lineId, lineNumber) => {
    const modal = document.getElementById('line-term-modal');
    const form = document.getElementById('line-term-form');
    form.reset();

    document.getElementById('line-term-line-id').value = lineId;
    document.getElementById('line-term-number-display').value = lineNumber;
    document.getElementById('line-term-delivery-date').value = formatDateForInput(new Date());

    const employeeSelect = document.getElementById('line-term-employee-select');
    const options = ['<option value="">Selecione...</option>'];
    state.employees.forEach(e => {
        options.push(`<option value="${e.matricula}">${e.name} (${e.matricula})</option>`);
    });
    // Define o HTML uma única vez, o que é muito mais eficiente.
    employeeSelect.innerHTML = options.join('');

    openModal(modal);
}

export function initLineRecordsModule() {
    const form = document.getElementById('line-term-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveButton = form.querySelector('button[type="submit"]');
        
        const payload = {
            linha_id: document.getElementById('line-term-line-id').value,
            matricula_funcionario: document.getElementById('line-term-employee-select').value,
            data_entrega: document.getElementById('line-term-delivery-date').value,
            currentUser: state.currentUser
        };

        setLoading(saveButton);
        try {
            const res = await fetch(`${API_URL}/api/line_records/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.message);
            
            showToast(result.message);
            closeModal(document.getElementById('line-term-modal'));
            
            if (result.newRecord) {
                printLineTerm({ ...result.newRecord, data_entrega: payload.data_entrega });
            }

        } catch (error) {
            showToast(`Erro: ${error.message}`, true);
        } finally {
            unsetLoading(saveButton);
        }
    });

    const printBtn = document.getElementById('line-term-print-btn');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            showToast("Salve o termo primeiro para poder imprimir.", true);
        });
    }
}
