# SMARTCONTROL/routes/maintenance_routes.py
# (FICHEIRO COMPLETO E CORRIGIDO)

from flask import Blueprint, jsonify, request, g, current_app
from .audit_helper import log_change
from datetime import datetime
from .decorators import require_permission

maintenance_bp = Blueprint('maintenance', __name__)

@maintenance_bp.route('/', methods=['GET'])
def get_maintenances():
    try:
        if not g.db_cursor:
             return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500
             
        sql = """
            SELECT 
                m.id, m.numero_os, m.aparelho_id,
                a.modelo AS modelo, a.imei1,
                m.data_envio, m.data_retorno, m.defeito_reportado,
                m.servico_realizado, m.fornecedor, m.custo, m.status
            FROM manutencoes m
            LEFT JOIN aparelhos a ON a.id = m.aparelho_id
            ORDER BY m.data_envio DESC
        """
        g.db_cursor.execute(sql)
        rows = g.db_cursor.fetchall()
        return jsonify(rows)
    except Exception as e:
        current_app.logger.error(f"Erro get_maintenances: {e}", exc_info=True)
        return jsonify({"message": "Erro ao listar manutenções"}), 500

@maintenance_bp.route('/<int:maint_id>', methods=['GET'])
def get_maintenance(maint_id):
    try:
        if not g.db_cursor:
             return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500
             
        g.db_cursor.execute(
            "SELECT * FROM manutencoes WHERE id = %s", (maint_id,)
        )
        record = g.db_cursor.fetchone()
        if not record:
            return jsonify({"message": "Registro não encontrado"}), 404
        return jsonify(record)
    except Exception as e:
        current_app.logger.error(f"Erro get_maintenance {maint_id}: {e}", exc_info=True)
        return jsonify({"message": "Erro ao obter manutenção"}), 500

@maintenance_bp.route('/', methods=['POST'])
@require_permission('maintenance_create')
def create_maintenance():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'message': 'Dados inválidos'}), 400
        aparelho_id = data.get('aparelho_id')
        data_envio = data.get('data_envio')
        defeito_reportado = data.get('defeito_reportado')
        fornecedor = data.get('fornecedor')
        current_user = data.get('currentUser', {})

        if not all([aparelho_id, data_envio, defeito_reportado]):
            return jsonify({"message": "Aparelho, data de envio e defeito são obrigatórios"}), 400

        if not g.db_cursor:
             return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500

        current_year = datetime.now().year
        g.db_cursor.execute(
            "SELECT COUNT(*) as count FROM manutencoes WHERE YEAR(data_envio) = %s", 
            (current_year,)
        )
        count_this_year = g.db_cursor.fetchone()['count']
        new_os_number = f"OS-{current_year}-{(count_this_year + 1):05d}"

        g.db_cursor.execute(
            """INSERT INTO manutencoes 
               (numero_os, aparelho_id, data_envio, defeito_reportado, fornecedor, status) 
               VALUES (%s, %s, %s, %s, %s, 'Em manutenção')""",
            (new_os_number, aparelho_id, data_envio, defeito_reportado, fornecedor)
        )
        maint_id = g.db_cursor.lastrowid

        g.db_cursor.execute("UPDATE aparelhos SET condicao = %s WHERE id = %s", ('Em manutenção', aparelho_id))
        g.db_conn.commit()

        log_change(
            user_id=current_user.get('id'),
            username=current_user.get('nome', 'Sistema'),
            action_type='CREATE', target_resource='Maintenance',
            target_id=maint_id,
            details_dict={'os_number': new_os_number, 'aparelho_id': aparelho_id}
        )
        
        g.db_cursor.execute("SELECT * FROM manutencoes WHERE id = %s", (maint_id,))
        new_maintenance_record = g.db_cursor.fetchone()

        return jsonify({"message": "Manutenção criada com sucesso", "new_record": new_maintenance_record}), 201
        
    except Exception as e:
        if g.db_conn: g.db_conn.rollback()
        current_app.logger.error(f"Erro create_maintenance: {e}", exc_info=True)
        return jsonify({"message": f"Erro ao criar manutenção: {e}"}), 500
            
