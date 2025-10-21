// static/js/modules/api.js
import { showToast } from './ui.js';

export const API_URL = 'http://127.0.0.1:5000';

export async function fetchData(endpoint) {
    const fullUrl = `${API_URL}/api/${endpoint}`; 
    try {
        const response = await fetch(fullUrl);
        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({ message: `Falha ao carregar ${endpoint}` }));
            throw new Error(errorBody.message);
        }
        return await response.json();
    } catch (error) {
        showToast(error.message, true);
        return []; 
    }
}

export async function fetchItemById(endpoint, id) {
    const fullUrl = `${API_URL}/api/${endpoint}/${id}`;
    try {
        const response = await fetch(fullUrl);
        if (!response.ok) throw new Error(`Registo não encontrado.`);
        return await response.json();
    } catch (error) {
        showToast(error.message, true);
        return null;
    }
}

// FUNÇÃO DE UPLOAD MOVIDA PARA AQUI
export async function handleFileUpload(fileInput) {
    const file = fileInput.files[0];
    if (!file) return null;

    const formData = new FormData();
    formData.append('file', file);

    showToast('Enviando anexo...');
    try {
        const res = await fetch(`${API_URL}/api/upload`, { // Supondo que você criará esta rota no backend
            method: 'POST',
            body: formData
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.message);
        
        showToast('Anexo enviado com sucesso!');
        return result.fileUrl;
    } catch(error) {
        showToast(`Erro no upload: ${error.message}`, true);
        fileInput.value = '';
        return null;
    }
}