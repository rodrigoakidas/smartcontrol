# app.py
from flask import Flask, render_template, jsonify, g
from flask_cors import CORS
from config.database import get_connection
from config.config import config_by_name
from routes import all_blueprints
import logging
from logging.handlers import RotatingFileHandler
import os

def create_app(config_name='default'):
    """
    Cria e configura a aplicação Flask (Factory Pattern).
    """
    app = Flask(__name__)

    # Carrega a configuração a partir do objeto
    config = config_by_name[config_name]
    app.config.from_object(config)

    # Configuração de CORS
    CORS(app, resources={r"/api/*": {"origins": app.config['CORS_ORIGINS']}}, supports_credentials=True)

    # --- CONFIGURAÇÃO DE LOGS ---
    if not os.path.exists(app.config['LOGS_DIR']):
        os.mkdir(app.config['LOGS_DIR'])

    file_handler = RotatingFileHandler(
        os.path.join(app.config['LOGS_DIR'], 'smartcontrol.log'),
        maxBytes=app.config['LOGS_MAX_BYTES'],
        backupCount=app.config['LOGS_BACKUP_COUNT']
    )
    file_handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
    ))
    file_handler.setLevel(logging.INFO)
    app.logger.addHandler(file_handler)

    stream_handler = logging.StreamHandler()
    stream_handler.setLevel(logging.INFO)
    app.logger.addHandler(stream_handler)

    app.logger.setLevel(logging.INFO)
    app.logger.info('SMARTCONTROL startup')

    # --- GESTÃO AUTOMÁTICA DA BASE DE DADOS ---
    @app.before_request
    def db_connect():
        """Abre uma conexão DB antes de cada requisição."""
        if not hasattr(g, 'db_conn') or not g.db_conn.is_connected():
            g.db_conn = get_connection()
            if g.db_conn:
                g.db_cursor = g.db_conn.cursor(dictionary=True)
            else:
                app.logger.error("Falha ao obter conexão com a base de dados.")
                g.db_cursor = None

    @app.teardown_request
    def db_disconnect(exception=None):
        """Fecha a conexão DB depois de cada requisição."""
        cursor = getattr(g, 'db_cursor', None)
        if cursor:
            cursor.close()
        conn = getattr(g, 'db_conn', None)
        if conn and conn.is_connected():
            conn.close()
            
        if exception:
            app.logger.error(f"Exceção no teardown_request: {exception}", exc_info=True)

    # --- REGISTO DAS ROTAS (BLUEPRINTS) ---
    for bp in all_blueprints:
        prefix = f'/api/{bp.name}'
        app.register_blueprint(bp, url_prefix=prefix)

    # --- ROTAS PRINCIPAIS (HTML) ---
    @app.route('/')
    def index():
        """Serve a página inicial da aplicação (index.html)."""
        return render_template('index.html')

    @app.route('/health')
    def health_check():
        """Rota de 'health check' para produção."""
        try:
            if hasattr(g, 'db_cursor') and g.db_cursor:
                g.db_cursor.execute("SELECT 1")
                g.db_cursor.fetchone()
                db_status = "OK"
            else:
                db_status = "Connection Failed"
            return jsonify(status="OK", database=db_status), 200
        except Exception as e:
            app.logger.error(f"Health check falhou: {e}", exc_info=True)
            return jsonify(status="Error", database="Error"), 500

    return app
