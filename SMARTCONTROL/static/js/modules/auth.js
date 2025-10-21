// SMARTCONTROL/static/js/modules/auth.js

import { API_URL } from './api.js';
import { initializeApp } from '../app.js';

export function initAuthModule() {
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('logout-btn');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const loginError = document.getElementById('login-error');
            loginError.classList.add('hidden');

            try {
                const response = await fetch(`${API_URL}/api/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: document.getElementById('username').value,
                        senha: document.getElementById('password').value
                    })
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Erro ao tentar fazer login');

                sessionStorage.setItem('currentUser', JSON.stringify(data.usuario));
                
                // --- CORREÇÃO DEFINITIVA ---
                // Recarrega a página para garantir um estado limpo da aplicação,
                // evitando a duplicação de event listeners.
                window.location.reload();

            } catch (error) {
                loginError.textContent = error.message;
                loginError.classList.remove('hidden');
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('currentUser');
            window.location.reload();
        });
    }
}