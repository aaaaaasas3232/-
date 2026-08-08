$content = Get-Content 'c:\Users\Administrator\Desktop\小听启动\js\apps\chat-app\index.js' -Raw
$lines = $content -split "`r?`n"
Write-Host ('LINES=' + $lines.Count)
$lines[2208..2215]