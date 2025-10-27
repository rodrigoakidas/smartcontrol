// --- MÓDULO DE UTILIZADORES (USERS.JS) ---

import { state, fetchAllData } from '../app.js';
import { openModal, closeModal, showToast, setLoading, unsetLoading } from './ui.js';
import { API_URL } from './api.js';

function renderUserTable(userTableBody, usersToRender = state.users) {
    if (!userTableBody) return;
    userTableBody.innerHTML = '';
    
    usersToRender.forEach(user => {
        userTableBody.innerHTML += `
            <tr class="border-b">
                <td class="p-3">${user.nome}</td>
                <td class="p-3">${user.username}</td>
                <td class="p-3">${user.role.charAt(0).toUpperCase() + user.role.slice(1)}</td>
                <td class="p-3 text-center space-x-1">
                    <button data-action="edit-user" data-id="${user.id}" class="text-gray-600 p-2" title="Editar"><i data-lucide="edit"></i></button>
                    ${user.username !== 'admin' ? `<button data-action="delete-user" data-id="${user.id}" class="text-red-600 p-2" title="Excluir"><i data-lucide="trash-2"></i></button>` : ''}
                </td>
            </tr>`;
    });
    if (window.lucide) lucide.createIcons();
}

function openUserForm(userForm, userFormModal, userId = null) {
    userForm.reset();
    document.getElementById('user-id-input').value = userId || '';
    const passwordInput = document.getElementById('userFormPassword');
    const usernameInput = document.getElementById('userFormUsername');
    
    if (userId) {
        const user = state.users.find(u => u.id === userId);
        document.getElementById('user-modal-title').textContent = 'Editar Utilizador';
        usernameInput.readOnly = true;
        usernameInput.value = user.username;
        passwordInput.required = false;
        passwordInput.placeholder = 'Deixe em branco para não alterar';
        document.getElementById('userFormFullName').value = user.nome;
        document.getElementById('userFormRole').value = user.role;
        
        const permissionsFieldset = document.getElementById('permissions-fieldset');
        permissionsFieldset.style.display = user.role === 'controlador' ? 'block' : 'none';
        
        if (user.role === 'controlador' && user.permissoes) {
            Object.keys(user.permissoes).forEach(key => {
                const checkbox = userForm.querySelector(`input[data-permission="${key}"]`);
                if(checkbox) checkbox.checked = user.permissoes[key];
            });
        }
    } else {
        document.getElementById('user-modal-title').textContent = 'Novo Utilizador';
        usernameInput.readOnly = false;
        passwordInput.required = true;
        passwordInput.placeholder = 'Senha obrigatória';
        document.getElementById('permissions-fieldset').style.display = 'block';
    }
    openModal(userFormModal);
}

export function initUsersModule() {
    const userListModal = document.getElementById('user-list-modal');
    const userFormModal = document.getElementById('user-form-modal');
    const userForm = document.getElementById('user-form');
    const userTableBody = document.getElementById('user-table-body');
    const manageUsersBtn = document.getElementById('manage-users-btn');
    const closeUserListBtn = document.getElementById('close-user-list-btn');
    const addUserBtn = document.getElementById('add-user-btn');
    const cancelUserFormBtn = document.getElementById('cancel-user-form-btn');
    const userFormRole = document.getElementById('userFormRole');
    const userSearchInput = document.getElementById('user-search-input');

    if (manageUsersBtn) {
        manageUsersBtn.addEventListener('click', () => { 
            renderUserTable(userTableBody);
            if(userSearchInput) userSearchInput.value = '';
            openModal(userListModal); 
        });
    }

    if (closeUserListBtn) closeUserListBtn.addEventListener('click', () => closeModal(userListModal));
    if (addUserBtn) addUserBtn.addEventListener('click', () => openUserForm(userForm, userFormModal));
    if (cancelUserFormBtn) cancelUserFormBtn.addEventListener('click', () => closeModal(userFormModal));
    
    if (userFormRole) {
        userFormRole.addEventListener('change', (e) => {
            const permissionsFieldset = document.getElementById('permissions-fieldset');
            if(permissionsFieldset) {
                permissionsFieldset.style.display = e.target.value === 'controlador' ? 'block' : 'none';
            }
        });
    }

    if (userSearchInput) {
        userSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            const filteredUsers = state.users.filter(user =>
                user.nome.toLowerCase().includes(searchTerm) ||
                user.username.toLowerCase().includes(searchTerm)
            );
            renderUserTable(userTableBody, filteredUsers);
        });
    }

    if (userForm) {
        userForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const saveButton = userForm.querySelector('button[type="submit"]');
            setLoading(saveButton);

            const userId = document.getElementById('user-id-input').value;
            const isEditing = !!userId;
            const password = document.getElementById('userFormPassword').value;
            const role = document.getElementById('userFormRole').value;
            
            const userData = {
                nome: document.getElementById('userFormFullName').value,
                username: document.getElementById('userFormUsername').value,
                role: role,
                currentUser: state.currentUser // <--- ADICIONADO
            };
            if (password) userData.senha = password;
            if (role === 'controlador') {
                userData.permissoes = {};
                document.querySelectorAll('#permissions-fieldset input[type="checkbox"]').forEach(cb => { 
                    userData.permissoes[cb.dataset.permission] = cb.checked; 
                });
            }

            const url = isEditing ? `${API_URL}/api/users/${userId}` : `${API_URL}/api/users`;
            const method = isEditing ? 'PUT' : 'POST';
            
            try {
                const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(userData) });
                const result = await res.json();
                if (!res.ok) throw new Error(result.message);
                showToast(result.message);
                await fetchAllData();
                renderUserTable(userTableBody);
                closeModal(userFormModal);
            } catch (error) { 
                showToast(`Erro: ${error.message}`, true); 
            } finally {
                unsetLoading(saveButton);
            }
        });
    }

    if (userTableBody) {
        userTableBody.addEventListener('click', async (e) => {
            const button = e.target.closest('button[data-action]');
            if (!button) return;
            const userId = parseInt(button.dataset.id, 10);
            const action = button.dataset.action;
            
            if (action === 'edit-user') { 
                openUserForm(userForm, userFormModal, userId); 
            } else if (action === 'delete-user') {
                if (!confirm('Tem a certeza?')) return;
                try {
                    const res = await fetch(`${API_URL}/api/users/${userId}`, { 
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ currentUser: state.currentUser }) // <--- ADICIONADO
                    });
                    const result = await res.json();
                    if (!res.ok) throw new Error(result.message);
                    showToast(result.message);
                    await fetchAllData();
                    renderUserTable(userTableBody);
                } catch (error) { 
                    showToast(`Erro: ${error.message}`, true); 
                }
            }
        });
    }
}