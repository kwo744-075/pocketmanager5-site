<#
.scripts/check-awards-env.ps1
Non-destructive environment check for applying awards SQL files.

Usage:
  .\.scripts\check-awards-env.ps1

What it does:
- Verifies `psql` is present and prints its version.
- Confirms the SQL files exist under `supabase\setup`.
- Prints PG env vars (masking password) and current repo path.
#>

Try {
  if ($PSScriptRoot) { $repoRoot = (Resolve-Path "$PSScriptRoot\..").Path } else { $repoRoot = (Get-Location).Path }
} Catch {
  $repoRoot = (Get-Location).Path
}

$sqlDir = Join-Path $repoRoot 'supabase\setup'
$files = @('awards_show_runtime.sql','awards_show_rls.sql')

Write-Host "Repository root: $repoRoot" -ForegroundColor Cyan
Write-Host "SQL directory: $sqlDir" -ForegroundColor Cyan

# psql availability
if (Get-Command psql -ErrorAction SilentlyContinue) {
  Write-Host "psql: found" -ForegroundColor Green
  try { & psql --version } catch { Write-Host "(psql --version failed)" -ForegroundColor Yellow }
} else {
  Write-Host "psql: NOT found in PATH" -ForegroundColor Red
}

# Check SQL files
$allFound = $true
foreach ($f in $files) {
  $path = Join-Path $sqlDir $f
  if (Test-Path $path) {
    Write-Host "Found: $f" -ForegroundColor Green
  } else {
    Write-Host "Missing: $f" -ForegroundColor Red
    $allFound = $false
  }
}

# Print PG env vars (mask password)
$envHost = $env:PGHOST
$envPort = $env:PGPORT
$envUser = $env:PGUSER
$envDB = $env:PGDATABASE

Write-Host "PGHOST: " -NoNewline
if ($envHost) { Write-Host $envHost } else { Write-Host "(not set)" }
Write-Host "PGPORT: " -NoNewline
if ($envPort) { Write-Host $envPort } else { Write-Host "(not set)" }
Write-Host "PGUSER: " -NoNewline
if ($envUser) { Write-Host $envUser } else { Write-Host "(not set)" }
Write-Host "PGDATABASE: " -NoNewline
if ($envDB) { Write-Host $envDB } else { Write-Host "(not set)" }
if ($env:PGPASSWORD) { Write-Host "PGPASSWORD: (set)" } else { Write-Host "PGPASSWORD: (not set)" }

if (-not $allFound) { Write-Host "One or more SQL files are missing. Fix before running the apply script." -ForegroundColor Red; exit 2 }

Write-Host "Environment check passed (files exist). If psql is missing, install it or run in WSL." -ForegroundColor Green
exit 0
