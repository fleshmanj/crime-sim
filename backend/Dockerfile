FROM python:3.12-slim

# System deps (psql + pg_isready come from postgresql-client)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev postgresql-client ca-certificates bash \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python deps
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# App code
COPY . ./

# Prestart script (ensure LF endings, make executable)
COPY prestart.sh /app/prestart.sh
RUN sed -i 's/\r$//' /app/prestart.sh || true && chmod +x /app/prestart.sh

# Optional: precompile for faster startup
RUN python -m compileall -q app

# Gunicorn config via env (your existing setting)
ENV GUNICORN_CMD_ARGS="--config gunicorn.conf.py"
EXPOSE 5000

# Run migrations, then start gunicorn (GUNICORN_CMD_ARGS still applies)
CMD ["/bin/bash","-lc","/app/prestart.sh && exec gunicorn wsgi:app"]
