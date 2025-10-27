# SMARTCONTROL/routes/audit_helper.py
# (FICHEIRO COMPLETO E CORRIGIDO)

# Removido: from config.database import get_connection
from flask import g, current_app # Importar g e current_app
import json
import logging

# Obter o logger configurado no app.py
logger = logging.getLogger('flask.app')

def log_change(user_id, username, action_type, target_resource, target_id, details_dict):
    """
    Grava um registo na tabela de auditoria.
    AGORA USA g.db_cursor e g.db_conn
    """
    try:
        details_json = json.dumps(details_dict, ensure_ascii=False)
        
        # Usar a conexão e cursor globais
        if not g.db_cursor:
            logger.error("!!! FAILED TO LOG AUDIT: No g.db_cursor available.")
            return

        sql = """
            INSERT INTO auditoria (user_id, username, action_type, target_resource, target_id, details)
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        g.db_cursor.execute(sql, (user_id, username, action_type, target_resource, target_id, details_json))
        g.db_conn.commit() # Fazer commit na conexão global
        
        logger.info(f"AUDIT LOG: User '{username}' performed '{action_type}' on {target_resource} '{target_id}'")

    except Exception as e:
        logger.error(f"!!! FAILED TO LOG AUDIT: {e}", exc_info=True)
        if g.db_conn:
            g.db_conn.rollback() # Fazer rollback na conexão global
    # Removido 'finally' - app.py trata de fechar a conexão.
