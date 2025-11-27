from flask import Flask

def create_app():
    """
    Cria uma instância da aplicação Flask.
    """
    app = Flask(__name__)
    return app
