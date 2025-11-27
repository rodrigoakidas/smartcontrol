# routes/employees_routes.py
from flask import Blueprint, jsonify, request
from services.employees_service import (
    get_all_employees, add_new_employee, update_existing_employee, 
    delete_existing_employee, get_employee_history_by_matricula, 
    import_employees_from_csv
)
from .decorators import require_permission
import json

employees_bp = Blueprint('employees', __name__)

@employees_bp.route('/', methods=['GET'])
def get_employees():
    employees, error = get_all_employees()
    if error:
        return jsonify(error), 500
    return jsonify(employees)

@employees_bp.route('/', methods=['POST'])
@require_permission('employees_create')
def add_employee():
    data = request.get_json()
    response, error = add_new_employee(data)
    if error:
        status_code = 400 if 'obrigatórios' in error['message'] else 409 if 'já existe' in error['message'] else 500
        return jsonify(error), status_code
    return jsonify(response), 201

@employees_bp.route('/<string:matricula>', methods=['PUT'])
@require_permission('employees_update')
def update_employee(matricula):
    data = request.get_json()
    response, error = update_existing_employee(matricula, data)
    if error:
        status_code = 404 if 'não encontrado' in error['message'] else 500
        return jsonify(error), status_code
    return jsonify(response)

@employees_bp.route('/<string:matricula>', methods=['DELETE'])
@require_permission('employees_delete')
def delete_employee(matricula):
    data = request.get_json() or {}
    response, error = delete_existing_employee(matricula, data)
    if error:
        status_code = 404 if 'não encontrado' in error['message'] else 409 if 'vinculados' in error['message'] else 500
        return jsonify(error), status_code
    return jsonify(response)

@employees_bp.route('/<string:matricula>/history', methods=['GET'])
def get_employee_history(matricula):
    history, error = get_employee_history_by_matricula(matricula)
    if error:
        return jsonify(error), 500
    return jsonify(history)

@employees_bp.route('/import', methods=['POST'])
@require_permission('employees_import')
def import_employees():
    if 'file' not in request.files:
        return jsonify({'message': 'Nenhum ficheiro enviado'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'message': 'Nenhum ficheiro selecionado'}), 400

    current_user_json = request.form.get('currentUser', '{}')
    current_user = json.loads(current_user_json)

    response, error = import_employees_from_csv(file, current_user)
    if error:
        return jsonify(error), 500
    return jsonify(response), 201