from flask import g, current_app
from datetime import datetime
from .audit_service import log_change


# -----------------------------
# Estatísticas de Manutenção
# -----------------------------
def get_maintenance_stats():
    """Retorna estatísticas agregadas de aparelhos por condição/uso.

    Retorna
      (dict, None) em caso de sucesso
      (None, { 'message': str }) em caso de erro
    """
    try:
        if not g.db_cursor:
            return None, {'message': 'Erro interno: Falha na conexão com a base de dados'}

        # Ajustado para usar campos existentes (condicao e registros em uso)
        g.db_cursor.execute(
            """
            SELECT 
                (SELECT COUNT(*) FROM aparelhos WHERE condicao = 'Em manutenção') AS in_maintenance,
                (SELECT COUNT(*) FROM registros r WHERE r.status = 'Em Uso') AS in_use,
                (SELECT COUNT(*) FROM aparelhos WHERE condicao IN ('Novo','Aprovado para uso')) AS available,
                (SELECT COUNT(*) FROM aparelhos WHERE condicao IN ('Sinistrado','Com Defeito','Danificado')) AS decommissioned
            """
        )
        stats = g.db_cursor.fetchone()
        return stats, None
    except Exception as e:
        current_app.logger.error(f"Erro get_maintenance_stats: {e}", exc_info=True)
        return None, {'message': 'Erro ao obter estatísticas de manutenção'}


# -----------------------------
# Operações de Manutenção
# -----------------------------
def list_maintenances():
    """Lista registros de manutenção com dados do aparelho."""
    try:
        if not g.db_cursor:
            return None, {'message': 'Erro interno: Falha na conexão com a base de dados'}

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
        return g.db_cursor.fetchall(), None
    except Exception as e:
        current_app.logger.error(f"Erro list_maintenances: {e}", exc_info=True)
        return None, {'message': 'Erro ao listar manutenções'}


def get_maintenance_by_id(maint_id):
    """Obtém um registro de manutenção pelo ID."""
    try:
        if not g.db_cursor:
            return None, {'message': 'Erro interno: Falha na conexão com a base de dados'}
        g.db_cursor.execute("SELECT * FROM manutencoes WHERE id = %s", (maint_id,))
        rec = g.db_cursor.fetchone()
        if not rec:
            return None, {'message': 'Registro não encontrado'}
        return rec, None
    except Exception as e:
        current_app.logger.error(f"Erro get_maintenance_by_id {maint_id}: {e}", exc_info=True)
        return None, {'message': 'Erro ao obter manutenção'}


def create_maintenance(data):
    """Cria um novo registro de manutenção e atualiza condição do aparelho."""
    try:
        if not g.db_cursor:
            return None, {'message': 'Erro interno: Falha na conexão com a base de dados'}

        aparelho_id = data.get('aparelho_id')
        data_envio = data.get('data_envio')
        defeito_reportado = data.get('defeito_reportado')
        fornecedor = data.get('fornecedor')
        current_user = data.get('currentUser', {})

        if not all([aparelho_id, data_envio, defeito_reportado, fornecedor]):
            return None, {'message': 'Campos obrigatórios ausentes'}

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

        return {"message": "Manutenção criada com sucesso", "id": maint_id}, None
    except Exception as e:
        if g.db_conn:
            try:
                g.db_conn.rollback()
            except Exception:
                pass
        current_app.logger.error(f"Erro create_maintenance: {e}", exc_info=True)
        return None, {'message': 'Erro ao criar manutenção'}


def update_maintenance(maint_id, data):
    """Atualiza um registro de manutenção e opcionalmente a condição do aparelho."""
    try:
        if not g.db_cursor:
            return None, {'message': 'Erro interno: Falha na conexão com a base de dados'}

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

        if updates:
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

        return {"message": "Atualizado com sucesso"}, None
    except Exception as e:
        if g.db_conn:
            try:
                g.db_conn.rollback()
            except Exception:
                pass
        current_app.logger.error(f"Erro update_maintenance {maint_id}: {e}", exc_info=True)
        return None, {'message': 'Erro ao atualizar manutenção'}


def delete_maintenance(maint_id, current_user):
    """Exclui um registro de manutenção."""
    try:
        if not g.db_cursor:
            return None, {'message': 'Erro interno: Falha na conexão com a base de dados'}

        g.db_cursor.execute("SELECT aparelho_id FROM manutencoes WHERE id = %s", (maint_id,))
        rec = g.db_cursor.fetchone()
        if not rec:
            return None, {'message': 'Registro não encontrado'}

        g.db_cursor.execute("DELETE FROM manutencoes WHERE id = %s", (maint_id,))
        g.db_conn.commit()

        log_change(
            user_id=(current_user or {}).get('id'),
            username=(current_user or {}).get('nome', 'Sistema'),
            action_type='DELETE', target_resource='Maintenance',
            target_id=maint_id,
            details_dict={'aparelho_id': rec.get('aparelho_id')}
        )

        return {'message': 'Registro excluído com sucesso'}, None
    except Exception as e:
        if g.db_conn:
            try:
                g.db_conn.rollback()
            except Exception:
                pass
        current_app.logger.error(f"Erro delete_maintenance {maint_id}: {e}", exc_info=True)
        return None, {'message': 'Erro ao excluir manutenção'}


# -----------------------------
# Associação de Linha a Aparelho
# -----------------------------
def associate_line(line_id, device_id, current_user):
    """Associa uma linha a um aparelho, desvinculando-a de outro se necessário."""
    try:
        if not g.db_cursor:
            return None, {'message': 'Erro interno: Falha na conexão com a base de dados'}

        # Validar linha
        g.db_cursor.execute("SELECT id, numero FROM linhas WHERE id = %s", (line_id,))
        line = g.db_cursor.fetchone()
        if not line:
            return None, {'message': 'Linha não encontrada'}

        # Validar aparelho
        g.db_cursor.execute("SELECT id, modelo, imei1 FROM aparelhos WHERE id = %s", (device_id,))
        dev = g.db_cursor.fetchone()
        if not dev:
            return None, {'message': 'Aparelho não encontrado'}

        # Desvincular a linha de qualquer outro aparelho
        g.db_cursor.execute("UPDATE aparelhos SET linha_id = NULL WHERE linha_id = %s", (line_id,))

        # Vincular ao aparelho solicitado
        g.db_cursor.execute("UPDATE aparelhos SET linha_id = %s WHERE id = %s", (line_id, device_id))

        g.db_conn.commit()

        # Auditoria
        log_change(
            user_id=(current_user or {}).get('id'),
            username=(current_user or {}).get('nome', 'Sistema'),
            action_type='ASSOCIATE',
            target_resource='LineBinding',
            target_id=line_id,
            details_dict={'device_id': device_id, 'device_imei': dev.get('imei1'), 'line_number': line.get('numero')}
        )

        return {"message": "Linha vinculada com sucesso"}, None
    except Exception as e:
        if g.db_conn:
            try:
                g.db_conn.rollback()
            except Exception:
                pass
        current_app.logger.error(f"Erro associate_line (line_id={line_id}, device_id={device_id}): {e}", exc_info=True)
        return None, {'message': 'Erro ao associar linha ao aparelho'}
