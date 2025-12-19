#!/usr/bin/env bash
# .scripts/run-awards-rls.sh
# Bash runner to apply awards_show SQL files via psql (WSL / macOS / Linux)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SQL_DIR="$REPO_ROOT/supabase/setup"

FILES=(
  "awards_show_runtime.sql"
  "awards_show_rls.sql"
)

echo "This will run SQL files from: $SQL_DIR"
read -rp "DB host (example: your-db-host.supabase.co): " PGHOST
read -rp "DB port (default 5432): " PGPORT
PGPORT=${PGPORT:-5432}
read -rp "DB user (example: postgres): " PGUSER
read -rp "DB name (example: postgres): " PGDATABASE
read -rsp "DB password (hidden): " PGPASSWORD
echo

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found in PATH. Install Postgres client (apt, brew, or package manager) or run this in WSL where psql is available." >&2
  exit 1
fi

export PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE

for f in "${FILES[@]}"; do
  path="$SQL_DIR/$f"
  if [[ ! -f "$path" ]]; then
    echo "SQL file not found: $path" >&2
    exit 2
  fi
  echo "\n--- Running: $f ---"
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -f "$path"
done

# Unset sensitive env
unset PGPASSWORD

echo -e "\nAll SQL files applied successfully. Run verification queries as needed."
