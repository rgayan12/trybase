"""
Example Django settings.py with Zero .env files.
Secrets and database passwords are pulled directly into memory via TryBase Unix Domain Socket.
"""

import os
from pathlib import Path
from trybase_secrets import load_secrets, TryBaseClient

BASE_DIR = Path(__file__).resolve().parent.parent

# 1. Fetch secrets directly into memory from the kernel-enforced socket
# Respects TRYBASE_SECRET_KEYS, fails closed in production, falls back in dev
secrets = load_secrets()

# 2. Secret Key and Core Config from memory (never stored on disk!)
SECRET_KEY = secrets.get("SECRET_KEY", "fallback-dev-key-for-local")
DEBUG = secrets.get("DEBUG", "False").lower() == "true"
ALLOWED_HOSTS = ["*"]

# 3. Third-party API keys in memory
STRIPE_SECRET_KEY = secrets.get("STRIPE_SECRET")
OPENAI_API_KEY = secrets.get("OPENAI_API_KEY")

# 4. Passwordless RDS PostgreSQL Database Setup
# In production, dynamically configures RDS IAM authentication with TLS verification
trybase = TryBaseClient()
if trybase.is_available() and os.environ.get("TRYBASE_RDS_IAM", "true").lower() == "true":
    db_params = trybase.get_database_connection_params({
        "NAME": "trybase_db",
        "CONN_MAX_AGE": 600,  # Recycle connections before 15-minute IAM token expiry!
    })
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": db_params.get("database"),
            "USER": db_params.get("user"),
            "PASSWORD": db_params.get("password"),
            "HOST": db_params.get("host"),
            "PORT": db_params.get("port"),
            "CONN_MAX_AGE": db_params.get("CONN_MAX_AGE", 600),
            "OPTIONS": {
                "sslmode": db_params.get("sslmode", "verify-full"),
                "sslrootcert": db_params.get("sslrootcert"),
            },
        }
    }
else:
    # Local laptop fallback
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": secrets.get("DB_NAME", "postgres"),
            "USER": secrets.get("DB_USER", "postgres"),
            "PASSWORD": secrets.get("DB_PASSWORD", "postgres"),
            "HOST": secrets.get("DB_HOST", "localhost"),
            "PORT": secrets.get("DB_PORT", "5432"),
        }
    }
