import mysql.connector
from mysql.connector import Error
import os # Importe a biblioteca 'os'

def get_connection():
    """
    Estabelece uma conexão com a base de dados usando variáveis de ambiente.
    """
    try:
        # Use os.environ.get() para ler as credenciais do ambiente.
        # Os valores 'root', '123456', etc., são agora "fallbacks" apenas para desenvolvimento.
        conn = mysql.connector.connect(
            host=os.environ.get('DB_HOST', 'localhost'),
            user=os.environ.get('DB_USER', 'root'),
            password=os.environ.get('DB_PASS', '123456'), # Altere '123456' para a sua senha de dev, se for diferente
            database=os.environ.get('DB_NAME', 'controle_ativos'),
            port=os.environ.get('DB_PORT', 3306)
        )
        return conn
    except Error as e:
        # É melhor usar um logger aqui, mas print() funciona por agora.
        print(f"Erro ao conectar no MySQL: {e}")
        return None