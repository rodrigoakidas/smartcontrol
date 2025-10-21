// --- MÓDULO DE RELATÓRIOS E IMPRESSÃO (REPORTS.JS) ---

import { state } from '../app.js';
import { openModal, closeModal, showToast, formatDateForInput } from './ui.js';

export function getReportHeader() {
    const info = state.companyInfo;
    const logoHtml = info && info.logo 
        ? `<img src="data:image/png;base64,${info.logo}" alt="Logótipo" style="height:50px;max-width:180px;" onerror="this.style.display='none'">` 
        : '';

    return `
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:20px;">
            <div>
                <h2 style="font-size:16px;font-weight:700;margin:0;">${info && info.nome ? info.nome : 'Relatório do Sistema'}</h2>
                <p style="font-size:12px;margin:0;">CNPJ: ${info && info.cnpj ? info.cnpj : 'Não informado'}</p>
            </div>
            ${logoHtml}
        </div>
    `;
}

export function printContent(htmlContent) {
    const printSection = document.getElementById('print-section');
    if (printSection) {
        printSection.innerHTML = htmlContent;
        setTimeout(() => {
            window.print();
            printSection.innerHTML = '';
        }, 100);
    }
}

function generateReport(title, headers, dataRows, reportModal) {
    const now = new Date();
    const timestamp = `Gerado em: ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')}`;
    const content = `
        <div class="p-8 bg-white font-sans">
            ${getReportHeader()}
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-xl font-bold">${title}</h2>
                <p class="text-sm text-gray-500">${timestamp}</p>
            </div>
            <table class="w-full text-left border-collapse text-sm">
                <thead><tr class="border-b-2 border-gray-400">${headers.map(h => `<th class="p-2 font-bold text-gray-700">${h}</th>`).join('')}</tr></thead>
                <tbody>${dataRows.join('')}</tbody>
            </table>
        </div>`;
    printContent(content);
    closeModal(reportModal);
}

function generateGeneralReport(reportModal) {
    const headers = ['Funcionário', 'Matrícula', 'Aparelho', 'IMEI', 'Data Entrega', 'Status'];
    const rows = state.records.map(r => `<tr class="border-b"><td class="p-2">${r.employeeName}</td><td class="p-2">${r.employeeMatricula}</td><td class="p-2">${r.deviceModel}</td><td class="p-2">${r.deviceImei}</td><td class="p-2">${new Date(r.deliveryDate).toLocaleDateString('pt-BR',{timeZone:'UTC'})}</td><td class="p-2">${r.status}</td></tr>`);
    generateReport('Relatório Geral de Movimentações', headers, rows, reportModal);
}

function generateDevicesReport(reportModal) {
    const headers = ['Modelo', 'IMEI', 'Status', 'Condição', 'Linha', 'Funcionário Atual'];
    const rows = state.devices.map(d => {
        let empName = '---';
        if (d.status === 'Em uso') {
            const rec = state.records.find(r => r.deviceImei === d.imei1 && r.status === 'Em Uso');
            if (rec) empName = rec.employeeName;
        }
        return `<tr class="border-b"><td class="p-2">${d.model}</td><td class="p-2">${d.imei1}</td><td class="p-2">${d.status}</td><td class="p-2">${d.condition}</td><td class="p-2">${d.currentLine||'---'}</td><td class="p-2">${empName}</td></tr>`;
    });
    generateReport('Relatório de Inventário de Aparelhos', headers, rows, reportModal);
}

function generateLinesReport(reportModal) {
    const headers = ['Número', 'Operadora', 'Plano', 'Status', 'Aparelho Vinculado (IMEI)'];
    const rows = state.lines.map(line => `<tr class="border-b"><td class="p-2">${line.numero}</td><td class="p-2">${line.operadora}</td><td class="p-2">${line.plano||'---'}</td><td class="p-2">${line.status}</td><td class="p-2">${line.imeiVinculado||'---'}</td></tr>`);
    generateReport('Relatório de Inventário de Linhas', headers, rows, reportModal);
}

