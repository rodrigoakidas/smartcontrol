# SMARTCONTROL/routes/line_records_routes.py
# (FICHEIRO COMPLETO E CORRIGIDO)

from flask import Blueprint, jsonify, request, g, current_app
from .audit_helper import log_change
from .decorators import require_permission

line_records_bp = Blueprint('line_records', __name__)

@line_records_bp.route('/', methods=['POST'])
@require_permission('line_records_create') # Assumindo a chave de permissão
def create_line_record():
    try:
        data = request.get_json()
        linha_id = data.get('linha_id')
        matricula_funcionario = data.get('matricula_funcionario')
        data_entrega = data.get('data_entrega')
        current_user = data.get('currentUser', {})
        
        entregue_por = current_user.get('nome', 'Sistema')
        user_id = current_user.get('id')

        if not all([linha_id, matricula_funcionario, data_entrega]):
            return jsonify({'message': 'Todos os campos são obrigatórios'}), 400

        if not g.db_cursor:
             return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500
        
        g.db_cursor.execute("SELECT id FROM funcionarios WHERE matricula = %s", (matricula_funcionario,))
        funcionario = g.db_cursor.fetchone()
        if not funcionario:
            return jsonify({'message': 'Funcionário com a matrícula informada não foi encontrado'}), 404
        
        funcionario_id_real = funcionario['id']

        g.db_cursor.execute("UPDATE termos_linha SET status = 'Inativo' WHERE linha_id = %s", (linha_id,))

        g.db_cursor.execute(
            "INSERT INTO termos_linha (linha_id, funcionario_id, data_entrega, entregue_por) VALUES (%s, %s, %s, %s)",
            (linha_id, funcionario_id_real, data_entrega, entregue_por)
        )
        new_id = g.db_cursor.lastrowid
        g.db_conn.commit()

        log_change(user_id, entregue_por, 'CREATE', 'LineTerm', new_id, {'linha_id': linha_id, 'funcionario_id': funcionario_id_real})

        g.db_cursor.execute(
            """SELECT t.id, l.numero, f.nome as employeeName, f.matricula as employeeMatricula
               FROM termos_linha t 
               JOIN linhas l ON t.linha_id = l.id
               JOIN funcionarios f ON t.funcionario_id = f.id
               WHERE t.id = %s""",
            (new_id,)
        )
        new_record_details = g.db_cursor.fetchone()

        return jsonify({'message': 'Termo de linha criado!', 'newRecord': new_record_details}), 201
    except Exception as e:
        if g.db_conn: g.db_conn.rollback()
        current_app.logger.error(f"ERRO AO CRIAR TERMO DE LINHA: {e}", exc_info=True)
        return jsonify({'message': f"Erro: {e}"}), 500
    # Removido 'finally'