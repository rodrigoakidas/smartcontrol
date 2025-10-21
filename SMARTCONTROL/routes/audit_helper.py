# SMARTCONTROL/routes/audit_helper.py
# (FICHEIRO COMPLETO E CORRIGIDO)

from config.database import get_connection
import json
import logging # Usar logging

# Obter o logger configurado no app.py
logger = logging.getLogger('flask.app')

def log_change(user_id, username, action_type, target_resource, target_id, details_dict):
    """
    Grava um registo na tabela de auditoria.
    """
    conn = None
    cursor = None
    try:
        details_json = json.dumps(details_dict, ensure_ascii=False)
        
        conn = get_connection()
        # Não podemos usar 'g' aqui, pois esta função pode ser chamada
        # fora do contexto da app (ex: scripts futuros).
        # Manter a gestão de conexão manual aqui é mais seguro.
        cursor = conn.cursor()
        
        sql = """
            INSERT INTO auditoria (user_id, username, action_type, target_resource, target_id, details)
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        cursor.execute(sql, (user_id, username, action_type, target_resource, target_id, details_json))
        conn.commit()
        logger.info(f"AUDIT LOG: User '{username}' performed '{action_type}' on {target_resource} '{target_id}'")

    except Exception as e:
        logger.error(f"!!! FAILED TO LOG AUDIT: {e}", exc_info=True)
        if conn:
            conn.rollback()
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()