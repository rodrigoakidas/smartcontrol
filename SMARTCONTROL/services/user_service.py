# services/user_service.py
from flask import g, current_app
import bcrypt
import json
from .audit_service import log_change

def hash_password(senha):
    return bcrypt.hashpw(senha.encode('utf-8'), bcrypt.gensalt())

def get_all_users():
    try:
        if not g.db_cursor:
            return None, {'message': 'Erro interno: Falha na conexão com a base de dados'}

        g.db_cursor.execute("SELECT id, nome, username, role, permissoes FROM usuarios")
        users = []
        for user in g.db_cursor.fetchall():
            permissoes_str = user.get('permissoes')
            user['permissoes'] = json.loads(permissoes_str) if permissoes_str else {}
            users.append(user)
        return users, None
    except Exception as e:
        current_app.logger.error(f"Erro ao buscar usuários: {e}", exc_info=True)
        return None, {'message': 'Erro ao buscar usuários'}

def create_new_user(data):
    try:
        if not g.db_cursor:
            return None, {'message': 'Erro interno: Falha na conexão com a base de dados'}

        nome = data.get('nome')
        username_to_create = data.get('username')
        senha = data.get('senha')
        role = data.get('role')
        permissoes = data.get('permissoes', {})
        current_user = data.get('currentUser', {})
        user_id = current_user.get('id')
        username_actor = current_user.get('nome', 'Sistema')

        if not all([nome, username_to_create, senha, role]):
            return None, {'message': 'Todos os campos são obrigatórios'}

        hashed_password = hash_password(senha)
        permissoes_json = json.dumps(permissoes)

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
        return {'message': 'Usuário criado com sucesso'}, None
    except Exception as e:
        if g.db_conn: g.db_conn.rollback()
        current_app.logger.error(f"Erro ao criar usuário: {e}", exc_info=True)
        return None, {'message': 'Erro ao criar usuário'}

def update_existing_user(user_id_to_update, data):
    try:
        if not g.db_cursor:
            return None, {'message': 'Erro interno: Falha na conexão com a base de dados'}

        nome = data.get('nome')
        role = data.get('role')
        senha = data.get('senha')
        permissoes = data.get('permissoes', {})
        current_user = data.get('currentUser', {})
        user_id_actor = current_user.get('id')
        username_actor = current_user.get('nome', 'Sistema')
        
        permissoes_json = json.dumps(permissoes)
        
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
            return None, {'message': 'Usuário não encontrado'}
        
        log_change(
            user_id=user_id_actor,
            username=username_actor,
            action_type='UPDATE',
            target_resource='User',
            target_id=user_id_to_update,
            details_dict={'message': f'Dados do utilizador {nome} atualizados.'}
        )
        return {'message': 'Usuário atualizado com sucesso'}, None
    except Exception as e:
        if g.db_conn: g.db_conn.rollback()
        current_app.logger.error(f"Erro ao atualizar usuário {user_id_to_update}: {e}", exc_info=True)
        return None, {'message': 'Erro ao atualizar usuário'}

def delete_existing_user(user_id_to_delete, data):
    try:
        if not g.db_cursor:
            return None, {'message': 'Erro interno: Falha na conexão com a base de dados'}
        
        current_user = data.get('currentUser', {})
        user_id_actor = current_user.get('id')
        username_actor = current_user.get('nome', 'Sistema')
        
        if user_id_to_delete == 1:
            return None, {'message': 'Não é possível excluir o administrador principal'}

        g.db_cursor.execute("SELECT username FROM usuarios WHERE id = %s", (user_id_to_delete,))
        user_data = g.db_cursor.fetchone()

        g.db_cursor.execute("DELETE FROM usuarios WHERE id = %s", (user_id_to_delete,))
        g.db_conn.commit()
        
        if g.db_cursor.rowcount == 0:
            return None, {'message': 'Usuário não encontrado'}
            
        log_change(
            user_id=user_id_actor,
            username=username_actor,
            action_type='DELETE',
            target_resource='User',
            target_id=user_id_to_delete,
            details_dict={'message': f'Utilizador {user_data.get("username")} excluído.'}
        )
        return {'message': 'Usuário excluído com sucesso'}, None
    except Exception as e:
        if g.db_conn: g.db_conn.rollback()
        current_app.logger.error(f"Erro ao deletar usuário {user_id_to_delete}: {e}", exc_info=True)
        return None, {'message': 'Erro ao deletar usuário'}
