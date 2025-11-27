from .service_utils import db_execute, finish
from .audit_service import log_change
from flask import g, current_app
import csv, io


def list_lines():
    sql = """
        SELECT 
            l.id, l.numero, l.operadora, l.plano, l.status,
            a.imei1 AS imeiVinculado
        FROM linhas l
        LEFT JOIN aparelhos a ON l.id = a.linha_id
        ORDER BY l.numero
    """
    return db_execute(sql)


def create_line(data):
    numero = data.get('numero')
    operadora = data.get('operadora')
    plano = data.get('plano')
    status = data.get('status')

    user = data.get('currentUser', {})
    username = user.get('nome', 'Sistema')
    user_id = user.get('id')

    if not all([numero, operadora, status]):
        return None, {'message': 'Número, operadora e status são obrigatórios'}

    ok, error = db_execute(
        "INSERT INTO linhas (numero, operadora, plano, status) VALUES (%s, %s, %s, %s)",
        (numero, operadora, plano, status),
        fetch=None
    )
    if error:
        finish(False)
        if 'duplicate' in str(error).lower():
            return None, {'message': f'O número {numero} já está cadastrado.'}
        return None, {'message': 'Erro ao adicionar linha'}

    finish(True)

    log_change(
        user_id=user_id, username=username,
        action_type='CREATE', target_resource='Line', target_id=numero,
        details_dict={'message': f'Linha {numero} criada com status {status}'}
    )
    return {'message': 'Linha adicionada com sucesso'}, None


def update_line(line_id, data):
    operadora = data.get('operadora')
    plano = data.get('plano')
    status = data.get('status')

    user = data.get('currentUser', {})
    username = user.get('nome', 'Sistema')
    user_id = user.get('id')

    existing, error = db_execute(
        "SELECT * FROM linhas WHERE id = %s", (line_id,), fetch='one'
    )
    if error or not existing:
        return None, {'message': 'Linha não encontrada'}

    ok, error = db_execute(
        "UPDATE linhas SET operadora = %s, plano = %s, status = %s WHERE id = %s",
        (operadora, plano, status, line_id), fetch=None
    )
    if error:
        finish(False)
        return None, {'message': 'Erro ao atualizar linha'}

    finish(True)

    log_change(
        user_id=user_id, username=username,
        action_type='UPDATE', target_resource='Line', target_id=line_id,
        details_dict={'old_data': existing, 'new_data': data}
    )
    return {'message': 'Linha atualizada com sucesso'}, None


def delete_line(line_id, data):
    user = data.get('currentUser', {})
    username = user.get('nome', 'Sistema')
    user_id = user.get('id')

    record, error = db_execute(
        "SELECT numero FROM linhas WHERE id = %s", (line_id,), fetch='one'
    )
    if error or not record:
        return None, {'message': 'Linha não encontrada'}

    ok, error = db_execute(
        "DELETE FROM linhas WHERE id = %s", (line_id,), fetch=None
    )
    if error:
        finish(False)
        if 'foreign key' in str(error).lower():
            return None, {'message': 'Não é possível excluir. A linha está vinculada a um aparelho.'}
        return None, {'message': 'Erro ao excluir linha'}

    finish(True)

    log_change(
        user_id=user_id, username=username,
        action_type='DELETE', target_resource='Line', target_id=line_id,
        details_dict={'message': f'Linha {record.get("numero")} excluída.'}
    )
    return {'message': 'Linha excluída com sucesso'}, None


def get_line_history(line_id):
    sql = """
        SELECT * 
        FROM linha_historico 
        WHERE linha_id = %s 
        ORDER BY data_vinculacao DESC
    """
    return db_execute(sql, (line_id,))


def import_lines_from_csv(file, current_user):
    try:
        stream = io.StringIO(file.stream.read().decode("UTF-8"), newline=None)
        csv_reader = csv.reader(stream)

        next(csv_reader)

        success, skipped, failed = 0, 0, []

        for row in csv_reader:
            if len(row) < 4:
                failed.append(f"Linha inválida: {row}")
                continue

            numero, operadora, plano, status = row[0], row[1], row[2], row[3]

            if not all([numero, operadora, status]):
                failed.append(f"Dados obrigatórios ausentes: {row}")
                continue

            _, err = db_execute(
                "INSERT IGNORE INTO linhas (numero, operadora, plano, status) VALUES (%s, %s, %s, %s)",
                (numero, operadora, plano, status), fetch=None
            )
            if err:
                failed.append(f"{numero}: erro inesperado")
                continue

            if g.db_cursor.rowcount > 0:
                success += 1
            else:
                skipped += 1

        finish(True)

        log_change(
            user_id=current_user.get('id'),
            username=current_user.get('nome', 'Sistema'),
            action_type='IMPORT', target_resource='Line', target_id='Multiple',
            details_dict={'message': f'{success} importadas / {skipped} ignoradas / {len(failed)} falhas'}
        )

        return {'message': f'{success} importadas, {skipped} ignoradas.', 'failures': failed}, None

    except Exception as e:
        finish(False)
        current_app.logger.error(f"Erro ao importar linhas: {e}", exc_info=True)
        return None, {'message': 'Erro interno ao importar CSV.'}
