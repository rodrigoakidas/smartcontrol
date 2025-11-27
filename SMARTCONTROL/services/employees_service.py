from .service_utils import db_execute, finish
from .audit_service import log_change
from flask import g, current_app
import csv
import io


def get_all_employees():
    sql = """
        SELECT matricula as id, nome as name, cargo as position, email 
        FROM funcionarios
        ORDER BY nome
    """
    return db_execute(sql)


def add_new_employee(data):
    matricula = data.get('id')
    nome = data.get('name')
    cargo = data.get('position')
    email = data.get('email')
    current_user = data.get('currentUser', {})
    user_id = current_user.get('id')
    username = current_user.get('nome', 'Sistema')

    if not all([matricula, nome, cargo]):
        return None, {'message': 'Matrícula, nome e cargo são obrigatórios'}

    ok, error = db_execute(
        "INSERT INTO funcionarios (matricula, nome, cargo, email) VALUES (%s, %s, %s, %s)",
        (matricula, nome, cargo, email),
        fetch=None
    )
    if error:
        finish(False)
        if 'duplicate' in str(error).lower():
            return None, {'message': f'A matrícula {matricula} já existe.'}
        return None, {'message': 'Erro ao adicionar funcionário'}

    finish(True)

    log_change(
        user_id=user_id, username=username, action_type='CREATE',
        target_resource='Employee', target_id=matricula,
        details_dict={'message': f'Funcionário criado: {nome} ({matricula})'}
    )

    return {'message': 'Funcionário adicionado com sucesso'}, None


def update_existing_employee(matricula, data):
    nome = data.get('name')
    cargo = data.get('position')
    email = data.get('email')
    current_user = data.get('currentUser', {})
    user_id = current_user.get('id')
    username = current_user.get('nome', 'Sistema')

    # Verificar se existe
    existing, error = db_execute(
        "SELECT * FROM funcionarios WHERE matricula = %s",
        (matricula,), fetch='one'
    )
    if error or not existing:
        return None, {'message': 'Funcionário não encontrado'}

    ok, error = db_execute(
        "UPDATE funcionarios SET nome = %s, cargo = %s, email = %s WHERE matricula = %s",
        (nome, cargo, email, matricula),
        fetch=None
    )
    if error:
        finish(False)
        return None, {'message': 'Erro ao atualizar funcionário'}

    finish(True)

    log_change(
        user_id=user_id, username=username, action_type='UPDATE',
        target_resource='Employee', target_id=matricula,
        details_dict={'old_data': existing, 'new_data': data}
    )

    return {'message': 'Funcionário atualizado com sucesso'}, None


def delete_existing_employee(matricula, data):
    current_user = data.get('currentUser', {})
    user_id = current_user.get('id')
    username = current_user.get('nome', 'Sistema')

    employee, error = db_execute(
        "SELECT nome FROM funcionarios WHERE matricula = %s",
        (matricula,), fetch='one'
    )
    if error or not employee:
        return None, {'message': 'Funcionário não encontrado'}

    ok, error = db_execute(
        "DELETE FROM funcionarios WHERE matricula = %s",
        (matricula,), fetch=None
    )
    if error:
        finish(False)
        if 'foreign key' in str(error).lower():
            return None, {'message': 'Não é possível excluir. O funcionário possui registros de aparelhos vinculados.'}
        return None, {'message': 'Erro ao excluir funcionário'}

    finish(True)

    log_change(
        user_id=user_id, username=username, action_type='DELETE',
        target_resource='Employee', target_id=matricula,
        details_dict={'message': f'Funcionário {employee.get("nome")} excluído.'}
    )

    return {'message': 'Funcionário excluído com sucesso'}, None


def get_employee_history_by_matricula(matricula):
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
    return db_execute(sql, (matricula,))


def import_employees_from_csv(file, current_user):
    try:
        stream = io.StringIO(file.stream.read().decode("UTF-8"), newline=None)
        csv_reader = csv.reader(stream)

        next(csv_reader)  # pular cabeçalho

        success = 0
        skipped = 0
        failed = []

        for row in csv_reader:
            if len(row) < 3:
                failed.append(f"Linha inválida: {row}")
                continue

            matricula, nome, cargo = row[0], row[1], row[2]
            email = row[3] if len(row) > 3 and row[3] else None

            if not all([matricula, nome, cargo]):
                failed.append(f"Dados obrigatórios ausentes: {row}")
                continue

            _, err = db_execute(
                "INSERT IGNORE INTO funcionarios (matricula, nome, cargo, email) VALUES (%s, %s, %s, %s)",
                (matricula, nome, cargo, email),
                fetch=None
            )
            if err:
                failed.append(f"Matrícula {matricula}: Erro inesperado.")
                continue

            if g.db_cursor.rowcount > 0:
                success += 1
            else:
                skipped += 1

        finish(True)

        log_change(
            user_id=current_user.get('id'),
            username=current_user.get('nome', 'Sistema'),
            action_type='IMPORT',
            target_resource='Employee',
            target_id='Multiple',
            details_dict={'message': f'{success} importados / {skipped} ignorados / {len(failed)} falhas.'}
        )

        return {'message': f'{success} importados, {skipped} ignorados.', 'failures': failed}, None

    except Exception as e:
        finish(False)
        current_app.logger.error(f"Erro ao importar funcionários: {e}", exc_info=True)
        return None, {'message': 'Erro interno ao importar CSV.'}
