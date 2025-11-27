# routes/records_routes.py
from flask import Blueprint, jsonify, request
from services.records_service import (
    get_all_records, get_record_by_id, update_existing_record, 
    create_new_record, delete_existing_record
)
from .decorators import require_permission

records_bp = Blueprint('records', __name__)

@records_bp.route('/', methods=['GET'])
def get_records():
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 10))
    status_filter = request.args.get('filter', 'Todos')

    total_records, records, error = get_all_records(page, limit, status_filter)
    if error:
        return jsonify(error), 500
    
    return jsonify({'total': total_records, 'records': records})

@records_bp.route('/<int:record_id>', methods=['GET'])
def get_record(record_id):
    record, error = get_record_by_id(record_id)
    if error:
        status_code = 404 if 'não encontrado' in error['message'] else 500
        return jsonify(error), status_code
    return jsonify(record)

@records_bp.route('/<int:record_id>', methods=['PUT'])
@require_permission('records_update')
def update_record(record_id):
    data = request.get_json()
    response, error = update_existing_record(record_id, data)
    if error:
        status_code = 400 if 'Nenhum dado válido' in error['message'] else 404 if 'não encontrado' in error['message'] else 500
        return jsonify(error), status_code
    return jsonify(response)

@records_bp.route('/', methods=['POST'])
@require_permission('records_create')
def create_record():
    data = request.get_json()
    response, error = create_new_record(data)
    if error:
        status_code = 400 if 'obrigatórios' in error['message'] else 404 if 'não encontrado' in error['message'] else 409 if 'associado' in error['message'] else 500
        return jsonify(error), status_code
    return jsonify(response), 201

@records_bp.route('/<int:record_id>', methods=['DELETE'])
@require_permission('records_delete')
def delete_record(record_id):
    data = request.get_json() or {}
    response, error = delete_existing_record(record_id, data)
    if error:
        status_code = 404 if 'não encontrado' in error['message'] else 500
        return jsonify(error), status_code
    return jsonify(response)
