# SMARTCONTROL/routes/devices_routes.py
# (FICHEIRO COMPLETO E CORRIGIDO)

from flask import Blueprint, jsonify, request, g, current_app
import json
from .audit_helper import log_change 
import csv
import io
from .decorators import require_permission

devices_bp = Blueprint('devices', __name__)

@devices_bp.route('/', methods=['GET'])
def get_devices():
    try:
        if not g.db_cursor:
             return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500
             
        sql = """
            SELECT 
                a.id, a.modelo AS model, a.imei1, a.imei2, 
                a.condicao AS `condition`, a.observacoes AS colorNotes,
                l.numero AS currentLine,
                CASE 
                    WHEN EXISTS (SELECT 1 FROM registros r WHERE r.aparelho_id = a.id AND r.status = 'Em Uso') THEN 'Em uso'
                    WHEN a.condicao IN ('Novo', 'Aprovado para uso') THEN 'Disponível'
                    ELSE 'Indisponível'
                END AS status
            FROM aparelhos a
            LEFT JOIN linhas l ON a.linha_id = l.id
        """
        g.db_cursor.execute(sql)
        devices = g.db_cursor.fetchall()
        return jsonify(devices)
    except Exception as e:
        current_app.logger.error(f"Erro ao buscar aparelhos: {e}", exc_info=True)
        return jsonify({'message': 'Erro ao buscar aparelhos'}), 500

@devices_bp.route('/', methods=['POST'])
@require_permission('devices_create')
def add_device():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'message': 'Dados inválidos'}), 400
        modelo = data.get('model')
        imei1 = data.get('imei1')
        imei2 = data.get('imei2')
        condicao = data.get('condition')
        observacoes = data.get('colorNotes')
        linha_id = data.get('linha_id')
        current_user = data.get('currentUser', {})
        user_id = current_user.get('id')
        username = current_user.get('nome', 'Sistema')

        if not all([modelo, imei1, condicao]):
            return jsonify({'message': 'Modelo, IMEI1 e Condição são obrigatórios'}), 400
            
        if not g.db_cursor:
             return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500

        g.db_cursor.execute(
            "INSERT INTO aparelhos (modelo, imei1, imei2, condicao, observacoes, linha_id) VALUES (%s, %s, %s, %s, %s, %s)",
            (modelo, imei1, imei2, condicao, observacoes, linha_id if linha_id else None)
        )
        g.db_conn.commit()
        
        log_change(
            user_id=user_id, username=username, action_type='CREATE',
            target_resource='Device', target_id=imei1,
            details_dict={'message': f'Aparelho criado: {modelo}', 'data': data}
        )
        return jsonify({'message': 'Aparelho adicionado com sucesso'}), 201
    except Exception as e:
        if g.db_conn: g.db_conn.rollback()
        if 'Duplicate entry' in str(e):
            return jsonify({'message': f'O IMEI {imei1} já está cadastrado.'}), 409
        current_app.logger.error(f"Erro ao adicionar aparelho: {e}", exc_info=True)
        return jsonify({'message': 'Erro ao adicionar aparelho'}), 500

@devices_bp.route('/<string:imei>', methods=['PUT'])
@require_permission('devices_update')
def update_device(imei):
    try:
        data = request.get_json()
        if not data:
            return jsonify({'message': 'Dados inválidos'}), 400
        modelo = data.get('model')
        imei2 = data.get('imei2')
        condicao = data.get('condition')
        observacoes = data.get('colorNotes')
        linha_id = data.get('linha_id')
        current_user = data.get('currentUser', {})
        user_id = current_user.get('id')
        username = current_user.get('nome', 'Sistema')

        if not g.db_cursor:
             return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500

        g.db_cursor.execute("SELECT * FROM aparelhos WHERE imei1 = %s", (imei,))
        old_data = g.db_cursor.fetchone()

        g.db_cursor.execute(
            "UPDATE aparelhos SET modelo = %s, imei2 = %s, condicao = %s, observacoes = %s, linha_id = %s WHERE imei1 = %s",
            (modelo, imei2, condicao, observacoes, linha_id if linha_id else None, imei)
        )
        g.db_conn.commit()
        
        if g.db_cursor.rowcount == 0:
            return jsonify({'message': 'Aparelho não encontrado'}), 404

        log_change(
            user_id=user_id, username=username, action_type='UPDATE',
            target_resource='Device', target_id=imei,
            details_dict={'message': 'Aparelho atualizado.', 'old_data': old_data, 'new_data': data}
        )
        return jsonify({'message': 'Aparelho atualizado com sucesso'})
    except Exception as e:
        if g.db_conn: g.db_conn.rollback()
        current_app.logger.error(f"Erro ao atualizar aparelho {imei}: {e}", exc_info=True)
        return jsonify({'message': 'Erro ao atualizar aparelho'}), 500

@devices_bp.route('/<string:imei>', methods=['DELETE'])
@require_permission('devices_delete')
def delete_device(imei):
    try:
        data = request.get_json() or {}
        current_user = data.get('currentUser', {})
        user_id = current_user.get('id')
        username = current_user.get('nome', 'Sistema')

        if not g.db_cursor:
             return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500

        g.db_cursor.execute("SELECT * FROM aparelhos WHERE imei1 = %s", (imei,))
        device_data = g.db_cursor.fetchone()

        g.db_cursor.execute("DELETE FROM aparelhos WHERE imei1 = %s", (imei,))
        g.db_conn.commit()

        if g.db_cursor.rowcount == 0:
            return jsonify({'message': 'Aparelho não encontrado'}), 404
        
        log_change(
            user_id=user_id, username=username, action_type='DELETE',
            target_resource='Device', target_id=imei,
            details_dict={'message': f'Aparelho {device_data.get("modelo")} excluído.'}
        )
        return jsonify({'message': 'Aparelho excluído com sucesso'})
    except Exception as e:
        if g.db_conn: g.db_conn.rollback()
        if 'foreign key constraint' in str(e).lower():
            return jsonify({'message': 'Não é possível excluir. O aparelho possui registros ou manutenções vinculadas.'}), 409
        current_app.logger.error(f"Erro ao excluir aparelho {imei}: {e}", exc_info=True)
        return jsonify({'message': 'Erro ao excluir aparelho'}), 500

