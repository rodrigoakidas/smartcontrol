# SMARTCONTROL/app.py
# (FICHEIRO COMPLETO E CORRIGIDO)

from flask import Flask, render_template, jsonify, g, request, abort
from flask_cors import CORS # Importe o CORS
from config.database import get_connection # Importe o get_connection
from routes import all_blueprints
import logging
from logging.handlers import RotatingFileHandler
import os

def create_app():
    """
    Cria e configura a aplicação Flask (Factory Pattern).
    Isto é ideal para produção com Gunicorn/WSGI.
    """
    app = Flask(__name__)

    # --- CONFIGURAÇÕES DE PRODUÇÃO ---
    
    # 1. Chave Secreta: Necessária para segurança. Defina no seu ambiente!
    app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY', 'sua-chave-secreta-de-desenvolvimento-pode-ser-qualquer-coisa')

    # 2. Limite de Upload (ex: 16 MB)
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024 

    # 3. Configuração de CORS (Segurança)
    # Em produção, defina a variável de ambiente:
    # CORS_ORIGINS="https://seu-dominio.com,https://www.seu-dominio.com"
    origins_env = os.environ.get('CORS_ORIGINS', 'http://localhost:5000,http://127.0.0.1:5000')
    origins = origins_env.split(',')
    
    CORS(app, resources={r"/api/*": {"origins": origins}}, supports_credentials=True)
    
    # --- FIM DAS CONFIGURAÇÕES DE PRODUÇÃO ---


    # --- CONFIGURAÇÃO DE LOGS (Melhorada) ---
    if not os.path.exists('logs'):
        os.mkdir('logs')

    # Aumentado para 10MB por ficheiro (1024 * 1024 * 10)
    file_handler = RotatingFileHandler('logs/smartcontrol.log', maxBytes=10485760, backupCount=5)
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
    # --- FIM DA CONFIGURAÇÃO DE LOGS ---


    # --- GESTÃO AUTOMÁTICA DA BASE DE DADOS ---
    @app.before_request
    def db_connect():
        """Abre uma conexão DB antes de cada requisição."""
        # Ignora rotas estáticas e de health check
        if 'db_conn' not in g and request.endpoint not in ('static', 'health_check'):
            try:
                g.db_conn = get_connection()
                g.db_cursor = g.db_conn.cursor(dictionary=True)
            except Exception as e:
                app.logger.error(f"Falha CRÍTICA ao obter conexão com a base de dados: {e}", exc_info=True)
                # Define como None para o teardown não falhar
                g.db_conn = None
                g.db_cursor = None
                # Aborta a requisição com um erro 503, impedindo a rota de ser executada.
                abort(503, description="Serviço indisponível: não foi possível conectar à base de dados.")

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
    # --- FIM DA GESTÃO DA BASE DE DADOS ---


    # --- REGISTO DAS ROTAS (BLUEPRINTS) ---
    for bp in all_blueprints:
        prefix = f'/api/{bp.name}'
        app.register_blueprint(bp, url_prefix=prefix)
        # app.logger.info(f"Blueprint '{bp.name}' registrado em {prefix}")

    
    # --- ROTAS PRINCIPAIS (HTML) ---
    @app.route('/')
    def index():
        """Serve a página inicial da aplicação (index.html)."""
        return render_template('index.html')

    @app.route('/health')
    def health_check():
        """Rota de 'health check' para produção."""
        conn = None
        cursor = None
        try:
            # Esta rota deve ter sua própria conexão para não interferir com 'g'
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.fetchone()
            db_status = "OK"
            return jsonify(status="OK", database=db_status), 200
        except Exception as e:
            app.logger.error(f"Health check falhou: {e}", exc_info=True)
            return jsonify(status="Error", database="Failed"), 503
        finally:
            if cursor: cursor.close()
            if conn and conn.is_connected(): conn.close()

    return app

# --- FIM DE create_app() ---


# Este bloco só é executado quando corre "python app.py"
if __name__ == '__main__':
    # Obtém o debug status do ambiente, fallback para True se não definido
    # NUNCA defina FLASK_DEBUG=True em produção!
    DEBUG_MODE = os.environ.get('FLASK_DEBUG', 'True').lower() == 'true'
    
    app = create_app() # Cria a aplicação
    
    app.logger.info(f"Iniciando servidor em modo DEBUG={DEBUG_MODE}")
    app.run(debug=DEBUG_MODE, host='0.0.0.0', port=5000)