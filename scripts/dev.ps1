param(
  [ValidateSet('start', 'web', 'android', 'ios', 'check', 'build:web', 'build:native', 'format', 'install')]
  [string]$Task = 'web'
)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$candidates = @(
  $(if ($nodeCommand) { $nodeCommand.Source }),
  (Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe')
)
$runtime = $null
foreach ($candidate in $candidates) {
  if ($candidate -and (Test-Path -LiteralPath $candidate)) {
    $runtimeVersion = [version]((& $candidate --version).TrimStart('v'))
    if (($runtimeVersion.Major -eq 22 -and $runtimeVersion.Minor -ge 13) -or ($runtimeVersion.Major -eq 24 -and $runtimeVersion.Minor -ge 3) -or $runtimeVersion.Major -ge 25) {
      $runtime = $candidate
      break
    }
  }
}
if (-not $runtime) { throw 'Instale Node.js 24 LTS ou Node.js 22.13+ antes de executar o KORA.' }
$npmCandidates = @(
  (Join-Path (Split-Path $runtime -Parent) 'node_modules\npm\bin\npm-cli.js'),
  (Join-Path $env:ProgramFiles 'nodejs\node_modules\npm\bin\npm-cli.js')
)
$npmCli = $npmCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $npmCli) { throw 'npm nao encontrado. Reinstale a distribuicao Node.js LTS.' }
$env:Path = (Split-Path $runtime -Parent) + ';' + $env:Path
$env:npm_config_cache = Join-Path (Get-Location) '.npm-cache'
Write-Host ('KORA - Node ' + (& $runtime --version))
if ($Task -eq 'install') { & $runtime $npmCli ci } else { & $runtime $npmCli run $Task }
exit $LASTEXITCODE
