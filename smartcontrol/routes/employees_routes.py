# SMARTCONTROL/routes/employees_routes.py
# (FICHEIRO COMPLETO E CORRIGIDO - Resolve Bug 1 e Bug 3)

from flask import Blueprint, jsonify, request, g, current_app # Adicionado g e current_app
# Removido: from config.database import get_connection
from .audit_helper import log_change
from .decorators import require_permission # Adicionado import do decorador
import csv
import io
import json

employees_bp = Blueprint('employees', __name__)

# GET /employees - Listar todos os funcionários
@employees_bp.route('/', methods=['GET'])
def get_employees():
    try:
        if not g.db_cursor:
             return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500
             
        g.db_cursor.execute("SELECT matricula as id, nome as name, cargo as position, email FROM funcionarios")
        employees = g.db_cursor.fetchall()
        return jsonify(employees)
    except Exception as e:
        current_app.logger.error(f"Erro ao buscar funcionários: {e}", exc_info=True)
        return jsonify({'message': 'Erro ao buscar funcionários'}), 500
    # Removido 'finally'

# POST /employees - Adicionar um novo funcionário
@employees_bp.route('/', methods=['POST'])
@require_permission('employees_create') # Protegendo a criação
def add_employee():
    try:
        data = request.get_json()
        matricula = data.get('id')
        nome = data.get('name')
        cargo = data.get('position')
        email = data.get('email')

        current_user = data.get('currentUser', {})
        user_id = current_user.get('id')
        username = current_user.get('nome', 'Sistema')

        if not all([matricula, nome, cargo]):
            return jsonify({'message': 'Matrícula, nome e cargo são obrigatórios'}), 400

        if not g.db_cursor:
             return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500

        g.db_cursor.execute(
            "INSERT INTO funcionarios (matricula, nome, cargo, email) VALUES (%s, %s, %s, %s)",
            (matricula, nome, cargo, email)
        )
        g.db_conn.commit()

        log_change(
            user_id=user_id,
            username=username,
            action_type='CREATE',
            target_resource='Employee',
            target_id=matricula,
            details_dict={'message': f'Funcionário criado: {nome} ({matricula})'}
        )

        return jsonify({'message': 'Funcionário adicionado com sucesso'}), 201
    except Exception as e:
        if g.db_conn: g.db_conn.rollback()
        if 'Duplicate entry' in str(e):
            return jsonify({'message': f'A matrícula {matricula} já existe.'}), 409
        current_app.logger.error(f"Erro ao adicionar funcionário: {e}", exc_info=True)
        return jsonify({'message': 'Erro ao adicionar funcionário'}), 500
    # Removido 'finally'

# PUT /employees/<matricula> - Atualizar um funcionário
@employees_bp.route('/<string:matricula>', methods=['PUT'])
@require_permission('employees_update') # Protegendo a atualização
def update_employee(matricula):
    try:
        data = request.get_json()
        nome = data.get('name')
        cargo = data.get('position')
        email = data.get('email')

        current_user = data.get('currentUser', {})
        user_id = current_user.get('id')
        username = current_user.get('nome', 'Sistema')

        if not g.db_cursor:
             return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500

        g.db_cursor.execute(
            "UPDATE funcionarios SET nome = %s, cargo = %s, email = %s WHERE matricula = %s",
            (nome, cargo, email, matricula)
        )
        g.db_conn.commit()
        
        if g.db_cursor.rowcount == 0:
            return jsonify({'message': 'Funcionário não encontrado'}), 404
            
        log_change(
            user_id=user_id,
            username=username,
            action_type='UPDATE',
            target_resource='Employee',
            target_id=matricula,
            details_dict={'message': f'Dados de {nome} atualizados.', 'new_data': data}
        )
            
        return jsonify({'message': 'Funcionário atualizado com sucesso'})
    except Exception as e:
        if g.db_conn: g.db_conn.rollback()
        current_app.logger.error(f"Erro ao atualizar funcionário {matricula}: {e}", exc_info=True)
        return jsonify({'message': 'Erro ao atualizar funcionário'}), 500
    # Removido 'finally'

