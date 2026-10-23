# syntax=docker/dockerfile:1

FROM python:3.12-slim
WORKDIR /app
# The container runs with a read-only root filesystem in production
# (backend/docker-compose.yml): no bytecode caches to write, and logs go
# straight to stdout.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Run as an unprivileged user: the service parses model output and calls out
# to third-party APIs, and needs no privileges (it listens on 8000 and writes
# nothing to disk).
RUN useradd --system --uid 10001 --no-create-home --shell /usr/sbin/nologin app
COPY --chown=app:app app/ ./app/
USER app

EXPOSE 8000
# --no-server-header: no software/version banner on responses.
ENTRYPOINT ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-server-header"]
