# SMARTCONTROL/routes/lines_routes.py
# (FICHEIRO COMPLETO E CORRIGIDO - Resolve Bug 1 e Bug 3)

from flask import Blueprint, jsonify, request, g, current_app # Adicionado g e current_app
# Removido: from config.database import get_connection
from .audit_helper import log_change
from .decorators import require_permission # Adicionado import do decorador
import csv
import io
import json

lines_bp = Blueprint('lines', __name__)

# GET /lines
@lines_bp.route('/', methods=['GET'])
def get_lines():
    try:
        if not g.db_cursor:
             return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500
             
        sql = """
            SELECT 
                l.id, l.numero, l.operadora, l.plano, l.status,
                a.imei1 AS imeiVinculado
            FROM linhas l
            LEFT JOIN aparelhos a ON l.id = a.linha_id
        """
        g.db_cursor.execute(sql)
        lines = g.db_cursor.fetchall()
        return jsonify(lines)
    except Exception as e:
        current_app.logger.error(f"Erro ao buscar linhas: {e}", exc_info=True)
        return jsonify({'message': 'Erro ao buscar linhas'}), 500
    # Removido 'finally'

# POST /lines - Adicionar uma nova linha
@lines_bp.route('/', methods=['POST'])
@require_permission('lines_create') # <-- CORREÇÃO DE SEGURANÇA
def add_line():
    try:
        data = request.get_json()
        numero = data.get('numero')
        operadora = data.get('operadora')
        plano = data.get('plano')
        status = data.get('status')
        
        current_user = data.get('currentUser', {})
        user_id = current_user.get('id')
        username = current_user.get('nome', 'Sistema')

        if not all([numero, operadora, status]):
            return jsonify({'message': 'Número, operadora e status são obrigatórios'}), 400

        if not g.db_cursor:
             return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500

        g.db_cursor.execute(
            "INSERT INTO linhas (numero, operadora, plano, status) VALUES (%s, %s, %s, %s)",
            (numero, operadora, plano, status)
        )
        g.db_conn.commit()

        log_change(
            user_id=user_id,
            username=username,
            action_type='CREATE',
            target_resource='Line',
            target_id=numero,
            details_dict={'message': f'Linha {numero} ({operadora}) criada com status {status}.'}
        )

        return jsonify({'message': 'Linha adicionada com sucesso'}), 201
    except Exception as e:
        if g.db_conn: g.db_conn.rollback()
        if 'Duplicate entry' in str(e):
            return jsonify({'message': f'O número {numero} já está cadastrado.'}), 409
        current_app.logger.error(f"Erro ao adicionar linha: {e}", exc_info=True)
        return jsonify({'message': 'Erro ao adicionar linha'}), 500
    # Removido 'finally'

# PUT /lines/<int:line_id> - Atualizar uma linha
@lines_bp.route('/<int:line_id>', methods=['PUT'])
@require_permission('lines_update') # <-- CORREÇÃO DE SEGURANÇA
def update_line(line_id):
    try:
        data = request.get_json()
        operadora = data.get('operadora')
        plano = data.get('plano')
        status = data.get('status')
        
        current_user = data.get('currentUser', {})
        user_id = current_user.get('id')
        username = current_user.get('nome', 'Sistema')

        if not g.db_cursor:
             return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500

        g.db_cursor.execute(
            "UPDATE linhas SET operadora = %s, plano = %s, status = %s WHERE id = %s",
            (operadora, plano, status, line_id)
        )
        g.db_conn.commit()

        if g.db_cursor.rowcount == 0:
            return jsonify({'message': 'Linha não encontrada'}), 404

        log_change(
            user_id=user_id,
            username=username,
            action_type='UPDATE',
            target_resource='Line',
            target_id=line_id,
            details_dict={'message': 'Linha atualizada.', 'new_data': data}
        )

        return jsonify({'message': 'Linha atualizada com sucesso'})
    except Exception as e:
        if g.db_conn: g.db_conn.rollback()
        current_app.logger.error(f"Erro ao atualizar linha {line_id}: {e}", exc_info=True)
        return jsonify({'message': 'Erro ao atualizar linha'}), 500
    # Removido 'finally'