@devices_bp.route('/<string:imei>/history', methods=['GET'])
def get_device_history(imei):
    try:
        if not g.db_cursor:
             return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500
             
        sql_utilizacao = """
            SELECT 
                f.nome as employeeName, r.data_entrega as deliveryDate, r.data_devolucao as returnDate 
            FROM registros r
            JOIN funcionarios f ON r.funcionario_id = f.id
            JOIN aparelhos a ON r.aparelho_id = a.id
            WHERE a.imei1 = %s ORDER BY r.data_entrega DESC
        """
        g.db_cursor.execute(sql_utilizacao, (imei,))
        utilizacao = g.db_cursor.fetchall()
        sql_manutencao = """
            SELECT m.data_envio, m.data_retorno, m.defeito_reportado, m.custo, m.status
            FROM manutencoes m
            JOIN aparelhos a ON m.aparelho_id = a.id
            WHERE a.imei1 = %s ORDER BY m.data_envio DESC
        """
        g.db_cursor.execute(sql_manutencao, (imei,))
        manutencao = g.db_cursor.fetchall()
        return jsonify({'utilizacao': utilizacao, 'manutencao': manutencao})
    except Exception as e:
        current_app.logger.error(f"Erro ao buscar histórico do aparelho {imei}: {e}", exc_info=True)
        return jsonify({'message': 'Erro ao buscar histórico do aparelho'}), 500

@devices_bp.route('/import', methods=['POST'])
@require_permission('devices_import')
def import_devices():
    if 'file' not in request.files:
        return jsonify({'message': 'Nenhum ficheiro enviado'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'message': 'Nenhum ficheiro selecionado'}), 400

    # O decorador já trata 'currentUser' do 'request.form'
    current_user_json = request.form.get('currentUser', '{}')
    current_user = json.loads(current_user_json)
    user_id = current_user.get('id')
    username = current_user.get('nome', 'Sistema')

    try:
        if not g.db_cursor:
             return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500
             
        stream = io.StringIO(file.stream.read().decode("UTF-8"), newline=None)
        csv_reader = csv.reader(stream)
        
        next(csv_reader) # Pular cabeçalho
        
        success_count = 0
        skipped_count = 0
        failed_entries = []
        valid_conditions = ['Novo', 'Aprovado para uso', 'Em manutenção', 'Danificado', 'Sinistrado', 'Com Defeito']

        for row in csv_reader:
            try:
                if len(row) < 3:
                    failed_entries.append(f'Linha com colunas insuficientes: {",".join(row)}')
                    continue
                modelo, imei1, condicao = row[0], row[1], row[2]
                imei2 = row[3] if len(row) > 3 else None
                observacoes = row[4] if len(row) > 4 else None

                if not all([modelo, imei1, condicao]):
                    failed_entries.append(f'Linha com dados obrigatórios em falta: {",".join(row)}')
                    continue
                if condicao not in valid_conditions:
                    failed_entries.append(f'IMEI {imei1}: Condição "{condicao}" inválida.')
                    continue
                
                g.db_cursor.execute(
                    "INSERT IGNORE INTO aparelhos (modelo, imei1, imei2, condicao, observacoes) VALUES (%s, %s, %s, %s, %s)",
                    (modelo, imei1, imei2, condicao, observacoes)
                )
                if g.db_cursor.rowcount > 0:
                    success_count += 1
                else:
                    skipped_count += 1
            except Exception as e:
                failed_entries.append(f'IMEI {row[1]}: Erro inesperado.')
                current_app.logger.warning(f"Erro na linha do CSV (Aparelhos): {row} -> {e}")
        
        g.db_conn.commit()

        log_change(
            user_id=user_id, username=username, action_type='IMPORT',
            target_resource='Device', target_id='Multiple',
            details_dict={'message': f'{success_count} aparelhos importados, {skipped_count} ignorados (duplicados). Falhas: {len(failed_entries)}.'}
        )
        return jsonify({
            'message': f'{success_count} importados, {skipped_count} ignorados.',
            'failures': failed_entries
        }), 201
    except Exception as e:
        if g.db_conn: g.db_conn.rollback()
        current_app.logger.error(f"Erro GERAL ao importar aparelhos: {e}", exc_info=True)
        return jsonify({'message': 'Erro interno ao processar o ficheiro CSV.'}), 500

@devices_bp.route('/eligible-for-maintenance', methods=['GET'])
def get_eligible_devices():
    try:
        if not g.db_cursor:
             return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500
             
        sql = """
            SELECT a.id, a.modelo, a.imei1
            FROM aparelhos a
            WHERE 
                a.condicao IN ('Com Defeito', 'Danificado') 
                AND NOT EXISTS (
                    SELECT 1 FROM registros r 
                    WHERE r.aparelho_id = a.id AND r.status = 'Em Uso'
                )
            ORDER BY a.modelo;
        """
        g.db_cursor.execute(sql)
        devices = g.db_cursor.fetchall()
        return jsonify(devices)
    except Exception as e:
        current_app.logger.error(f"Erro ao buscar aparelhos elegíveis: {e}", exc_info=True)
        return jsonify({'message': 'Erro ao buscar aparelhos elegíveis'}), 500