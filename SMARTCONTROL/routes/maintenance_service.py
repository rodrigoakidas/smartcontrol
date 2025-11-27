from datetime import datetime
from flask import g, current_app
from routes.audit_helper import log_change


def list_maintenances():
    sql = """
        SELECT 
            m.id, m.numero_os, m.aparelho_id,
            a.modelo AS modelo, a.imei1,
            m.data_envio, m.data_retorno, m.defeito_reportado,
            m.servico_realizado, m.fornecedor, m.custo, m.status
        FROM manutencoes m
        LEFT JOIN aparelhos a ON a.id = m.aparelho_id
        ORDER BY m.data_envio DESC
    """
    g.db_cursor.execute(sql)
    return g.db_cursor.fetchall()


def get_maintenance_by_id(maint_id):
    g.db_cursor.execute("SELECT * FROM manutencoes WHERE id = %s", (maint_id,))
    return g.db_cursor.fetchone()


def create_maintenance(data):
    aparelho_id = data.get('aparelho_id')
    data_envio = data.get('data_envio')
    defeito_reportado = data.get('defeito_reportado')
    fornecedor = data.get('fornecedor')
    current_user = data.get('currentUser', {})

    current_year = datetime.now().year
    g.db_cursor.execute(
        "SELECT COUNT(*) as count FROM manutencoes WHERE YEAR(data_envio) = %s",
        (current_year,)
    )
    count_this_year = g.db_cursor.fetchone()['count']
    new_os_number = f"OS-{current_year}-{(count_this_year + 1):05d}"

    g.db_cursor.execute(
        """INSERT INTO manutencoes 
           (numero_os, aparelho_id, data_envio, defeito_reportado, fornecedor, status) 
           VALUES (%s, %s, %s, %s, %s, 'Em manutenção')""",
        (new_os_number, aparelho_id, data_envio, defeito_reportado, fornecedor)
    )
    maint_id = g.db_cursor.lastrowid

    g.db_cursor.execute("UPDATE aparelhos SET condicao = %s WHERE id = %s", ('Em manutenção', aparelho_id))
    g.db_conn.commit()

    log_change(
        user_id=current_user.get('id'),
        username=current_user.get('nome', 'Sistema'),
        action_type='CREATE', target_resource='Maintenance',
        target_id=maint_id,
        details_dict={'os_number': new_os_number, 'aparelho_id': aparelho_id}
    )

    return maint_id


def update_maintenance(maint_id, data):
    data_retorno = data.get('data_retorno')
    servico_realizado = data.get('servico_realizado')
    custo = data.get('custo')
    status = data.get('status')
    post_condition = data.get('postCondition')
    current_user = data.get('currentUser', {})

    updates = []
    params = []
    if data_retorno is not None:
        updates.append("data_retorno = %s"); params.append(data_retorno)
    if servico_realizado is not None:
        updates.append("servico_realizado = %s"); params.append(servico_realizado)
    if custo is not None:
        updates.append("custo = %s"); params.append(custo)
    if status is not None:
        updates.append("status = %s"); params.append(status)

    sql = "UPDATE manutencoes SET " + ", ".join(updates) + " WHERE id = %s"
    params.append(maint_id)
    g.db_cursor.execute(sql, tuple(params))

    if post_condition:
        g.db_cursor.execute("SELECT aparelho_id FROM manutencoes WHERE id = %s", (maint_id,))
        rec = g.db_cursor.fetchone()
        if rec and rec.get('aparelho_id'):
            aparelho_id = rec['aparelho_id']
            g.db_cursor.execute("UPDATE aparelhos SET condicao = %s WHERE id = %s", (post_condition, aparelho_id))

    g.db_conn.commit()

    log_change(
        user_id=current_user.get('id'),
        username=current_user.get('nome', 'Sistema'),
        action_type='UPDATE', target_resource='Maintenance',
        target_id=maint_id,
        details_dict={'updated_fields': updates, 'data': data}
    )


def delete_maintenance(maint_id, current_user):
    g.db_cursor.execute("SELECT aparelho_id FROM manutencoes WHERE id = %s", (maint_id,))
    rec = g.db_cursor.fetchone()
    if not rec:
        return None

    aparelho_id = rec['aparelho_id']

    g.db_cursor.execute("DELETE FROM manutencoes WHERE id = %s", (maint_id,))
    g.db_conn.commit()

    log_change(
        user_id=current_user.get('id'),
        username=current_user.get('nome', 'Sistema'),
        action_type='DELETE', target_resource='Maintenance',
        target_id=maint_id,
        details_dict={'aparelho_id': aparelho_id}
    )

    return True
