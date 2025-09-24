#!/usr/bin/env bash
set -euo pipefail

echo "[prestart] waiting for db…"
until pg_isready -h db -p 5432 -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do
  sleep 1
done

echo "[prestart] db ready; applying migrations…"
PSQL="psql postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@db:5432/$POSTGRES_DB -v ON_ERROR_STOP=1 -q"

# tracking table
$PSQL <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  id         bigserial PRIMARY KEY,
  filename   text NOT NULL UNIQUE,
  sha256     text,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL

shopt -s nullglob
files=(/app/migrations/*.sql)
echo "[prestart] found ${#files[@]} file(s) in /app/migrations"
for f in "${files[@]}"; do
  name="$(basename "$f")"
  already="$($PSQL -Atc "SELECT 1 FROM schema_migrations WHERE filename = '$name' LIMIT 1" || true)"
  if [[ "$already" == "1" ]]; then
    echo "[prestart] SKIP $name"
    continue
  fi
  echo "[prestart] APPLY $name"
  $PSQL -f "$f"
  sha="$(sha256sum "$f" | awk '{print $1}')"
  $PSQL -c "INSERT INTO schema_migrations (filename, sha256) VALUES ('$name', '$sha')"
done

echo "[prestart] migrations complete."
