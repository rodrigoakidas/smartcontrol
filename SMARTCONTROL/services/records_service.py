# services/records_service.py
from flask import g, current_app
from .audit_service import log_change
import json

def get_all_records(page, limit, status_filter):
    try:
        if not g.db_cursor:
            return None, None, {'message': 'Erro interno: Falha na conexão com a base de dados'}

        offset = (page - 1) * limit
        
        count_sql = "SELECT COUNT(*) as total FROM registros"
        params = []
        if status_filter != 'Todos':
            count_sql += " WHERE status = %s"
            params.append(status_filter)

        g.db_cursor.execute(count_sql, tuple(params))
        total_records = g.db_cursor.fetchone()['total']

        sql = """
            SELECT
                r.id, r.data_entrega AS deliveryDate, r.status,
                r.termo_entrega_url, r.termo_devolucao_url, r.bo_url,
                f.nome AS employeeName, f.matricula AS employeeMatricula,
                a.modelo AS deviceModel, a.imei1 AS deviceImei,
                li.numero AS deviceLine
            FROM registros r
            JOIN funcionarios f ON r.funcionario_id = f.id
            JOIN aparelhos a ON r.aparelho_id = a.id
            LEFT JOIN linhas li ON a.linha_id = li.id
        """
        if status_filter != 'Todos':
            sql += " WHERE r.status = %s"

        sql += " ORDER BY r.data_entrega DESC LIMIT %s OFFSET %s"
        params.extend([limit, offset])

        g.db_cursor.execute(sql, tuple(params))
        records = g.db_cursor.fetchall()

        return total_records, records, None
    except Exception as e:
        current_app.logger.error(f"Erro ao buscar registros: {e}", exc_info=True)
        return None, None, {'message': 'Erro ao buscar registros'}

def get_record_by_id(record_id):
    try:
        if not g.db_cursor:
            return None, {'message': 'Erro interno: Falha na conexão com a base de dados'}

        sql = """
            SELECT r.*, f.matricula AS employeeMatricula, a.imei1 AS deviceImei,
                   a.modelo AS deviceModel, li.numero AS deviceLine
            FROM registros r
            JOIN funcionarios f ON r.funcionario_id = f.id
            JOIN aparelhos a ON r.aparelho_id = a.id
            LEFT JOIN linhas li ON a.linha_id = li.id
            WHERE r.id = %s
        """
        g.db_cursor.execute(sql, (record_id,))
        record = g.db_cursor.fetchone()
        if not record:
            return None, {'message': 'Registro não encontrado'}
        if record.get('acessorios'):
            record['acessorios'] = json.loads(record['acessorios'])
        return record, None
    except Exception as e:
        current_app.logger.error(f"Erro ao buscar registro por ID {record_id}: {e}", exc_info=True)
        return None, {'message': 'Erro ao buscar registro por ID'}

def update_existing_record(record_id, data):
    try:
        if not g.db_cursor:
            return None, {'message': 'Erro interno: Falha na conexão com a base de dados'}

        current_user = data.get('currentUser', {})
        user_id = current_user.get('id')
        username = current_user.get('nome', 'Sistema')

        data_devolucao = data.get('returnDate')
        condicao_devolucao = data.get('returnCondition')
        notas_devolucao = data.get('returnNotes')
        termo_devolucao_url = data.get('returnTermUrl') 
        bo_url = data.get('policeReportUrl')
        return_checker = data.get('returnChecker')

        update_fields = []
        params = []
        if data_devolucao:
            update_fields.append("data_devolucao = %s"); params.append(data_devolucao)
            update_fields.append("status = 'Devolvido'")
        if condicao_devolucao:
            update_fields.append("condicao_devolucao = %s"); params.append(condicao_devolucao)
        if notas_devolucao is not None:
            update_fields.append("notas_devolucao = %s"); params.append(notas_devolucao)
        if termo_devolucao_url:
            update_fields.append("termo_devolucao_url = %s"); params.append(termo_devolucao_url)
        if bo_url:
            update_fields.append("bo_url = %s"); params.append(bo_url)
        if return_checker:
            update_fields.append("return_checker = %s"); params.append(return_checker)
        if 'deliveryTermUrl' in data and data['deliveryTermUrl']:
             update_fields.append("termo_entrega_url = %s"); params.append(data['deliveryTermUrl'])

        if not update_fields:
            return None, {'message': 'Nenhum dado válido para atualizar'}

        sql = f"UPDATE registros SET {', '.join(update_fields)} WHERE id = %s"
        params.append(record_id)

        g.db_cursor.execute(sql, tuple(params))

        if g.db_cursor.rowcount == 0:
            g.db_conn.rollback()
            return None, {'message': 'Registro não encontrado ou nenhum dado alterado'}

        g.db_conn.commit()

        log_change(
            user_id=user_id, username=username, action_type='UPDATE', target_resource='Record',
            target_id=record_id, details_dict={'message': f'Termo {record_id} atualizado.', 'updated_data': data}
        )
        return {'message': 'Registro atualizado com sucesso'}, None
    except Exception as e:
        if g.db_conn: g.db_conn.rollback()
        current_app.logger.error(f"Erro ao atualizar registro {record_id}: {e}", exc_info=True)
        return None, {'message': 'Erro ao atualizar registro'}

