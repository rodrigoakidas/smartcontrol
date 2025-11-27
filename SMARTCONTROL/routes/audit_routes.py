# SMARTCONTROL/routes/audit_routes.py
# (FICHEIRO COMPLETO E CORRIGIDO)

from flask import Blueprint, jsonify, request, g, current_app
# Removido get_connection

audit_bp = Blueprint('audit', __name__)

@audit_bp.route('/<string:resource>/<string:resource_id>', methods=['GET'])
def get_audit_logs(resource, resource_id):
    """
    Busca o histórico de alterações para um recurso específico.
    """
    try:
        if not g.db_cursor:
             return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500
             
        sql = """
            SELECT id, timestamp, username, action_type, details 
            FROM auditoria 
            WHERE target_resource = %s AND target_id = %s
            ORDER BY timestamp DESC
        """
        g.db_cursor.execute(sql, (resource, resource_id))
        logs = g.db_cursor.fetchall()
        
        return jsonify(logs)

    except Exception as e:
        current_app.logger.error(f"Erro ao buscar logs de auditoria para {resource}/{resource_id}: {e}", exc_info=True)
        return jsonify({'message': 'Erro ao buscar histórico de alterações'}), 500
    # Removido 'finally'