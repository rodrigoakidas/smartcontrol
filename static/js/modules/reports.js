// --- MÓDULO DE RELATÓRIOS E IMPRESSÃO (REPORTS.JS) ---

import { state } from '../app.js';
import { openModal, closeModal, showToast, formatDateForInput } from './ui.js';

export function getReportHeader() {
    const info = state.companyInfo;
    const logoHtml = info && info.logo
        // Aplicamos a classe 'company-logo' e removemos estilos inline exceto object-fit
        ? `<img src="data:image/png;base64,${info.logo}" alt="Logótipo" class="company-logo" style="object-fit:contain;" onerror="this.style.display='none'">`
        : '';

    // Usamos classes CSS para estrutura
    return `
        <div class="print-header">
            <div class="company-info">
                <h2 class="company-name">${info && info.nome ? info.nome : 'Relatório do Sistema'}</h2>
                <p class="company-cnpj">CNPJ: ${info && info.cnpj ? info.cnpj : 'Não informado'}</p>
            </div>
            ${logoHtml}
        </div>
    `;
}

export function printContent(htmlContent) {
    const printSection = document.getElementById('print-section');
    if (printSection) {
        printSection.innerHTML = htmlContent;
        window.print(); // Chama a impressão imediatamente
        // Opcional: Limpar depois (pode ou não ser necessário)
        // printSection.innerHTML = ''; 
    }
}

/**
 * Renderiza um template HTML substituindo placeholders por dados.
 * @param {string} templateId O ID do elemento <template> a ser usado.
 * @param {object} data Um objeto onde as chaves correspondem aos placeholders (sem as chaves duplas).
 * @returns {string} O HTML renderizado ou uma string vazia se o template não for encontrado.
 */
export function renderTemplate(templateId, data) {
    const template = document.getElementById(templateId);
    if (!template) {
        console.error(`Template com ID "${templateId}" não encontrado.`);
        return '';
    }

    let html = template.innerHTML;
    // Substitui todos os placeholders {{key}} pelos valores do objeto de dados
    for (const key in data) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        html = html.replace(regex, data[key] || ''); // Usa string vazia se o valor for nulo/undefined
    }
    return html;
}
// Adicione estas funções melhoradas ao reports.js

// Função base melhorada para gerar relatórios
function generateReport(title, headers, dataRows, reportModal, subtitle = '') {
    const now = new Date();
    const timestamp = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}`;
    
    const content = `
        <div style="padding:24px; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size:11px; color:#000; max-width:1200px; margin:0 auto;">
            ${getReportHeader()}
            
            <div style="display:flex; justify-content:space-between; align-items:center; margin:24px 0; padding-bottom:16px; border-bottom:2px solid #333;">
                <div>
                    <h2 style="font-size:20px; font-weight:700; margin:0 0 8px 0;">${title}</h2>
                    ${subtitle ? `<p style="margin:0; color:#666; font-size:12px;">${subtitle}</p>` : ''}
                </div>
                <div style="text-align:right;">
                    <p style="margin:0; font-size:10px; color:#666;">Gerado em:</p>
                    <p style="margin:0; font-weight:600;">${timestamp}</p>
                </div>
            </div>
            
            ${dataRows.length === 0 ? `
                <div style="background:#fef3c7; border:2px solid #f59e0b; padding:20px; text-align:center; border-radius:8px; margin:20px 0;">
                    <p style="margin:0; font-size:14px;">⚠️ Nenhum dado disponível para este relatório.</p>
                </div>
            ` : `
                <table style="width:100%; border-collapse:collapse; font-size:10px;">
                    <thead>
                        <tr style="background:#333; color:white;">
                            ${headers.map(h => `<th style="padding:12px 8px; text-align:left; font-weight:600; border:1px solid #555;">${h}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${dataRows.join('')}
                    </tbody>
                </table>
                
                <div style="margin-top:20px; padding:12px; background:#f0f0f0; border-radius:4px;">
                    <p style="margin:0; font-size:10px; color:#666;">
                        <strong>Total de registos:</strong> ${dataRows.length} | 
                        <strong>Relatório:</strong> ${title}
                    </p>
                </div>
            `}
            
            <!-- Rodapé -->
            <div style="margin-top:40px; padding-top:16px; border-top:1px solid #ccc; text-align:center; font-size:9px; color:#666;">
                <p style="margin:0;">Este documento foi gerado eletronicamente pelo Sistema SMARTCONTROL</p>
                <p style="margin:4px 0;">Página 1 de 1 | © ${new Date().getFullYear()} - Todos os direitos reservados</p>
            </div>
        </div>
    `;
    
    printContent(content);
    closeModal(reportModal);
}

