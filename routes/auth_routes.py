# SMARTCONTROL/routes/auth_routes.py
# (FICHEIRO COMPLETO E CORRIGIDO)

from flask import Blueprint, jsonify, request, current_app, g
# Removido get_connection
import bcrypt
import json

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    # Removido 'conn = None' e 'cursor = None'
    try:
        data = request.get_json()
        username = data.get('username')
        senha = data.get('senha')

        if not username or not senha:
            return jsonify({'message': 'Usuário e senha são obrigatórios'}), 400

        # 'g.db_cursor' já está disponível graças ao app.py
        if not g.db_cursor:
             return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500

        # --- CORREÇÃO DE SEGURANÇA ---
        # 1. Selecione APENAS os campos necessários. NÃO use 'SELECT *'.
        g.db_cursor.execute(
            "SELECT id, nome, username, role, permissoes FROM usuarios WHERE username = %s", 
            (username,)
        )
        user = g.db_cursor.fetchone()
        # --- FIM DA CORREÇÃO ---

        if not user:
            return jsonify({'message': 'Usuário não encontrado'}), 401

        # --- CORREÇÃO DE SEGURANÇA: Busque a senha separadamente ---
        # Desta forma, o hash nunca é armazenado no objeto 'user' que será retornado.
        g.db_cursor.execute("SELECT senha FROM usuarios WHERE id = %s", (user['id'],))
        user_auth_data = g.db_cursor.fetchone()
        senha_hash = user_auth_data['senha']
        # --- FIM DA CORREÇÃO ---
        
        try:
            # Verifique a senha
            senha_ok = bcrypt.checkpw(senha.encode('utf-8'), senha_hash.encode('utf-8'))
        except Exception:
            # Fallback para senhas antigas em texto plano (se houver)
            senha_ok = (senha == senha_hash)

        if not senha_ok:
            return jsonify({'message': 'Senha incorreta'}), 401

        # Processa permissões
        permissoes_str = user.get('permissoes')
        permissoes_obj = json.loads(permissoes_str) if permissoes_str and isinstance(permissoes_str, str) else permissoes_str
        
        # O objeto 'user' já está limpo porque o SELECT foi específico
        user['permissoes'] = permissoes_obj

        current_app.logger.info(f"Login bem-sucedido para o utilizador: {username}")
        # Retorna o objeto 'user' limpo, sem o hash da senha
        return jsonify({'usuario': user}), 200

    except Exception as e:
        # Use o logger da app em vez de print()
        current_app.logger.error(f"Erro no login: {e}", exc_info=True)
        return jsonify({'message': 'Erro interno no servidor'}), 500
    # Removido 'finally' pois o app.py gere o fecho da conexão