def create_new_record(data):
    try:
        if not g.db_cursor:
            return None, {'message': 'Erro interno: Falha na conexão com a base de dados'}

        matricula = data.get('employeeMatricula')
        imei = data.get('deviceImei')
        data_entrega = data.get('deliveryDate')
        delivery_checker = data.get('deliveryChecker')
        termo_entrega_url = data.get('deliveryTermUrl')
        current_user = data.get('currentUser', {})
        user_id = current_user.get('id')
        username = current_user.get('nome', 'Sistema')

        if not all([matricula, imei, data_entrega]):
            return None, {'message': 'Funcionário, aparelho e data de entrega são obrigatórios'}

        g.db_cursor.execute("SELECT id, modelo FROM aparelhos WHERE imei1 = %s", (imei,))
        aparelho = g.db_cursor.fetchone()
        if not aparelho:
            return None, {'message': 'Aparelho não encontrado'}
        aparelho_id = aparelho['id']

        g.db_cursor.execute(
            "SELECT id FROM registros WHERE aparelho_id = %s AND status = 'Em Uso'",
            (aparelho_id,)
        )
        existing_record = g.db_cursor.fetchone()
        if existing_record:
            return None, {'message': f'Este aparelho já está associado ao termo Nº {existing_record["id"]}.'}

        g.db_cursor.execute("SELECT id, nome, cargo FROM funcionarios WHERE matricula = %s", (matricula,))
        func = g.db_cursor.fetchone()
        if not func: return None, {'message': 'Funcionário não encontrado'}
        funcionario_id = func['id']

        g.db_cursor.execute(
            """INSERT INTO registros (funcionario_id, aparelho_id, data_entrega, condicao_entrega, notas_entrega, acessorios, termo_entrega_url, status, delivery_checker)
               VALUES (%s, %s, %s, %s, %s, %s, %s, 'Em Uso', %s)""",
            (funcionario_id, aparelho_id, data.get('deliveryDate'), data.get('deliveryCondition'), data.get('deliveryNotes'), json.dumps(data.get('accessories', [])), termo_entrega_url, delivery_checker)
        )
        new_record_id = g.db_cursor.lastrowid
        g.db_conn.commit()

        log_change(
            user_id=user_id, username=username, action_type='CREATE', target_resource='Record',
            target_id=imei, details_dict={'message': f'Entrega do aparelho {imei} para {func.get("nome")}.'}
        )
        
        g.db_cursor.execute("SELECT li.numero FROM aparelhos a LEFT JOIN linhas li ON a.linha_id = li.id WHERE a.id = %s", (aparelho_id,))
        line_info = g.db_cursor.fetchone()
        device_line = line_info['numero'] if line_info else None

        new_record_object = {
            "id": new_record_id, "employeeName": func.get('nome'), "employeeMatricula": matricula,
            "employeePosition": func.get('cargo'), "deviceModel": aparelho.get('modelo'), "deviceImei": imei,
            "deviceLine": device_line, "data_entrega": data.get('deliveryDate'), "condicao_entrega": data.get('deliveryCondition'),
            "notas_entrega": data.get('deliveryNotes'), "acessorios": data.get('accessories', []),
            "delivery_checker": delivery_checker
        }
        return {'message': 'Termo criado com sucesso', 'newRecord': new_record_object}, None
    except Exception as e:
        if g.db_conn: g.db_conn.rollback()
        current_app.logger.error(f"Erro ao criar registro: {e}", exc_info=True)
        return None, {'message': 'Erro ao criar registro'}

def delete_existing_record(record_id, data):
    try:
        if not g.db_cursor:
            return None, {'message': 'Erro interno: Falha na conexão com a base de dados'}

        current_user = data.get('currentUser', {})
        user_id = current_user.get('id')
        username = current_user.get('nome', 'Sistema')

        g.db_cursor.execute("DELETE FROM registros WHERE id = %s", (record_id,))
        g.db_conn.commit()

        if g.db_cursor.rowcount == 0:
            return None, {'message': 'Registro não encontrado'}

        log_change(
            user_id=user_id, username=username, action_type='DELETE', target_resource='Record',
            target_id=record_id, details_dict={'message': f'Termo {record_id} excluído.'}
        )
        return {'message': 'Registro excluído com sucesso'}, None
    except Exception as e:
        if g.db_conn: g.db_conn.rollback()
        current_app.logger.error(f"Erro ao excluir registro {record_id}: {e}", exc_info=True)
        return None, {'message': 'Erro ao excluir registro'}