// Relatório Geral de Movimentações - MELHORADO
function generateGeneralReport(reportModal) {
    const headers = ['Funcionário', 'Matrícula', 'Aparelho', 'IMEI', 'Linha', 'Data Entrega', 'Status'];
    
    const rows = state.records.map((r, index) => {
        const bgColor = index % 2 === 0 ? '#ffffff' : '#f9f9f9';
        const statusColor = r.status === 'Em Uso' ? '#3b82f6' : '#10b981';
        const deliveryDate = new Date(r.deliveryDate + 'T00:00:00').toLocaleDateString('pt-BR');
        
        return `
            <tr style="background:${bgColor}; border-bottom:1px solid #e5e7eb;">
                <td style="padding:10px 8px; border:1px solid #e5e7eb;">${r.employeeName}</td>
                <td style="padding:10px 8px; border:1px solid #e5e7eb; text-align:center;">${r.employeeMatricula}</td>
                <td style="padding:10px 8px; border:1px solid #e5e7eb;">${r.deviceModel}</td>
                <td style="padding:10px 8px; border:1px solid #e5e7eb; font-family:monospace;">${r.deviceImei}</td>
                <td style="padding:10px 8px; border:1px solid #e5e7eb; text-align:center;">${r.deviceLine || '---'}</td>
                <td style="padding:10px 8px; border:1px solid #e5e7eb; text-align:center;">${deliveryDate}</td>
                <td style="padding:10px 8px; border:1px solid #e5e7eb; text-align:center;">
                    <span style="padding:4px 8px; background:${statusColor}; color:white; border-radius:12px; font-size:9px; font-weight:600;">
                        ${r.status}
                    </span>
                </td>
            </tr>
        `;
    });
    
    const subtitle = `Total de movimentações: ${state.records.length} | Em uso: ${state.records.filter(r => r.status === 'Em Uso').length}`;
    generateReport('Relatório Geral de Movimentações', headers, rows, reportModal, subtitle);
}

// Relatório de Inventário de Aparelhos - MELHORADO
function generateDevicesReport(reportModal) {
    const headers = ['Modelo', 'IMEI', 'Status', 'Condição', 'Linha', 'Funcionário'];
    
    const rows = state.devices.map((d, index) => {
        const bgColor = index % 2 === 0 ? '#ffffff' : '#f9f9f9';
        
        let empName = '---';
        if (d.status === 'Em uso') {
            const rec = state.records.find(r => r.deviceImei === d.imei1 && r.status === 'Em Uso');
            if (rec) empName = rec.employeeName;
        }
        
        const statusColors = {
            'Em uso': '#3b82f6',
            'Disponível': '#10b981',
            'Indisponível': '#f59e0b'
        };
        
        const conditionColors = {
            'Novo': '#3b82f6',
            'Aprovado para uso': '#10b981',
            'Em manutenção': '#f59e0b',
            'Danificado': '#ef4444',
            'Sinistrado': '#dc2626',
            'Com Defeito': '#ec4899'
        };
        
        return `
            <tr style="background:${bgColor}; border-bottom:1px solid #e5e7eb;">
                <td style="padding:10px 8px; border:1px solid #e5e7eb;">${d.model}</td>
                <td style="padding:10px 8px; border:1px solid #e5e7eb; font-family:monospace;">${d.imei1}</td>
                <td style="padding:10px 8px; border:1px solid #e5e7eb; text-align:center;">
                    <span style="padding:4px 8px; background:${statusColors[d.status] || '#6b7280'}; color:white; border-radius:12px; font-size:9px; font-weight:600;">
                        ${d.status}
                    </span>
                </td>
                <td style="padding:10px 8px; border:1px solid #e5e7eb; text-align:center;">
                    <span style="padding:4px 8px; background:${conditionColors[d.condition] || '#6b7280'}; color:white; border-radius:12px; font-size:9px; font-weight:600;">
                        ${d.condition}
                    </span>
                </td>
                <td style="padding:10px 8px; border:1px solid #e5e7eb; text-align:center;">${d.currentLine || '---'}</td>
                <td style="padding:10px 8px; border:1px solid #e5e7eb;">${empName}</td>
            </tr>
        `;
    });
    
    const emUso = state.devices.filter(d => d.status === 'Em uso').length;
    const disponiveis = state.devices.filter(d => d.status === 'Disponível').length;
    const subtitle = `Total: ${state.devices.length} | Em uso: ${emUso} | Disponíveis: ${disponiveis}`;
    
    generateReport('Relatório de Inventário de Aparelhos', headers, rows, reportModal, subtitle);
}

