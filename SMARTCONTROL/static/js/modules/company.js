// --- MÓDULO DE DADOS DA EMPRESA (COMPANY.JS) ---

import { state, fetchAllData } from '../app.js';
import { openModal, closeModal, showToast, readFileAsBase64 } from './ui.js';
import { API_URL } from './api.js';

function openCompanyInfoForm(companyInfoModal) {
    const { nome, cnpj, logo } = state.companyInfo;
    document.getElementById('companyName').value = nome || '';
    document.getElementById('companyCnpj').value = cnpj || '';
    const preview = document.getElementById('logo-preview');

    if (logo) {
        preview.src = `data:image/png;base64,${logo}`;
        preview.classList.remove('hidden');
    } else {
        preview.classList.add('hidden');
    }
    document.getElementById('companyLogoInput').value = '';
    openModal(companyInfoModal);
}


export function initCompanyModule() {
    const companyInfoModal = document.getElementById('company-info-modal');
    const companyInfoForm = document.getElementById('company-info-form');
    const companyLogoInput = document.getElementById('companyLogoInput');
    const logoPreview = document.getElementById('logo-preview');

    const companyInfoBtn = document.getElementById('company-info-btn');
    if (companyInfoBtn) {
        companyInfoBtn.addEventListener('click', () => {
            openCompanyInfoForm(companyInfoModal);
        });
    }

    const cancelBtn = document.getElementById('cancel-company-info-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => closeModal(companyInfoModal));
    }

    if (companyLogoInput) {
        companyLogoInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file && logoPreview) {
                const base64 = await readFileAsBase64(file);
                logoPreview.src = base64;
                logoPreview.classList.remove('hidden');
            }
        });
    }

    if (companyInfoForm) {
        companyInfoForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const logoSrc = logoPreview ? logoPreview.src : '';
            let logoParaEnviar = null;

            if (logoSrc && logoSrc.startsWith('data:image')) {
                logoParaEnviar = logoSrc;
            }

            const companyData = {
                nome: document.getElementById('companyName').value,
                cnpj: document.getElementById('companyCnpj').value,
                logo: logoParaEnviar
            };

            try {
                const response = await fetch(`${API_URL}/api/company/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(companyData)
                });
                
                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.message);
                }

                showToast(result.message);
                await fetchAllData();
                closeModal(companyInfoModal);

            } catch (error) {
                showToast(`Erro: ${error.message}`, true);
            }
        });
    }
}