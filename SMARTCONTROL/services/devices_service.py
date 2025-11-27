from flask import g, current_app
from .audit_service import log_change
from .service_utils import db_execute, finish
import csv
import io


def get_all_devices():
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
    return db_execute(sql)


def add_new_device(data):
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
        return None, {'message': 'Modelo, IMEI1 e Condição são obrigatórios'}

    ok, error = db_execute(
        "INSERT INTO aparelhos (modelo, imei1, imei2, condicao, observacoes, linha_id) VALUES (%s, %s, %s, %s, %s, %s)",
        (modelo, imei1, imei2, condicao, observacoes, linha_id if linha_id else None),
        fetch=None
    )
    if error:
        finish(False)
        if 'Já está cadastrado' in str(error):
            return None, {'message': f'O IMEI {imei1} já está cadastrado.'}
        return None, {'message': 'Erro ao adicionar aparelho'}

    finish(True)

    log_change(
        user_id=user_id, username=username, action_type='CREATE',
        target_resource='Device', target_id=imei1,
        details_dict={'message': f'Aparelho criado: {modelo}', 'data': data}
    )
    return {'message': 'Aparelho adicionado com sucesso'}, None


def update_existing_device(imei, data):
    modelo = data.get('model')
    imei2 = data.get('imei2')
    condicao = data.get('condition')
    observacoes = data.get('colorNotes')
    linha_id = data.get('linha_id')
    current_user = data.get('currentUser', {})
    user_id = current_user.get('id')
    username = current_user.get('nome', 'Sistema')

    old_data, error = db_execute("SELECT * FROM aparelhos WHERE imei1 = %s", (imei,), fetch='one')
    if error or not old_data:
        return None, {'message': 'Aparelho não encontrado'}

    ok, error = db_execute(
        "UPDATE aparelhos SET modelo = %s, imei2 = %s, condicao = %s, observacoes = %s, linha_id = %s WHERE imei1 = %s",
        (modelo, imei2, condicao, observacoes, linha_id if linha_id else None, imei),
        fetch=None
    )
    if error:
        finish(False)
        return None, {'message': 'Erro ao atualizar aparelho'}

    finish(True)

    log_change(
        user_id=user_id, username=username, action_type='UPDATE',
        target_resource='Device', target_id=imei,
        details_dict={'old_data': old_data, 'new_data': data}
    )
    return {'message': 'Aparelho atualizado com sucesso'}, None


def delete_existing_device(imei, data):
    current_user = data.get('currentUser', {})
    user_id = current_user.get('id')
    username = current_user.get('nome', 'Sistema')

    device_data, error = db_execute("SELECT * FROM aparelhos WHERE imei1 = %s", (imei,), fetch='one')
    if error or not device_data:
        return None, {'message': 'Aparelho não encontrado'}

    ok, error = db_execute("DELETE FROM aparelhos WHERE imei1 = %s", (imei,), fetch=None)
    if error:
        finish(False)
        if 'FOREIGN KEY' in str(error).upper():
            return None, {'message': 'Não é possível excluir. O aparelho possui registros ou manutenções vinculadas.'}
        return None, {'message': 'Erro ao excluir aparelho'}

    finish(True)

    log_change(
        user_id=user_id, username=username, action_type='DELETE',
        target_resource='Device', target_id=imei,
        details_dict={'message': f'Aparelho {device_data.get("modelo")} excluído.'}
    )
    return {'message': 'Aparelho excluído com sucesso'}, None


def get_device_history_by_imei(imei):
    sql_utilizacao = """
        SELECT 
            f.nome as employeeName, r.data_entrega as deliveryDate, r.data_devolucao as returnDate 
        FROM registros r
        JOIN funcionarios f ON r.funcionario_id = f.id
        JOIN aparelhos a ON r.aparelho_id = a.id
        WHERE a.imei1 = %s ORDER BY r.data_entrega DESC
    """
    utilizacao, error = db_execute(sql_utilizacao, (imei,))
    if error:
        return None, error

    sql_manutencao = """
        SELECT m.data_envio, m.data_retorno, m.defeito_reportado, m.custo, m.status
        FROM manutencoes m
        JOIN aparelhos a ON m.aparelho_id = a.id
        WHERE a.imei1 = %s ORDER BY m.data_envio DESC
    """
    manutencao, error = db_execute(sql_manutencao, (imei,))
    return {'utilizacao': utilizacao, 'manutencao': manutencao}, None


def import_devices_from_csv(file, current_user):
    try:
        stream = io.StringIO(file.stream.read().decode("UTF-8"), newline=None)
        csv_reader = csv.reader(stream)

        next(csv_reader)  # skip header

        success_count = 0
        skipped_count = 0
        failed_entries = []
        valid_conditions = ['Novo', 'Aprovado para uso', 'Em manutenção', 'Danificado', 'Sinistrado', 'Com Defeito']

        for row in csv_reader:
            if len(row) < 3:
                failed_entries.append(f'Linha inválida: {row}')
                continue

            modelo, imei1, condicao = row[0], row[1], row[2]
            imei2 = row[3] if len(row) > 3 else None
            observacoes = row[4] if len(row) > 4 else None

            if not all([modelo, imei1, condicao]):
                failed_entries.append(f'Dados obrigatórios faltando: {row}')
                continue
            if condicao not in valid_conditions:
                failed_entries.append(f'{imei1}: Condição inválida "{condicao}".')
                continue

            db_execute(
                "INSERT IGNORE INTO aparelhos (modelo, imei1, imei2, condicao, observacoes) VALUES (%s, %s, %s, %s, %s)",
                (modelo, imei1, imei2, condicao, observacoes),
                fetch=None
            )
            if g.db_cursor.rowcount > 0:
                success_count += 1
            else:
                skipped_count += 1

        finish(True)

        log_change(
            user_id=current_user.get('id'), username=current_user.get('nome', 'Sistema'),
            action_type='IMPORT', target_resource='Device', target_id='Multiple',
            details_dict={'message': f'{success_count} importados, {skipped_count} ignorados. Falhas: {len(failed_entries)}.'}
        )
        return {'message': f'{success_count} importados, {skipped_count} ignorados.', 'failures': failed_entries}, None

    except Exception as e:
        finish(False)
        current_app.logger.error(f"Erro ao importar aparelhos: {e}", exc_info=True)
        return None, {'message': 'Erro interno ao importar CSV.'}


def get_eligible_for_maintenance_devices():
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
    return db_execute(sql)