# DELETE /lines/<int:line_id> - Deletar uma linha
@lines_bp.route('/<int:line_id>', methods=['DELETE'])
@require_permission('lines_delete') # <-- CORREÇÃO DE SEGURANÇA
def delete_line(line_id):
    try:
        data = request.get_json() or {}
        current_user = data.get('currentUser', {})
        user_id = current_user.get('id')
        username = current_user.get('nome', 'Sistema')

        if not g.db_cursor:
             return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500

        g.db_cursor.execute("SELECT numero FROM linhas WHERE id = %s", (line_id,))
        line_data = g.db_cursor.fetchone()

        g.db_cursor.execute("DELETE FROM linhas WHERE id = %s", (line_id,))
        g.db_conn.commit()
        
        if g.db_cursor.rowcount == 0:
            return jsonify({'message': 'Linha não encontrada'}), 404

        log_change(
            user_id=user_id,
            username=username,
            action_type='DELETE',
            target_resource='Line',
            target_id=line_id,
            details_dict={'message': f'Linha {line_data.get("numero")} excluída.'}
        )

        return jsonify({'message': 'Linha excluída com sucesso'})
    except Exception as e:
        if g.db_conn: g.db_conn.rollback()
        if 'foreign key constraint' in str(e).lower():
            return jsonify({'message': 'Não é possível excluir. A linha está vinculada a um aparelho.'}), 409
        current_app.logger.error(f"Erro ao excluir linha {line_id}: {e}", exc_info=True)
        return jsonify({'message': 'Erro ao excluir linha'}), 500
    # Removido 'finally'

# GET /lines/<int:line_id>/history
@lines_bp.route('/<int:line_id>/history', methods=['GET'])
def get_line_history(line_id):
    try:
        if not g.db_cursor:
             return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500
             
        g.db_cursor.execute("SELECT * FROM linha_historico WHERE linha_id = %s ORDER BY data_vinculacao DESC", (line_id,))
        history = g.db_cursor.fetchall()
        return jsonify(history)
    except Exception as e:
        current_app.logger.error(f"Erro ao buscar histórico da linha {line_id}: {e}", exc_info=True)
        return jsonify({'message': 'Erro ao buscar histórico da linha'}), 500
    # Removido 'finally'


# POST /lines/import
@lines_bp.route('/import', methods=['POST'])
@require_permission('lines_import') # <-- CORREÇÃO DE SEGURANÇA
def import_lines():
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
                if len(row) < 4:
                    failed_entries.append(f'Linha com colunas insuficientes: {",".join(row)}')
                    continue

                numero, operadora, plano, status = row[0], row[1], row[2], row[3]

                if not all([numero, operadora, status]):
                    failed_entries.append(f'Linha com dados obrigatórios em falta: {",".join(row)}')
                    continue
                
                g.db_cursor.execute(
                    "INSERT IGNORE INTO linhas (numero, operadora, plano, status) VALUES (%s, %s, %s, %s)",
                    (numero, operadora, plano, status)
                )
                if g.db_cursor.rowcount > 0:
                    success_count += 1
                else:
                    skipped_count += 1
            except Exception as e:
                failed_entries.append(f'Linha {row[0]}: Erro inesperado.')
                current_app.logger.warning(f"Erro na linha do CSV (Linhas): {row} -> {e}")
        
        g.db_conn.commit()

        log_change(
            user_id=user_id,
            username=username,
            action_type='IMPORT',
            target_resource='Line',
            target_id='Multiple',
            details_dict={'message': f'{success_count} linhas importadas, {skipped_count} ignoradas. Falhas: {len(failed_entries)}.'}
        )

        return jsonify({
            'message': f'{success_count} linhas importadas, {skipped_count} ignoradas.',
            'failures': failed_entries
        }), 201

    except Exception as e:
        if g.db_conn: g.db_conn.rollback()
        current_app.logger.error(f"Erro GERAL ao importar linhas: {e}", exc_info=True)
        return jsonify({'message': 'Erro interno ao processar o ficheiro CSV.'}), 500
    # Removido 'finally'
