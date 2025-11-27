# run.py
import os
from app import create_app

# Obtém a configuração do ambiente (development, production)
config_name = os.getenv('FLASK_CONFIG', 'default')
app = create_app(config_name)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
