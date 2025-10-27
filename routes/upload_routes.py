# SMARTCONTROL/routes/upload_routes.py
# (FICHEIRO COMPLETO E CORRIGIDO)

import os
from flask import Blueprint, jsonify, request, url_for, current_app
from werkzeug.utils import secure_filename

upload_bp = Blueprint('upload', __name__)

# Define a pasta onde os uploads serão guardados
UPLOAD_FOLDER = 'static/uploads'
# Garante que a pasta de uploads existe
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# --- CORREÇÃO DE SEGURANÇA ---
ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
# --- FIM DA CORREÇÃO ---

@upload_bp.route('/', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'message': 'Nenhum ficheiro enviado'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'message': 'Nenhum ficheiro selecionado'}), 400
        
    # --- CORREÇÃO DE SEGURANÇA ---
    if not allowed_file(file.filename):
        current_app.logger.warning(f"Tentativa de upload de ficheiro inválido: {file.filename}")
        return jsonify({'message': 'Tipo de ficheiro não permitido'}), 400
    # --- FIM DA CORREÇÃO ---

    if file:
        try:
            filename = secure_filename(file.filename)
            file_path = os.path.join(UPLOAD_FOLDER, filename)
            file.save(file_path)
            
            # Gera a URL completa para o ficheiro guardado
            file_url = url_for('static', filename=f'uploads/{filename}', _external=True)
            
            current_app.logger.info(f"Upload bem-sucedido: {filename}")
            return jsonify({'message': 'Upload bem-sucedido!', 'fileUrl': file_url}), 201
        
        except Exception as e:
            current_app.logger.error(f"Erro durante o upload do ficheiro {file.filename}: {e}", exc_info=True)
            return jsonify({'message': 'Erro ao guardar o ficheiro'}), 500

    return jsonify({'message': 'Erro desconhecido no upload'}), 500