$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$serviceUrl = 'http://127.0.0.1:3210/api/'
$listener = @(Get-NetTCPConnection -LocalPort 3210 -State Listen)
if ($listener.Count -ne 1) { throw 'Expected exactly one local service listener.' }
$serviceProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener[0].OwningProcess)"
if ($serviceProcess.Name -ne 'node.exe' -or $serviceProcess.CommandLine -notmatch 'server\.js') { throw 'The listener is not the expected Node server.' }
$snapshot = Invoke-RestMethod ($serviceUrl + 'state')
$snapshotFile = Join-Path $projectRoot 'data/runtime-restart.json'
# Pause scheduling and close the collector cleanly before replacing the process.
Invoke-RestMethod ($serviceUrl + 'run') -Method Post -ContentType 'application/json' -Body '{"running":false}' | Out-Null
$settled = Invoke-RestMethod ($serviceUrl + 'state')
$settled.running = $snapshot.running
$settled.connection = $snapshot.connection
$settled.effect = $null
if ($snapshot.effect -and $snapshot.effect.giftId -and $snapshot.effect.expiresAt -gt [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) {
  $interruptedOrder = @($settled.danceQueue | Where-Object { $_.giftId -eq $snapshot.effect.giftId })
  if ($interruptedOrder.Count) { $interruptedOrder[0].remaining++ }
  else { $settled.danceQueue = @([pscustomobject]@{giftId=$snapshot.effect.giftId;user=$snapshot.effect.user;source=$snapshot.effect.source;remaining=1;receivedAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()}) + @($settled.danceQueue) }
}
$settled | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $snapshotFile -Encoding utf8
Invoke-RestMethod ($serviceUrl + 'disconnect') -Method Post -ContentType 'application/json' -Body '{}' | Out-Null
Stop-Process -Id $serviceProcess.ProcessId
$nodePath = (Get-Command node.exe).Source
Start-Process -FilePath $nodePath -ArgumentList @('server.js','--resume') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $projectRoot 'output/server-resume.log') -RedirectStandardError (Join-Path $projectRoot 'output/server-resume-error.log')
for ($attempt = 0; $attempt -lt 150; $attempt++) {
  Start-Sleep -Milliseconds 500
  try {
    $restored = Invoke-RestMethod ($serviceUrl + 'state')
    if ($restored.running -ne $snapshot.running) { throw 'Running state has not been restored.' }
    if ($snapshot.connection -ne 'disconnected' -and $restored.connection -notin @('watching','receiving')) {
      throw ('Service is available, but the live room listener is not ready yet: {0}' -f $restored.connectionDetail)
    }
    Write-Output ('Restored service: running={0}; connection={1}; waitingSongs={2}; replies={3}' -f $restored.running,$restored.connection,$restored.songs.Count,$restored.stats.replies)
    exit 0
  } catch { if ($attempt -eq 149) { throw } }
}
