#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL to a protected database connection string}"
: "${BACKUP_ROOT:?Set BACKUP_ROOT to an offsite staging directory outside the repository}"
run_id="${BACKUP_RUN_ID:-$(date -u +%Y%m%dT%H%M%SZ)}"
mkdir -p -- "${BACKUP_ROOT}"
if [[ -e "${BACKUP_ROOT}/${run_id}" ]]; then
  echo "Refusing to reuse backup generation: ${run_id}" >&2
  exit 1
fi
run_dir="$(mkdir -- "${BACKUP_ROOT}/${run_id}" && cd -- "${BACKUP_ROOT}/${run_id}" && pwd)"
command -v pg_dump >/dev/null || { echo "pg_dump is required" >&2; exit 1; }
command -v psql >/dev/null || { echo "psql is required" >&2; exit 1; }
{
  pg_dump --version
  psql --version
  node --version
} > "${run_dir}/tool-versions.txt"

pg_dump --format=custom --no-owner --no-privileges \
  --schema=public --schema=private \
  --file "${run_dir}/application.dump" "${SUPABASE_DB_URL}"
psql --no-psqlrc --tuples-only --no-align "${SUPABASE_DB_URL}" \
  --command "select json_build_object('database_size_bytes',pg_database_size(current_database()),'migration_head',coalesce((select max(version) from supabase_migrations.schema_migrations),''))" \
  > "${run_dir}/database-metadata.json"
node scripts/backup/create-manifest.mjs "${run_dir}"
printf 'backup_run=%s\nmanifest=%s\n' "${run_id}" "${run_dir}/manifest.json"
