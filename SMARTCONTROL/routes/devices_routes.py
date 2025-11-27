# routes/devices_routes.py
from flask import Blueprint, jsonify, request
from services.devices_service import (
    get_all_devices, add_new_device, update_existing_device, 
    delete_existing_device, get_device_history_by_imei, 
    import_devices_from_csv, get_eligible_for_maintenance_devices
)
from .decorators import require_permission
import json

devices_bp = Blueprint('devices', __name__)

@devices_bp.route('/', methods=['GET'])
def get_devices():
    devices, error = get_all_devices()
    if error:
        return jsonify(error), 500
    return jsonify(devices)

@devices_bp.route('/', methods=['POST'])
@require_permission('devices_create')
def add_device():
    data = request.get_json()
    response, error = add_new_device(data)
    if error:
        status_code = 400 if 'obrigatórios' in error['message'] else 409 if 'já está cadastrado' in error['message'] else 500
        return jsonify(error), status_code
    return jsonify(response), 201

@devices_bp.route('/<string:imei>', methods=['PUT'])
@require_permission('devices_update')
def update_device(imei):
    data = request.get_json()
    response, error = update_existing_device(imei, data)
    if error:
        status_code = 404 if 'não encontrado' in error['message'] else 500
        return jsonify(error), status_code
    return jsonify(response)

@devices_bp.route('/<string:imei>', methods=['DELETE'])
@require_permission('devices_delete')
def delete_device(imei):
    data = request.get_json() or {}
    response, error = delete_existing_device(imei, data)
    if error:
        status_code = 404 if 'não encontrado' in error['message'] else 409 if 'vinculadas' in error['message'] else 500
        return jsonify(error), status_code
    return jsonify(response)

@devices_bp.route('/<string:imei>/history', methods=['GET'])
def get_device_history(imei):
    history, error = get_device_history_by_imei(imei)
    if error:
        return jsonify(error), 500
    return jsonify(history)

@devices_bp.route('/import', methods=['POST'])
@require_permission('devices_import')
def import_devices():
    if 'file' not in request.files:
        return jsonify({'message': 'Nenhum ficheiro enviado'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'message': 'Nenhum ficheiro selecionado'}), 400

    current_user_json = request.form.get('currentUser', '{}')
    current_user = json.loads(current_user_json)

    response, error = import_devices_from_csv(file, current_user)
    if error:
        return jsonify(error), 500
    return jsonify(response), 201

@devices_bp.route('/eligible-for-maintenance', methods=['GET'])
def get_eligible_devices():
    devices, error = get_eligible_for_maintenance_devices()
    if error:
        return jsonify(error), 500
    return jsonify(devices)
