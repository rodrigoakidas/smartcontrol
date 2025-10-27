# SMARTCONTROL/routes/dashboard_routes.py
# (FICHEIRO COMPLETO E CORRIGIDO)

from flask import Blueprint, jsonify, current_app, g
# Removido get_connection

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/stats', methods=['GET'])
def get_dashboard_stats():
    try:
        if not g.db_cursor:
             return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500

        g.db_cursor.execute("SELECT COUNT(*) as total FROM aparelhos")
        total_devices = g.db_cursor.fetchone()['total']

        g.db_cursor.execute("SELECT COUNT(*) as total FROM funcionarios")
        total_employees = g.db_cursor.fetchone()['total']
        
        g.db_cursor.execute("SELECT COUNT(*) as count FROM aparelhos WHERE condicao = 'Em manutenção'")
        maintenance_devices_for_card = g.db_cursor.fetchone()['count']
        
        g.db_cursor.execute("SELECT COUNT(DISTINCT aparelho_id) as count FROM registros WHERE status = 'Em Uso'")
        in_use_devices_for_card = g.db_cursor.fetchone()['count']

        g.db_cursor.execute("SELECT DISTINCT aparelho_id FROM registros WHERE status = 'Em Uso'")
        in_use_ids_tuples = g.db_cursor.fetchall()
        in_use_ids = [item['aparelho_id'] for item in in_use_ids_tuples]
        in_use_count = len(in_use_ids)

        unavailable_conditions = "('Em manutenção', 'Danificado', 'Sinistrado', 'Com Defeito')"
        
        if in_use_ids:
            placeholders = ','.join(['%s'] * len(in_use_ids))
            unavailable_query = f"""
                SELECT COUNT(*) as count FROM aparelhos
                WHERE condicao IN {unavailable_conditions} AND id NOT IN ({placeholders})
            """
            g.db_cursor.execute(unavailable_query, tuple(in_use_ids))
        else:
            unavailable_query = f"SELECT COUNT(*) as count FROM aparelhos WHERE condicao IN {unavailable_conditions}"
            g.db_cursor.execute(unavailable_query)
            
        unavailable_count = g.db_cursor.fetchone()['count']
        
        available_count = total_devices - in_use_count - unavailable_count

        g.db_cursor.execute("SELECT condicao, COUNT(*) as count FROM aparelhos GROUP BY condicao")
        devices_by_condition = g.db_cursor.fetchall()

        stats = {
            "totalDevices": total_devices,
            "inUseDevices": in_use_devices_for_card,
            "maintenanceDevices": maintenance_devices_for_card,
            "totalEmployees": total_employees,
            "devicesByCondition": devices_by_condition,
            "deviceStatusSummary": {
                'Em Uso': in_use_count,
                'Disponível': available_count,
                'Indisponível': unavailable_count
            }
        }
        return jsonify(stats)
    except Exception as e:
        current_app.logger.error(f"Erro ao buscar estatísticas do dashboard: {e}", exc_info=True)
        return jsonify({'message': 'Erro interno ao buscar estatísticas'}), 500
    # Removido 'finally'