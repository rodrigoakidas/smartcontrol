# routes/user_routes.py
from flask import Blueprint, jsonify, request
from services.user_service import (
    get_all_users, create_new_user, update_existing_user, delete_existing_user
)
from .decorators import require_permission

user_bp = Blueprint('users', __name__)

@user_bp.route('/', methods=['GET'])
def get_users():
    users, error = get_all_users()
    if error:
        return jsonify(error), 500
    return jsonify(users)

@user_bp.route('/', methods=['POST'])
@require_permission('users_create')
def create_user():
    data = request.get_json()
    response, error = create_new_user(data)
    if error:
        status_code = 400 if 'obrigatórios' in error['message'] else 500
        return jsonify(error), status_code
    return jsonify(response), 201

@user_bp.route('/<int:user_id_to_update>', methods=['PUT'])
@require_permission('users_update')
def update_user(user_id_to_update):
    data = request.get_json()
    response, error = update_existing_user(user_id_to_update, data)
    if error:
        status_code = 404 if 'não encontrado' in error['message'] else 500
        return jsonify(error), status_code
    return jsonify(response)

@user_bp.route('/<int:user_id_to_delete>', methods=['DELETE'])
@require_permission('users_delete')
def delete_user(user_id_to_delete):
    data = request.get_json() or {}
    response, error = delete_existing_user(user_id_to_delete, data)
    if error:
        status_code = 403 if 'administrador' in error['message'] else 404 if 'não encontrado' in error['message'] else 500
        return jsonify(error), status_code
    return jsonify(response)