@maintenance_bp.route('/<int:maint_id>', methods=['PUT'])
@require_permission('maintenance_update')
def update_maintenance(maint_id):
    try:
        data = request.get_json()
        if not data:
            return jsonify({'message': 'Dados inválidos'}), 400
        data_retorno = data.get('data_retorno')
        servico_realizado = data.get('servico_realizado')
        custo = data.get('custo')
        status = data.get('status')
        post_condition = data.get('postCondition')
        current_user = data.get('currentUser', {})

        if not g.db_cursor:
             return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500

        updates = []
        params = []
        if data_retorno is not None:
            updates.append("data_retorno = %s"); params.append(data_retorno)
        if servico_realizado is not None:
            updates.append("servico_realizado = %s"); params.append(servico_realizado)
        if custo is not None:
            updates.append("custo = %s"); params.append(custo)
        if status is not None:
            updates.append("status = %s"); params.append(status)

        if not updates:
            return jsonify({"message": "Nenhum campo para atualizar"}), 400

        sql = "UPDATE manutencoes SET " + ", ".join(updates) + " WHERE id = %s"
        params.append(maint_id)
        g.db_cursor.execute(sql, tuple(params))

        if g.db_cursor.rowcount == 0:
            return jsonify({"message": "Registro de manutenção não encontrado"}), 404

        if post_condition:
            g.db_cursor.execute("SELECT aparelho_id FROM manutencoes WHERE id = %s", (maint_id,))
            rec = g.db_cursor.fetchone()
            if rec and rec.get('aparelho_id'):
                aparelho_id = rec['aparelho_id']
                g.db_cursor.execute("UPDATE aparelhos SET condicao = %s WHERE id = %s", (post_condition, aparelho_id))

        g.db_conn.commit()

        log_change(
            user_id=current_user.get('id'),
            username=current_user.get('nome', 'Sistema'),
            action_type='UPDATE', target_resource='Maintenance',
            target_id=maint_id,
            details_dict={'updated_fields': updates, 'data': data}
        )
        return jsonify({"message": "Atualizado com sucesso"})
    except Exception as e:
        if g.db_conn: g.db_conn.rollback()
        current_app.logger.error(f"Erro update_maintenance {maint_id}: {e}", exc_info=True)
        return jsonify({"message": "Erro ao atualizar manutenção"}), 500

@maintenance_bp.route('/<int:maint_id>', methods=['DELETE'])
@require_permission('maintenance_delete')
def delete_maintenance(maint_id):
    try:
        data = request.get_json()
        if not data:
            data = {}
        current_user = data.get('currentUser', {})

        if not g.db_cursor:
             return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500

        g.db_cursor.execute("SELECT aparelho_id FROM manutencoes WHERE id = %s", (maint_id,))
        rec = g.db_cursor.fetchone()
        if not rec:
            return jsonify({'message': 'Registro de manutenção não encontrado'}), 404
        aparelho_id = rec['aparelho_id']

        g.db_cursor.execute("DELETE FROM manutencoes WHERE id = %s", (maint_id,))
        g.db_conn.commit()

        log_change(
            user_id=current_user.get('id'),
            username=current_user.get('nome', 'Sistema'),
            action_type='DELETE', target_resource='Maintenance',
            target_id=maint_id,
            details_dict={'aparelho_id': aparelho_id}
        )
        return jsonify({'message': 'Registro de manutenção excluído com sucesso'})
    except Exception as e:
        if g.db_conn: g.db_conn.rollback()
        current_app.logger.error(f"Erro delete_maintenance {maint_id}: {e}", exc_info=True)
        return jsonify({'message': 'Erro ao excluir manutenção'}), 500