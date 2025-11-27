from flask import Blueprint, jsonify, request, g, current_app
from .decorators import require_permission
from services.maintenance_service import (
    list_maintenances, get_maintenance_by_id,
    create_maintenance, update_maintenance, delete_maintenance
)

maintenance_bp = Blueprint('maintenance', __name__)

@maintenance_bp.route('/', methods=['GET'])
def get_maintenances_route():
    try:
        return jsonify(list_maintenances())
    except Exception as e:
        current_app.logger.error(f"Erro get_maintenances: {e}", exc_info=True)
        return jsonify({"message": "Erro ao listar manutenções"}), 500


@maintenance_bp.route('/<int:maint_id>', methods=['GET'])
def get_maintenance_route(maint_id):
    try:
        record = get_maintenance_by_id(maint_id)
        if not record:
            return jsonify({"message": "Registro não encontrado"}), 404
        return jsonify(record)
    except Exception as e:
        current_app.logger.error(f"Erro get_maintenance {maint_id}: {e}", exc_info=True)
        return jsonify({"message": "Erro ao obter manutenção"}), 500


@maintenance_bp.route('/', methods=['POST'])
@require_permission('maintenance_create')
def create_maintenance_route():
    try:
        new_id = create_maintenance(request.get_json() or {})
        return jsonify({"message": "Manutenção criada com sucesso", "id": new_id}), 201
    except Exception as e:
        if g.db_conn: g.db_conn.rollback()
        current_app.logger.error(f"Erro create_maintenance: {e}", exc_info=True)
        return jsonify({"message": "Erro ao criar manutenção"}), 500


@maintenance_bp.route('/<int:maint_id>', methods=['PUT'])
@require_permission('maintenance_update')
def update_maintenance_route(maint_id):
    try:
        update_maintenance(maint_id, request.get_json() or {})
        return jsonify({"message": "Atualizado com sucesso"})
    except Exception as e:
        if g.db_conn: g.db_conn.rollback()
        current_app.logger.error(f"Erro update_maintenance {maint_id}: {e}", exc_info=True)
        return jsonify({"message": "Erro ao atualizar manutenção"}), 500


@maintenance_bp.route('/<int:maint_id>', methods=['DELETE'])
@require_permission('maintenance_delete')
def delete_maintenance_route(maint_id):
    try:
        ok = delete_maintenance(maint_id, (request.get_json() or {}).get('currentUser', {}))
        if not ok:
            return jsonify({'message': 'Registro não encontrado'}), 404
        return jsonify({'message': 'Registro excluído com sucesso'})
    except Exception as e:
        if g.db_conn: g.db_conn.rollback()
        current_app.logger.error(f"Erro delete_maintenance {maint_id}: {e}", exc_info=True)
        return jsonify({'message': 'Erro ao excluir manutenção'}), 500
