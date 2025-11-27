from flask import g, current_app

def db_execute(query, params=None, fetch='all'):
    """
    Executa a query com cursor padronizado e lida com erros.
    fetch:
       'all'   -> retorna cursor.fetchall()
       'one'   -> retorna cursor.fetchone()
       None    -> não busca resultado (INSERT/UPDATE/DELETE)
    """
    try:
        if not g.db_cursor:
            return None, {'message': 'Erro interno: Falha na conexão com a base de dados'}

        g.db_cursor.execute(query, params or ())

        if fetch == 'all':
            return g.db_cursor.fetchall(), None
        elif fetch == 'one':
            return g.db_cursor.fetchone(), None
        return True, None

    except Exception as e:
        current_app.logger.error(f"Erro DB: {e}", exc_info=True)
        return None, {'message': 'Erro ao executar operação no banco de dados'}

def finish(success=True):
    """
    Finaliza a operação com commit ou rollback.
    """
    try:
        if success:
            g.db_conn.commit()
        else:
            if g.db_conn:
                g.db_conn.rollback()
    except Exception:
        pass
