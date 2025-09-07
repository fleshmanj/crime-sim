FROM python:3.12-slim

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . ./

# Precompile bytecode for quicker startup
RUN python -m compileall -q app

# Gunicorn config
ENV GUNICORN_CMD_ARGS="--config gunicorn.conf.py"
EXPOSE 5000

CMD ["gunicorn", "wsgi:app"]
