// SMARTCONTROL/static/js/modules/line_records.js
import { state } from '../app.js';
import { openModal, closeModal, showToast, formatDateForInput, setLoading, unsetLoading } from './ui.js';
import { API_URL } from './api.js';
import { getReportHeader, printContent } from './reports.js';

// Substitua a função printLineTerm em line_records.js por esta versão:

function printLineTerm(recordData) {
    const deliveryDate = recordData.data_entrega 
        ? new Date(recordData.data_entrega + 'T00:00:00').toLocaleDateString('pt-BR') 
        : 'Data Inválida';
    
    const entregador = state.currentUser?.nome || 'Sistema';
    
    const content = `
        <div style="padding:24px; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size:12px; color:#000; max-width:800px; margin:0 auto;">
            ${getReportHeader()}
            
            <h1 style="font-size:22px; font-weight:700; text-align:center; margin: 32px 0; text-transform:uppercase; border-bottom:3px solid #333; padding-bottom:12px;">
                Termo de Responsabilidade de Linha Nº ${recordData.id ? String(recordData.id).padStart(5, '0') : '_____'}
            </h1>
            
            <div style="background:#e6f7ff; border-left:4px solid #1890ff; padding:16px; margin:24px 0; border-radius:4px;">
                <p style="margin:0; font-size:11px; line-height:1.6;">
                    <strong>ℹ️ Informação:</strong> Este documento estabelece a responsabilidade do funcionário 
                    sobre o uso da linha telefónica corporativa fornecida pela empresa.
                </p>
            </div>
            
            <!-- SEÇÃO 1: FUNCIONÁRIO -->
            <h3 style="font-size:16px; font-weight:700; margin: 24px 0 12px 0; border-bottom:2px solid #333; padding-bottom:8px;">
                1. DADOS DO FUNCIONÁRIO
            </h3>
            
            <table style="width:100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr>
                    <td style="padding:10px; border:1px solid #ddd; background:#f9f9f9; width:35%; font-weight:600;">Nome Completo:</td>
                    <td style="padding:10px; border:1px solid #ddd;">${recordData.employeeName || 'N/A'}</td>
                </tr>
                <tr>
                    <td style="padding:10px; border:1px solid #ddd; background:#f9f9f9; font-weight:600;">Matrícula:</td>
                    <td style="padding:10px; border:1px solid #ddd;">${recordData.employeeMatricula || 'N/A'}</td>
                </tr>
            </table>
            
            <!-- SEÇÃO 2: LINHA TELEFÓNICA -->
            <h3 style="font-size:16px; font-weight:700; margin: 24px 0 12px 0; border-bottom:2px solid #333; padding-bottom:8px;">
                2. DADOS DA LINHA TELEFÓNICA
            </h3>
            
            <table style="width:100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr>
                    <td style="padding:10px; border:1px solid #ddd; background:#f9f9f9; width:35%; font-weight:600;">Número:</td>
                    <td style="padding:10px; border:1px solid #ddd; font-size:16px; font-weight:600; color:#059669;">${recordData.numero || 'N/A'}</td>
                </tr>
                <tr>
                    <td style="padding:10px; border:1px solid #ddd; background:#f9f9f9; font-weight:600;">Data de Entrega:</td>
                    <td style="padding:10px; border:1px solid #ddd;">${deliveryDate}</td>
                </tr>
                <tr>
                    <td style="padding:10px; border:1px solid #ddd; background:#f9f9f9; font-weight:600;">Entregue por:</td>
                    <td style="padding:10px; border:1px solid #ddd;">${entregador}</td>
                </tr>
            </table>
            
            <!-- SEÇÃO 3: TERMOS E RESPONSABILIDADES -->
            <h3 style="font-size:16px; font-weight:700; margin: 32px 0 12px 0; border-bottom:2px solid #333; padding-bottom:8px;">
                3. TERMOS E RESPONSABILIDADES
            </h3>
            
            <div style="background:#f9fafb; border:1px solid #ddd; padding:20px; border-radius:8px; margin-bottom:24px;">
                <p style="margin:0 0 12px 0; font-size:11px; line-height:1.8;">
                    <strong>O funcionário declara estar ciente e concorda com os seguintes termos:</strong>
                </p>
                <ol style="margin:0; padding-left:20px; font-size:11px; line-height:1.8;">
                    <li style="margin-bottom:8px;">A linha telefónica é de propriedade da empresa e destina-se exclusivamente ao uso profissional;</li>
                    <li style="margin-bottom:8px;">É de responsabilidade do funcionário zelar pelo SIM card e informar imediatamente em caso de perda, roubo ou dano;</li>
                    <li style="margin-bottom:8px;">O uso indevido ou excessivo da linha pode resultar em medidas disciplinares;</li>
                    <li style="margin-bottom:8px;">Em caso de desligamento ou devolução, o SIM card deverá ser devolvido intacto;</li


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
