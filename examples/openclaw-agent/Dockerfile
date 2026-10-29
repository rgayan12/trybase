FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY main.py .

EXPOSE 8000

# Run with single-tenant isolation (Anti-Leak daemon injects secrets via /var/run/trybase/secrets.sock)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
