# d:\APP\smartcontrol\routes\employees_routes.py

from flask import Blueprint, jsonify, request, g, current_app
from .audit_helper import log_change
from .decorators import require_permission
import csv
import io

employees_bp = Blueprint('employees', __name__)

@employees_bp.route('/', methods=['GET'])
def get_employees():
    """Busca e retorna todos os funcionários."""
    try:
        if not g.db_cursor:
            return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500
        
        # Versão estável e correta da consulta
        g.db_cursor.execute("SELECT id, nome AS name, matricula, cargo AS position, email FROM funcionarios ORDER BY nome")
        employees = g.db_cursor.fetchall()
        return jsonify(employees)
    except Exception as e:
        current_app.logger.error(f"Erro ao buscar funcionários: {e}", exc_info=True)
        return jsonify({'message': 'Erro ao buscar funcionários'}), 500

@employees_bp.route('/', methods=['POST'])
@require_permission('employees_create')
def add_employee():
    """Adiciona um novo funcionário."""
    try:
        data = request.get_json()
        nome = data.get('name')
        matricula = data.get('id')
        cargo = data.get('position')
        email = data.get('email')
        current_user = data.get('currentUser', {})
        user_id = current_user.get('id')
        username = current_user.get('nome', 'Sistema')

        if not all([nome, matricula, cargo]):
            return jsonify({'message': 'Nome, Matrícula e Cargo são obrigatórios'}), 400
            
        if not g.db_cursor:
            return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500

        g.db_cursor.execute(
            "INSERT INTO funcionarios (nome, matricula, cargo, email) VALUES (%s, %s, %s, %s)",
            (nome, matricula, cargo, email)
        )
        g.db_conn.commit()
        
        log_change(
            user_id=user_id, username=username, action_type='CREATE',
            target_resource='Employee', target_id=matricula,
            details_dict={'message': f'Funcionário criado: {nome}', 'data': data}
        )
        return jsonify({'message': 'Funcionário adicionado com sucesso'}), 201
    except Exception as e:
        if g.db_conn: g.db_conn.rollback()
        if 'Duplicate entry' in str(e):
            return jsonify({'message': f'A matrícula {matricula} já está cadastrada.'}), 409
        current_app.logger.error(f"Erro ao adicionar funcionário: {e}", exc_info=True)
        return jsonify({'message': 'Erro ao adicionar funcionário'}), 500

@employees_bp.route('/<int:employee_id>', methods=['PUT'])
@require_permission('employees_update')
def update_employee(employee_id):
    """Atualiza um funcionário existente."""
    try:
        data = request.get_json()
        nome = data.get('name')
        matricula = data.get('id')
        cargo = data.get('position')
        email = data.get('email')
        current_user = data.get('currentUser', {})
        user_id = current_user.get('id')
        username = current_user.get('nome', 'Sistema')

        if not g.db_cursor:
            return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500

        g.db_cursor.execute("SELECT * FROM funcionarios WHERE id = %s", (employee_id,))
        old_data = g.db_cursor.fetchone()

        g.db_cursor.execute(
            "UPDATE funcionarios SET nome = %s, matricula = %s, cargo = %s, email = %s WHERE id = %s",
            (nome, matricula, cargo, email, employee_id)
        )
        g.db_conn.commit()

        if g.db_cursor.rowcount == 0:
            return jsonify({'message': 'Funcionário não encontrado'}), 404

        log_change(
            user_id=user_id, username=username, action_type='UPDATE',
            target_resource='Employee', target_id=matricula,
            details_dict={'message': 'Funcionário atualizado.', 'old_data': old_data, 'new_data': data}
        )
        return jsonify({'message': 'Funcionário atualizado com sucesso'})
    except Exception as e:
        if g.db_conn: g.db_conn.rollback()
        if 'Duplicate entry' in str(e):
            return jsonify({'message': f'A matrícula {matricula} já pertence a outro funcionário.'}), 409
        current_app.logger.error(f"Erro ao atualizar funcionário {employee_id}: {e}", exc_info=True)
        return jsonify({'message': 'Erro ao atualizar funcionário'}), 500

