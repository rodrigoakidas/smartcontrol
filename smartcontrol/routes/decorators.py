from functools import wraps
from flask import request, abort, g, current_app
import json

def require_permission(permission_key):
    """
    Decorador que verifica se o utilizador logado tem uma permissão específica.
    Busca as permissões REAIS do utilizador na base de dados.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                # 1. Obter dados da requisição
                data = request.get_json()
                if not data:
                    current_app.logger.warning(f"Tentativa de acesso (sem dados) à rota protegida: {request.path}")
                    abort(401, description="Acesso não autorizado: dados de autenticação em falta.")
                
                current_user = data.get('currentUser')
                if not current_user or not current_user.get('id'):
                    current_app.logger.warning(f"Tentativa de acesso (sem ID de utilizador) à rota protegida: {request.path}")
                    abort(401, description="Acesso não autorizado: ID de utilizador em falta.")

                user_id = current_user.get('id')

                # 2. Buscar permissões REAIS na base de dados (usando a conexão 'g' do app.py)
                if not g.db_cursor:
                    current_app.logger.error(f"Falha na verificação de permissão: Sem cursor de DB. Rota: {request.path}")
                    abort(500, description="Erro interno: falha na conexão da base de dados.")
                    
                g.db_cursor.execute("SELECT role, permissoes FROM usuarios WHERE id = %s", (user_id,))
                user_db_data = g.db_cursor.fetchone()

                if not user_db_data:
                    current_app.logger.error(f"Falha na verificação de permissão: Utilizador ID {user_id} não encontrado na DB. Rota: {request.path}")
                    abort(401, description="Acesso não autorizado: utilizador inválido.")

                # 3. Verificar permissões
                role = user_db_data.get('role')
                
                # Administradores têm acesso total
                if role == 'administrador':
                    return f(*args, **kwargs) # Permite acesso

                # Verificar permissões específicas para outros roles
                permissoes_str = user_db_data.get('permissoes')
                user_permissions = {}
                if permissoes_str:
                    try:
                        user_permissions = json.loads(permissoes_str)
                    except json.JSONDecodeError:
                        current_app.logger.error(f"Erro ao descodificar JSON de permissões para o utilizador ID {user_id}.")
                        abort(500, description="Erro interno: falha ao ler permissões.")

                if user_permissions.get(permission_key, False):
                    return f(*args, **kwargs) # Permite acesso
                
                # 4. Bloquear se não tiver permissão
                current_app.logger.warning(f"Acesso NEGADO para utilizador ID {user_id} (role: {role}) à rota '{request.path}'. Permissão '{permission_key}' em falta.")
                abort(403, description="Acesso proibido: não tem permissão para esta ação.")

            except Exception as e:
                current_app.logger.error(f"Erro no decorador require_permission: {e}", exc_info=True)
                abort(500, description="Erro interno no sistema de permissões.")
                
        return decorated_function
    return decorator