function generateMaintenanceReport(reportModal) {
    const headers = ['Aparelho', 'IMEI', 'Data Envio', 'Data Retorno', 'Defeito', 'Custo', 'Status'];
    const rows = state.maintenance.map(m => `<tr class="border-b"><td class="p-2">${m.deviceModel}</td><td class="p-2">${m.deviceImei}</td><td class="p-2">${formatDateForInput(m.data_envio)}</td><td class="p-2">${m.data_retorno?formatDateForInput(m.data_retorno):'---'}</td><td class="p-2">${m.defeito_reportado}</td><td class="p-2">${m.custo?'R$ ' + parseFloat(m.custo).toFixed(2):'---'}</td><td class="p-2">${m.status}</td></tr>`);
    generateReport('Relatório de Manutenção de Aparelhos', headers, rows, reportModal);
}

export function generateRepairAuthorization(maintId) {
    const maint = state.maintenance.find(m => m.id === maintId);
    if (!maint || !maint.custo) { showToast("Custo não informado para gerar autorização.", true); return; }

    const device = state.devices.find(d => d.imei1 === maint.deviceImei);
    const content = `
        <div class="p-8 bg-white font-sans text-sm">
            ${getReportHeader()}
            <h1 class="text-xl font-bold text-center my-4">AUTORIZAÇÃO DE CONSERTO</h1>
            <div class="mt-6 border-t pt-4">
                <h2 class="text-lg font-bold mb-2">1. EQUIPAMENTO</h2>
                <div class="grid grid-cols-2 gap-x-4">
                    <div><strong>Modelo:</strong> ${device.model}</div>
                    <div><strong>IMEI:</strong> ${device.imei1}</div>
                </div>
            </div>
            <div class="mt-6 border-t pt-4">
                <h2 class="text-lg font-bold mb-2">2. DETALHES DO REPARO</h2>
                <p><strong>Defeito Reportado:</strong> ${maint.defeito_reportado}</p>
                <p><strong>Fornecedor:</strong> ${maint.fornecedor || 'N/A'}</p>
                <p class="font-bold"><strong>Custo Autorizado:</strong> R$ ${parseFloat(maint.custo).toFixed(2)}</p>
            </div>
            <div class="mt-16 pt-4 text-center text-sm">
                <p class="text-xs mb-8">Autorizamos o conserto do equipamento descrito, pelo valor estipulado.</p>
                <div class="flex justify-around">
                    <div class="w-2/5 text-center"><div class="border-b border-gray-500 pb-2"></div><p class="mt-1">Assinatura do Gestor</p></div>
                    <div class="w-2/5 text-center"><div class="border-b border-gray-500 pb-2"></div><p class="mt-1">Assinatura do Responsável (TI)</p></div>
                </div>
            </div>
        </div>
    `;
    printContent(content);
}

export function initReportsModule() {
    const reportModal = document.getElementById('report-modal');
    const generateReportBtn = document.getElementById('generate-report-btn');
    const closeReportModalBtn = document.getElementById('close-report-modal-btn');
    const reportGeneralBtn = document.getElementById('report-general-btn');
    const reportDevicesBtn = document.getElementById('report-devices-btn');
    const reportLinesBtn = document.getElementById('report-lines-btn');
    const reportMaintenanceBtn = document.getElementById('report-maintenance-btn');

    if (generateReportBtn) generateReportBtn.addEventListener('click', () => openModal(reportModal));
    if (closeReportModalBtn) closeReportModalBtn.addEventListener('click', () => closeModal(reportModal));
    if (reportGeneralBtn) reportGeneralBtn.addEventListener('click', () => generateGeneralReport(reportModal));
    if (reportDevicesBtn) reportDevicesBtn.addEventListener('click', () => generateDevicesReport(reportModal));
    if (reportLinesBtn) reportLinesBtn.addEventListener('click', () => generateLinesReport(reportModal));
    if (reportMaintenanceBtn) reportMaintenanceBtn.addEventListener('click', () => generateMaintenanceReport(reportModal));
}