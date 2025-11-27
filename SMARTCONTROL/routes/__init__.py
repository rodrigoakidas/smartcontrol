# routes/__init__.py

from .audit_routes import audit_bp
from .auth_routes import auth_bp
from .company_routes import company_bp
from .dashboard_routes import dashboard_bp
from .devices_routes import devices_bp
from .employees_routes import employees_bp
from .line_records_routes import line_records_bp
from .lines_routes import lines_bp
from .maintenance_routes import maintenance_bp
from .records_routes import records_bp
from .upload_routes import upload_bp
from .user_routes import user_bp

all_blueprints = [
    audit_bp,
    auth_bp,
    company_bp,
    dashboard_bp,
    devices_bp,
    employees_bp,
    line_records_bp,
    lines_bp,
    maintenance_bp,
    records_bp,
    upload_bp,
    user_bp
]
