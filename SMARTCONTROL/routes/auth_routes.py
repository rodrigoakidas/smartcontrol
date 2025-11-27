# routes/auth_routes.py
from flask import Blueprint, jsonify, request
from services.auth_service import login_user

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    senha = data.get('senha')

    if not username or not senha:
        return jsonify({'message': 'Usuário e senha são obrigatórios'}), 400

    response, error = login_user(username, senha)

    if error:
        status_code = 401 if 'não encontrado' in error['message'] or 'incorreta' in error['message'] else 500
        return jsonify(error), status_code
        
    return jsonify(response), 200
