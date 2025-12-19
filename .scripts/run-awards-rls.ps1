<#
.scripts/run-awards-rls.ps1
PowerShell helper to run awards_show SQL files against a Postgres/Supabase DB.

Usage: Open PowerShell, change to the repo root and run:
  ./.scripts/run-awards-rls.ps1

The script prompts for DB connection info and runs, in order:
  supabase/setup/awards_show_runtime.sql
  supabase/setup/awards_show_rls.sql

Requires: `psql` available in PATH (Postgres client).
This script is intended for local/dev usage. Do NOT run against production without backups.
#>

Try {
  if ($PSScriptRoot) { $repoRoot = (Resolve-Path "$PSScriptRoot\..").Path } else { $repoRoot = (Get-Location).Path }
} Catch {
  $repoRoot = (Get-Location).Path
}

$sqlDir = Join-Path $repoRoot 'supabase\setup'
$files = @(
  'awards_show_runtime.sql',
  'awards_show_rls.sql'
)

# Prompt for connection details
Write-Host "This will run the awards SQL files located in: $sqlDir" -ForegroundColor Cyan
# Allow non-interactive usage via existing environment variables (PGHOST, PGPORT, PGUSER, PGDATABASE, PGPASSWORD)
$host = $env:PGHOST; if (-not $host) { $host = Read-Host 'DB host (example: your-db-host.supabase.co)' }
$port = $env:PGPORT; if (-not $port) { $port = Read-Host 'DB port (default 5432)'; if (-not $port) { $port = '5432' } }
$user = $env:PGUSER; if (-not $user) { $user = Read-Host 'DB user (example: postgres)' }
$db   = $env:PGDATABASE; if (-not $db) { $db = Read-Host 'DB name (example: postgres)' }

# Password: prefer env var PGPASSWORD; otherwise prompt securely
if ($env:PGPASSWORD) {
  $plainPwd = $env:PGPASSWORD
} else {
  $securePwd = Read-Host 'DB password (will be hidden)' -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePwd)
  $plainPwd = [Runtime.InteropServices.Marshal]::PtrToStringAuto($ptr)
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) | Out-Null
}

# Ensure psql exists and print version for diagnostics
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  Write-Error "psql not found in PATH. Install Postgres client or add psql to PATH. On Windows install Postgres or use WSL."
  exit 1
} else {
  try { & psql --version } catch { }
}

# Set environment variables for psql
# Set environment variables for psql (do not overwrite existing values unnecessarily)
$env:PGHOST = $host
$env:PGPORT = $port
$env:PGUSER = $user
$env:PGPASSWORD = $plainPwd
$env:PGDATABASE = $db

# Run each SQL file in order
foreach ($f in $files) {
  $path = Join-Path $sqlDir $f
  if (-not (Test-Path $path)) {
    Write-Error "SQL file not found: $path"; exit 2
  }
  Write-Host "`n--- Running: $f ---" -ForegroundColor Yellow
  try {
    $log = Join-Path $repoRoot ".scripts\psql-logs"
    if (-not (Test-Path $log)) { New-Item -ItemType Directory -Path $log | Out-Null }
    $logFile = Join-Path $log "psql-$(Get-Date -Format 'yyyyMMdd-HHmmss')-$f.log"
    Write-Host "Logging psql output to: $logFile" -ForegroundColor DarkGray
    # Enable ON_ERROR_STOP so psql exits on first SQL error
    & psql -v ON_ERROR_STOP=1 -h $env:PGHOST -p $env:PGPORT -U $env:PGUSER -d $env:PGDATABASE -f $path 2>&1 | Tee-Object -FilePath $logFile
  } catch {
    Write-Error "psql execution failed: $_"
    $env:PGPASSWORD = ''
    exit 3
  }
  if ($LASTEXITCODE -ne 0) {
    Write-Error "psql returned exit code $LASTEXITCODE while running $f"
    # Clear sensitive env and exit
    $env:PGPASSWORD = ''
    exit $LASTEXITCODE
  }
}

# Wipe plaintext password and env var
$plainPwd = ''
$env:PGPASSWORD = ''

Write-Host '\nAll SQL files applied successfully. Please run verification queries as needed.' -ForegroundColor Green

# End