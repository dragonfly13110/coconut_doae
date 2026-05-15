$session = 'E:\coding\coconut_doae\.superpowers\brainstorm\ui-charts-20260515'
New-Item -ItemType Directory -Force -Path "$session\content", "$session\state" | Out-Null
$env:BRAINSTORM_DIR = $session
$env:BRAINSTORM_HOST = '127.0.0.1'
$env:BRAINSTORM_URL_HOST = 'localhost'
Start-Process -FilePath 'node' `
  -ArgumentList @('C:\Users\TOR_HOME\.codex\plugins\cache\openai-curated\superpowers\b8edb371\skills\brainstorming\scripts\server.cjs') `
  -WindowStyle Hidden
Start-Sleep -Seconds 1
Get-Content -LiteralPath "$session\state\server-info"
