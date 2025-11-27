# services/auth_service.py
from flask import g, current_app
import bcrypt
import json

def login_user(username, senha):
    try:
        if not g.db_cursor:
            return None, {'message': 'Erro interno: Falha na conexão com a base de dados'}

        g.db_cursor.execute(
            "SELECT id, nome, username, role, permissoes FROM usuarios WHERE username = %s", 
            (username,)
        )
        user = g.db_cursor.fetchone()

        if not user:
            return None, {'message': 'Usuário não encontrado'}

        g.db_cursor.execute("SELECT senha FROM usuarios WHERE id = %s", (user['id'],))
        user_auth_data = g.db_cursor.fetchone()
        senha_hash = user_auth_data['senha']
        
        try:
            senha_ok = bcrypt.checkpw(senha.encode('utf-8'), senha_hash.encode('utf-8'))
        except Exception:
            senha_ok = (senha == senha_hash)

        if not senha_ok:
            return None, {'message': 'Senha incorreta'}

        permissoes_str = user.get('permissoes')
        permissoes_obj = json.loads(permissoes_str) if permissoes_str and isinstance(permissoes_str, str) else permissoes_str
        
        user['permissoes'] = permissoes_obj

        current_app.logger.info(f"Login bem-sucedido para o utilizador: {username}")
        return {'usuario': user}, None

    except Exception as e:
        current_app.logger.error(f"Erro no login: {e}", exc_info=True)
        return None, {'message': 'Erro interno no servidor'}
