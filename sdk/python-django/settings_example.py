"""
Example Django settings.py with Zero .env files.
Secrets and database passwords are pulled directly into memory via TryBase Unix Domain Socket.
"""

from pathlib import Path
from trybase_secrets import load_secrets, TryBaseClient

BASE_DIR = Path(__file__).resolve().parent.parent

# 1. Fetch secrets directly into memory from the kernel-enforced socket
secrets = load_secrets()

# 2. Secret Key from memory (never exists on disk!)
SECRET_KEY = secrets.get("SECRET_KEY", "fallback-dev-key-for-local")
DEBUG = secrets.get("DEBUG", "False").lower() == "true"
ALLOWED_HOSTS = ["*"]

# 3. Third-party API keys in memory
STRIPE_SECRET_KEY = secrets.get("STRIPE_SECRET")
OPENAI_API_KEY = secrets.get("OPENAI_API_KEY")

# 4. Passwordless RDS PostgreSQL Database Setup
# If running in TryBase production, pull the ephemeral 15-minute IAM auth token
db_password = secrets.get("DB_PASSWORD")
try:
    client = TryBaseClient()
    db_token_info = client.get_database_token()
    db_password = db_token_info["auth_token"]
    db_host = db_token_info["db_host"]
    db_port = str(db_token_info["db_port"])
    db_user = db_token_info["db_user"]
    db_name = db_token_info["db_name"]
except Exception:
    # Local laptop fallback
    db_host = secrets.get("DB_HOST", "localhost")
    db_port = secrets.get("DB_PORT", "5432")
    db_user = secrets.get("DB_USER", "postgres")
    db_name = secrets.get("DB_NAME", "postgres")

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": db_name,
        "USER": db_user,
        "PASSWORD": db_password,
        "HOST": db_host,
        "PORT": db_port,
    }
}
