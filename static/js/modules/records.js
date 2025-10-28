// SMARTCONTROL/static/js/modules/records.js

import { state } from '../app.js';
import { showToast } from './ui.js';
import { fetchItemById } from './api.js';
import { getReportHeader, printContent, renderTemplate } from './reports.js';
import { initRecordsFormModule, openRecordForm } from './records_form.js';
import { initRecordsTableModule, fetchRecordsPage, renderMainTable } from './records_table.js'; // Import from records_table.js

// Flag para controlar impressão
let isPrinting = false;

/**
 * Prepara os dados e renderiza o HTML do termo usando templates.
 * @param {object} data - Os dados brutos do registro.
 * @returns {string} O HTML final pronto para impressão.
 */
function generatePrintableTermHTML(data) {
    const accessories = data.acessorios || data.accessories || [];
    const deliveryDateStr = data.data_entrega || data.deliveryDate;
    const returnDateStr = data.data_devolucao || data.returnDate;

    // Prepara os dados para o template principal
    const templateData = {
        header: getReportHeader(),
        id: data.id && data.id !== 'Novo' ? String(data.id).padStart(5, '0') : '_____',
        employeeName: data.employeeName || 'N/A',
        employeeMatricula: data.employeeMatricula || 'N/A',
        employeePosition: data.employeePosition || 'N/A',
        deviceModel: data.deviceModel || 'N/A',
        deviceImei: data.deviceImei || 'N/A',
        deviceLine: data.deviceLine || 'Sem linha vinculada',
        accessories: accessories.length > 0 ? accessories.join(', ') : 'Nenhum',
        deliveryDate: deliveryDateStr ? new Date(deliveryDateStr.replace(/-/g, '/')).toLocaleDateString('pt-BR') : 'Data Inválida',
        deliveryCondition: data.condicao_entrega || data.deliveryCondition || 'N/A',
        deliveryNotes: data.notas_entrega || data.deliveryNotes || 'Nenhuma observação',
        delivererName: data.delivery_checker || state.currentUser?.nome || 'N/A',
        generationTimestamp: new Date().toLocaleString('pt-BR'),
        returnSection: '' // Inicialmente vazio
    };

    // Se houver dados de devolução, renderiza o template de devolução
    if (returnDateStr) {
        const returnTemplateData = {
            returnDate: new Date(returnDateStr.replace(/-/g, '/')).toLocaleDateString('pt-BR'),
            returnCondition: data.condicao_devolucao || 'N/A',
            returnNotes: data.notas_devolucao || 'Nenhuma observação',
            receiverName: data.return_checker || state.currentUser?.nome || 'N/A',
            employeeName: templateData.employeeName // Reutiliza o nome do funcionário
        };
        templateData.returnSection = renderTemplate('record-return-section-template', returnTemplateData);
    }

    // Renderiza o template principal com todos os dados preparados
    return renderTemplate('record-term-print-template', templateData);
}

// Função auxiliar para imprimir (COM FLAG isPrinting)
export async function printSingleRecord(recordOrData) {
    if (isPrinting) { console.warn("Impressão já em andamento, ignorando."); return; }
    isPrinting = true;
    showToast('A gerar termo para impressão...');
    let recordDataToPrint;
    try {
        if (typeof recordOrData === 'object' && recordOrData !== null) {
            const employee = state.employees.find(e => e.matricula === recordOrData.employeeMatricula);
            recordDataToPrint = { ...recordOrData, employeeName: employee?.name || recordOrData.employeeName || recordOrData.employeeMatricula, employeePosition: employee?.position || recordOrData.employeePosition || 'N/A' };
        }
        else if (typeof recordOrData === 'number' || (typeof recordOrData === 'string' && !isNaN(parseInt(recordOrData)))) {
             const recordId = parseInt(recordOrData, 10);
             const record = await fetchItemById('records', recordId);
             if (!record) throw new Error('Registo não encontrado para impressão.');
             const employee = state.employees.find(e => e.matricula === record.employeeMatricula);
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
    // Inicializa o módulo do formulário
    initRecordsFormModule();
    // Inicializa o módulo da tabela
    initRecordsTableModule();

    // Listener botão Imprimir DENTRO do modal
    const printTermBtn = document.getElementById('print-term-btn');
    if(printTermBtn) {
        printTermBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();

            const recordId = document.getElementById('record-id').value;
            if (recordId) {
                printSingleRecord(parseInt(recordId, 10)); // Edição
            } else {
                 // Novo Termo
                 isPrinting = true;
                 if (isPrinting) { console.warn("Impressão já em andamento."); return; }
                 try {
                     const employeeSelect = document.getElementById('employeeSelect');
                     const deviceSelect = document.getElementById('deviceSelect');
                     const selectedEmployee = state.employees.find(emp => emp.matricula === employeeSelect.value);
                     const selectedDevice = state.devices.find(d => d.imei1 === deviceSelect.value);
                     if (!selectedEmployee || !selectedDevice) { showToast("Selecione Funcionário e Aparelho para imprimir.", true); return; } // Valida
                     const formDataForPrint = { id: 'Novo', employeeName: selectedEmployee.name, employeeMatricula: selectedEmployee.matricula, employeePosition: selectedEmployee.position, deviceModel: selectedDevice.model, deviceImei: selectedDevice.imei1, deviceLine: document.getElementById('deviceLineDisplay').value || 'N/A', deliveryDate: document.getElementById('deliveryDate').value, deliveryCondition: document.getElementById('deliveryCondition').value, deliveryNotes: document.getElementById('deliveryNotes').value, accessories: Array.from(document.querySelectorAll('input[name="accessories"]:checked')).map(cb => cb.value), delivery_checker: state.currentUser?.nome || 'N/A', data_devolucao: null, condicao_devolucao: null, notas_devolucao: null, return_checker: null };
                     const content = generatePrintableTermHTML(formDataForPrint);
                     printContent(content);
                 } finally {
                    setTimeout(() => { isPrinting = false; }, 500); // Reseta flag
                 }
            }
        });
    }

    // fetchRecordsPage(1); // Initial fetch, now handled by records_table.js
}
