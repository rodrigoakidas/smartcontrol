from flask import Blueprint, jsonify, request
from config.database import get_connection
from .audit_helper import log_change # <--- IMPORTAR
import csv
import io
import json


lines_bp = Blueprint('lines', __name__)

# GET /lines - (Sem alterações)
@lines_bp.route('/', methods=['GET'])
def get_lines():
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        sql = """
            SELECT 
                l.id, l.numero, l.operadora, l.plano, l.status,
                a.imei1 AS imeiVinculado
            FROM linhas l
            LEFT JOIN aparelhos a ON l.id = a.linha_id
        """
        cursor.execute(sql)
        lines = cursor.fetchall()
        return jsonify(lines)
    except Exception as e:
        print(f"Erro ao buscar linhas: {e}")
        return jsonify({'message': 'Erro ao buscar linhas'}), 500
    finally:
        if conn and conn.is_connected():
            cursor.close()
            conn.close()

# POST /lines - Adicionar uma nova linha
@lines_bp.route('/', methods=['POST'])
def add_line():
    conn = None
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

        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO linhas (numero, operadora, plano, status) VALUES (%s, %s, %s, %s)",
            (numero, operadora, plano, status)
        )
        conn.commit()

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
        if 'Duplicate entry' in str(e):
            return jsonify({'message': f'O número {numero} já está cadastrado.'}), 409
        print(f"Erro ao adicionar linha: {e}")
        return jsonify({'message': 'Erro ao adicionar linha'}), 500
    finally:
        if conn and conn.is_connected():
            cursor.close()
            conn.close()

# PUT /lines/<int:line_id> - Atualizar uma linha
@lines_bp.route('/<int:line_id>', methods=['PUT'])
def update_line(line_id):
    conn = None
    try:
        data = request.get_json()
        operadora = data.get('operadora')
        plano = data.get('plano')
        status = data.get('status')
        
        current_user = data.get('currentUser', {})
        user_id = current_user.get('id')
        username = current_user.get('nome', 'Sistema')

        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE linhas SET operadora = %s, plano = %s, status = %s WHERE id = %s",
            (operadora, plano, status, line_id)
        )
        conn.commit()

        if cursor.rowcount == 0:
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
        print(f"Erro ao atualizar linha: {e}")
        return jsonify({'message': 'Erro ao atualizar linha'}), 500
    finally:
        if conn and conn.is_connected():
            cursor.close()
            conn.close()

# DELETE /lines/<int:line_id> - Deletar uma linha
@lines_bp.route('/<int:line_id>', methods=['DELETE'])
def delete_line(line_id):
    conn = None
    try:
        data = request.get_json() or {}
        current_user = data.get('currentUser', {})
        user_id = current_user.get('id')
        username = current_user.get('nome', 'Sistema')

        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT numero FROM linhas WHERE id = %s", (line_id,))
        line_data = cursor.fetchone()

        cursor.execute("DELETE FROM linhas WHERE id = %s", (line_id,))
        conn.commit()
        
        if cursor.rowcount == 0:
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
        if 'foreign key constraint' in str(e).lower():
            return jsonify({'message': 'Não é possível excluir. A linha está vinculada a um aparelho.'}), 409
        print(f"Erro ao excluir linha: {e}")
        return jsonify({'message': 'Erro ao excluir linha'}), 500
    finally:
        if conn and conn.is_connected():
            cursor.close()
            conn.close()

# GET /lines/<int:line_id>/history - (Sem alterações)
@lines_bp.route('/<int:line_id>/history', methods=['GET'])
def get_line_history(line_id):
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM linha_historico WHERE linha_id = %s ORDER BY data_vinculacao DESC", (line_id,))
        history = cursor.fetchall()
        return jsonify(history)
    except Exception as e:
        print(f"Erro ao buscar histórico da linha: {e}")
        return jsonify({'message': 'Erro ao buscar histórico da linha'}), 500
    finally:
        if conn and conn.is_connected():
            cursor.close()
            conn.close()




# ADICIONE A NOVA ROTA DE IMPORTAÇÃO NO FINAL DO FICHEIRO
@lines_bp.route('/import', methods=['POST'])
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

    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
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
                
                # Usar INSERT IGNORE para não dar erro em números duplicados
                cursor.execute(
                    "INSERT IGNORE INTO linhas (numero, operadora, plano, status) VALUES (%s, %s, %s, %s)",
                    (numero, operadora, plano, status)
                )
                if cursor.rowcount > 0:
                    success_count += 1
                else:
                    skipped_count += 1
            except Exception as e:
                failed_entries.append(f'Linha {row[0]}: Erro inesperado.')
                print(f"Erro na linha do CSV (Linhas): {row} -> {e}")
        
        conn.commit()

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
        print(f"Erro GERAL ao importar linhas: {e}")
        if conn:
            conn.rollback()
        return jsonify({'message': 'Erro interno ao processar o ficheiro CSV.'}), 500
    finally:
        if conn and conn.is_connected():
            cursor.close()
            conn.close()