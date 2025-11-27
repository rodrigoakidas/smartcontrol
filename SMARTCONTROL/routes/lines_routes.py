from flask import Blueprint, jsonify, request
from .decorators import require_permission
from services.lines_service import (
    list_lines, create_line, update_line, delete_line,
    get_line_history, import_lines_from_csv
)

lines_bp = Blueprint('lines', __name__)


@lines_bp.route('/', methods=['GET'])
def get_lines_route():
    data, error = list_lines()
    if error:
        return jsonify(error), 500
    return jsonify(data)


@lines_bp.route('/', methods=['POST'])
@require_permission('lines_create')
def add_line_route():
    response, error = create_line(request.get_json())
    if error:
        return jsonify(error), 400
    return jsonify(response), 201


@lines_bp.route('/<int:line_id>', methods=['PUT'])
@require_permission('lines_update')
def update_line_route(line_id):
    response, error = update_line(line_id, request.get_json())
    if error:
        return jsonify(error), 404
    return jsonify(response)


@lines_bp.route('/<int:line_id>', methods=['DELETE'])
@require_permission('lines_delete')
def delete_line_route(line_id):
    response, error = delete_line(line_id, request.get_json() or {})
    if error:
        return jsonify(error), 404
    return jsonify(response)


@lines_bp.route('/<int:line_id>/history', methods=['GET'])
def get_line_history_route(line_id):
    data, error = get_line_history(line_id)
    if error:
        return jsonify(error), 500
    return jsonify(data)


@lines_bp.route('/import', methods=['POST'])
@require_permission('lines_import')
def import_lines_route():
    file = request.files.get('file')
    if not file:
        return jsonify({'message': 'Nenhum ficheiro enviado'}), 400

    current_user_json = request.form.get('currentUser', '{}')
    import json
    current_user = json.loads(current_user_json)

    response, error = import_lines_from_csv(file, current_user)
    if error:
        return jsonify(error), 500
    return jsonify(response), 201
