// --- MÓDULO DE UI (UI.JS) ---

/**
 * Abre um modal (janela pop-up) com uma animação suave.
 */
export function openModal(modal) {
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.style.opacity = '0';
    modal.querySelector('.modal-content').style.transform = 'scale(0.95)';
    setTimeout(() => {
        modal.style.opacity = '1';
        modal.querySelector('.modal-content').style.transform = 'scale(1)';
    }, 10);
}

/**
 * Fecha um modal com uma animação suave.
 */
export function closeModal(modal) {
    if (!modal) return;
    modal.style.opacity = '0';
    modal.querySelector('.modal-content').style.transform = 'scale(0.95)';
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

/**
 * Exibe uma notificação (toast) no canto da tela.
 */
export function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    if (!toast || !toastMessage) return;

    toastMessage.textContent = message;
    toast.className = 'toast fixed bottom-5 right-5 text-white py-3 px-6 rounded-lg shadow-lg z-50 opacity-0 transform translate-y-2';
    toast.classList.add(isError ? 'bg-red-600' : 'bg-green-600');
    
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    }, 100);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(0.5rem)';
    }, 3100);
}

/**
 * Formata uma string de data para o formato YYYY-MM-DD.
 */
export const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() + userTimezoneOffset).toISOString().split('T')[0];
};

/**
 * Converte um ficheiro para uma string base64.
 */
export const readFileAsBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};

/**
 * ATIVAR o estado de carregamento de um botão.
 * @param {HTMLButtonElement} button O botão a ser modificado.
 * @param {string} loadingText O texto a ser exibido durante o carregamento.
 */
export function setLoading(button, loadingText = 'Salvando...') {
    if (!button.dataset.originalContent) {
        button.dataset.originalContent = button.innerHTML;
    }
    button.disabled = true;
    button.innerHTML = `
        <svg class="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24" style="display: inline-block;">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        ${loadingText}
    `;
}

/**
 * DESATIVAR o estado de carregamento de um botão.
 * @param {HTMLButtonElement} button O botão a ser restaurado.
 */
export function unsetLoading(button) {
    if (button.dataset.originalContent) {
        button.innerHTML = button.dataset.originalContent;
        delete button.dataset.originalContent;
    }
    button.disabled = false;
}