# config/config.py
import os

class Config:
    """Configurações base da aplicação."""
    SECRET_KEY = os.environ.get('FLASK_SECRET_KEY', 'sua-chave-secreta-de-desenvolvimento-pode-ser-qualquer-coisa')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024
    
    # Configuração de CORS
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', 'http://localhost:5000,http://127.0.0.1:5000').split(',')

    # Configuração de Logs
    LOGS_DIR = 'logs'
    LOGS_MAX_BYTES = 10485760  # 10MB
    LOGS_BACKUP_COUNT = 5

class DevelopmentConfig(Config):
    """Configurações para ambiente de desenvolvimento."""
    DEBUG = True

class ProductionConfig(Config):
    """Configurações para ambiente de produção."""
    DEBUG = False

# Mapeamento para facilitar a seleção da configuração
config_by_name = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
