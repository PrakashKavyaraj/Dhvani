# Multi-Stage Production Dockerfile for Dhvani Voice Integrity Backend
FROM python:3.11-slim AS builder

WORKDIR /app

# Install build dependencies and audio development libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libsndfile1-dev \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies in virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt requirements-ml.txt ./
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir -r requirements-ml.txt && \
    pip install --no-cache-dir soundfile speechbrain

# Runner stage
FROM python:3.11-slim AS runner

WORKDIR /app

# Install runtime system libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy virtualenv from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Create non-root system user
RUN groupadd -g 1001 dhvani && \
    useradd -u 1001 -g dhvani -s /bin/bash -m dhvani

# Create and set permissions for data directories
RUN mkdir -p /app/data/temp /app/models/weights && \
    chown -R dhvani:dhvani /app

# Copy application source code
COPY --chown=dhvani:dhvani app /app/app
COPY --chown=dhvani:dhvani AEGIS_INTEGRATION /app/AEGIS_INTEGRATION
COPY --chown=dhvani:dhvani models /app/models
COPY --chown=dhvani:dhvani .env.example /app/.env

USER dhvani

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
