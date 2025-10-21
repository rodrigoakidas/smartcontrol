// SMARTCONTROL/static/js/modules/line_records.js
import { state } from '../app.js';
import { openModal, closeModal, showToast, formatDateForInput, setLoading, unsetLoading } from './ui.js';
import { API_URL } from './api.js';
import { getReportHeader, printContent } from './reports.js';

function printLineTerm(recordData) {
    const deliveryDate = recordData.data_entrega ? new Date(recordData.data_entrega + 'T00:00:00').toLocaleDateString('pt-BR') : 'Data Inválida';
    const content = `
        <div style="padding:16px; font-family:sans-serif; font-size:12px; color:black;">
            ${getReportHeader()}
            <h2 style="font-size:18px; font-weight:700; text-align:center; margin: 24px 0;">TERMO DE RESPONSABILIDADE DE LINHA Nº ${recordData.id || '___'}</h2>
            <p>Declaro, para os devidos fins, que recebi da empresa o SIM Card (chip) da linha telefónica abaixo para uso exclusivo a serviço, sob minha total responsabilidade.</p>
            
            <h3 style="font-size:14px; font-weight:700; margin: 16px 0 8px 0; border-top:1px solid #ddd; padding-top:16px;">1. FUNCIONÁRIO</h3>
            <p><strong>Nome:</strong> ${recordData.employeeName || 'N/A'}</p>
            <p><strong>Matrícula:</strong> ${recordData.employee  || 'N/A'}</p>

            <h3 style="font-size:14px; font-weight:700; margin: 16px 0 8px 0; border-top:1px solid #ddd; padding-top:16px;">2. LINHA TELEFÓNICA</h3>
            <p><strong>Número:</strong> ${recordData.numero || 'N/A'}</p>
            <p><strong>Data de Entrega:</strong> ${deliveryDate}</p>

            <div style="margin-top:80px; display:flex; justify-content:space-around; text-align:center; font-size:12px;">
                <div style="width:40%;"><div style="border-bottom:1px solid #333; height:48px;"></div><p>${recordData.employeeName || 'N/A'}</p></div>
                <div style="width:40%;"><div style="border-bottom:1px solid #333; height:48px;"></div><p>${state.currentUser.nome}</p></div>
            </div>
        </div>
    `;
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
    employeeSelect.innerHTML = '<option value="">Selecione...</option>';
    state.employees.forEach(e => {
        employeeSelect.innerHTML += `<option value="${e.id}">${e.name} (${e.id})</option>`;
    });

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
            matricula_funcionario: document.getElementById('line-term-employee-select').value, // Verifique se esta linha está correta
            data_entrega: document.getElementById('line-term-delivery-date').value,
            currentUser: state.currentUser // Adicione esta linha para enviar o utilizador logado
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

    document.getElementById('line-term-print-btn').addEventListener('click', () => {
        // Implementar lógica de impressão para um termo já existente se necessário
        showToast("Salve o termo primeiro para poder imprimir.", true);
    });
}