@employees_bp.route('/<int:employee_id>', methods=['DELETE'])
@require_permission('employees_delete')
def delete_employee(employee_id):
    """Exclui um funcionário."""
    try:
        data = request.get_json() or {}
        current_user = data.get('currentUser', {})
        user_id = current_user.get('id')
        username = current_user.get('nome', 'Sistema')

        if not g.db_cursor:
            return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500

        g.db_cursor.execute("SELECT nome FROM funcionarios WHERE id = %s", (employee_id,))
        employee_data = g.db_cursor.fetchone()

        g.db_cursor.execute("DELETE FROM funcionarios WHERE id = %s", (employee_id,))
        g.db_conn.commit()

        if g.db_cursor.rowcount == 0:
            return jsonify({'message': 'Funcionário não encontrado'}), 404
        
        log_change(
            user_id=user_id, username=username, action_type='DELETE',
            target_resource='Employee', target_id=employee_id,
            details_dict={'message': f'Funcionário {employee_data.get("nome")} excluído.'}
        )
        return jsonify({'message': 'Funcionário excluído com sucesso'})
    except Exception as e:
        if g.db_conn: g.db_conn.rollback()
        if 'foreign key constraint' in str(e).lower():
            return jsonify({'message': 'Não é possível excluir. O funcionário possui termos de responsabilidade vinculados.'}), 409
        current_app.logger.error(f"Erro ao excluir funcionário {employee_id}: {e}", exc_info=True)
        return jsonify({'message': 'Erro ao excluir funcionário'}), 500

@employees_bp.route('/<int:employee_id>/history', methods=['GET'])
def get_employee_history(employee_id):
    """Busca o histórico de aparelhos de um funcionário."""
    try:
        if not g.db_cursor:
            return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500
            
        sql = """
            SELECT 
                a.modelo AS deviceModel, r.data_entrega AS deliveryDate, 
                r.data_devolucao AS returnDate, r.status
            FROM registros r
            JOIN aparelhos a ON r.aparelho_id = a.id
            WHERE r.funcionario_id = %s 
            ORDER BY r.data_entrega DESC
        """
        g.db_cursor.execute(sql, (employee_id,))
        history = g.db_cursor.fetchall()
        return jsonify(history)
    except Exception as e:
        current_app.logger.error(f"Erro ao buscar histórico do funcionário {employee_id}: {e}", exc_info=True)
        return jsonify({'message': 'Erro ao buscar histórico do funcionário'}), 500

@employees_bp.route('/import', methods=['POST'])
@require_permission('employees_import')
def import_employees():
    """Importa funcionários a partir de um arquivo CSV."""
    if 'file' not in request.files:
        return jsonify({'message': 'Nenhum ficheiro enviado'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'message': 'Nenhum ficheiro selecionado'}), 400

    current_user_json = request.form.get('currentUser', '{}')
    current_user = json.loads(current_user_json)
    user_id = current_user.get('id')
    username = current_user.get('nome', 'Sistema')

    try:
        if not g.db_cursor:
            return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500
            
        stream = io.StringIO(file.stream.read().decode("UTF-8"), newline=None)
        csv_reader = csv.reader(stream)
        
        next(csv_reader) # Pula o cabeçalho
        
        success_count = 0
        skipped_count = 0
        failed_entries = []

        for row in csv_reader:
            try:
                if len(row) < 3:
                    failed_entries.append(f'Linha com colunas insuficientes: {",".join(row)}')
                    continue
                nome, matricula, cargo = row[0], row[1], row[2]
                email = row[3] if len(row) > 3 else None

                if not all([nome, matricula, cargo]):
                    failed_entries.append(f'Linha com dados obrigatórios em falta: {",".join(row)}')
                    continue
                
                g.db_cursor.execute(
                    "INSERT IGNORE INTO funcionarios (nome, matricula, cargo, email) VALUES (%s, %s, %s, %s)",
                    (nome, matricula, cargo, email)
                )
                if g.db_cursor.rowcount > 0:
                    success_count += 1
                else:
                    skipped_count += 1
            except Exception as e:
                failed_entries.append(f'Matrícula {row[1]}: Erro inesperado.')
                current_app.logger.warning(f"Erro na linha do CSV (Funcionários): {row} -> {e}")
        
        g.db_conn.commit()

        log_change(
            user_id=user_id, username=username, action_type='IMPORT',
            target_resource='Employee', target_id='Multiple',
            details_dict={'message': f'{success_count} funcionários importados, {skipped_count} ignorados (duplicados). Falhas: {len(failed_entries)}.'}
        )
        return jsonify({
            'message': f'{success_count} importados, {skipped_count} ignorados.',
            'failures': failed_entries
        }), 201
    except Exception as e:
        if g.db_conn: g.db_conn.rollback()
        current_app.logger.error(f"Erro GERAL ao importar funcionários: {e}", exc_info=True)
        return jsonify({'message': 'Erro interno ao processar o ficheiro CSV.'}), 500