# DELETE /employees/<matricula> - Deletar um funcionário
@employees_bp.route('/<string:matricula>', methods=['DELETE'])
@require_permission('employees_delete') # Protegendo a exclusão
def delete_employee(matricula):
    try:
        data = request.get_json() or {}
        current_user = data.get('currentUser', {})
        user_id = current_user.get('id')
        username = current_user.get('nome', 'Sistema')

        if not g.db_cursor:
             return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500

        g.db_cursor.execute("SELECT nome FROM funcionarios WHERE matricula = %s", (matricula,))
        employee_data = g.db_cursor.fetchone()

        g.db_cursor.execute("DELETE FROM funcionarios WHERE matricula = %s", (matricula,))
        g.db_conn.commit()

        if g.db_cursor.rowcount == 0:
            return jsonify({'message': 'Funcionário não encontrado'}), 404
            
        log_change(
            user_id=user_id,
            username=username,
            action_type='DELETE',
            target_resource='Employee',
            target_id=matricula,
            details_dict={'message': f'Funcionário {employee_data.get("nome")} ({matricula}) excluído.'}
        )
            
        return jsonify({'message': 'Funcionário excluído com sucesso'})
    except Exception as e:
        if g.db_conn: g.db_conn.rollback()
        if 'foreign key constraint' in str(e).lower():
            return jsonify({'message': 'Não é possível excluir. O funcionário possui registros de aparelhos vinculados.'}), 409
        current_app.logger.error(f"Erro ao excluir funcionário {matricula}: {e}", exc_info=True)
        return jsonify({'message': 'Erro ao excluir funcionário'}), 500
    # Removido 'finally'

# GET /employees/<matricula>/history - Obter histórico de aparelhos de um funcionário
@employees_bp.route('/<string:matricula>/history', methods=['GET'])
def get_employee_history(matricula):
    try:
        if not g.db_cursor:
             return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500
             
        sql = """
            SELECT 
                a.modelo AS deviceModel,
                a.imei1 AS deviceImei,
                r.data_entrega AS deliveryDate,
                r.data_devolucao AS returnDate,
                r.status AS status
            FROM registros r
            JOIN aparelhos a ON r.aparelho_id = a.id
            JOIN funcionarios f ON r.funcionario_id = f.id
            WHERE f.matricula = %s
            ORDER BY r.data_entrega DESC
        """
        g.db_cursor.execute(sql, (matricula,))
        history = g.db_cursor.fetchall()
        return jsonify(history)
    except Exception as e:
        current_app.logger.error(f"Erro ao buscar histórico do funcionário {matricula}: {e}", exc_info=True)
        return jsonify({'message': 'Erro ao buscar histórico do funcionário'}), 500
    # Removido 'finally'

# --- ROTA PARA IMPORTAÇÃO DE CSV (CORRIGIDA E PROTEGIDA) ---
@employees_bp.route('/import', methods=['POST'])
@require_permission('employees_import') # <-- CORREÇÃO DE SEGURANÇA
def import_employees():
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
        
        next(csv_reader) # Pular o cabeçalho
        
        success_count = 0
        skipped_count = 0
        failed_entries = []

        for row in csv_reader:
            try:
                if len(row) < 3:
                    failed_entries.append(f'Linha com colunas insuficientes: {",".join(row)}')
                    continue

                matricula, nome, cargo = row[0], row[1], row[2]
                email = row[3] if len(row) > 3 and row[3] else None

                if not all([matricula, nome, cargo]):
                    failed_entries.append(f'Linha com dados obrigatórios em falta: {",".join(row)}')
                    continue
                
                g.db_cursor.execute(
                    "INSERT IGNORE INTO funcionarios (matricula, nome, cargo, email) VALUES (%s, %s, %s, %s)",
                    (matricula, nome, cargo, email)
                )
                if g.db_cursor.rowcount > 0:
                    success_count += 1
                else:
                    skipped_count += 1
            except Exception as e:
                failed_entries.append(f'Matrícula {row[0]}: Erro inesperado.')
                current_app.logger.warning(f"Erro na linha do CSV (Funcionários): {row} -> {e}")
        
        g.db_conn.commit()

        log_change(
            user_id=user_id,
            username=username,
            action_type='IMPORT',
            target_resource='Employee',
            target_id='Multiple',
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
    # Removido 'finally'
