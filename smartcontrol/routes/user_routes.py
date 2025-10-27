# SMARTCONTROL/routes/user_routes.py
# VERSÃO CORRIGIDA - Substitua TODO o conteúdo do arquivo

from flask import Blueprint, jsonify, request, current_app, g
import bcrypt
import json
from .audit_helper import log_change
from .decorators import require_permission

user_bp = Blueprint('users', __name__)

def hash_password(senha):
    return bcrypt.hashpw(senha.encode('utf-8'), bcrypt.gensalt())

# GET /users - Listar todos os usuários (SEM DECORADOR PARA LEITURA)
@user_bp.route('/', methods=['GET'])
def get_users():
    """Lista todos os utilizadores. Agora sem proteção para leitura."""
    try:
        if not g.db_cursor:
             return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500
             
        g.db_cursor.execute("SELECT id, nome, username, role, permissoes FROM usuarios")
        users = []
        for user in g.db_cursor.fetchall():
            permissoes_str = user.get('permissoes')
            user['permissoes'] = json.loads(permissoes_str) if permissoes_str else {}
            users.append(user)
        return jsonify(users)
    except Exception as e:
        current_app.logger.error(f"Erro ao buscar usuários: {e}", exc_info=True)
        return jsonify({'message': 'Erro ao buscar usuários'}), 500

# POST /users - Criar um novo usuário
@user_bp.route('/', methods=['POST'])
@require_permission('users_create')
def create_user():
    """Cria um novo utilizador. Requer permissão 'users_create'."""
    try:
        data = request.get_json()
        nome = data.get('nome')
        username_to_create = data.get('username')
        senha = data.get('senha')
        role = data.get('role')
        permissoes = data.get('permissoes', {})
        
        current_user = data.get('currentUser', {})
        user_id = current_user.get('id')
        username_actor = current_user.get('nome', 'Sistema')

        if not all([nome, username_to_create, senha, role]):
            return jsonify({'message': 'Todos os campos são obrigatórios'}), 400

        hashed_password = hash_password(senha)
        permissoes_json = json.dumps(permissoes)

        if not g.db_cursor:
             return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500

        g.db_cursor.execute(
            "INSERT INTO usuarios (nome, username, senha, role, permissoes) VALUES (%s, %s, %s, %s, %s)",
            (nome, username_to_create, hashed_password.decode('utf-8'), role, permissoes_json)
        )
        g.db_conn.commit()
        
        log_change(
            user_id=user_id,
            username=username_actor,
            action_type='CREATE',
            target_resource='User',
            target_id=username_to_create,
            details_dict={'message': f'Utilizador {username_to_create} ({role}) criado.'}
        )
        return jsonify({'message': 'Usuário criado com sucesso'}), 201
    except Exception as e:
        if g.db_conn: g.db_conn.rollback()
        current_app.logger.error(f"Erro ao criar usuário: {e}", exc_info=True)
        return jsonify({'message': 'Erro ao criar usuário'}), 500

# PUT /users/<int:user_id> - Atualizar um usuário
@user_bp.route('/<int:user_id_to_update>', methods=['PUT'])
@require_permission('users_update')
def update_user(user_id_to_update):
    try:
        data = request.get_json()
        nome = data.get('nome')
        role = data.get('role')
        senha = data.get('senha')
        permissoes = data.get('permissoes', {})
        
        current_user = data.get('currentUser', {})
        user_id_actor = current_user.get('id')
        username_actor = current_user.get('nome', 'Sistema')
        
        permissoes_json = json.dumps(permissoes)
        
        if not g.db_cursor:
             return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500

        if senha:
            hashed_password = hash_password(senha)
            g.db_cursor.execute(
                "UPDATE usuarios SET nome = %s, role = %s, permissoes = %s, senha = %s WHERE id = %s",
                (nome, role, permissoes_json, hashed_password.decode('utf-8'), user_id_to_update)
            )
        else:
            g.db_cursor.execute(
                "UPDATE usuarios SET nome = %s, role = %s, permissoes = %s WHERE id = %s",
                (nome, role, permissoes_json, user_id_to_update)
            )
        
        g.db_conn.commit()
        
        if g.db_cursor.rowcount == 0:
            return jsonify({'message': 'Usuário não encontrado'}), 404
        
        log_change(
            user_id=user_id_actor,
            username=username_actor,
            action_type='UPDATE',
            target_resource='User',
            target_id=user_id_to_update,
            details_dict={'message': f'Dados do utilizador {nome} atualizados.'}
        )
        return jsonify({'message': 'Usuário atualizado com sucesso'})
    except Exception as e:
        if g.db_conn: g.db_conn.rollback()
        current_app.logger.error(f"Erro ao atualizar usuário {user_id_to_update}: {e}", exc_info=True)
        return jsonify({'message': 'Erro ao atualizar usuário'}), 500

# DELETE /users/<int:user_id> - Deletar um usuário
@user_bp.route('/<int:user_id_to_delete>', methods=['DELETE'])
@require_permission('users_delete')
def delete_user(user_id_to_delete):
    try:
        data = request.get_json() or {}
        current_user = data.get('currentUser', {})
        user_id_actor = current_user.get('id')
        username_actor = current_user.get('nome', 'Sistema')
        
        if not g.db_cursor:
             return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500
        
        if user_id_to_delete == 1:
            return jsonify({'message': 'Não é possível excluir o administrador principal'}), 403

        g.db_cursor.execute("SELECT username FROM usuarios WHERE id = %s", (user_id_to_delete,))
        user_data = g.db_cursor.fetchone()

        g.db_cursor.execute("DELETE FROM usuarios WHERE id = %s", (user_id_to_delete,))
        g.db_conn.commit()
        
        if g.db_cursor.rowcount == 0:
            return jsonify({'message': 'Usuário não encontrado'}), 404
            
        log_change(
            user_id=user_id_actor,
            username=username_actor,
            action_type='DELETE',
            target_resource='User',
            target_id=user_id_to_delete,
            details_dict={'message': f'Utilizador {user_data.get("username")} excluído.'}
        )
        return jsonify({'message': 'Usuário excluído com sucesso'})
    except Exception as e:
        if g.db_conn: g.db_conn.rollback()
        current_app.logger.error(f"Erro ao deletar usuário {user_id_to_delete}: {e}", exc_info=True)
        return jsonify({'message': 'Erro ao deletar usuário'}), 500