// Relatório de Linhas - MELHORADO
function generateLinesReport(reportModal) {
    const headers = ['Número', 'Operadora', 'Plano', 'Status', 'Aparelho Vinculado'];
    
    const rows = state.lines.map((line, index) => {
        const bgColor = index % 2 === 0 ? '#ffffff' : '#f9f9f9';
        
        const statusColors = {
            'Ativa': '#10b981',
            'Inativa': '#f59e0b',
            'Cancelada': '#ef4444'
        };
        
        return `
            <tr style="background:${bgColor}; border-bottom:1px solid #e5e7eb;">
                <td style="padding:10px 8px; border:1px solid #e5e7eb; font-weight:600;">${line.numero}</td>
                <td style="padding:10px 8px; border:1px solid #e5e7eb;">${line.operadora}</td>
                <td style="padding:10px 8px; border:1px solid #e5e7eb;">${line.plano || '---'}</td>
                <td style="padding:10px 8px; border:1px solid #e5e7eb; text-align:center;">
                    <span style="padding:4px 8px; background:${statusColors[line.status] || '#6b7280'}; color:white; border-radius:12px; font-size:9px; font-weight:600;">
                        ${line.status}
                    </span>
                </td>
                <td style="padding:10px 8px; border:1px solid #e5e7eb; font-family:monospace; text-align:center;">${line.imeiVinculado || '---'}</td>
            </tr>
        `;
    });
    
    const ativas = state.lines.filter(l => l.status === 'Ativa').length;
    const vinculadas = state.lines.filter(l => l.imeiVinculado).length;
    const subtitle = `Total: ${state.lines.length} | Ativas: ${ativas} | Vinculadas: ${vinculadas}`;
    
    generateReport('Relatório de Inventário de Linhas Telefónicas', headers, rows, reportModal, subtitle);
}

// Relatório de Manutenção - MELHORADO
function generateMaintenanceReport(reportModal) {
    const headers = ['Nº OS', 'Aparelho', 'IMEI', 'Envio', 'Retorno', 'Defeito', 'Custo', 'Status'];
    
    const rows = state.maintenance.map((m, index) => {
        const bgColor = index % 2 === 0 ? '#ffffff' : '#f9f9f9';
        const dataEnvio = formatDateForInput(m.data_envio);
        const dataRetorno = m.data_retorno ? formatDateForInput(m.data_retorno) : '---';
        const custo = m.custo ? `R$ ${parseFloat(m.custo).toFixed(2)}` : '---';
        
        const statusColors = {
            'Em manutenção': '#f59e0b',
            'Concluído': '#10b981',
            'Cancelado': '#ef4444'
        };
        
        return `
            <tr style="background:${bgColor}; border-bottom:1px solid #e5e7eb;">
                <td style="padding:10px 8px; border:1px solid #e5e7eb; font-weight:600;">${m.numero_os || 'N/A'}</td>
                <td style="padding:10px 8px; border:1px solid #e5e7eb;">${m.modelo || 'N/A'}</td>
                <td style="padding:10px 8px; border:1px solid #e5e7eb; font-family:monospace;">${m.imei1 || 'N/A'}</td>
                <td style="padding:10px 8px; border:1px solid #e5e7eb; text-align:center;">${dataEnvio}</td>
                <td style="padding:10px 8px; border:1px solid #e5e7eb; text-align:center;">${dataRetorno}</td>
                <td style="padding:10px 8px; border:1px solid #e5e7eb; font-size:9px;">${(m.defeito_reportado || '').substring(0, 50)}${m.defeito_reportado && m.defeito_reportado.length > 50 ? '...' : ''}</td>
                <td style="padding:10px 8px; border:1px solid #e5e7eb; text-align:right; font-weight:600;">${custo}</td>
                <td style="padding:10px 8px; border:1px solid #e5e7eb; text-align:center;">
                    <span style="padding:4px 8px; background:${statusColors[m.status] || '#6b7280'}; color:white; border-radius:12px; font-size:9px; font-weight:600;">
                        ${m.status}
                    </span>
                </td>
            </tr>
        `;
    });
    
    const emManutencao = state.maintenance.filter(m => m.status === 'Em manutenção').length;
    const custoTotal = state.maintenance
        .filter(m => m.custo)
        .reduce((sum, m) => sum + parseFloat(m.custo), 0)
        .toFixed(2);
    
    const subtitle = `Total de OS: ${state.maintenance.length} | Em manutenção: ${emManutencao} | Custo Total: R$ ${custoTotal}`;
    
    generateReport('Relatório de Manutenção de Aparelhos', headers, rows, reportModal, subtitle);
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
