# SMARTCONTROL/routes/dashboard_routes.py
# (VERSÃO CORRIGIDA - Trata erros de DB)

from flask import Blueprint, jsonify, current_app, g

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/stats', methods=['GET'])
def get_dashboard_stats():
    try:
        # Valida se o cursor está disponível
        if not g.db_cursor:
            current_app.logger.error("Cursor de DB não disponível em /dashboard/stats")
            return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500

        # Total de aparelhos
        g.db_cursor.execute("SELECT COUNT(*) as total FROM aparelhos")
        result = g.db_cursor.fetchone()
        total_devices = result['total'] if result else 0

        # Total de funcionários
        g.db_cursor.execute("SELECT COUNT(*) as total FROM funcionarios")
        result = g.db_cursor.fetchone()
        total_employees = result['total'] if result else 0
        
        # Aparelhos em manutenção
        g.db_cursor.execute("SELECT COUNT(*) as count FROM aparelhos WHERE condicao = 'Em manutenção'")
        result = g.db_cursor.fetchone()
        maintenance_devices_for_card = result['count'] if result else 0
        
        # Aparelhos em uso (distintos)
        g.db_cursor.execute("SELECT COUNT(DISTINCT aparelho_id) as count FROM registros WHERE status = 'Em Uso'")
        result = g.db_cursor.fetchone()
        in_use_devices_for_card = result['count'] if result else 0

        # IDs dos aparelhos em uso
        g.db_cursor.execute("SELECT DISTINCT aparelho_id FROM registros WHERE status = 'Em Uso'")
        in_use_ids_tuples = g.db_cursor.fetchall()
        in_use_ids = [item['aparelho_id'] for item in in_use_ids_tuples] if in_use_ids_tuples else []
        in_use_count = len(in_use_ids)

        # Aparelhos indisponíveis (excluindo os em uso)
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
            
        result = g.db_cursor.fetchone()
        unavailable_count = result['count'] if result else 0
        
        # Aparelhos disponíveis (cálculo)
        available_count = total_devices - in_use_count - unavailable_count

        # Aparelhos por condição
        g.db_cursor.execute("SELECT condicao, COUNT(*) as count FROM aparelhos GROUP BY condicao")
        devices_by_condition = g.db_cursor.fetchall() or []

        # Monta resposta
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
        current_app.logger.error(f"Erro CRÍTICO ao buscar estatísticas do dashboard: {e}", exc_info=True)
        # Retorna resposta vazia em vez de erro para não travar o frontend
        return jsonify({
            "totalDevices": 0,
            "inUseDevices": 0,
            "maintenanceDevices": 0,
            "totalEmployees": 0,
            "devicesByCondition": [],
            "deviceStatusSummary": {'Em Uso': 0, 'Disponível': 0, 'Indisponível': 0}
        }), 200  # Retorna 200 com dados vazios