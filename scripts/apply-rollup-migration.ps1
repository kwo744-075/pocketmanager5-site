<#
Run this script to apply the rollups migration and the safe trigger re-creation file
against a target Supabase/Postgres database using psql.

Usage (PowerShell):
  $env:DATABASE_URL = 'postgresql://<user>:<pass>@<host>:<port>/<db>'
  .\apply-rollup-migration.ps1

Or pass a connection string directly:
  .\apply-rollup-migration.ps1 -ConnectionString 'postgresql://...'

Make sure you have a recent backup before running this script and run first against staging.
#>

param(
  [string]$ConnectionString
)

if (-not $ConnectionString) {
  $ConnectionString = $env:DATABASE_URL
}

if (-not $ConnectionString) {
  Write-Error "No connection string supplied. Set DATABASE_URL or pass -ConnectionString."
  exit 1
}

function Run-SqlFile([string]$filePath) {
  if (-not (Test-Path $filePath)) {
    Write-Error "SQL file not found: $filePath"
    exit 1
  }
  Write-Host "Applying $filePath..."
  & psql $ConnectionString -f $filePath
  if ($LASTEXITCODE -ne 0) {
    Write-Error "psql returned non-zero exit code ($LASTEXITCODE) while applying $filePath"
    exit $LASTEXITCODE
  }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$migration1 = Join-Path $scriptDir "..\supabase\migrations\20251207090000_make_rollups_canonical.sql" | Resolve-Path -ErrorAction Stop
$migration2 = Join-Path $scriptDir "..\supabase\migrations\20251214000000_fix_rollup_trigger_drop.sql" | Resolve-Path -ErrorAction Stop

Run-SqlFile $migration1
Run-SqlFile $migration2

Write-Host "Migration applied. Verify the migration on the database using the verification queries in supabase/VERIFICATION.md"
