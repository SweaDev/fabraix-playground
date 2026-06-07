FROM python:3.11-slim

WORKDIR /app

# System deps kept minimal; SQLite is bundled with Python.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# Install Python deps first for layer caching.
COPY engine/requirements.txt ./engine/requirements.txt
RUN pip install --no-cache-dir -r engine/requirements.txt

# Copy the engine package. The build context is the repository root (see
# docker-compose.yml), so the package is importable as `engine.*`.
COPY engine ./engine

# Persisted SQLite lives here (mounted as a volume in compose).
RUN mkdir -p /data

EXPOSE 8000

# Run as a module so `engine.*` relative imports resolve.
CMD ["python", "-m", "engine.main"]
