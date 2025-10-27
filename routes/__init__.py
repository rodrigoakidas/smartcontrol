# Este arquivo transforma a pasta "routes" em um pacote Python
# e facilita a importação de todos os blueprints no app.py

from .auth_routes import auth_bp
from .company_routes import company_bp
from .user_routes import user_bp
from .employees_routes import employees_bp
from .devices_routes import devices_bp
from .lines_routes import lines_bp
from .maintenance_routes import maintenance_bp
from .records_routes import records_bp
from .upload_routes import upload_bp
from .dashboard_routes import dashboard_bp
from .audit_routes import audit_bp
from .line_records_routes import line_records_bp

# Lista de todos os blueprints para registro automático
all_blueprints = [
    auth_bp,
    company_bp,
    user_bp,
    employees_bp,
    devices_bp,
    lines_bp,
    maintenance_bp,
    records_bp,
    upload_bp,
    dashboard_bp,
    audit_bp,
    line_records_bp 
]