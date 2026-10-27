<#
.SYNOPSIS
  Mirrors selected branches from GitHub to the internal GitLab.

.DESCRIPTION
  aigov GitLab rejects connections from outside its network, so GitHub
  Actions (and other cloud runners) cannot push to it. Run this script on a
  PC that can reach both hosts; -Install registers a Windows scheduled task
  that repeats the sync every few minutes.

  The sync uses its own bare repository (default: %LOCALAPPDATA%\gitlab-mirror)
  so it never touches a working copy. Each branch in -Branches (default: main)
  overwrites the same-named branch on GitLab. Branches are pushed one at a
  time because the GitLab security scan rejects a whole push when any branch
  in it fails, so one stale branch must not block the others.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\sync-gitlab.ps1
  Runs one sync now (do this first so Git stores your GitLab credentials).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\sync-gitlab.ps1 -Install
  Registers the scheduled task (every 10 minutes by default).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\sync-gitlab.ps1 -Branches main,dev -Install

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\sync-gitlab.ps1 -Uninstall
#>
param(
  [string]$GitHubUrl = 'https://github.com/kimjs3176-prog/patent-summary-wizard.git',
  [string]$GitLabUrl = 'https://gitlab.aigov.go.kr/kimjs1408/patent-summary-wizard.git',
  [string]$MirrorDir = (Join-Path $env:LOCALAPPDATA 'gitlab-mirror\patent-summary-wizard.git'),
  # powershell -File passes "main,dev" as one string, so split it here.
  [string[]]$Branches = @('main'),
  [int]$IntervalMinutes = 10,
  [switch]$Scheduled,
  [switch]$Install,
  [switch]$Uninstall
)

$TaskName = 'patent-summary-wizard GitLab sync'
$LogFile = Join-Path (Split-Path $MirrorDir -Parent) 'sync.log'
$Branches = @($Branches | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })

if ($Uninstall) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host "Removed scheduled task '$TaskName'."
  return
}

if ($Install) {
  $arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$PSCommandPath`"" +
    " -GitHubUrl `"$GitHubUrl`" -GitLabUrl `"$GitLabUrl`" -MirrorDir `"$MirrorDir`"" +
    " -Branches `"$($Branches -join ',')`" -Scheduled"
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments
  $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) `
    -RepetitionDuration (New-TimeSpan -Days 3650)
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
  Write-Host "Registered '$TaskName' for $($Branches -join ', ') (every $IntervalMinutes min). Log: $LogFile"
  return
}

# A manual run may prompt for GitLab credentials so Git can store them; the
# scheduled run must fail instead of hanging on a hidden prompt.
if ($Scheduled) {
  $env:GIT_TERMINAL_PROMPT = '0'
  $env:GCM_INTERACTIVE = 'never'
}

New-Item -ItemType Directory -Force -Path (Split-Path $MirrorDir -Parent) | Out-Null
if ((Test-Path $LogFile) -and (Get-Item $LogFile).Length -gt 1MB) {
  Move-Item $LogFile "$LogFile.old" -Force
}

function Write-Log([string]$message) {
  $line = '{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $message
  Add-Content -Path $LogFile -Value $line
  Write-Host $line
}

function Invoke-Git {
  # git reports progress on stderr; keep it in the log without treating it as a failure.
  $output = & git @args 2>&1 | ForEach-Object { "$_" }
  if ($output) { Add-Content -Path $LogFile -Value $output }
  if ($LASTEXITCODE -ne 0) {
    if ($output) { $output | ForEach-Object { Write-Host "  $_" } }
    throw "git $($args -join ' ') failed (exit $LASTEXITCODE)"
  }
}

try {
  if (-not (Test-Path $MirrorDir)) {
    Write-Log "Creating mirror repository at $MirrorDir"
    Invoke-Git init --bare -q $MirrorDir
    Invoke-Git -C $MirrorDir remote add origin $GitHubUrl
    Invoke-Git -C $MirrorDir remote add gitlab $GitLabUrl
  }
  Invoke-Git -C $MirrorDir remote set-url origin $GitHubUrl
  Invoke-Git -C $MirrorDir remote set-url gitlab $GitLabUrl
} catch {
  Write-Log "Sync FAILED: $_"
  exit 1
}

$failed = @()
foreach ($branch in $Branches) {
  $refspec = "+refs/heads/${branch}:refs/heads/${branch}"
  try {
    Invoke-Git -C $MirrorDir fetch -q origin $refspec
    Invoke-Git -C $MirrorDir push --porcelain gitlab $refspec
    Write-Log "Sync OK: $branch"
  } catch {
    Write-Log "Sync FAILED: ${branch}: $_"
    $failed += $branch
  }
}
if ($failed.Count -gt 0) { exit 1 }
