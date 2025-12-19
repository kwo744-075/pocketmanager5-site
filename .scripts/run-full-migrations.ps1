<#
Run full migration workflow: patch policies, check env, apply setup SQL, and push migrations
Usage: From repo root run: .\.scripts\run-full-migrations.ps1
#>

Set-StrictMode -Version Latest

# Determine repo root (parent of this script's folder)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $scriptDir) { $scriptDir = $PSScriptRoot }
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
Set-Location $repoRoot

$logDir = Join-Path $repoRoot '.scripts\psql-logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }

Write-Host "Repo root:" $repoRoot -ForegroundColor Cyan
Write-Host "Logs:" $logDir -ForegroundColor Cyan

# 1) Run node patcher (if present)
$patcher = Join-Path $repoRoot '.scripts\patch_policy_idempotent.js'
if (Test-Path $patcher) {
  Write-Host "Running policy patcher:" $patcher
  node $patcher 2>&1 | Tee-Object -FilePath (Join-Path $logDir 'patch_policy_idempotent.log')
  if ($LASTEXITCODE -ne 0) { Write-Error "Policy patcher failed. See logs"; Exit $LASTEXITCODE }
} else {
  Write-Host "Patcher not found at $patcher — skipping patch step." -ForegroundColor Yellow
}

# 2) Run environment check (pwsh script)
$checkScript = Join-Path $repoRoot '.scripts\check-awards-env.ps1'
if (Test-Path $checkScript) {
  Write-Host "Running environment check script"
  pwsh -NoProfile -ExecutionPolicy Bypass -File $checkScript 2>&1 | Tee-Object -FilePath (Join-Path $logDir 'check-awards-env.log')
  if ($LASTEXITCODE -ne 0) { Write-Error "Env check failed. See logs"; Exit $LASTEXITCODE }
} else {
  Write-Host "Env check script not found at $checkScript — skipping." -ForegroundColor Yellow
}

# 3) Run targeted SQL runner to apply setup RLS files
$awardsRunner = Join-Path $repoRoot '.scripts\run-awards-rls.ps1'
if (Test-Path $awardsRunner) {
  Write-Host "Executing awards RLS runner (psql output logged)"
  pwsh -NoProfile -ExecutionPolicy Bypass -File $awardsRunner *>&1 | Tee-Object -FilePath (Join-Path $logDir 'run-awards-rls.log')
  if ($LASTEXITCODE -ne 0) { Write-Error "run-awards-rls.ps1 failed. See logs"; Exit $LASTEXITCODE }
} else {
  Write-Host "Awards runner not found — skipping." -ForegroundColor Yellow
}

# --- supabase db push (linked) ---
$supabaseLog = Join-Path $logDir "supabase-db-push.log"

Write-Host 'Running: supabase db push --linked' -ForegroundColor Cyan

& supabase db push --linked 2>&1 | Tee-Object -FilePath $supabaseLog

if ($LASTEXITCODE -ne 0) {
  Write-Host 'supabase db push failed. Logs: $supabaseLog' -ForegroundColor Red
  exit 1
} else {
  Write-Host 'supabase db push completed successfully. Logs: $supabaseLog' -ForegroundColor Green
}

Exit 0
# end
