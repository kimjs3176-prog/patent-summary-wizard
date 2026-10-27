<#
.SYNOPSIS
  Mirrors branches and tags from GitHub to the internal GitLab.

.DESCRIPTION
  aigov GitLab rejects connections from outside its network, so GitHub
  Actions (and other cloud runners) cannot push to it. Run this script on a
  PC that can reach both hosts; -Install registers a Windows scheduled task
  that repeats the sync every few minutes.

  The sync uses its own bare repository (default: %LOCALAPPDATA%\gitlab-mirror)
  so it never touches a working copy. Branches that exist on GitHub overwrite
  the same-named branches on GitLab; GitLab-only branches are kept unless
  -Prune is given.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\sync-gitlab.ps1
  Runs one sync now (do this first so Git stores your GitLab credentials).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\sync-gitlab.ps1 -Install
  Registers the scheduled task (every 10 minutes by default).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\sync-gitlab.ps1 -Uninstall
#>
param(
  [string]$GitHubUrl = 'https://github.com/kimjs3176-prog/patent-summary-wizard.git',
  [string]$GitLabUrl = 'https://gitlab.aigov.go.kr/kimjs1408/patent-summary-wizard.git',
  [string]$MirrorDir = (Join-Path $env:LOCALAPPDATA 'gitlab-mirror\patent-summary-wizard.git'),
  [int]$IntervalMinutes = 10,
  [switch]$Prune,
  [switch]$Install,
  [switch]$Uninstall
)

$TaskName = 'patent-summary-wizard GitLab sync'
$LogFile = Join-Path (Split-Path $MirrorDir -Parent) 'sync.log'

if ($Uninstall) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host "Removed scheduled task '$TaskName'."
  return
}

if ($Install) {
  $arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$PSCommandPath`"" +
    " -GitHubUrl `"$GitHubUrl`" -GitLabUrl `"$GitLabUrl`" -MirrorDir `"$MirrorDir`""
  if ($Prune) { $arguments += ' -Prune' }
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments
  $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) `
    -RepetitionDuration (New-TimeSpan -Days 3650)
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
  Write-Host "Registered '$TaskName' (every $IntervalMinutes min). Log: $LogFile"
  return
}

# Fail instead of hanging on a hidden credential prompt when run by the scheduler.
$env:GIT_TERMINAL_PROMPT = '0'
$env:GCM_INTERACTIVE = 'never'

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
  if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' ') failed (exit $LASTEXITCODE)" }
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

  $refspecs = @('+refs/heads/*:refs/heads/*', '+refs/tags/*:refs/tags/*')
  Invoke-Git -C $MirrorDir fetch -q --prune origin @refspecs

  $pushArgs = @('-C', $MirrorDir, 'push', '--porcelain', 'gitlab') + $refspecs
  if ($Prune) { $pushArgs = @('-C', $MirrorDir, 'push', '--porcelain', '--prune', 'gitlab') + $refspecs }
  Invoke-Git @pushArgs

  Write-Log 'Sync OK'
} catch {
  Write-Log "Sync FAILED: $_"
  exit 1
}
