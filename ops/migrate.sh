# ops/migrate.sh
#!/usr/bin/env bash
set -euo pipefail

PSQL="psql postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@db:5432/$POSTGRES_DB -v ON_ERROR_STOP=1"

$PSQL <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  id         bigserial PRIMARY KEY,
  filename   text NOT NULL UNIQUE,
  sha256     text,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL

shopt -s nullglob
for f in /migrations/*.sql; do
  name="$(basename "$f")"
  already="$($PSQL -Atc "SELECT 1 FROM schema_migrations WHERE filename = '$name' LIMIT 1" || true)"
  if [[ "$already" == "1" ]]; then
    echo "SKIP $name (already applied)"
    continue
  fi
  echo "APPLY $name"
  $PSQL -f "$f"
  sha="$(sha256sum "$f" | awk '{print $1}')"
  $PSQL -c "INSERT INTO schema_migrations (filename, sha256) VALUES ('$name', '$sha')"
done

echo "All migrations done."
