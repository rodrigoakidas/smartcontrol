# SMARTCONTROL/routes/company_routes.py
# (FICHEIRO COMPLETO E CORRIGIDO)

from flask import Blueprint, jsonify, request, current_app, g
import base64
from .decorators import require_permission # Importar decorador

company_bp = Blueprint('company', __name__)

@company_bp.route('/', methods=['GET'])
def get_company():
    try:
        if not g.db_cursor:
             return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500
             
        g.db_cursor.execute("SELECT nome, cnpj, logo FROM empresa WHERE id = 1")
        company_data = g.db_cursor.fetchone()

        if not company_data:
            return jsonify({'nome': 'Relatório do Sistema', 'cnpj': 'Não informado', 'logo': None})

        if company_data.get('logo'):
            company_data['logo'] = base64.b64encode(company_data['logo']).decode('utf-8')

        return jsonify(company_data)
    except Exception as e:
        current_app.logger.error(f"Erro ao buscar dados da empresa: {e}", exc_info=True)
        return jsonify({'message': 'Erro interno ao buscar dados da empresa'}), 500

@company_bp.route('/', methods=['POST'])
@require_permission('company_update') # Proteger esta rota
def update_company():
    try:
        data = request.get_json()
        nome = data.get('nome')
        cnpj = data.get('cnpj')
        logo_base64 = data.get('logo') # String base64 com cabeçalho

        if not g.db_cursor:
             return jsonify({'message': 'Erro interno: Falha na conexão com a base de dados'}), 500

        g.db_cursor.execute("SELECT id FROM empresa WHERE id = 1")
        record_exists = g.db_cursor.fetchone()

        logo_data = None
        if logo_base64 and ',' in logo_base64:
            # Remove o cabeçalho 'data:image/png;base64,' antes de descodificar
            logo_data = base64.b64decode(logo_base64.split(',')[1])

        if record_exists:
            # ATUALIZA (UPDATE)
            if logo_data:
                g.db_cursor.execute(
                    "UPDATE empresa SET nome = %s, cnpj = %s, logo = %s WHERE id = 1",
                    (nome, cnpj, logo_data)
                )
            else:
                # Se não for enviado um novo logótipo, não se altera o existente
                g.db_cursor.execute(
                    "UPDATE empresa SET nome = %s, cnpj = %s WHERE id = 1",
                    (nome, cnpj)
                )
        else:
            # CRIA (INSERT)
            g.db_cursor.execute(
                "INSERT INTO empresa (id, nome, cnpj, logo) VALUES (1, %s, %s, %s)",
                (nome, cnpj, logo_data)
            )
        
        g.db_conn.commit()
        return jsonify({'message': 'Dados da empresa atualizados com sucesso!'})
    except Exception as e:
        current_app.logger.error(f"Erro ao atualizar dados da empresa: {e}", exc_info=True)
        if g.db_conn: g.db_conn.rollback()
        return jsonify({'message': 'Erro interno ao salvar os dados da empresa'}), 500